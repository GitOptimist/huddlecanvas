import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import type { BoardDocument } from "@huddlecanvas/board-schema";

import {
  AuthenticationError,
  SessionSigner,
  type IdentityVerifier,
} from "./auth.ts";
import type { BrowserOidcClient } from "./browser-oidc.ts";
import {
  BoardRepository,
  JsonFileStorage,
  MemoryStorage,
} from "./repository.ts";
import { DEVELOPMENT_SECRET, buildServer } from "./server.ts";

interface SessionResponse {
  token: string;
  session: { user: { id: string; email: string; displayName: string } };
}

interface WorkspaceResponse {
  workspaces: Array<{
    workspace: { id: string; name: string };
    role: string;
  }>;
}

interface BoardListResponse {
  role: string;
  boards: Array<{ id: string; revision: number; title: string }>;
}

interface BoardResponse {
  board: {
    id: string;
    revision: number;
    title: string;
    document: BoardDocument;
  };
  role?: string;
}

interface VersionsResponse {
  versions: Array<{
    id: string;
    revision: number;
    reason: string;
  }>;
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

function firstCookie(
  value: string | string[] | undefined,
  name: string,
): string {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  const selected = values.find((item) => item.startsWith(`${name}=`));
  assert.ok(selected, `Expected ${name} cookie`);
  return selected.split(";", 1)[0]!;
}

async function signIn(
  server: ReturnType<typeof buildServer>,
  email: string,
  displayName: string,
): Promise<SessionResponse> {
  const response = await server.inject({
    method: "POST",
    url: "/v1/auth/dev-session",
    payload: { email, displayName },
  });
  assert.equal(response.statusCode, 201, response.body);
  return response.json<SessionResponse>();
}

test("signed sessions reject tampering and expiration", () => {
  const signer = new SessionSigner(DEVELOPMENT_SECRET, 60);
  const issuedAt = Date.UTC(2026, 8, 10, 12, 0, 0);
  const token = signer.issue(
    {
      userId: "user-1",
      email: "alex@example.com",
      displayName: "Alex",
    },
    issuedAt,
  );
  assert.equal(signer.verify(token, issuedAt + 30_000).userId, "user-1");
  assert.throws(
    () => signer.verify(`${token.slice(0, -1)}x`, issuedAt + 30_000),
    AuthenticationError,
  );
  assert.throws(
    () => signer.verify(token, issuedAt + 61_000),
    AuthenticationError,
  );
});

test("authenticated owner can save, reopen, version, and recover a board", async () => {
  const repository = new BoardRepository(new MemoryStorage());
  const signer = new SessionSigner(DEVELOPMENT_SECRET);
  const server = buildServer({
    repository,
    signer,
    allowDevAuth: true,
    logger: false,
  });
  await server.ready();

  const session = await signIn(server, "alex@example.com", "Alex Rivera");
  const headers = bearer(session.token);

  const workspaceResult = await server.inject({
    method: "GET",
    url: "/v1/workspaces",
    headers,
  });
  assert.equal(workspaceResult.statusCode, 200);
  const workspaces = workspaceResult.json<WorkspaceResponse>();
  assert.equal(workspaces.workspaces.length, 1);
  assert.equal(workspaces.workspaces[0]?.role, "owner");
  const workspaceId = workspaces.workspaces[0]?.workspace.id;
  assert.ok(workspaceId);

  const listResult = await server.inject({
    method: "GET",
    url: `/v1/workspaces/${workspaceId}/boards`,
    headers,
  });
  const list = listResult.json<BoardListResponse>();
  assert.equal(list.role, "owner");
  assert.equal(list.boards.length, 1);
  const boardId = list.boards[0]?.id;
  assert.ok(boardId);

  const openResult = await server.inject({
    method: "GET",
    url: `/v1/boards/${boardId}`,
    headers,
  });
  assert.equal(openResult.statusCode, 200);
  const opened = openResult.json<BoardResponse>();
  const changed = structuredClone(opened.board.document);
  changed.title = "Durable planning board";
  changed.generation += 1;

  const saveResult = await server.inject({
    method: "PUT",
    url: `/v1/boards/${boardId}`,
    headers,
    payload: {
      expectedRevision: opened.board.revision,
      document: changed,
      reason: "Renamed board",
    },
  });
  assert.equal(saveResult.statusCode, 200, saveResult.body);
  const saved = saveResult.json<BoardResponse>();
  assert.equal(saved.board.revision, 2);
  assert.equal(saved.board.title, "Durable planning board");

  const staleResult = await server.inject({
    method: "PUT",
    url: `/v1/boards/${boardId}`,
    headers,
    payload: {
      expectedRevision: 1,
      document: changed,
      reason: "Stale autosave",
    },
  });
  assert.equal(staleResult.statusCode, 409);

  const versionResult = await server.inject({
    method: "GET",
    url: `/v1/boards/${boardId}/versions`,
    headers,
  });
  const versions = versionResult.json<VersionsResponse>();
  assert.deepEqual(
    versions.versions.map((version) => version.revision),
    [2, 1],
  );
  const initialVersion = versions.versions.find(
    (version) => version.revision === 1,
  );
  assert.ok(initialVersion);

  const restoreResult = await server.inject({
    method: "POST",
    url: `/v1/boards/${boardId}/versions/${initialVersion.id}/restore`,
    headers,
  });
  assert.equal(restoreResult.statusCode, 200, restoreResult.body);
  const restored = restoreResult.json<BoardResponse>();
  assert.equal(restored.board.revision, 3);
  assert.equal(restored.board.title, "My first hosted board");

  const reopenedResult = await server.inject({
    method: "GET",
    url: `/v1/boards/${boardId}`,
    headers,
  });
  const reopened = reopenedResult.json<BoardResponse>();
  assert.equal(reopened.board.title, "My first hosted board");
  assert.equal(reopened.board.revision, 3);

  await server.close();
});

test("API mutations enforce workspace roles", async () => {
  const repository = new BoardRepository(new MemoryStorage());
  const signer = new SessionSigner(DEVELOPMENT_SECRET);
  const server = buildServer({
    repository,
    signer,
    allowDevAuth: true,
    logger: false,
  });
  await server.ready();

  const owner = await signIn(server, "owner@example.com", "Owner");
  const viewer = await signIn(server, "viewer@example.com", "Viewer");
  const ownerWorkspaces = await repository.listWorkspacesForUser(
    owner.session.user.id,
  );
  const workspaceId = ownerWorkspaces[0]?.workspace.id;
  assert.ok(workspaceId);
  await repository.setMembership({
    workspaceId,
    userId: viewer.session.user.id,
    role: "viewer",
  });
  const boards = await repository.listBoards(workspaceId);
  const board = boards[0];
  assert.ok(board);

  const readResult = await server.inject({
    method: "GET",
    url: `/v1/boards/${board.id}`,
    headers: bearer(viewer.token),
  });
  assert.equal(readResult.statusCode, 200);

  const editResult = await server.inject({
    method: "PUT",
    url: `/v1/boards/${board.id}`,
    headers: bearer(viewer.token),
    payload: {
      expectedRevision: board.revision,
      document: board.document,
      reason: "Viewer edit",
    },
  });
  assert.equal(editResult.statusCode, 403);

  const restoreResult = await server.inject({
    method: "POST",
    url: `/v1/boards/${board.id}/versions/not-a-version/restore`,
    headers: bearer(viewer.token),
  });
  assert.equal(restoreResult.statusCode, 403);

  const anonymousResult = await server.inject({
    method: "GET",
    url: `/v1/boards/${board.id}`,
  });
  assert.equal(anonymousResult.statusCode, 401);

  await server.close();
});

test("external identities are provisioned into one stable personal workspace", async () => {
  const repository = new BoardRepository(new MemoryStorage());
  const identityVerifier: IdentityVerifier = {
    kind: "oidc",
    async verify() {
      return {
        externalSubject: "https://identity.example.test|subject-42",
        email: "external@example.com",
        displayName: "External User",
      };
    },
  };
  const server = buildServer({
    repository,
    identityVerifier,
    allowDevAuth: false,
    logger: false,
  });
  await server.ready();

  const first = await server.inject({
    method: "GET",
    url: "/v1/session",
    headers: bearer("provider-token"),
  });
  const second = await server.inject({
    method: "GET",
    url: "/v1/session",
    headers: bearer("provider-token"),
  });
  assert.equal(first.statusCode, 200, first.body);
  assert.equal(second.statusCode, 200, second.body);
  const firstSession = first.json<{
    identity: { userId: string };
    workspaces: WorkspaceResponse["workspaces"];
  }>();
  const secondSession = second.json<{
    identity: { userId: string };
    workspaces: WorkspaceResponse["workspaces"];
  }>();
  assert.equal(firstSession.identity.userId, secondSession.identity.userId);
  assert.equal(firstSession.workspaces.length, 1);
  assert.equal(secondSession.workspaces.length, 1);
  assert.equal(
    firstSession.workspaces[0]?.workspace.id,
    secondSession.workspaces[0]?.workspace.id,
  );

  const meta = await server.inject({ method: "GET", url: "/v1/meta" });
  assert.equal(meta.json().boundaries.externalIdentityProvider, true);
  await server.close();
});

test("browser OIDC creates a secure cookie session and enforces request origin", async () => {
  const now = Date.now();
  const oidc: BrowserOidcClient = {
    async createAuthorizationRequest(input) {
      assert.equal(
        input.redirectUri,
        "https://staging.huddlecanvas.test/api/v1/auth/callback",
      );
      assert.equal(input.returnTo, "/boards/one");
      return {
        url: "https://identity.example.test/authorize?request=one",
        transaction: {
          state: "state-1",
          nonce: "nonce-1",
          codeVerifier: "verifier-1",
          returnTo: input.returnTo,
          createdAt: now,
        },
      };
    },
    async completeAuthorization(input) {
      assert.equal(
        input.callbackUrl,
        "https://staging.huddlecanvas.test/api/v1/auth/callback?code=code-1&state=state-1",
      );
      assert.equal(input.transaction.state, "state-1");
      return {
        externalSubject: "https://identity.example.test|subject-1",
        email: "oidc@example.com",
        displayName: "OIDC User",
      };
    },
  };
  const server = buildServer({
    repository: new BoardRepository(new MemoryStorage()),
    signer: new SessionSigner("staging-session-secret-12345"),
    transactionSecret: "staging-transaction-secret-12345",
    browserOidc: oidc,
    publicOrigin: "https://staging.huddlecanvas.test",
    secureCookies: true,
    allowDevAuth: false,
    logger: false,
  });
  await server.ready();

  const config = await server.inject({
    method: "GET",
    url: "/api/v1/auth/config",
  });
  assert.equal(config.statusCode, 200);
  assert.equal(config.json().mode, "oidc");

  const login = await server.inject({
    method: "GET",
    url: "/api/v1/auth/login?returnTo=%2Fboards%2Fone",
  });
  assert.equal(login.statusCode, 302, login.body);
  assert.equal(
    login.headers.location,
    "https://identity.example.test/authorize?request=one",
  );
  const transactionCookie = firstCookie(
    login.headers["set-cookie"],
    "huddlecanvas_oidc_transaction",
  );

  const callback = await server.inject({
    method: "GET",
    url: "/api/v1/auth/callback?code=code-1&state=state-1",
    headers: { cookie: transactionCookie },
  });
  assert.equal(callback.statusCode, 302, callback.body);
  assert.equal(
    callback.headers.location,
    "https://staging.huddlecanvas.test/boards/one",
  );
  const sessionCookie = firstCookie(
    callback.headers["set-cookie"],
    "__Host-huddlecanvas_session",
  );

  const session = await server.inject({
    method: "GET",
    url: "/api/v1/session",
    headers: { cookie: sessionCookie },
  });
  assert.equal(session.statusCode, 200, session.body);
  assert.equal(session.json().identity.email, "oidc@example.com");
  assert.equal(session.json().workspaces.length, 1);

  const rejectedLogout = await server.inject({
    method: "POST",
    url: "/api/v1/auth/logout",
    headers: { cookie: sessionCookie, origin: "https://attacker.example" },
  });
  assert.equal(rejectedLogout.statusCode, 403);

  const logout = await server.inject({
    method: "POST",
    url: "/api/v1/auth/logout",
    headers: {
      cookie: sessionCookie,
      origin: "https://staging.huddlecanvas.test",
    },
  });
  assert.equal(logout.statusCode, 204, logout.body);
  assert.match(
    String(logout.headers["set-cookie"]),
    /__Host-huddlecanvas_session=; Path=\/; Max-Age=0/,
  );

  await server.close();
});

test("production server serves the web build and keeps unknown API routes as JSON", async () => {
  const directory = await mkdtemp(
    join(process.cwd(), ".huddlecanvas-web-test-"),
  );
  try {
    await mkdir(join(directory, "assets"));
    await writeFile(
      join(directory, "index.html"),
      "<!doctype html><h1>Hosted</h1>",
    );
    await writeFile(
      join(directory, "assets", "app.js"),
      "console.log('hosted')",
    );
    const server = buildServer({
      repository: new BoardRepository(new MemoryStorage()),
      staticDirectory: directory,
      logger: false,
    });
    await server.ready();

    const root = await server.inject({ method: "GET", url: "/" });
    assert.equal(root.statusCode, 200, root.body);
    assert.match(root.headers["content-type"] ?? "", /^text\/html/);
    assert.match(root.body, /Hosted/);

    const asset = await server.inject({ method: "GET", url: "/assets/app.js" });
    assert.equal(asset.statusCode, 200, asset.body);
    assert.equal(
      asset.headers["cache-control"],
      "public, max-age=31536000, immutable",
    );

    const clientRoute = await server.inject({
      method: "GET",
      url: "/boards/one",
    });
    assert.equal(clientRoute.statusCode, 200, clientRoute.body);
    assert.match(clientRoute.body, /Hosted/);

    const missingApi = await server.inject({
      method: "GET",
      url: "/api/v1/missing",
    });
    assert.equal(missingApi.statusCode, 404);
    assert.equal(missingApi.json().error, "not_found");

    await server.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("file storage survives a repository restart", async () => {
  const directory = await mkdtemp(
    join(process.cwd(), ".huddlecanvas-store-test-"),
  );
  const file = join(directory, "store.json");
  try {
    const first = new BoardRepository(new JsonFileStorage(file));
    const user = await first.upsertUser({
      email: "durable@example.com",
      displayName: "Durable User",
    });
    const access = await first.ensurePersonalWorkspace(user);
    const created = await first.createBoard({
      workspaceId: access.workspace.id,
      title: "Persisted board",
      actorId: user.id,
    });

    const second = new BoardRepository(new JsonFileStorage(file));
    await second.initialize();
    const reopened = await second.boardAccess(created.id, user.id);
    assert.equal(reopened.board.title, "Persisted board");
    assert.equal(reopened.board.revision, 1);

    const raw = JSON.parse(await readFile(file, "utf8")) as {
      schemaVersion: number;
    };
    assert.equal(raw.schemaVersion, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("file storage upgrades M3.2 schema version one automatically", async () => {
  const directory = await mkdtemp(
    join(process.cwd(), ".huddlecanvas-upgrade-test-"),
  );
  const file = join(directory, "store.json");
  try {
    await writeFile(
      file,
      JSON.stringify({
        schemaVersion: 1,
        users: [],
        workspaces: [],
        memberships: [],
        boards: [],
        versions: [],
      }),
      "utf8",
    );
    const repository = new BoardRepository(new JsonFileStorage(file));
    await repository.initialize();
    const upgraded = JSON.parse(await readFile(file, "utf8")) as {
      schemaVersion: number;
    };
    assert.equal(upgraded.schemaVersion, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
