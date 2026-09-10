import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  EPOCH_TIMESTAMP,
  assertBoardDocument,
  createEmptyBoard,
  importLegacyV8,
  parseSerializedBoard,
  serializeBoard,
  validateBoardDocument,
  type BoardDocument,
  type StickyObject,
} from "./index.ts";

const sticky = (id: string, parentId: string | null = null): StickyObject => ({
  id,
  type: "sticky",
  parentId,
  orderKey: "00000001",
  transform: { x: 40, y: 60, rotation: 0, scaleX: 1, scaleY: 1 },
  size: { width: 220, height: 152 },
  locked: false,
  hidden: false,
  createdAt: EPOCH_TIMESTAMP,
  createdBy: "test-user",
  updatedAt: EPOCH_TIMESTAMP,
  updatedBy: "test-user",
  text: "Customer onboarding is too slow",
  color: "#fff2a8",
});

test("empty board factory returns schema v1", () => {
  const board = createEmptyBoard({ boardId: "board-empty", title: "Planning" });
  assert.equal(board.schemaVersion, 1);
  assert.equal(board.title, "Planning");
  assert.deepEqual(board.rootOrder, []);
  assert.equal(validateBoardDocument(board).ok, true);
});

test("deterministic serialization ignores object-key insertion order", () => {
  const a = sticky("a");
  const b = { ...sticky("b"), orderKey: "00000002" };
  const left: BoardDocument = {
    ...createEmptyBoard({ boardId: "board-1" }),
    objects: { b, a },
    rootOrder: ["a", "b"],
  };
  const right: BoardDocument = {
    ...createEmptyBoard({ boardId: "board-1" }),
    objects: { a, b },
    rootOrder: ["a", "b"],
  };
  assert.equal(serializeBoard(left), serializeBoard(right));
  assert.deepEqual(
    parseSerializedBoard(serializeBoard(left)),
    assertBoardDocument(left),
  );
});

test("validation rejects dangling connector bindings", () => {
  const board = createEmptyBoard({ boardId: "board-invalid" });
  board.objects.connector = {
    id: "connector",
    type: "connector",
    parentId: null,
    orderKey: "00000001",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 100, height: 40 },
    locked: false,
    hidden: false,
    createdAt: EPOCH_TIMESTAMP,
    createdBy: "test-user",
    updatedAt: EPOCH_TIMESTAMP,
    updatedBy: "test-user",
    start: { kind: "binding", objectId: "missing", anchor: "right" },
    end: { kind: "point", x: 100, y: 40 },
    routing: "straight",
    style: { color: "#111827", width: 2, endMarker: "arrow" },
  };
  board.rootOrder.push("connector");
  const result = validateBoardDocument(board);
  assert.equal(result.ok, false);
  if (!result.ok)
    assert(result.issues.some((issue) => issue.code === "dangling_binding"));
});

test("validation rejects cyclic group hierarchy", () => {
  const board = createEmptyBoard({ boardId: "board-cycle" });
  board.objects.a = {
    id: "a",
    type: "group",
    parentId: "b",
    orderKey: "00000001",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 100, height: 100 },
    locked: false,
    hidden: false,
    createdAt: EPOCH_TIMESTAMP,
    createdBy: "test-user",
    updatedAt: EPOCH_TIMESTAMP,
    updatedBy: "test-user",
    childIds: ["b"],
  };
  board.objects.b = {
    ...board.objects.a,
    id: "b",
    parentId: "a",
    orderKey: "00000002",
    childIds: ["a"],
  };
  const result = validateBoardDocument(board);
  assert.equal(result.ok, false);
  if (!result.ok)
    assert(result.issues.some((issue) => issue.code === "hierarchy_cycle"));
});

test("v8 importer is read-only, deterministic, and reports lossy boundaries", () => {
  const legacy = {
    id: "sales-kickoff",
    name: "Sales kickoff",
    grid: true,
    background: "#ffffff",
    media: [
      {
        id: "photo",
        src: "data:image/png;base64,abc",
        x: 20,
        y: 20,
        w: 300,
        h: 200,
      },
    ],
    ops: [
      {
        type: "stroke",
        mode: "pen",
        color: "#111827",
        size: 3,
        points: [
          { x: 10, y: 10 },
          { x: 20, y: 30 },
        ],
      },
      {
        type: "arrow",
        color: "#6256D9",
        size: 2,
        x1: 200,
        y1: 120,
        x2: 360,
        y2: 120,
      },
    ],
    items: [
      {
        id: "idea-1",
        type: "sticky",
        x: 180,
        y: 220,
        text: "Improve handoff",
        bg: "#fff2a8",
        groupId: "ideas",
      },
      {
        id: "idea-2",
        type: "text",
        x: 440,
        y: 220,
        text: "Owner: Sales Ops",
        groupId: "ideas",
      },
      {
        id: "frame-1",
        type: "frame",
        x: 120,
        y: 100,
        w: 760,
        h: 480,
        title: "Priorities",
      },
    ],
  };
  const original = structuredClone(legacy);
  const first = importLegacyV8(legacy);
  const second = importLegacyV8(legacy);
  assert.deepEqual(legacy, original);
  assert.equal(first.sourceUnchanged, true);
  assert.equal(first.summary.importedObjects, 7);
  assert(first.issues.some((issue) => issue.code === "media_requires_upload"));
  assert(first.issues.some((issue) => issue.code === "unbound_connector"));
  assert.equal(serializeBoard(first.document), serializeBoard(second.document));
});

test("v8 importer rejects a workspace with no boards", () => {
  assert.throws(() => importLegacyV8({ boards: [] }), /contains no boards/);
});

test("representative v8 fixture imports and surfaces identity and asset boundaries", () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL("../fixtures/representative-v8.flowboard.json", import.meta.url),
      "utf8",
    ),
  );
  const result = importLegacyV8(fixture);
  assert.equal(result.document.title, "Customer discovery workshop");
  assert(result.issues.some((issue) => issue.code === "media_requires_upload"));
  assert(result.issues.some((issue) => issue.code === "unresolved_assignee"));
  assertBoardDocument(result.document);
});

test("invalid fixture is rejected at the connector binding", () => {
  const fixture = JSON.parse(
    readFileSync(
      new URL(
        "../fixtures/invalid-dangling-connector.v1.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const result = validateBoardDocument(fixture);
  assert.equal(result.ok, false);
  if (!result.ok)
    assert(result.issues.some((issue) => issue.code === "dangling_binding"));
});

test("validation rejects invalid settings and incomplete group membership", () => {
  const invalidSettings = createEmptyBoard({
    boardId: "board-invalid-settings",
  });
  invalidSettings.settings.snap.gridSize = 0;
  const settingsResult = validateBoardDocument(invalidSettings);
  assert.equal(settingsResult.ok, false);
  if (!settingsResult.ok)
    assert(
      settingsResult.issues.some(
        (issue) => issue.code === "invalid_snap_settings",
      ),
    );

  const invalidGroup = createEmptyBoard({ boardId: "board-invalid-group" });
  invalidGroup.objects.group = {
    id: "group",
    type: "group",
    parentId: null,
    orderKey: "00000001",
    transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 100, height: 100 },
    locked: false,
    hidden: false,
    createdAt: EPOCH_TIMESTAMP,
    createdBy: "test-user",
    updatedAt: EPOCH_TIMESTAMP,
    updatedBy: "test-user",
    childIds: [],
  };
  invalidGroup.objects.note = sticky("note", "group");
  invalidGroup.rootOrder = ["group"];
  const groupResult = validateBoardDocument(invalidGroup);
  assert.equal(groupResult.ok, false);
  if (!groupResult.ok)
    assert(
      groupResult.issues.some(
        (issue) => issue.code === "parent_child_mismatch",
      ),
    );
});
