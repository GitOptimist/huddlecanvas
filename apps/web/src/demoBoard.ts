import {
  CURRENT_SCHEMA_VERSION,
  assertBoardDocument,
  type BoardDocument,
  type BoardObject,
} from "@huddlecanvas/board-schema";

const createdAt = "2026-09-10T09:00:00.000Z";

function base(
  id: string,
  type: BoardObject["type"],
  x: number,
  y: number,
  width: number,
  height: number,
  order: number,
) {
  return {
    id,
    type,
    parentId: "frame-planning",
    orderKey: order.toString().padStart(8, "0"),
    transform: { x, y, rotation: 0, scaleX: 1, scaleY: 1 },
    size: { width, height },
    locked: false,
    hidden: false,
    createdAt,
    createdBy: "demo-owner",
    updatedAt: createdAt,
    updatedBy: "demo-owner",
  };
}

export const demoBoard: BoardDocument = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  boardId: "board-product-planning",
  generation: 12,
  title: "Q4 Product Planning",
  settings: {
    background: { kind: "grid", color: "#f8fafc" },
    snap: { enabled: true, gridSize: 20 },
  },
  rootOrder: ["frame-planning"],
  objects: {
    "frame-planning": {
      ...base("frame-planning", "frame", 70, 55, 790, 450, 0),
      type: "frame",
      parentId: null,
      title: "Launch readiness",
      presentationOrder: 1,
    },
    "text-heading": {
      ...base("text-heading", "text", 105, 100, 300, 42, 0),
      type: "text",
      text: "What must be true before launch?",
      altText: "Workshop prompt",
      style: {
        color: "#172033",
        fontFamily: "Inter, ui-sans-serif, system-ui",
        fontSize: 24,
        fontWeight: 700,
        textAlign: "left",
      },
    },
    "sticky-value": {
      ...base("sticky-value", "sticky", 105, 175, 180, 125, 1),
      type: "sticky",
      text: "Clear value story for the first workshop",
      color: "#fef3c7",
    },
    "sticky-confidence": {
      ...base("sticky-confidence", "sticky", 315, 175, 180, 125, 2),
      type: "sticky",
      text: "Facilitators can recover from mistakes",
      color: "#dbeafe",
    },
    "action-pilot": {
      ...base("action-pilot", "action", 525, 175, 285, 125, 3),
      type: "action",
      title: "Run five moderated pilot sessions",
      status: "in-progress",
      assigneeId: "user-maya",
      dueAt: "2026-10-15T17:00:00.000Z",
    },
    "checklist-launch": {
      ...base("checklist-launch", "checklist", 105, 340, 390, 125, 4),
      type: "checklist",
      title: "Launch confidence",
      rows: [
        { id: "row-a", text: "Keyboard navigation reviewed", done: true },
        { id: "row-b", text: "Import report understood", done: true },
        { id: "row-c", text: "Recovery test completed", done: false },
      ],
    },
    "sticky-decision": {
      ...base("sticky-decision", "sticky", 630, 350, 180, 105, 5),
      type: "sticky",
      text: "Decision: prioritize trust over feature count",
      color: "#dcfce7",
    },
    "connector-decision": {
      ...base("connector-decision", "connector", 0, 0, 0, 0, 6),
      type: "connector",
      start: { kind: "binding", objectId: "action-pilot", anchor: "bottom" },
      end: { kind: "binding", objectId: "sticky-decision", anchor: "top" },
      routing: "curved",
      style: { color: "#64748b", width: 2, endMarker: "arrow" },
    },
  },
};

assertBoardDocument(demoBoard);
