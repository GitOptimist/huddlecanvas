import assert from "node:assert/strict";
import test from "node:test";

import { assessLegacyV8, importLegacyV8 } from "./index.ts";

const exportBoard = () => ({
  version: 8,
  branding: {
    company: "GETITECH",
    brand1: "#6256D9",
    brand2: "#312E81",
    logoData: "",
  },
  board: {
    id: "local-1",
    title: "My v8 board",
    grid: true,
    background: "#ffffff",
    privateMode: false,
    voteLimit: 5,
    versions: [],
    media: [],
    ops: [
      {
        id: "ink-1",
        type: "stroke",
        mode: "pen",
        color: "#123456",
        size: 3,
        points: [
          { x: 10, y: 20 },
          { x: 40, y: 50 },
        ],
      },
    ],
    items: [
      {
        id: "note-1",
        type: "sticky",
        x: 100,
        y: 200,
        text: "Idea",
        bg: "#fff2a8",
        votes: 0,
        votedByMe: false,
        comments: [],
        scale: 1,
        rotation: 0,
      },
      {
        id: "shape-1",
        type: "shape",
        shape: "hexagon",
        x: 300,
        y: 400,
        w: 110,
        h: 110,
        x1: 12,
        y1: 12,
        x2: 98,
        y2: 98,
        color: "#6256D9",
        size: 2,
        votes: 0,
        comments: [],
        scale: 1,
        rotation: 0,
      },
    ],
  },
});

test("actual v8 single-board export preserves supported content without mutating the file", () => {
  const payload = exportBoard();
  const original = structuredClone(payload);
  const assessment = assessLegacyV8(payload);
  assert.deepEqual(payload, original);
  assert.equal(assessment.canImport, true, JSON.stringify(assessment.issues));
  assert.equal(assessment.document.title, "My v8 board");
  assert.equal(assessment.sourceBoardId, "local-1");
  assert.equal(Object.keys(assessment.document.objects).length, 3);
  assert.equal(importLegacyV8(payload).summary.importedObjects, 3);
  const shape = Object.values(assessment.document.objects).find(
    (object) => object.type === "shape",
  );
  assert.ok(shape);
  assert.equal(shape.shape, "hexagon");
  assert.equal(shape.transform.x, 312);
  assert.equal(shape.size.width, 86);
});

test("lossy v8 features and unknown fields block an import", () => {
  const payload = exportBoard();
  payload.board.items[0]!.votes = 3;
  payload.board.items[0]!.comments.push({ text: "Important" } as never);
  payload.board.versions.push({ id: "revision-1" } as never);
  const assessment = assessLegacyV8(payload);
  assert.equal(assessment.canImport, false);
  assert(
    assessment.issues.some((issue) => issue.code === "votes_not_migrated"),
  );
  assert(
    assessment.issues.some((issue) => issue.code === "comments_not_migrated"),
  );
  assert(
    assessment.issues.some((issue) => issue.code === "history_not_migrated"),
  );
  const another = exportBoard();
  another.board.items.push({ type: "action", title: "Finish" } as never);
  assert(
    assessLegacyV8(another).issues.some(
      (issue) => issue.code === "unavailable_hosted_tool",
    ),
  );
});

test("v8 file selection rejects multi-board and invalid exports", () => {
  assert.throws(
    () => assessLegacyV8({ version: 7, board: exportBoard().board }),
    /not a v8/,
  );
  assert.throws(
    () =>
      assessLegacyV8({ boards: [exportBoard().board, exportBoard().board] }),
    /one board at a time/,
  );
  assert.throws(
    () => assessLegacyV8({ version: 8, board: { title: "missing arrays" } }),
    /drawing and item data/,
  );
});
