import {
  CURRENT_SCHEMA_VERSION,
  type BoardDocument,
  type BoardSettings,
  type ID,
} from "./types.ts";

export interface CreateBoardOptions {
  boardId: ID;
  title?: string;
  settings?: Partial<BoardSettings>;
}

export function createEmptyBoard(options: CreateBoardOptions): BoardDocument {
  const background = options.settings?.background ?? {
    kind: "grid" as const,
    color: "#ffffff",
  };
  const snap = options.settings?.snap ?? { enabled: true, gridSize: 10 };
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    boardId: options.boardId,
    generation: 0,
    title: options.title ?? "Untitled board",
    settings: { background, snap },
    objects: {},
    rootOrder: [],
  };
}
