import {
  AuthorizationError,
  assertCapability,
  capabilitiesFor,
  type Capability,
  type Role,
} from "@huddlecanvas/authz";
import { assertBoardDocument } from "@huddlecanvas/board-schema";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

import {
  AuthenticationError,
  type IdentityVerifier,
  SessionSigner,
  requireIdentity,
  type ExternalIdentity,
  type SessionIdentity,
} from "./auth.ts";
import {
  OidcTransactionCodec,
  safeReturnTo,
  type BrowserOidcClient,
} from "./browser-oidc.ts";
import {
  BoardRepository,
  MemoryStorage,
  RepositoryConflictError,
  RepositoryIdentityConflictError,
  RepositoryNotFoundError,
  type BoardAccess,
  type BoardRepositoryPort,
} from "./repository.ts";

export const DEVELOPMENT_SECRET = "huddlecanvas-local-development-only";

interface BuildServerOptions {
  repository?: BoardRepositoryPort;
  signer?: SessionSigner;
  identityVerifier?: IdentityVerifier;
  browserOidc?: BrowserOidcClient;
  publicOrigin?: string;
  oidcCallbackPath?: string;
  transactionSecret?: string;
  staticDirectory?: string;
  secureCookies?: boolean;
  allowDevAuth?: boolean;
  logger?: boolean;
}

interface DevSessionBody {
  email?: unknown;
  displayName?: unknown;
}

interface CreateBoardBody {
  title?: unknown;
}

interface SaveBoardBody {
  expectedRevision?: unknown;
  document?: unknown;
  reason?: unknown;
}

class RequestValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

const SESSION_COOKIE = "huddlecanvas_session";
const SECURE_SESSION_COOKIE = "__Host-huddlecanvas_session";
const TRANSACTION_COOKIE = "huddlecanvas_oidc_transaction";

function cookieValues(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator < 1) return [];
      const name = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      try {
        return [[name, decodeURIComponent(value)]];
      } catch {
        return [];
      }
    }),
  );
}

function cookie(
  name: string,
  value: string,
  options: {
    maxAge: number;
    path: string;
    secure: boolean;
  },
): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
    options.secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function mimeType(path: string): string {
  return (
    {
      ".css": "text/css; charset=utf-8",
      ".html": "text/html; charset=utf-8",
      ".ico": "image/x-icon",
      ".js": "text/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
    }[extname(path).toLowerCase()] ?? "application/octet-stream"
  );
}

function callbackUrl(
  publicOrigin: URL,
  callbackPath: string,
  requestUrl = "",
): string {
  const queryIndex = requestUrl.indexOf("?");
  const query = queryIndex >= 0 ? requestUrl.slice(queryIndex) : "";
  return new URL(`${callbackPath}${query}`, publicOrigin).href;
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new RequestValidationError(`${field} is required.`);
  }
  return value.trim();
}

async function workspaceRole(
  repository: BoardRepositoryPort,
  workspaceId: string,
  identity: SessionIdentity,
  capability: Capability,
): Promise<Role> {
  const membership = await repository.membership(workspaceId, identity.userId);
  if (!membership) {
    throw new RepositoryNotFoundError(
      `Workspace '${workspaceId}' was not found.`,
    );
  }
  assertCapability(membership.role, capability);
  return membership.role;
}

async function authorizedBoard(
  repository: BoardRepositoryPort,
  boardId: string,
  identity: SessionIdentity,
  capability: Capability,
): Promise<BoardAccess> {
  const access = await repository.boardAccess(boardId, identity.userId);
  assertCapability(access.role, capability);
  return access;
}

function isExternalIdentity(
  identity: SessionIdentity | ExternalIdentity,
): identity is ExternalIdentity {
  return "externalSubject" in identity;
}

async function identityFor(
  request: FastifyRequest,
  verifier: IdentityVerifier,
  signer: SessionSigner,
  sessionCookieName: string,
  repository: BoardRepositoryPort,
): Promise<SessionIdentity> {
  const sessionToken = cookieValues(request.headers.cookie)[sessionCookieName];
  const verified = sessionToken
    ? signer.verify(sessionToken)
    : await requireIdentity(request, verifier);
  if (!isExternalIdentity(verified)) return verified;
  return provisionExternalIdentity(repository, verified);
}

async function provisionExternalIdentity(
  repository: BoardRepositoryPort,
  identity: ExternalIdentity,
): Promise<SessionIdentity> {
  const user = await repository.upsertUser({
    externalSubject: identity.externalSubject,
    email: identity.email,
    displayName: identity.displayName,
  });
  const access = await repository.ensurePersonalWorkspace(user);
  const existing = await repository.listBoards(access.workspace.id);
  if (!existing.length) {
    await repository.createBoard({
      workspaceId: access.workspace.id,
      title: "My first hosted board",
      actorId: user.id,
    });
  }
  return {
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}

export function buildServer(options: BuildServerOptions = {}) {
  const repository =
    options.repository ?? new BoardRepository(new MemoryStorage());
  const signer = options.signer ?? new SessionSigner(DEVELOPMENT_SECRET);
  const identityVerifier = options.identityVerifier ?? signer;
  const allowDevAuth = options.allowDevAuth ?? false;
  const browserOidc = options.browserOidc;
  const publicOrigin = options.publicOrigin
    ? new URL(options.publicOrigin)
    : undefined;
  if (Boolean(browserOidc) !== Boolean(publicOrigin)) {
    throw new Error(
      "Browser OIDC and the public application origin must be configured together.",
    );
  }
  if (browserOidc && !options.transactionSecret) {
    throw new Error("Browser OIDC requires a transaction signing secret.");
  }
  const callbackPath = options.oidcCallbackPath ?? "/api/v1/auth/callback";
  const secureCookies =
    options.secureCookies ?? publicOrigin?.protocol === "https:";
  const sessionCookieName = secureCookies
    ? SECURE_SESSION_COOKIE
    : SESSION_COOKIE;
  const transactionCodec = new OidcTransactionCodec(
    options.transactionSecret ?? DEVELOPMENT_SECRET,
  );
  const server = Fastify({
    logger: options.logger ?? process.env.NODE_ENV !== "test",
    rewriteUrl: (request) => {
      const url = request.url ?? "/";
      return url.startsWith("/api/") ? url.slice("/api".length) : url;
    },
  });

  server.addHook("onReady", async () => repository.initialize());
  server.addHook("onClose", async () => repository.close());
  server.addHook("onSend", async (_request, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "same-origin");
    reply.header("x-frame-options", "DENY");
    reply.header(
      "content-security-policy",
      "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    return payload;
  });
  server.addHook("onRequest", async (request, reply) => {
    if (
      !publicOrigin ||
      request.method === "GET" ||
      request.method === "HEAD" ||
      request.method === "OPTIONS" ||
      request.headers.authorization ||
      !cookieValues(request.headers.cookie)[sessionCookieName]
    ) {
      return;
    }
    if (request.headers.origin !== publicOrigin.origin) {
      return reply.code(403).send({
        error: "forbidden_origin",
        message: "This request did not originate from HuddleCanvas.",
      });
    }
  });

  server.setErrorHandler((error, _request, reply) => {
    const message =
      error instanceof Error
        ? error.message
        : "The request could not be completed.";
    if (error instanceof AuthenticationError) {
      return reply.code(401).send({ error: "unauthenticated", message });
    }
    if (error instanceof AuthorizationError) {
      return reply
        .code(403)
        .send({ error: "forbidden", message: error.message });
    }
    if (error instanceof RepositoryNotFoundError) {
      return reply
        .code(404)
        .send({ error: "not_found", message: error.message });
    }
    if (error instanceof RepositoryConflictError) {
      return reply.code(409).send({
        error: "revision_conflict",
        message: error.message,
        currentRevision: error.currentRevision,
      });
    }
    if (error instanceof RepositoryIdentityConflictError) {
      return reply.code(409).send({ error: "identity_conflict", message });
    }
    if (
      error instanceof RequestValidationError ||
      message.startsWith("Invalid HuddleCanvas board document") ||
      message.startsWith("Board document id")
    ) {
      return reply.code(400).send({ error: "invalid_request", message });
    }
    server.log.error(error);
    return reply.code(500).send({
      error: "internal_error",
      message: "The request could not be completed.",
    });
  });

  server.get("/health", async () => ({
    status: "ok",
    service: "huddlecanvas-api",
    persistence: repository.persistenceKind,
  }));

  server.get("/v1/auth/config", async () => ({
    mode: browserOidc ? "oidc" : allowDevAuth ? "development" : "unavailable",
  }));

  server.get<{ Querystring: { returnTo?: string } }>(
    "/v1/auth/login",
    async (request, reply) => {
      if (!browserOidc || !publicOrigin) {
        return reply.code(404).send({
          error: "not_found",
          message: "Hosted sign-in is not configured.",
        });
      }
      const redirectUri = new URL(callbackPath, publicOrigin).href;
      const authorization = await browserOidc.createAuthorizationRequest({
        redirectUri,
        returnTo: safeReturnTo(request.query.returnTo),
      });
      const transactionPath = callbackPath.slice(
        0,
        Math.max(callbackPath.lastIndexOf("/") + 1, 1),
      );
      reply.header(
        "set-cookie",
        cookie(
          TRANSACTION_COOKIE,
          transactionCodec.issue(authorization.transaction),
          {
            maxAge: 10 * 60,
            path: transactionPath,
            secure: Boolean(secureCookies),
          },
        ),
      );
      return reply.redirect(authorization.url);
    },
  );

  server.get("/v1/auth/callback", async (request, reply) => {
    if (!browserOidc || !publicOrigin) {
      return reply.code(404).send({
        error: "not_found",
        message: "Hosted sign-in is not configured.",
      });
    }
    const transactionPath = callbackPath.slice(
      0,
      Math.max(callbackPath.lastIndexOf("/") + 1, 1),
    );
    const clearTransaction = cookie(TRANSACTION_COOKIE, "", {
      maxAge: 0,
      path: transactionPath,
      secure: Boolean(secureCookies),
    });
    try {
      const encodedTransaction = cookieValues(request.headers.cookie)[
        TRANSACTION_COOKIE
      ];
      if (!encodedTransaction) {
        throw new AuthenticationError("The sign-in transaction is missing.");
      }
      const transaction = transactionCodec.verify(encodedTransaction);
      const redirectUri = new URL(callbackPath, publicOrigin).href;
      const externalIdentity = await browserOidc.completeAuthorization({
        callbackUrl: callbackUrl(publicOrigin, callbackPath, request.raw.url),
        redirectUri,
        transaction,
      });
      const identity = await provisionExternalIdentity(
        repository,
        externalIdentity,
      );
      reply.header("set-cookie", [
        cookie(sessionCookieName, signer.issue(identity), {
          maxAge: 8 * 60 * 60,
          path: "/",
          secure: Boolean(secureCookies),
        }),
        clearTransaction,
      ]);
      return reply.redirect(new URL(transaction.returnTo, publicOrigin).href);
    } catch (error) {
      request.log.warn({ error }, "OIDC callback failed");
      reply.header("set-cookie", clearTransaction);
      return reply.redirect(
        new URL("/?auth_error=login_failed", publicOrigin).href,
      );
    }
  });

  server.post("/v1/auth/logout", async (_request, reply) => {
    reply.header(
      "set-cookie",
      cookie(sessionCookieName, "", {
        maxAge: 0,
        path: "/",
        secure: Boolean(secureCookies),
      }),
    );
    return reply.code(204).send();
  });

  server.get("/v1/meta", async () => ({
    milestone: "M3.4-staging-authentication-deployment",
    schemaVersion: 1,
    capabilities: {
      owner: capabilitiesFor("owner"),
      editor: capabilitiesFor("editor"),
      commenter: capabilitiesFor("commenter"),
      viewer: capabilitiesFor("viewer"),
      "guest-session": capabilitiesFor("guest-session"),
    } satisfies Record<Role, string[]>,
    boundaries: {
      signedSessions: true,
      developmentBootstrap: allowDevAuth,
      durableStorage:
        repository.persistenceKind === "file" ||
        repository.persistenceKind === "postgresql",
      multiInstanceStorage: repository.persistenceKind === "postgresql",
      realtime: false,
      externalIdentityProvider:
        Boolean(browserOidc) ||
        identityVerifier.kind === "oidc" ||
        identityVerifier.kind === "composite",
      browserOidc: Boolean(browserOidc),
    },
  }));

  server.post<{ Body: DevSessionBody }>(
    "/v1/auth/dev-session",
    async (request, reply) => {
      if (!allowDevAuth) {
        return reply.code(404).send({
          error: "not_found",
          message: "Development sign-in is disabled.",
        });
      }
      const body = request.body ?? {};
      const email = requiredString(body.email, "Email").toLowerCase();
      const displayName = requiredString(body.displayName, "Display name");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new RequestValidationError("Enter a valid email address.");
      }
      const user = await repository.upsertUser({ email, displayName });
      const access = await repository.ensurePersonalWorkspace(user);
      const existing = await repository.listBoards(access.workspace.id);
      if (!existing.length) {
        await repository.createBoard({
          workspaceId: access.workspace.id,
          title: "My first hosted board",
          actorId: user.id,
        });
      }
      const token = signer.issue({
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
      });
      return reply.code(201).send({
        token,
        session: { user, expiresInSeconds: 8 * 60 * 60 },
      });
    },
  );

  server.get("/v1/session", async (request) => {
    const identity = await identityFor(
      request,
      identityVerifier,
      signer,
      sessionCookieName,
      repository,
    );
    const workspaces = await repository.listWorkspacesForUser(identity.userId);
    return { identity, workspaces };
  });

  server.get("/v1/workspaces", async (request) => {
    const identity = await identityFor(
      request,
      identityVerifier,
      signer,
      sessionCookieName,
      repository,
    );
    return {
      workspaces: await repository.listWorkspacesForUser(identity.userId),
    };
  });

  server.get<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId/boards",
    async (request) => {
      const identity = await identityFor(
        request,
        identityVerifier,
        signer,
        sessionCookieName,
        repository,
      );
      const role = await workspaceRole(
        repository,
        request.params.workspaceId,
        identity,
        "board.read",
      );
      const boards = await repository.listBoards(request.params.workspaceId);
      return {
        role,
        boards: boards.map(({ document: _document, ...metadata }) => metadata),
      };
    },
  );

  server.post<{
    Params: { workspaceId: string };
    Body: CreateBoardBody;
  }>("/v1/workspaces/:workspaceId/boards", async (request, reply) => {
    const identity = await identityFor(
      request,
      identityVerifier,
      signer,
      sessionCookieName,
      repository,
    );
    await workspaceRole(
      repository,
      request.params.workspaceId,
      identity,
      "board.edit",
    );
    const board = await repository.createBoard({
      workspaceId: request.params.workspaceId,
      title:
        typeof request.body?.title === "string"
          ? request.body.title
          : "Untitled board",
      actorId: identity.userId,
    });
    return reply.code(201).send({ board });
  });

  server.get<{ Params: { boardId: string } }>(
    "/v1/boards/:boardId",
    async (request) => {
      const identity = await identityFor(
        request,
        identityVerifier,
        signer,
        sessionCookieName,
        repository,
      );
      const access = await authorizedBoard(
        repository,
        request.params.boardId,
        identity,
        "board.read",
      );
      return { board: access.board, role: access.role };
    },
  );

  server.put<{ Params: { boardId: string }; Body: SaveBoardBody }>(
    "/v1/boards/:boardId",
    async (request) => {
      const identity = await identityFor(
        request,
        identityVerifier,
        signer,
        sessionCookieName,
        repository,
      );
      await authorizedBoard(
        repository,
        request.params.boardId,
        identity,
        "board.edit",
      );
      if (!Number.isInteger(request.body?.expectedRevision)) {
        throw new RequestValidationError(
          "expectedRevision must be an integer.",
        );
      }
      const document = assertBoardDocument(request.body.document);
      const reason =
        typeof request.body.reason === "string"
          ? request.body.reason.slice(0, 120)
          : "Autosave";
      const board = await repository.saveBoard({
        boardId: request.params.boardId,
        expectedRevision: request.body.expectedRevision as number,
        document,
        actorId: identity.userId,
        reason,
      });
      return { board };
    },
  );

  server.get<{ Params: { boardId: string } }>(
    "/v1/boards/:boardId/versions",
    async (request) => {
      const identity = await identityFor(
        request,
        identityVerifier,
        signer,
        sessionCookieName,
        repository,
      );
      await authorizedBoard(
        repository,
        request.params.boardId,
        identity,
        "board.read",
      );
      return {
        versions: await repository.listVersions(request.params.boardId),
      };
    },
  );

  server.post<{ Params: { boardId: string; versionId: string } }>(
    "/v1/boards/:boardId/versions/:versionId/restore",
    async (request) => {
      const identity = await identityFor(
        request,
        identityVerifier,
        signer,
        sessionCookieName,
        repository,
      );
      await authorizedBoard(
        repository,
        request.params.boardId,
        identity,
        "version.restore",
      );
      const board = await repository.restoreVersion({
        boardId: request.params.boardId,
        versionId: request.params.versionId,
        actorId: identity.userId,
      });
      return { board };
    },
  );

  if (options.staticDirectory) {
    const staticRoot = resolve(options.staticDirectory);
    const indexPath = resolve(staticRoot, "index.html");
    const serveWeb = async (request: FastifyRequest, reply: FastifyReply) => {
      const pathname = decodeURIComponent(
        new URL(request.raw.url ?? "/", "http://huddlecanvas.local").pathname,
      );
      if (
        pathname === "/health" ||
        pathname === "/v1" ||
        pathname.startsWith("/v1/")
      ) {
        return reply.code(404).send({
          error: "not_found",
          message: "The requested API route was not found.",
        });
      }
      const relative = pathname === "/" ? "index.html" : pathname.slice(1);
      const candidate = resolve(staticRoot, relative);
      const insideRoot =
        candidate === staticRoot || candidate.startsWith(`${staticRoot}${sep}`);
      let selected = indexPath;
      if (insideRoot) {
        try {
          if ((await stat(candidate)).isFile()) selected = candidate;
        } catch {
          // Client-side routes fall back to the application entry point.
        }
      }
      try {
        const body = await readFile(selected);
        const immutable =
          selected !== indexPath && pathname.startsWith("/assets/");
        reply.header(
          "cache-control",
          immutable ? "public, max-age=31536000, immutable" : "no-store",
        );
        return reply.type(mimeType(selected)).send(body);
      } catch {
        return reply.code(503).send({
          error: "web_unavailable",
          message: "The HuddleCanvas web build is unavailable.",
        });
      }
    };
    server.get("/", serveWeb);
    server.get("/*", serveWeb);
  }

  return server;
}
