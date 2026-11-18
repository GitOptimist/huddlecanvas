import assert from "node:assert/strict";
import test from "node:test";

import { newDb } from "pg-mem";
import type { Pool } from "pg";
import { assessLegacyV8 } from "@huddlecanvas/board-schema";

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
    changed.objects["sticky-one"] = {
      id: "sticky-one",
      type: "sticky",
      parentId: null,
      orderKey: "a0",
      transform: { x: 40, y: 50, rotation: 0, scaleX: 1, scaleY: 1 },
      size: { width: 220, height: 150 },
      locked: false,
      hidden: false,
      createdAt: "2000-01-01T00:00:00.000Z",
      createdBy: "attacker-controlled",
      updatedAt: "2000-01-01T00:00:00.000Z",
      updatedBy: "attacker-controlled",
      text: "Server-owned audit fields",
      color: "#fff2a8",
    };
    changed.rootOrder.push("sticky-one");
    const saved = await repository.saveBoard({
      boardId: board.id,
      expectedRevision: 1,
      document: changed,
      actorId: user.id,
      reason: "Integration test",
    });
    assert.equal(saved.revision, 2);
    assert.equal(saved.title, "Saved on PostgreSQL");
    assert.equal(saved.document.objects["sticky-one"]?.createdBy, user.id);
    assert.equal(saved.document.objects["sticky-one"]?.updatedBy, user.id);

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

test("concurrent identity provisioning never rebinds one email to another subject", async () => {
  const { repository } = repositoryFixture();
  try {
    await repository.initialize();
    const attempts = await Promise.allSettled([
      repository.upsertUser({
        externalSubject: "https://identity.example.test|concurrent-one",
        email: "concurrent@example.com",
        displayName: "Concurrent One",
      }),
      repository.upsertUser({
        externalSubject: "https://identity.example.test|concurrent-two",
        email: "concurrent@example.com",
        displayName: "Concurrent Two",
      }),
    ]);
    const accepted = attempts.filter(
      (
        attempt,
      ): attempt is PromiseFulfilledResult<
        Awaited<ReturnType<typeof repository.upsertUser>>
      > => attempt.status === "fulfilled",
    );
    const rejected = attempts.filter(
      (attempt): attempt is PromiseRejectedResult =>
        attempt.status === "rejected",
    );
    assert.equal(accepted.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(
      rejected[0]!.reason instanceof RepositoryIdentityConflictError,
      rejected[0]!.reason instanceof Error
        ? rejected[0]!.reason.stack
        : String(rejected[0]!.reason),
    );

    const winner = accepted[0]!.value;
    assert.ok(winner.externalSubject);
    const repeated = await repository.upsertUser({
      externalSubject: winner.externalSubject,
      email: "concurrent@example.com",
      displayName: "Established Identity",
    });
    assert.equal(repeated.id, winner.id);
  } finally {
    await repository.close();
  }
});

test("PostgreSQL stores an imported v8 board and initial version together", async () => {
  const { repository } = repositoryFixture();
  try {
    const user = await repository.upsertUser({
      externalSubject: "v8-import-user",
      email: "v8@example.com",
      displayName: "V8 User",
    });
    const access = await repository.ensurePersonalWorkspace(user);
    const assessment = assessLegacyV8(
      {
        version: 8,
        board: {
          id: "original",
          title: "Original v8",
          grid: true,
          background: "#fff",
          ops: [],
          items: [
            {
              id: "my-idea",
              type: "sticky",
              x: 100,
              y: 100,
              text: "Persist me",
              bg: "#fff2a8",
            },
          ],
          media: [],
          versions: [],
        },
      },
      { actorId: user.id },
    );
    assert.equal(assessment.canImport, true, JSON.stringify(assessment.issues));
    const board = await repository.createBoard({
      workspaceId: access.workspace.id,
      title: assessment.document.title,
      actorId: user.id,
      initialDocument: assessment.document,
    });
    assert.notEqual(board.id, assessment.document.boardId);
    assert.equal(board.document.boardId, board.id);
    assert.equal(board.document.objects["sticky-my-idea"]?.type, "sticky");
    const reopened = await repository.boardAccess(board.id, user.id);
    assert.equal(
      reopened.board.document.objects["sticky-my-idea"]?.type,
      "sticky",
    );
    const versions = await repository.listVersions(board.id);
    assert.equal(versions.length, 1);
    assert.equal(versions[0]?.reason, "Imported v8 board");
  } finally {
    await repository.close();
  }
});
