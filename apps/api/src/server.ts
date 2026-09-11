import {
  AuthorizationError,
  assertCapability,
  capabilitiesFor,
  type Capability,
  type Role,
} from "@huddlecanvas/authz";
import { assertBoardDocument } from "@huddlecanvas/board-schema";
import Fastify, { type FastifyRequest } from "fastify";

import {
  AuthenticationError,
  type IdentityVerifier,
  SessionSigner,
  requireIdentity,
  type ExternalIdentity,
  type SessionIdentity,
} from "./auth.ts";
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
  repository: BoardRepositoryPort,
): Promise<SessionIdentity> {
  const verified = await requireIdentity(request, verifier);
  if (!isExternalIdentity(verified)) return verified;
  const user = await repository.upsertUser({
    externalSubject: verified.externalSubject,
    email: verified.email,
    displayName: verified.displayName,
  });
  await repository.ensurePersonalWorkspace(user);
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
  const server = Fastify({
    logger: options.logger ?? process.env.NODE_ENV !== "test",
  });

  server.addHook("onReady", async () => repository.initialize());
  server.addHook("onClose", async () => repository.close());

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

  server.get("/v1/meta", async () => ({
    milestone: "M3.3-deployable-identity-persistence",
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
        identityVerifier.kind === "oidc" ||
        identityVerifier.kind === "composite",
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
    const identity = await identityFor(request, identityVerifier, repository);
    const workspaces = await repository.listWorkspacesForUser(identity.userId);
    return { identity, workspaces };
  });

  server.get("/v1/workspaces", async (request) => {
    const identity = await identityFor(request, identityVerifier, repository);
    return {
      workspaces: await repository.listWorkspacesForUser(identity.userId),
    };
  });

  server.get<{ Params: { workspaceId: string } }>(
    "/v1/workspaces/:workspaceId/boards",
    async (request) => {
      const identity = await identityFor(request, identityVerifier, repository);
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
    const identity = await identityFor(request, identityVerifier, repository);
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
      const identity = await identityFor(request, identityVerifier, repository);
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
      const identity = await identityFor(request, identityVerifier, repository);
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
      const identity = await identityFor(request, identityVerifier, repository);
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
      const identity = await identityFor(request, identityVerifier, repository);
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

  return server;
}
