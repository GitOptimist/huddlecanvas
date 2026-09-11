import assert from "node:assert/strict";
import test from "node:test";

import { newDb } from "pg-mem";
import type { Pool } from "pg";

import { PostgresBoardRepository } from "./postgres-repository.ts";
import {
  RepositoryConflictError,
  RepositoryIdentityConflictError,
} from "./repository.ts";

function repositoryFixture() {
  const database = newDb({ autoCreateForeignKeyIndices: true });
  const adapter = database.adapters.createPg();
  const pool = new adapter.Pool() as unknown as Pool;
  const repository = new PostgresBoardRepository(pool, {
    migrate: true,
    closePool: true,
  });
  return { repository, pool };
}

test("PostgreSQL schema migration is idempotent", async () => {
  const { repository } = repositoryFixture();
  try {
    await repository.initialize();
    await repository.initialize();
  } finally {
    await repository.close();
  }
});

test("PostgreSQL repository supports identity, boards, conflicts, and recovery", async () => {
  const { repository } = repositoryFixture();
  try {
    const user = await repository.upsertUser({
      externalSubject: "https://identity.example.test|person-1",
      email: "person@example.com",
      displayName: "First Name",
    });
    const repeated = await repository.upsertUser({
      externalSubject: "https://identity.example.test|person-1",
      email: "person@example.com",
      displayName: "Updated Name",
    });
    assert.equal(repeated.id, user.id);
    assert.equal(repeated.displayName, "Updated Name");
    await assert.rejects(
      repository.upsertUser({
        externalSubject: "https://identity.example.test|different-person",
        email: "person@example.com",
        displayName: "Wrong Account",
      }),
      RepositoryIdentityConflictError,
    );

    const access = await repository.ensurePersonalWorkspace(repeated);
    const repeatedAccess = await repository.ensurePersonalWorkspace(repeated);
    assert.equal(repeatedAccess.workspace.id, access.workspace.id);
    assert.equal(access.role, "owner");

    const board = await repository.createBoard({
      workspaceId: access.workspace.id,
      title: "PostgreSQL board",
      actorId: user.id,
    });
    const changed = structuredClone(board.document);
    changed.title = "Saved on PostgreSQL";
    changed.generation += 1;
    const saved = await repository.saveBoard({
      boardId: board.id,
      expectedRevision: 1,
      document: changed,
      actorId: user.id,
      reason: "Integration test",
    });
    assert.equal(saved.revision, 2);
    assert.equal(saved.title, "Saved on PostgreSQL");

    await assert.rejects(
      repository.saveBoard({
        boardId: board.id,
        expectedRevision: 1,
        document: changed,
        actorId: user.id,
        reason: "Stale save",
      }),
      (error: unknown) =>
        error instanceof RepositoryConflictError && error.currentRevision === 2,
    );

    const versions = await repository.listVersions(board.id);
    assert.deepEqual(
      versions.map((version) => version.revision),
      [2, 1],
    );
    const restored = await repository.restoreVersion({
      boardId: board.id,
      versionId: versions[1]!.id,
      actorId: user.id,
    });
    assert.equal(restored.revision, 3);
    assert.equal(restored.title, "PostgreSQL board");

    const reopened = await repository.boardAccess(board.id, user.id);
    assert.equal(reopened.board.revision, 3);
    assert.equal(reopened.role, "owner");
  } finally {
    await repository.close();
  }
});
