export const CLASSIC_MAX_BYTES = 10 * 1024 * 1024;
export interface ClassicSnapshot {
  revision: number;
  workspace: Record<string, unknown> | null;
}

export class ClassicValidationError extends Error {}

export function validateClassicWorkspace(
  value: unknown,
): Record<string, unknown> {
  const fail = () => {
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
  const visit = (v: unknown, depth: number) => {
    if (depth > 40) fail();
    if (v && typeof v === "object") {
      for (const [key, child] of Object.entries(v)) {
        if (["__proto__", "constructor", "prototype"].includes(key)) fail();
        visit(child, depth + 1);
      }
    }
  };
  visit(value, 0);
  if (Buffer.byteLength(JSON.stringify(value)) > CLASSIC_MAX_BYTES)
    return fail();
  return structuredClone(value);
}
