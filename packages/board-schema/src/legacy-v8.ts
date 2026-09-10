import {
  CURRENT_SCHEMA_VERSION,
  EPOCH_TIMESTAMP,
  type ActionObject,
  type BoardDocument,
  type BoardObject,
  type ChecklistObject,
  type ConnectorObject,
  type FrameObject,
  type GroupObject,
  type ID,
  type MediaObject,
  type ObjectBase,
  type ObjectType,
  type QuizObject,
  type ShapeKind,
  type ShapeObject,
  type StickyObject,
  type StrokeObject,
  type TextObject,
} from "./types.ts";
import { assertBoardDocument } from "./validation.ts";

type UnknownRecord = Record<string, unknown>;

export interface LegacyImportIssue {
  severity: "warning" | "error";
  code: string;
  path: string;
  message: string;
}

export interface LegacyImportResult {
  document: BoardDocument;
  issues: LegacyImportIssue[];
  sourceBoardId: string;
  sourceUnchanged: true;
  summary: {
    importedObjects: number;
    warnings: number;
    errors: number;
  };
}

export interface LegacyImportOptions {
  boardId?: string;
  actorId?: string;
}

const record = (value: unknown): UnknownRecord | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;

const stringValue = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;

const numberValue = (value: unknown, fallback = 0): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const booleanValue = (value: unknown, fallback = false): boolean =>
  typeof value === "boolean" ? value : fallback;

const arrayValue = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : [];

const cleanIdPart = (value: unknown, fallback: string): string => {
  const cleaned = stringValue(value, fallback)
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return cleaned || fallback;
};

const orderKey = (index: number): string => String(index).padStart(8, "0");

function selectLegacyBoard(
  payload: unknown,
  requestedId?: string,
): UnknownRecord {
  const root = record(payload);
  if (!root) throw new Error("The v8 import payload must be an object.");
  if (Array.isArray(root.boards)) {
    const boards = root.boards
      .map(record)
      .filter((board): board is UnknownRecord => board !== null);
    const selected = requestedId
      ? boards.find((board) => stringValue(board.id) === requestedId)
      : boards[0];
    if (!selected)
      throw new Error(
        requestedId
          ? `No v8 board matches ${requestedId}.`
          : "The v8 workspace contains no boards.",
      );
    return selected;
  }
  return root;
}

function itemSize(
  type: string,
  item: UnknownRecord,
): { width: number; height: number } {
  const rows = arrayValue(item.rows).length;
  switch (type) {
    case "sticky":
      return { width: 220, height: 152 };
    case "text":
      return {
        width: numberValue(item.w, 220),
        height: numberValue(item.h, 75),
      };
    case "action":
      return { width: 250, height: 130 };
    case "checklist":
      return { width: 270, height: Math.max(155, 75 + rows * 28) };
    case "quiz":
      return { width: 310, height: 245 };
    case "frame":
      return {
        width: numberValue(item.w, 760),
        height: numberValue(item.h, 480),
      };
    default:
      return { width: 120, height: 80 };
  }
}

export function importLegacyV8(
  payload: unknown,
  options: LegacyImportOptions = {},
): LegacyImportResult {
  const before = JSON.stringify(payload);
  const board = selectLegacyBoard(payload, options.boardId);
  const issues: LegacyImportIssue[] = [];
  const objects: Record<ID, BoardObject> = {};
  const rootOrder: ID[] = [];
  const usedIds = new Set<ID>();
  const actorId = options.actorId ?? "legacy-v8-import";
  let sequence = 0;

  const issue = (
    code: string,
    path: string,
    message: string,
    severity: "warning" | "error" = "warning",
  ) => {
    issues.push({ severity, code, path, message });
  };

  const nextId = (prefix: string, raw: unknown, index: number): ID => {
    const base = `${prefix}-${cleanIdPart(raw, String(index + 1))}`;
    let candidate = base;
    let suffix = 2;
    while (usedIds.has(candidate)) candidate = `${base}-${suffix++}`;
    usedIds.add(candidate);
    return candidate;
  };

  const base = <TType extends ObjectType>(
    id: ID,
    type: TType,
    x: number,
    y: number,
    width: number,
    height: number,
    parentId: ID | null = null,
  ): ObjectBase<TType> => ({
    id,
    type,
    parentId,
    orderKey: orderKey(sequence++),
    transform: {
      x,
      y,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
    size: { width: Math.max(0, width), height: Math.max(0, height) },
    locked: false,
    hidden: false,
    createdAt: EPOCH_TIMESTAMP,
    createdBy: actorId,
    updatedAt: EPOCH_TIMESTAMP,
    updatedBy: actorId,
  });

  const addRoot = (object: BoardObject): void => {
    objects[object.id] = object;
    rootOrder.push(object.id);
  };

  arrayValue(board.media).forEach((rawMedia, index) => {
    const media = record(rawMedia);
    if (!media) {
      issue(
        "invalid_media",
        `media.${index}`,
        "Skipped a malformed media entry.",
      );
      return;
    }
    const id = nextId("media", media.id, index);
    const object: MediaObject = {
      ...base(
        id,
        "media",
        numberValue(media.x),
        numberValue(media.y),
        numberValue(media.w, 320),
        numberValue(media.h, 240),
      ),
      assetId: `legacy-pending-upload-${id}`,
      altText: stringValue(media.altText),
    };
    addRoot(object);
    issue(
      "media_requires_upload",
      `media.${index}.src`,
      "Embedded v8 media was not copied into the board document; upload it through the asset pipeline before use.",
    );
  });

  const shapeMap: Record<string, ShapeKind> = {
    line: "line",
    rect: "rectangle",
    roundrect: "rounded-rectangle",
    ellipse: "ellipse",
    triangle: "triangle",
    diamond: "diamond",
    hexagon: "hexagon",
    star: "star",
  };

  arrayValue(board.ops).forEach((rawOp, index) => {
    const op = record(rawOp);
    if (!op) {
      issue(
        "invalid_operation",
        `ops.${index}`,
        "Skipped a malformed drawing operation.",
      );
      return;
    }
    if (op.type === "stroke") {
      if (op.mode === "erase") {
        issue(
          "eraser_flattening_required",
          `ops.${index}`,
          "Eraser history cannot be represented as a visible object and must be flattened during media conversion.",
        );
        return;
      }
      const sourcePoints = arrayValue(op.points)
        .map(record)
        .filter((point): point is UnknownRecord => point !== null)
        .map((point) => ({ x: numberValue(point.x), y: numberValue(point.y) }));
      if (sourcePoints.length < 2) {
        issue(
          "short_stroke",
          `ops.${index}.points`,
          "Skipped a stroke with fewer than two valid points.",
        );
        return;
      }
      const minX = Math.min(...sourcePoints.map((point) => point.x));
      const minY = Math.min(...sourcePoints.map((point) => point.y));
      const maxX = Math.max(...sourcePoints.map((point) => point.x));
      const maxY = Math.max(...sourcePoints.map((point) => point.y));
      const id = nextId("stroke", op.id, index);
      const object: StrokeObject = {
        ...base(id, "stroke", minX, minY, maxX - minX, maxY - minY),
        points: sourcePoints.map((point) => ({
          x: point.x - minX,
          y: point.y - minY,
        })),
        style: {
          color: stringValue(op.color, "#111827"),
          width: Math.max(0.5, numberValue(op.size, 2)),
          opacity: op.mode === "highlight" ? 0.28 : 1,
        },
      };
      addRoot(object);
      return;
    }

    const x1 = numberValue(op.x1);
    const y1 = numberValue(op.y1);
    const x2 = numberValue(op.x2, x1);
    const y2 = numberValue(op.y2, y1);
    if (op.type === "arrow") {
      const id = nextId("connector", op.id, index);
      const object: ConnectorObject = {
        ...base(
          id,
          "connector",
          Math.min(x1, x2),
          Math.min(y1, y2),
          Math.abs(x2 - x1),
          Math.abs(y2 - y1),
        ),
        start: { kind: "point", x: x1, y: y1 },
        end: { kind: "point", x: x2, y: y2 },
        routing: "straight",
        style: {
          color: stringValue(op.color, "#111827"),
          width: Math.max(0.5, numberValue(op.size, 2)),
          endMarker: "arrow",
        },
      };
      addRoot(object);
      issue(
        "unbound_connector",
        `ops.${index}`,
        "Legacy arrows were imported as unbound connectors with absolute endpoints.",
      );
      return;
    }

    const shape = shapeMap[stringValue(op.type)];
    if (shape) {
      const id = nextId("shape", op.id, index);
      const object: ShapeObject = {
        ...base(
          id,
          "shape",
          Math.min(x1, x2),
          Math.min(y1, y2),
          Math.abs(x2 - x1),
          Math.abs(y2 - y1),
        ),
        shape,
        style: {
          stroke: stringValue(op.color, "#111827"),
          strokeWidth: Math.max(0.5, numberValue(op.size, 2)),
          fill: null,
          opacity: 1,
        },
      };
      addRoot(object);
      return;
    }
    issue(
      "unsupported_operation",
      `ops.${index}.type`,
      `Skipped unsupported drawing operation ${String(op.type)}.`,
    );
  });

  const legacyItems = arrayValue(board.items);
  const groupIds = new Map<string, ID>();
  legacyItems.forEach((rawItem, index) => {
    const item = record(rawItem);
    const legacyGroupId = item ? stringValue(item.groupId) : "";
    if (legacyGroupId && !groupIds.has(legacyGroupId))
      groupIds.set(legacyGroupId, nextId("group", legacyGroupId, index));
  });

  const groupChildren = new Map<ID, ID[]>();
  const placedGroups = new Set<ID>();

  legacyItems.forEach((rawItem, index) => {
    const item = record(rawItem);
    if (!item) {
      issue(
        "invalid_item",
        `items.${index}`,
        "Skipped a malformed board item.",
      );
      return;
    }
    const type = stringValue(item.type);
    const id = nextId(type || "item", item.id, index);
    const legacyGroupId = stringValue(item.groupId);
    const parentId = legacyGroupId
      ? (groupIds.get(legacyGroupId) ?? null)
      : null;
    const size = itemSize(type, item);
    const common = base(
      id,
      type === "sticky" ||
        type === "text" ||
        type === "action" ||
        type === "checklist" ||
        type === "quiz" ||
        type === "frame"
        ? type
        : "text",
      numberValue(item.x),
      numberValue(item.y),
      size.width,
      size.height,
      parentId,
    );
    common.transform.rotation = numberValue(item.rotation);
    common.transform.scaleX = numberValue(item.scale, 1) || 1;
    common.transform.scaleY = numberValue(item.scale, 1) || 1;
    common.locked = booleanValue(item.locked);

    let object: BoardObject | null = null;
    if (type === "sticky") {
      object = {
        ...common,
        type: "sticky",
        text: stringValue(item.text),
        color: stringValue(item.bg, "#fff2a8"),
      } as StickyObject;
    } else if (type === "text") {
      object = {
        ...common,
        type: "text",
        text: stringValue(item.text),
        style: {
          color: stringValue(item.color, "#111827"),
          fontFamily: "Avenir Next, Segoe UI, sans-serif",
          fontSize: 22,
          fontWeight: booleanValue(item.bold) ? 800 : 400,
          textAlign: "left",
        },
        altText: stringValue(item.altText),
      } as TextObject;
    } else if (type === "action") {
      const owner = stringValue(item.owner);
      const rawDue = stringValue(item.due);
      const dueAt =
        rawDue && !Number.isNaN(Date.parse(rawDue))
          ? new Date(rawDue).toISOString()
          : null;
      object = {
        ...common,
        type: "action",
        title: stringValue(item.title, "Action item"),
        status: booleanValue(item.done) ? "done" : "open",
        ...(dueAt ? { dueAt } : {}),
      } as ActionObject;
      if (owner)
        issue(
          "unresolved_assignee",
          `items.${index}.owner`,
          `Legacy owner “${owner}” requires user identity resolution.`,
        );
      if (rawDue && !dueAt)
        issue(
          "unparsed_due_date",
          `items.${index}.due`,
          `Legacy due value “${rawDue}” was not imported because it is not an ISO-compatible date.`,
        );
    } else if (type === "checklist") {
      object = {
        ...common,
        type: "checklist",
        title: stringValue(item.title, "Checklist"),
        rows: arrayValue(item.rows).map((rawRow, rowIndex) => {
          const row = record(rawRow);
          return {
            id: `${id}-row-${rowIndex + 1}`,
            text: stringValue(row?.text),
            done: booleanValue(row?.done),
          };
        }),
      } as ChecklistObject;
    } else if (type === "quiz") {
      const options = arrayValue(item.options).map((value, optionIndex) => ({
        id: `${id}-option-${optionIndex + 1}`,
        text: stringValue(value),
      }));
      const answerIndex = numberValue(item.answer, -1);
      const correctOption = options[answerIndex];
      object = {
        ...common,
        type: "quiz",
        prompt: stringValue(item.question, "Question"),
        options,
        answerPolicy: booleanValue(item.revealed) ? "revealed" : "hidden",
        ...(correctOption ? { correctOptionId: correctOption.id } : {}),
      } as QuizObject;
    } else if (type === "frame") {
      object = {
        ...common,
        type: "frame",
        title: stringValue(item.title, "Frame"),
      } as FrameObject;
    } else {
      issue(
        "unsupported_item",
        `items.${index}.type`,
        `Skipped unsupported board item ${type || "(missing type)"}.`,
      );
    }

    if (!object) return;
    objects[id] = object;
    if (parentId) {
      const children = groupChildren.get(parentId) ?? [];
      children.push(id);
      groupChildren.set(parentId, children);
      if (!placedGroups.has(parentId)) {
        rootOrder.push(parentId);
        placedGroups.add(parentId);
      }
    } else {
      rootOrder.push(id);
    }
  });

  for (const [legacyGroupId, groupId] of groupIds) {
    const childIds = groupChildren.get(groupId) ?? [];
    if (childIds.length === 0) continue;
    const children = childIds
      .map((id) => objects[id])
      .filter((value): value is BoardObject => value !== undefined);
    const left = Math.min(...children.map((child) => child.transform.x));
    const top = Math.min(...children.map((child) => child.transform.y));
    const right = Math.max(
      ...children.map(
        (child) =>
          child.transform.x +
          child.size.width * Math.abs(child.transform.scaleX),
      ),
    );
    const bottom = Math.max(
      ...children.map(
        (child) =>
          child.transform.y +
          child.size.height * Math.abs(child.transform.scaleY),
      ),
    );
    const group: GroupObject = {
      ...base(groupId, "group", left, top, right - left, bottom - top),
      childIds,
    };
    objects[groupId] = group;
    issue(
      "legacy_group_coordinates",
      `groups.${legacyGroupId}`,
      "Group children retain world coordinates during import; the renderer adapter must preserve their world transform when normalizing hierarchy.",
    );
  }

  const sourceBoardId = stringValue(board.id, "legacy-board");
  const document: BoardDocument = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    boardId: `board-${cleanIdPart(sourceBoardId, "legacy-board")}`,
    generation: 0,
    title: stringValue(
      board.name,
      stringValue(board.title, "Imported v8 board"),
    ),
    settings: {
      background: {
        kind: booleanValue(board.grid) ? "grid" : "solid",
        color: stringValue(board.background, "#ffffff"),
      },
      snap: {
        enabled: true,
        gridSize: 10,
      },
    },
    objects,
    rootOrder,
  };

  const validDocument = assertBoardDocument(document);
  if (JSON.stringify(payload) !== before)
    throw new Error("Legacy import mutated its source payload.");
  return {
    document: validDocument,
    issues,
    sourceBoardId,
    sourceUnchanged: true,
    summary: {
      importedObjects: Object.keys(validDocument.objects).length,
      warnings: issues.filter((entry) => entry.severity === "warning").length,
      errors: issues.filter((entry) => entry.severity === "error").length,
    },
  };
}
