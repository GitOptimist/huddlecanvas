import type { BoardDocument } from "./types.ts";
import { assertBoardDocument } from "./validation.ts";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, nested]) => [key, canonicalize(nested)]),
    );
  }
  return value;
}

export function serializeBoard(document: BoardDocument): string {
  const valid = assertBoardDocument(document);
  return JSON.stringify(canonicalize(valid));
}

export function parseSerializedBoard(serialized: string): BoardDocument {
  let value: unknown;
  try {
    value = JSON.parse(serialized) as unknown;
  } catch (error) {
    throw new Error("Board document is not valid JSON.", { cause: error });
  }
  return assertBoardDocument(value);
}
