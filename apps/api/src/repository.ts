import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  assertBoardDocument,
  createEmptyBoard,
  type BoardDocument,
} from "@huddlecanvas/board-schema";
import type { Role } from "@huddlecanvas/authz";

const STORE_SCHEMA_VERSION = 2 as const;

export interface UserRecord {
  id: string;
  email: string;
  displayName: string;
  externalSubject?: string;
  createdAt: string;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  createdAt: string;
  createdBy: string;
}

export interface MembershipRecord {
  workspaceId: string;
  userId: string;
  role: Role;
}

export interface BoardRecord {
  id: string;
  workspaceId: string;
  title: string;
  document: BoardDocument;
  revision: number;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface BoardVersionRecord {
  id: string;
  boardId: string;
  revision: number;
  document: BoardDocument;
  createdAt: string;
  createdBy: string;
  reason: string;
}

interface RepositoryState {
  schemaVersion: typeof STORE_SCHEMA_VERSION;
  users: UserRecord[];
  workspaces: WorkspaceRecord[];
  memberships: MembershipRecord[];
  boards: BoardRecord[];
  versions: BoardVersionRecord[];
}

export interface WorkspaceAccess {
  workspace: WorkspaceRecord;
  role: Role;
}

export interface BoardAccess {
  board: BoardRecord;
  role: Role;
}

export type PersistenceKind = "memory" | "file" | "postgresql";

export interface BoardRepositoryPort {
  readonly persistenceKind: PersistenceKind;
  initialize(): Promise<void>;
  close(): Promise<void>;
  upsertUser(input: {
    email: string;
    displayName: string;
    externalSubject?: string;
  }): Promise<UserRecord>;
  ensurePersonalWorkspace(user: UserRecord): Promise<WorkspaceAccess>;
  listWorkspacesForUser(userId: string): Promise<WorkspaceAccess[]>;
  membership(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipRecord | null>;
  setMembership(input: {
    workspaceId: string;
    userId: string;
    role: Role;
  }): Promise<MembershipRecord>;
  listBoards(workspaceId: string): Promise<BoardRecord[]>;
  boardAccess(boardId: string, userId: string): Promise<BoardAccess>;
  createBoard(input: {
    workspaceId: string;
    title: string;
    actorId: string;
  }): Promise<BoardRecord>;
  saveBoard(input: {
    boardId: string;
    expectedRevision: number;
    document: BoardDocument;
    actorId: string;
    reason: string;
  }): Promise<BoardRecord>;
  listVersions(boardId: string, limit?: number): Promise<BoardVersionRecord[]>;
  restoreVersion(input: {
    boardId: string;
    versionId: string;
    actorId: string;
  }): Promise<BoardRecord>;
}

export interface RepositoryStorage {
  readonly kind: "memory" | "file";
  load(): Promise<RepositoryState | null>;
  save(state: RepositoryState): Promise<void>;
}

export class RepositoryNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RepositoryNotFoundError";
  }
}

export class RepositoryConflictError extends Error {
  readonly currentRevision: number;

  constructor(currentRevision: number) {
    super(`Board changed since revision ${currentRevision}.`);
    this.name = "RepositoryConflictError";
    this.currentRevision = currentRevision;
  }
}

export class RepositoryIdentityConflictError extends Error {
  constructor() {
    super("This verified email is already linked to another identity.");
    this.name = "RepositoryIdentityConflictError";
  }
}

export class MemoryStorage implements RepositoryStorage {
  readonly kind = "memory" as const;
  private snapshot: RepositoryState | null = null;

  async load(): Promise<RepositoryState | null> {
    return this.snapshot ? structuredClone(this.snapshot) : null;
  }

  async save(state: RepositoryState): Promise<void> {
    this.snapshot = structuredClone(state);
  }
}

export class JsonFileStorage implements RepositoryStorage {
  readonly kind = "file" as const;
  private readonly filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async load(): Promise<RepositoryState | null> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as RepositoryState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async save(state: RepositoryState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(state, null, 2), {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(temporaryPath, this.filePath);
  }
}

function emptyState(): RepositoryState {
  return {
    schemaVersion: STORE_SCHEMA_VERSION,
    users: [],
    workspaces: [],
    memberships: [],
    boards: [],
    versions: [],
  };
}

function upgradeState(
  stored:
    | RepositoryState
    | (Omit<RepositoryState, "schemaVersion"> & { schemaVersion: 1 }),
): RepositoryState {
  if (stored.schemaVersion === STORE_SCHEMA_VERSION) return stored;
  if (stored.schemaVersion === 1) {
    return { ...stored, schemaVersion: STORE_SCHEMA_VERSION };
  }
  throw new Error(
    `Unsupported repository schema version '${String((stored as { schemaVersion?: unknown }).schemaVersion)}'.`,
  );
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function now(): string {
  return new Date().toISOString();
}

export class BoardRepository implements BoardRepositoryPort {
  private state: RepositoryState = emptyState();
  private initialized = false;
  private writes: Promise<void> = Promise.resolve();
  readonly storage: RepositoryStorage;

  constructor(storage: RepositoryStorage) {
    this.storage = storage;
  }

  get persistenceKind(): PersistenceKind {
    return this.storage.kind;
  }

  async close(): Promise<void> {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const stored = await this.storage.load();
    if (stored) {
      const upgraded = upgradeState(stored);
      upgraded.boards.forEach((board) => assertBoardDocument(board.document));
      upgraded.versions.forEach((version) =>
        assertBoardDocument(version.document),
      );
      this.state = upgraded;
      if (stored.schemaVersion !== STORE_SCHEMA_VERSION) {
        await this.storage.save(this.state);
      }
    } else {
      await this.storage.save(this.state);
    }
    this.initialized = true;
  }

  private async mutate<T>(operation: () => T): Promise<T> {
    await this.initialize();
    let result!: T;
    const pending = this.writes.then(async () => {
      const before = structuredClone(this.state);
      try {
        result = operation();
        await this.storage.save(this.state);
      } catch (error) {
        this.state = before;
        throw error;
      }
    });
    this.writes = pending.catch(() => undefined);
    await pending;
    return structuredClone(result);
  }

  async upsertUser(input: {
    email: string;
    displayName: string;
    externalSubject?: string;
  }): Promise<UserRecord> {
    return this.mutate(() => {
      const email = normalizedEmail(input.email);
      const externalSubject = input.externalSubject?.trim() || undefined;
      const subjectMatch = externalSubject
        ? this.state.users.find(
            (user) => user.externalSubject === externalSubject,
          )
        : undefined;
      const emailMatch = this.state.users.find((user) => user.email === email);
      if (subjectMatch && emailMatch && subjectMatch.id !== emailMatch.id) {
        throw new RepositoryIdentityConflictError();
      }
      if (
        externalSubject &&
        emailMatch?.externalSubject &&
        emailMatch.externalSubject !== externalSubject
      ) {
        throw new RepositoryIdentityConflictError();
      }
      const existing = subjectMatch ?? emailMatch;
      if (existing) {
        existing.email = email;
        existing.displayName = input.displayName.trim();
        if (externalSubject) existing.externalSubject = externalSubject;
        return existing;
      }
      const user: UserRecord = {
        id: id("usr"),
        email,
        displayName: input.displayName.trim(),
        ...(externalSubject ? { externalSubject } : {}),
        createdAt: now(),
      };
      this.state.users.push(user);
      return user;
    });
  }

  async ensurePersonalWorkspace(user: UserRecord): Promise<WorkspaceAccess> {
    return this.mutate(() => {
      const membership = this.state.memberships.find(
        (candidate) => candidate.userId === user.id,
      );
      if (membership) {
        const workspace = this.state.workspaces.find(
          (candidate) => candidate.id === membership.workspaceId,
        );
        if (workspace) return { workspace, role: membership.role };
      }

      const createdAt = now();
      const workspace: WorkspaceRecord = {
        id: id("wsp"),
        name: `${user.displayName}'s workspace`,
        createdAt,
        createdBy: user.id,
      };
      const owner: MembershipRecord = {
        workspaceId: workspace.id,
        userId: user.id,
        role: "owner",
      };
      this.state.workspaces.push(workspace);
      this.state.memberships.push(owner);
      return { workspace, role: owner.role };
    });
  }

  async listWorkspacesForUser(userId: string): Promise<WorkspaceAccess[]> {
    await this.initialize();
    return this.state.memberships
      .filter((membership) => membership.userId === userId)
      .flatMap((membership) => {
        const workspace = this.state.workspaces.find(
          (candidate) => candidate.id === membership.workspaceId,
        );
        return workspace ? [{ workspace, role: membership.role }] : [];
      })
      .map((access) => structuredClone(access));
  }

  async membership(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    await this.initialize();
    const membership = this.state.memberships.find(
      (candidate) =>
        candidate.workspaceId === workspaceId && candidate.userId === userId,
    );
    return membership ? structuredClone(membership) : null;
  }

  async setMembership(input: {
    workspaceId: string;
    userId: string;
    role: Role;
  }): Promise<MembershipRecord> {
    return this.mutate(() => {
      if (
        !this.state.workspaces.some((item) => item.id === input.workspaceId)
      ) {
        throw new RepositoryNotFoundError(
          `Workspace '${input.workspaceId}' was not found.`,
        );
      }
      if (!this.state.users.some((item) => item.id === input.userId)) {
        throw new RepositoryNotFoundError(
          `User '${input.userId}' was not found.`,
        );
      }
      const existing = this.state.memberships.find(
        (item) =>
          item.workspaceId === input.workspaceId &&
          item.userId === input.userId,
      );
      if (existing) {
        existing.role = input.role;
        return existing;
      }
      const membership: MembershipRecord = { ...input };
      this.state.memberships.push(membership);
      return membership;
    });
  }

  async listBoards(workspaceId: string): Promise<BoardRecord[]> {
    await this.initialize();
    return this.state.boards
      .filter((board) => board.workspaceId === workspaceId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((board) => structuredClone(board));
  }

  async boardAccess(boardId: string, userId: string): Promise<BoardAccess> {
    await this.initialize();
    const board = this.state.boards.find(
      (candidate) => candidate.id === boardId,
    );
    if (!board)
      throw new RepositoryNotFoundError(`Board '${boardId}' was not found.`);
    const membership = this.state.memberships.find(
      (candidate) =>
        candidate.workspaceId === board.workspaceId &&
        candidate.userId === userId,
    );
    if (!membership)
      throw new RepositoryNotFoundError(`Board '${boardId}' was not found.`);
    return structuredClone({ board, role: membership.role });
  }

  async createBoard(input: {
    workspaceId: string;
    title: string;
    actorId: string;
  }): Promise<BoardRecord> {
    return this.mutate(() => {
      const createdAt = now();
      const boardId = id("brd");
      const document = createEmptyBoard({
        boardId,
        title: input.title.trim() || "Untitled board",
      });
      const board: BoardRecord = {
        id: boardId,
        workspaceId: input.workspaceId,
        title: document.title,
        document,
        revision: 1,
        createdAt,
        createdBy: input.actorId,
        updatedAt: createdAt,
        updatedBy: input.actorId,
      };
      this.state.boards.push(board);
      this.state.versions.push({
        id: id("ver"),
        boardId,
        revision: 1,
        document: structuredClone(document),
        createdAt,
        createdBy: input.actorId,
        reason: "Board created",
      });
      return board;
    });
  }

  async saveBoard(input: {
    boardId: string;
    expectedRevision: number;
    document: BoardDocument;
    actorId: string;
    reason: string;
  }): Promise<BoardRecord> {
    const validated = assertBoardDocument(input.document);
    return this.mutate(() => {
      const board = this.state.boards.find(
        (candidate) => candidate.id === input.boardId,
      );
      if (!board)
        throw new RepositoryNotFoundError(
          `Board '${input.boardId}' was not found.`,
        );
      if (board.revision !== input.expectedRevision) {
        throw new RepositoryConflictError(board.revision);
      }
      if (validated.boardId !== board.id) {
        throw new Error("Board document id does not match the route board id.");
      }
      const updatedAt = now();
      const revision = board.revision + 1;
      board.document = structuredClone(validated);
      board.title = validated.title;
      board.revision = revision;
      board.updatedAt = updatedAt;
      board.updatedBy = input.actorId;
      this.state.versions.push({
        id: id("ver"),
        boardId: board.id,
        revision,
        document: structuredClone(validated),
        createdAt: updatedAt,
        createdBy: input.actorId,
        reason: input.reason.trim() || "Autosave",
      });
      return board;
    });
  }

  async listVersions(
    boardId: string,
    limit = 30,
  ): Promise<BoardVersionRecord[]> {
    await this.initialize();
    return this.state.versions
      .filter((version) => version.boardId === boardId)
      .sort((a, b) => b.revision - a.revision)
      .slice(0, Math.max(1, Math.min(limit, 100)))
      .map((version) => structuredClone(version));
  }

  async restoreVersion(input: {
    boardId: string;
    versionId: string;
    actorId: string;
  }): Promise<BoardRecord> {
    return this.mutate(() => {
      const board = this.state.boards.find(
        (candidate) => candidate.id === input.boardId,
      );
      if (!board)
        throw new RepositoryNotFoundError(
          `Board '${input.boardId}' was not found.`,
        );
      const source = this.state.versions.find(
        (candidate) =>
          candidate.id === input.versionId &&
          candidate.boardId === input.boardId,
      );
      if (!source)
        throw new RepositoryNotFoundError(
          `Version '${input.versionId}' was not found.`,
        );
      const restoredAt = now();
      const revision = board.revision + 1;
      const document = structuredClone(source.document);
      document.generation =
        Math.max(document.generation, board.document.generation) + 1;
      board.document = document;
      board.title = document.title;
      board.revision = revision;
      board.updatedAt = restoredAt;
      board.updatedBy = input.actorId;
      this.state.versions.push({
        id: id("ver"),
        boardId: board.id,
        revision,
        document: structuredClone(document),
        createdAt: restoredAt,
        createdBy: input.actorId,
        reason: `Restored revision ${source.revision}`,
      });
      return board;
    });
  }
}
