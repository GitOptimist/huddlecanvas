import assert from "node:assert/strict";
import test from "node:test";

import {
  EPOCH_TIMESTAMP,
  assertBoardDocument,
  createEmptyBoard,
  type BoardObject,
  type ConnectorObject,
  type GroupObject,
  type StickyObject,
} from "../../board-schema/src/index.ts";
import { applyBoardCommand, CommandError } from "./commands.ts";
import { normalizeRect, objectBounds, selectWithLasso } from "./geometry.ts";

const context = { actorId: "user-1", now: "2026-09-10T12:00:00.000Z" };

function base(id: string, type: BoardObject["type"], x = 0, y = 0) {
  return {
    id,
    type,
    parentId: null,
    orderKey: "00000000",
    transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width: 100, height: 80 },
    locked: false,
    hidden: false,
    createdAt: EPOCH_TIMESTAMP,
    createdBy: "user-1",
    updatedAt: EPOCH_TIMESTAMP,
    updatedBy: "user-1",
  };
}

function sticky(id: string, x = 0, y = 0): StickyObject {
  return {
    ...base(id, "sticky", x, y),
    type: "sticky",
    text: id,
    color: "#fde68a",
  };
}

test("move is immutable and advances the document generation", () => {
  const board = createEmptyBoard({ boardId: "board-1" });
  board.objects.note = sticky("note", 10, 20);
  board.rootOrder = ["note"];

  const moved = applyBoardCommand(
    board,
    { type: "object.move", objectIds: ["note"], deltaX: 12, deltaY: -5 },
    context,
  );

  assert.equal(board.objects.note?.transform.x, 10);
  assert.equal(moved.objects.note?.transform.x, 22);
  assert.equal(moved.objects.note?.transform.y, 15);
  assert.equal(moved.generation, 1);
  assertBoardDocument(moved);
});

test("locked objects reject mutation until explicitly unlocked", () => {
  const board = createEmptyBoard({ boardId: "board-1" });
  board.objects.note = { ...sticky("note"), locked: true };
  board.rootOrder = ["note"];

  assert.throws(
    () =>
      applyBoardCommand(
        board,
        { type: "object.move", objectIds: ["note"], deltaX: 1, deltaY: 1 },
        context,
      ),
    (error) => error instanceof CommandError && error.code === "object.locked",
  );

  const unlocked = applyBoardCommand(
    board,
    { type: "object.lock", objectIds: ["note"], locked: false },
    context,
  );
  assert.equal(unlocked.objects.note?.locked, false);
});

test("removing a bound object preserves the connector at the former anchor", () => {
  const board = createEmptyBoard({ boardId: "board-1" });
  board.objects.note = sticky("note", 20, 30);
  const connector: ConnectorObject = {
    ...base("link", "connector"),
    type: "connector",
    size: { width: 0, height: 0 },
    start: { kind: "binding", objectId: "note", anchor: "right" },
    end: { kind: "point", x: 300, y: 90 },
    routing: "straight",
    style: { color: "#334155", width: 2, endMarker: "arrow" },
  };
  board.objects.link = connector;
  board.rootOrder = ["note", "link"];

  const next = applyBoardCommand(
    board,
    { type: "object.remove", objectIds: ["note"] },
    context,
  );
  const start = (next.objects.link as ConnectorObject).start;
  assert.deepEqual(start, { kind: "point", x: 120, y: 70 });
  assertBoardDocument(next);
});

test("deleting a group promotes surviving children without losing them", () => {
  const board = createEmptyBoard({ boardId: "board-1" });
  const group: GroupObject = {
    ...base("group", "group"),
    type: "group",
    childIds: ["note"],
  };
  const note = { ...sticky("note"), parentId: "group" };
  board.objects.group = group;
  board.objects.note = note;
  board.rootOrder = ["group"];

  const next = applyBoardCommand(
    board,
    { type: "object.remove", objectIds: ["group"] },
    context,
  );
  assert.equal(next.objects.note?.parentId, null);
  assert.deepEqual(next.rootOrder, ["note"]);
  assertBoardDocument(next);
});

test("lasso selection is spatial and visually distinct from persistent frames", () => {
  const board = createEmptyBoard({ boardId: "board-1" });
  board.objects.a = sticky("a", 10, 10);
  board.objects.b = sticky("b", 300, 300);
  board.rootOrder = ["a", "b"];

  const lasso = normalizeRect({ x: 0, y: 0 }, { x: 120, y: 110 });
  assert.deepEqual(selectWithLasso(board, lasso, "contain"), ["a"]);
  assert.deepEqual(
    selectWithLasso(board, { x: 95, y: 70, width: 20, height: 20 }, "touch"),
    ["a"],
  );
});

test("rotated objects receive a correct axis-aligned hit box", () => {
  const note = sticky("note");
  note.size = { width: 100, height: 40 };
  note.transform.rotation = 90;
  const bounds = objectBounds(note);
  assert.ok(Math.abs(bounds.width - 40) < 0.000001);
  assert.ok(Math.abs(bounds.height - 100) < 0.000001);
  assert.ok(Math.abs(bounds.x - 30) < 0.000001);
  assert.ok(Math.abs(bounds.y + 30) < 0.000001);
});
