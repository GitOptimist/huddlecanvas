import {
  importLegacyV8,
  type LegacyImportIssue,
  type LegacyImportOptions,
} from "./legacy-v8.ts";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as RecordValue)
    : null;

const boardKeys = new Set([
  "id",
  "title",
  "name",
  "created",
  "updated",
  "grid",
  "background",
  "privateMode",
  "voteLimit",
  "versions",
  "ops",
  "items",
  "media",
]);
const itemKeys = new Set([
  "id",
  "type",
  "x",
  "y",
  "votes",
  "votedByMe",
  "comments",
  "scale",
  "rotation",
  "private",
  "locked",
]);
const itemDetails: Record<string, Set<string>> = {
  sticky: new Set(["text", "bg"]),
  text: new Set(["text", "color", "w", "h", "bold", "altText"]),
  shape: new Set(["shape", "color", "w", "h", "x1", "y1", "x2", "y2", "size"]),
};
const drawingKeys = new Set(["id", "type", "color", "size"]);
const strokeKeys = new Set(["mode", "points"]);
const shapeKeys = new Set(["x1", "y1", "x2", "y2"]);

export interface SafeV8Assessment {
  document: ReturnType<typeof importLegacyV8>["document"];
  sourceBoardId: string;
  issues: LegacyImportIssue[];
  canImport: boolean;
}

/** Restrictive by design: no placeholder media or silently omitted v8 features. */
export function assessLegacyV8(
  payload: unknown,
  options: LegacyImportOptions = {},
): SafeV8Assessment {
  const root = record(payload);
  if (!root) throw new Error("Select a valid v8 .flowboard JSON file.");
  if (root.board && root.boards)
    throw new Error(
      "Use a single-board v8 export, not a mixed workspace file.",
    );
  if (root.board && root.version !== 8)
    throw new Error("This is not a v8 .flowboard export.");
  const boards = Array.isArray(root.boards) ? root.boards : null;
  if (boards && boards.length !== 1) {
    throw new Error("Export and import one board at a time from v8.");
  }
  const board = record(root.board ?? boards?.[0] ?? root);
  if (!board || !Array.isArray(board.ops) || !Array.isArray(board.items)) {
    throw new Error(
      "This file does not contain a v8 board with drawing and item data.",
    );
  }
  const imported = importLegacyV8(payload, options);
  const issues = [...imported.issues];
  const add = (code: string, path: string, message: string) => {
    issues.push({ severity: "error", code, path, message });
  };
  if (board.versions !== undefined && !Array.isArray(board.versions)) {
    add("invalid_history", "versions", "The v8 board history is malformed.");
  }
  if (board.media !== undefined && !Array.isArray(board.media)) {
    add("invalid_media", "media", "The v8 media list is malformed.");
  }
  if (typeof board.grid !== "boolean" || typeof board.background !== "string") {
    add(
      "invalid_board_settings",
      "settings",
      "Grid and background must be valid v8 board settings.",
    );
  }
  const branding = record(root.branding);
  const defaultPalette = [
    "#111827",
    "#6256D9",
    "#2563EB",
    "#DC2626",
    "#059669",
    "#D97706",
    "#DB2777",
    "#0891B2",
  ];
  if (
    branding &&
    ((branding.company !== undefined && branding.company !== "GETITECH") ||
      (typeof branding.logoData === "string" && branding.logoData.length > 0) ||
      (branding.logoData !== undefined &&
        typeof branding.logoData !== "string") ||
      (branding.brand1 !== undefined &&
        String(branding.brand1).toLowerCase() !== "#6256d9") ||
      (branding.brand2 !== undefined &&
        String(branding.brand2).toLowerCase() !== "#312e81") ||
      (branding.palette !== undefined &&
        JSON.stringify(branding.palette) !== JSON.stringify(defaultPalette)) ||
      Object.keys(branding).some(
        (key) =>
          !["company", "brand1", "brand2", "logoData", "palette"].includes(key),
      ))
  )
    add(
      "custom_branding_not_migrated",
      "branding",
      "Custom v8 workspace branding is not applied to hosted boards.",
    );
  if (Array.isArray(board.versions) && board.versions.length) {
    add(
      "history_not_migrated",
      "versions",
      "Local v8 checkpoints are not included in hosted history.",
    );
  }
  if (board.privateMode === true) {
    add(
      "private_mode_not_migrated",
      "privateMode",
      "Private brainstorm state is not supported in the hosted board.",
    );
  }
  if (board.voteLimit !== undefined && board.voteLimit !== 5) {
    add(
      "vote_limit_not_migrated",
      "voteLimit",
      "Custom vote limits are not yet supported in hosted boards.",
    );
  }
  for (const key of Object.keys(board)) {
    if (!boardKeys.has(key))
      add(
        "unknown_board_field",
        key,
        `The v8 board field “${key}” has no hosted equivalent yet.`,
      );
  }
  (board.items as unknown[]).forEach((raw, index) => {
    const item = record(raw);
    if (!item) return;
    if (!new Set(["sticky", "text", "shape"]).has(String(item.type))) {
      add(
        "unavailable_hosted_tool",
        `items.${index}.type`,
        `The hosted board cannot yet edit v8 ${String(item.type)} items.`,
      );
    }
    if (
      ![item.x, item.y].every(
        (value) => typeof value === "number" && Number.isFinite(value),
      )
    ) {
      add(
        "invalid_item_position",
        `items.${index}`,
        "An item has missing or invalid coordinates.",
      );
    }
    if (
      item.votes !== undefined &&
      (typeof item.votes !== "number" || !Number.isFinite(item.votes))
    ) {
      add(
        "invalid_votes",
        `items.${index}.votes`,
        "The local vote count is malformed.",
      );
    }
    if (item.comments !== undefined && !Array.isArray(item.comments)) {
      add(
        "invalid_comments",
        `items.${index}.comments`,
        "The local comments are malformed.",
      );
    }
    if (
      item.scale !== undefined &&
      (typeof item.scale !== "number" ||
        !Number.isFinite(item.scale) ||
        item.scale === 0)
    ) {
      add(
        "invalid_scale",
        `items.${index}.scale`,
        "An item's scale cannot be represented.",
      );
    }
    if (
      item.rotation !== undefined &&
      (typeof item.rotation !== "number" || !Number.isFinite(item.rotation))
    ) {
      add(
        "invalid_rotation",
        `items.${index}.rotation`,
        "An item's rotation cannot be represented.",
      );
    }
    if (
      item.type === "shape" &&
      ![item.x1, item.y1, item.x2, item.y2].every(
        (value) => typeof value === "number" && Number.isFinite(value),
      )
    ) {
      add(
        "invalid_shape_geometry",
        `items.${index}`,
        "The shape's endpoints are malformed.",
      );
    }
    if (typeof item.votes === "number" && item.votes !== 0) {
      add(
        "votes_not_migrated",
        `items.${index}.votes`,
        "V8 votes are not yet part of the hosted board.",
      );
    }
    if (item.votedByMe === true) {
      add(
        "vote_session_not_migrated",
        `items.${index}.votedByMe`,
        "A local vote session cannot be imported.",
      );
    }
    if (Array.isArray(item.comments) && item.comments.length) {
      add(
        "comments_not_migrated",
        `items.${index}.comments`,
        "V8 comments are not yet part of the hosted board.",
      );
    }
    if (item.private === true) {
      add(
        "private_item_not_migrated",
        `items.${index}.private`,
        "Private v8 items cannot be safely imported.",
      );
    }
    for (const key of Object.keys(item)) {
      if (!itemKeys.has(key) && !itemDetails[String(item.type)]?.has(key))
        add(
          "unknown_item_field",
          `items.${index}.${key}`,
          `The v8 item field “${key}” has no hosted equivalent yet.`,
        );
    }
  });
  (board.ops as unknown[]).forEach((raw, index) => {
    const op = record(raw);
    if (!op) return;
    if (
      op.type === "stroke" &&
      (!Array.isArray(op.points) ||
        op.points.some((point) => {
          const p = record(point);
          return (
            !p ||
            ![p.x, p.y].every(
              (value) => typeof value === "number" && Number.isFinite(value),
            )
          );
        }))
    )
      add(
        "invalid_stroke_points",
        `ops.${index}.points`,
        "The freehand stroke has invalid points.",
      );
    if (
      op.type !== "stroke" &&
      ![op.x1, op.y1, op.x2, op.y2].every(
        (value) => typeof value === "number" && Number.isFinite(value),
      )
    ) {
      add(
        "invalid_drawing_geometry",
        `ops.${index}`,
        "The drawing has invalid endpoints.",
      );
    }
    for (const key of Object.keys(op)) {
      if (
        !drawingKeys.has(key) &&
        !(op.type === "stroke" ? strokeKeys : shapeKeys).has(key)
      )
        add(
          "unknown_drawing_field",
          `ops.${index}.${key}`,
          `The v8 drawing field “${key}” has no hosted equivalent yet.`,
        );
    }
    if (Array.isArray(op.points))
      op.points.forEach((rawPoint, pointIndex) => {
        const point = record(rawPoint);
        if (
          point &&
          Object.keys(point).some((key) => key !== "x" && key !== "y")
        ) {
          add(
            "stroke_detail_not_migrated",
            `ops.${index}.points.${pointIndex}`,
            "Stroke detail would be lost on import.",
          );
        }
      });
  });
  for (const object of Object.values(imported.document.objects)) {
    if (!new Set(["stroke", "shape", "sticky", "text"]).has(object.type)) {
      add(
        "unavailable_hosted_object",
        `objects.${object.id}`,
        `The hosted editor cannot yet display ${object.type} faithfully.`,
      );
    }
  }
  return {
    document: imported.document,
    sourceBoardId: imported.sourceBoardId,
    issues,
    canImport: issues.length === 0,
  };
}
