export const CLASSIC_MAX_BYTES = 10 * 1024 * 1024;
const CLASSIC_MAX_DEPTH = 40;
const CLASSIC_MAX_NODES = 1_000_000;
const CLASSIC_MAX_STRING_LENGTH = CLASSIC_MAX_BYTES;
const CLASSIC_MAX_CANVAS_VALUE = 1_000_000;
const CANVAS_NUMBER_KEYS = new Set([
  "x",
  "y",
  "w",
  "h",
  "width",
  "height",
  "scale",
  "rotation",
]);
export interface ClassicSnapshot {
  revision: number;
  workspace: Record<string, unknown> | null;
}

export class ClassicValidationError extends Error {}

export function validateClassicWorkspace(
  value: unknown,
): Record<string, unknown> {
  const fail = (): never => {
    throw new ClassicValidationError(
      "Invalid v8 workspace. Export a backup and check the board data.",
    );
  };
  const object = (v: unknown): v is Record<string, unknown> =>
    !!v && typeof v === "object" && !Array.isArray(v);
  if (
    !object(value) ||
    value.version !== 8 ||
    !Array.isArray(value.boards) ||
    !value.boards.length ||
    value.boards.length > 500 ||
    !object(value.branding)
  )
    return fail();
  const ids = new Set<string>();
  for (const board of value.boards) {
    if (
      !object(board) ||
      typeof board.id !== "string" ||
      !board.id ||
      board.id.length > 200 ||
      ids.has(board.id) ||
      typeof board.title !== "string" ||
      board.title.length > 1000
    )
      return fail();
    ids.add(board.id);
    for (const key of ["ops", "items", "media", "versions"]) {
      if (!Array.isArray(board[key]) || board[key].length > 100000)
        return fail();
    }
  }
  if (
    typeof value.currentBoardId !== "string" ||
    !ids.has(value.currentBoardId)
  )
    return fail();
  let nodes = 0;
  let arrayItems = 0;
  const seen = new WeakSet<object>();
  const visit = (v: unknown, depth: number, parentKey = "") => {
    nodes += 1;
    if (nodes > CLASSIC_MAX_NODES || depth > CLASSIC_MAX_DEPTH) fail();
    if (typeof v === "string") {
      if (v.length > CLASSIC_MAX_STRING_LENGTH) fail();
      return;
    }
    if (typeof v === "number") {
      if (!Number.isFinite(v) || !Number.isSafeInteger(Math.trunc(v))) fail();
      if (
        CANVAS_NUMBER_KEYS.has(parentKey) &&
        Math.abs(v) > CLASSIC_MAX_CANVAS_VALUE
      )
        fail();
      return;
    }
    if (v === null || typeof v === "boolean") return;
    if (!v || typeof v !== "object") return fail();
    if (seen.has(v)) fail();
    seen.add(v);
    if (Array.isArray(v)) {
      arrayItems += v.length;
      if (arrayItems > CLASSIC_MAX_NODES) fail();
      for (const child of v) visit(child, depth + 1);
      return;
    }
    for (const [key, child] of Object.entries(v)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) fail();
      visit(child, depth + 1, key);
    }
  };
  visit(value, 0);
  let encoded: string;
  try {
    encoded = JSON.stringify(value);
  } catch {
    return fail();
  }
  if (Buffer.byteLength(encoded) > CLASSIC_MAX_BYTES) return fail();
  return structuredClone(value);
}
