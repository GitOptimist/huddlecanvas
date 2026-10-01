import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { newDb } from "pg-mem";
import type { Pool } from "pg";
import {
  BoardRepository,
  JsonFileStorage,
  MemoryStorage,
  RepositoryConflictError,
} from "./repository.ts";
import { PostgresBoardRepository } from "./postgres-repository.ts";
import { SessionSigner } from "./auth.ts";
import { buildServer, DEVELOPMENT_SECRET } from "./server.ts";

const workspace = () => ({
  version: 8,
  currentBoardId: "board-one",
  branding: { company: "GETITECH" },
  boards: [
    {
      id: "board-one",
      title: "Original board",
      ops: [{ type: "stroke", points: [{ x: 1, y: 2 }] }],
      items: [{ type: "sticky", text: "Keep me" }],
      media: [{ src: "data:image/png;base64,test" }],
      versions: [],
    },
  ],
});

test("classic API requires auth, isolates accounts, validates payloads and rejects stale saves", async () => {
  const server = buildServer({
    repository: new BoardRepository(new MemoryStorage()),
    signer: new SessionSigner(DEVELOPMENT_SECRET),
    allowDevAuth: true,
    logger: false,
  });
  try {
    assert.equal(
      (await server.inject({ method: "GET", url: "/api/v1/classic-workspace" }))
        .statusCode,
      401,
    );
    async function headers(email: string) {
      const login = await server.inject({
        method: "POST",
        url: "/v1/auth/dev-session",
        payload: { email, displayName: "Test" },
      });
      return { authorization: `Bearer ${login.json().token}` };
    }
    const a = await headers("a@example.com"),
      b = await headers("b@example.com");
    const save = (expectedRevision: number, data: unknown = workspace()) =>
      server.inject({
        method: "PUT",
        url: "/api/v1/classic-workspace",
        headers: a,
        payload: { expectedRevision, workspace: data },
      });
    const first = await save(0);
    assert.equal(first.statusCode, 200, first.body);
    assert.deepEqual(first.json(), { revision: 1, workspace: workspace() });
    assert.equal(first.headers["cache-control"], "no-store");
    assert.deepEqual(
      (
        await server.inject({
          method: "GET",
          url: "/v1/classic-workspace",
          headers: b,
        })
      ).json(),
      { revision: 0, workspace: null },
    );
    assert.equal((await save(0)).statusCode, 409);
    assert.equal((await save(1, { version: 8, boards: [] })).statusCode, 400);
    assert.equal((await save(-1)).statusCode, 400);
    assert.equal((await save(1)).json().revision, 2);
  } finally {
    await server.close();
  }
});

test("classic workspaces survive file repository restart without dropping original objects", async () => {
  const directory = await mkdtemp(join(process.cwd(), ".data-classic-"));
  try {
    const path = join(directory, "state.json");
    const first = new BoardRepository(new JsonFileStorage(path));
    const user = await first.upsertUser({
      externalSubject: "classic-file",
      email: "file@example.com",
      displayName: "File",
    });
    await first.saveClassicWorkspace(user.id, 0, workspace());
    const reopened = new BoardRepository(new JsonFileStorage(path));
    assert.deepEqual(await reopened.getClassicWorkspace(user.id), {
      revision: 1,
      workspace: workspace(),
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Postgres classic workspace updates use atomic revisions and account isolation", async () => {
  const adapter = newDb().adapters.createPg();
  const repository = new PostgresBoardRepository(
    new adapter.Pool() as unknown as Pool,
    { migrate: true, closePool: true },
  );
  try {
    const user = await repository.upsertUser({
      externalSubject: "classic-pg",
      email: "pg@example.com",
      displayName: "PG",
    });
    await repository.saveClassicWorkspace(user.id, 0, workspace());
    const results = await Promise.allSettled([
      repository.saveClassicWorkspace(user.id, 1, workspace()),
      repository.saveClassicWorkspace(user.id, 1, workspace()),
    ]);
    assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
    const failure = results.find((x) => x.status === "rejected");
    assert.ok(
      failure?.status === "rejected" &&
        failure.reason instanceof RepositoryConflictError,
    );
    assert.deepEqual(await repository.getClassicWorkspace(user.id), {
      revision: 2,
      workspace: workspace(),
    });
    assert.deepEqual(await repository.getClassicWorkspace("other-user"), {
      revision: 0,
      workspace: null,
    });
  } finally {
    await repository.close();
  }
});
