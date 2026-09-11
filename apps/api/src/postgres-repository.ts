import {
  assertBoardDocument,
  createEmptyBoard,
  type BoardDocument,
} from "@huddlecanvas/board-schema";
import type { Role } from "@huddlecanvas/authz";
import type { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

import {
  RepositoryConflictError,
  RepositoryIdentityConflictError,
  RepositoryNotFoundError,
  type BoardAccess,
  type BoardRecord,
  type BoardRepositoryPort,
  type BoardVersionRecord,
  type MembershipRecord,
  type UserRecord,
  type WorkspaceAccess,
  type WorkspaceRecord,
} from "./repository.ts";

export const POSTGRES_SCHEMA_SQL = `
BEGIN;

CREATE TABLE IF NOT EXISTS huddlecanvas_users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  external_subject text UNIQUE,
  created_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS huddlecanvas_workspaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL REFERENCES huddlecanvas_users(id),
  personal_owner_id text UNIQUE REFERENCES huddlecanvas_users(id)
);

CREATE TABLE IF NOT EXISTS huddlecanvas_memberships (
  workspace_id text NOT NULL REFERENCES huddlecanvas_workspaces(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES huddlecanvas_users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'editor', 'commenter', 'viewer', 'guest-session')),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS huddlecanvas_boards (
  id text PRIMARY KEY,
  workspace_id text NOT NULL REFERENCES huddlecanvas_workspaces(id) ON DELETE CASCADE,
  title text NOT NULL,
  document jsonb NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  created_at timestamptz NOT NULL,
  created_by text NOT NULL REFERENCES huddlecanvas_users(id),
  updated_at timestamptz NOT NULL,
  updated_by text NOT NULL REFERENCES huddlecanvas_users(id)
);

CREATE INDEX IF NOT EXISTS huddlecanvas_boards_workspace_updated
  ON huddlecanvas_boards (workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS huddlecanvas_board_versions (
  id text PRIMARY KEY,
  board_id text NOT NULL REFERENCES huddlecanvas_boards(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision > 0),
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  created_by text NOT NULL REFERENCES huddlecanvas_users(id),
  reason text NOT NULL,
  UNIQUE (board_id, revision)
);

CREATE INDEX IF NOT EXISTS huddlecanvas_versions_board_revision
  ON huddlecanvas_board_versions (board_id, revision DESC);

COMMIT;
`;

interface UserRow extends QueryResultRow {
  id: string;
  email: string;
  display_name: string;
  external_subject: string | null;
  created_at: Date | string;
}

interface WorkspaceRow extends QueryResultRow {
  id: string;
  name: string;
  created_at: Date | string;
  created_by: string;
}

interface MembershipRow extends QueryResultRow {
  workspace_id: string;
  user_id: string;
  role: Role;
}

interface BoardRow extends QueryResultRow {
  id: string;
  workspace_id: string;
  title: string;
  document: BoardDocument | string;
  revision: number;
  created_at: Date | string;
  created_by: string;
  updated_at: Date | string;
  updated_by: string;
}

interface VersionRow extends QueryResultRow {
  id: string;
  board_id: string;
  revision: number;
  document: BoardDocument | string;
  created_at: Date | string;
  created_by: string;
  reason: string;
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function timestamp(value: Date | string): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function document(value: BoardDocument | string): BoardDocument {
  return assertBoardDocument(
    typeof value === "string" ? (JSON.parse(value) as unknown) : value,
  );
}

function userRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    ...(row.external_subject ? { externalSubject: row.external_subject } : {}),
    createdAt: timestamp(row.created_at),
  };
}

function workspaceRecord(row: WorkspaceRow): WorkspaceRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: timestamp(row.created_at),
    createdBy: row.created_by,
  };
}

function membershipRecord(row: MembershipRow): MembershipRecord {
  return {
    workspaceId: row.workspace_id,
    userId: row.user_id,
    role: row.role,
  };
}

function boardRecord(row: BoardRow): BoardRecord {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    title: row.title,
    document: document(row.document),
    revision: Number(row.revision),
    createdAt: timestamp(row.created_at),
    createdBy: row.created_by,
    updatedAt: timestamp(row.updated_at),
    updatedBy: row.updated_by,
  };
}

function versionRecord(row: VersionRow): BoardVersionRecord {
  return {
    id: row.id,
    boardId: row.board_id,
    revision: Number(row.revision),
    document: document(row.document),
    createdAt: timestamp(row.created_at),
    createdBy: row.created_by,
    reason: row.reason,
  };
}

const USER_COLUMNS = "id, email, display_name, external_subject, created_at";
const WORKSPACE_COLUMNS = "id, name, created_at, created_by";
const MEMBERSHIP_COLUMNS = "workspace_id, user_id, role";
const BOARD_COLUMNS =
  "id, workspace_id, title, document, revision, created_at, created_by, updated_at, updated_by";
const VERSION_COLUMNS =
  "id, board_id, revision, document, created_at, created_by, reason";

export class PostgresBoardRepository implements BoardRepositoryPort {
  readonly persistenceKind = "postgresql" as const;
  private initialized = false;
  private readonly pool: Pool;
  private readonly options: { migrate?: boolean; closePool?: boolean };

  constructor(
    pool: Pool,
    options: { migrate?: boolean; closePool?: boolean } = {},
  ) {
    this.pool = pool;
    this.options = options;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.options.migrate !== false) {
      await this.pool.query(POSTGRES_SCHEMA_SQL);
    }
    this.initialized = true;
  }

  async close(): Promise<void> {
    if (this.options.closePool !== false) await this.pool.end();
  }

  private async transaction<T>(
    operation: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async upsertUser(input: {
    email: string;
    displayName: string;
    externalSubject?: string;
  }): Promise<UserRecord> {
    await this.initialize();
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim();
    const externalSubject = input.externalSubject?.trim() || null;
    try {
      return await this.transaction(async (client) => {
        const existing = await client.query<UserRow>(
          `SELECT ${USER_COLUMNS}
           FROM huddlecanvas_users
          WHERE email = $1 OR ($2::text IS NOT NULL AND external_subject = $2)
          FOR UPDATE`,
          [email, externalSubject],
        );
        const subjectMatch = existing.rows.find(
          (row) => row.external_subject === externalSubject,
        );
        const emailMatch = existing.rows.find((row) => row.email === email);
        if (
          (subjectMatch && emailMatch && subjectMatch.id !== emailMatch.id) ||
          (externalSubject &&
            emailMatch?.external_subject &&
            emailMatch.external_subject !== externalSubject)
        ) {
          throw new RepositoryIdentityConflictError();
        }
        const row = subjectMatch ?? emailMatch;
        if (row) {
          const updated = await client.query<UserRow>(
            `UPDATE huddlecanvas_users
              SET email = $2,
                  display_name = $3,
                  external_subject = COALESCE($4, external_subject)
            WHERE id = $1
        RETURNING ${USER_COLUMNS}`,
            [row.id, email, displayName, externalSubject],
          );
          return userRecord(updated.rows[0]!);
        }
        const created = await client.query<UserRow>(
          `INSERT INTO huddlecanvas_users
          (id, email, display_name, external_subject, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (email) DO UPDATE
         SET display_name = EXCLUDED.display_name,
             external_subject = COALESCE(EXCLUDED.external_subject, huddlecanvas_users.external_subject)
         RETURNING ${USER_COLUMNS}`,
          [id("usr"), email, displayName, externalSubject],
        );
        return userRecord(created.rows[0]!);
      });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        throw new RepositoryIdentityConflictError();
      }
      throw error;
    }
  }

  async ensurePersonalWorkspace(user: UserRecord): Promise<WorkspaceAccess> {
    await this.initialize();
    return this.transaction(async (client) => {
      const existing = await client.query<WorkspaceRow & { role: Role }>(
        `SELECT w.${WORKSPACE_COLUMNS.split(", ").join(", w.")}, m.role
           FROM huddlecanvas_workspaces w
           JOIN huddlecanvas_memberships m ON m.workspace_id = w.id
          WHERE w.personal_owner_id = $1 AND m.user_id = $1
          LIMIT 1
          FOR UPDATE`,
        [user.id],
      );
      if (existing.rows[0]) {
        return {
          workspace: workspaceRecord(existing.rows[0]),
          role: existing.rows[0].role,
        };
      }
      const created = await client.query<WorkspaceRow>(
        `INSERT INTO huddlecanvas_workspaces
          (id, name, created_at, created_by, personal_owner_id)
         VALUES ($1, $2, NOW(), $3, $3)
         ON CONFLICT (personal_owner_id) DO UPDATE SET name = huddlecanvas_workspaces.name
         RETURNING ${WORKSPACE_COLUMNS}`,
        [id("wsp"), `${user.displayName}'s workspace`, user.id],
      );
      const workspace = workspaceRecord(created.rows[0]!);
      await client.query(
        `INSERT INTO huddlecanvas_memberships (workspace_id, user_id, role)
         VALUES ($1, $2, 'owner')
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = 'owner'`,
        [workspace.id, user.id],
      );
      return { workspace, role: "owner" };
    });
  }

  async listWorkspacesForUser(userId: string): Promise<WorkspaceAccess[]> {
    await this.initialize();
    const result = await this.pool.query<WorkspaceRow & { role: Role }>(
      `SELECT w.${WORKSPACE_COLUMNS.split(", ").join(", w.")}, m.role
         FROM huddlecanvas_workspaces w
         JOIN huddlecanvas_memberships m ON m.workspace_id = w.id
        WHERE m.user_id = $1
        ORDER BY w.created_at ASC`,
      [userId],
    );
    return result.rows.map((row) => ({
      workspace: workspaceRecord(row),
      role: row.role,
    }));
  }

  async membership(
    workspaceId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    await this.initialize();
    const result = await this.pool.query<MembershipRow>(
      `SELECT ${MEMBERSHIP_COLUMNS}
         FROM huddlecanvas_memberships
        WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId],
    );
    return result.rows[0] ? membershipRecord(result.rows[0]) : null;
  }

  async setMembership(input: {
    workspaceId: string;
    userId: string;
    role: Role;
  }): Promise<MembershipRecord> {
    await this.initialize();
    try {
      const result = await this.pool.query<MembershipRow>(
        `INSERT INTO huddlecanvas_memberships (workspace_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role
         RETURNING ${MEMBERSHIP_COLUMNS}`,
        [input.workspaceId, input.userId, input.role],
      );
      return membershipRecord(result.rows[0]!);
    } catch (error) {
      if ((error as { code?: string }).code === "23503") {
        throw new RepositoryNotFoundError("Workspace or user was not found.");
      }
      throw error;
    }
  }

  async listBoards(workspaceId: string): Promise<BoardRecord[]> {
    await this.initialize();
    const result = await this.pool.query<BoardRow>(
      `SELECT ${BOARD_COLUMNS}
         FROM huddlecanvas_boards
        WHERE workspace_id = $1
        ORDER BY updated_at DESC`,
      [workspaceId],
    );
    return result.rows.map(boardRecord);
  }

  async boardAccess(boardId: string, userId: string): Promise<BoardAccess> {
    await this.initialize();
    const result = await this.pool.query<BoardRow & { role: Role }>(
      `SELECT b.${BOARD_COLUMNS.split(", ").join(", b.")}, m.role
         FROM huddlecanvas_boards b
         JOIN huddlecanvas_memberships m ON m.workspace_id = b.workspace_id
        WHERE b.id = $1 AND m.user_id = $2`,
      [boardId, userId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new RepositoryNotFoundError(`Board '${boardId}' was not found.`);
    }
    return { board: boardRecord(row), role: row.role };
  }

  async createBoard(input: {
    workspaceId: string;
    title: string;
    actorId: string;
  }): Promise<BoardRecord> {
    await this.initialize();
    const boardId = id("brd");
    const created = createEmptyBoard({
      boardId,
      title: input.title.trim() || "Untitled board",
    });
    return this.transaction(async (client) => {
      const board = await client.query<BoardRow>(
        `INSERT INTO huddlecanvas_boards
          (id, workspace_id, title, document, revision, created_at, created_by, updated_at, updated_by)
         VALUES ($1, $2, $3, $4::jsonb, 1, NOW(), $5, NOW(), $5)
         RETURNING ${BOARD_COLUMNS}`,
        [
          boardId,
          input.workspaceId,
          created.title,
          JSON.stringify(created),
          input.actorId,
        ],
      );
      await client.query(
        `INSERT INTO huddlecanvas_board_versions
          (id, board_id, revision, document, created_at, created_by, reason)
         VALUES ($1, $2, 1, $3::jsonb, NOW(), $4, 'Board created')`,
        [id("ver"), boardId, JSON.stringify(created), input.actorId],
      );
      return boardRecord(board.rows[0]!);
    });
  }

  async saveBoard(input: {
    boardId: string;
    expectedRevision: number;
    document: BoardDocument;
    actorId: string;
    reason: string;
  }): Promise<BoardRecord> {
    await this.initialize();
    const validated = assertBoardDocument(input.document);
    if (validated.boardId !== input.boardId) {
      throw new Error("Board document id does not match the route board id.");
    }
    return this.transaction(async (client) => {
      const locked = await client.query<BoardRow>(
        `SELECT ${BOARD_COLUMNS}
           FROM huddlecanvas_boards
          WHERE id = $1
          FOR UPDATE`,
        [input.boardId],
      );
      const current = locked.rows[0];
      if (!current) {
        throw new RepositoryNotFoundError(
          `Board '${input.boardId}' was not found.`,
        );
      }
      if (Number(current.revision) !== input.expectedRevision) {
        throw new RepositoryConflictError(Number(current.revision));
      }
      const revision = Number(current.revision) + 1;
      const updated = await client.query<BoardRow>(
        `UPDATE huddlecanvas_boards
            SET title = $2,
                document = $3::jsonb,
                revision = $4,
                updated_at = NOW(),
                updated_by = $5
          WHERE id = $1
          RETURNING ${BOARD_COLUMNS}`,
        [
          input.boardId,
          validated.title,
          JSON.stringify(validated),
          revision,
          input.actorId,
        ],
      );
      await client.query(
        `INSERT INTO huddlecanvas_board_versions
          (id, board_id, revision, document, created_at, created_by, reason)
         VALUES ($1, $2, $3, $4::jsonb, NOW(), $5, $6)`,
        [
          id("ver"),
          input.boardId,
          revision,
          JSON.stringify(validated),
          input.actorId,
          input.reason.trim() || "Autosave",
        ],
      );
      return boardRecord(updated.rows[0]!);
    });
  }

  async listVersions(
    boardId: string,
    limit = 30,
  ): Promise<BoardVersionRecord[]> {
    await this.initialize();
    const safeLimit = Math.max(1, Math.min(limit, 100));
    const result = await this.pool.query<VersionRow>(
      `SELECT ${VERSION_COLUMNS}
         FROM huddlecanvas_board_versions
        WHERE board_id = $1
        ORDER BY revision DESC
        LIMIT $2`,
      [boardId, safeLimit],
    );
    return result.rows.map(versionRecord);
  }

  async restoreVersion(input: {
    boardId: string;
    versionId: string;
    actorId: string;
  }): Promise<BoardRecord> {
    await this.initialize();
    return this.transaction(async (client) => {
      const locked = await client.query<BoardRow>(
        `SELECT ${BOARD_COLUMNS}
           FROM huddlecanvas_boards
          WHERE id = $1
          FOR UPDATE`,
        [input.boardId],
      );
      const current = locked.rows[0];
      if (!current) {
        throw new RepositoryNotFoundError(
          `Board '${input.boardId}' was not found.`,
        );
      }
      const sourceResult = await client.query<VersionRow>(
        `SELECT ${VERSION_COLUMNS}
           FROM huddlecanvas_board_versions
          WHERE id = $1 AND board_id = $2`,
        [input.versionId, input.boardId],
      );
      const source = sourceResult.rows[0];
      if (!source) {
        throw new RepositoryNotFoundError(
          `Version '${input.versionId}' was not found.`,
        );
      }
      const restored = structuredClone(document(source.document));
      const currentDocument = document(current.document);
      restored.generation =
        Math.max(restored.generation, currentDocument.generation) + 1;
      const revision = Number(current.revision) + 1;
      const updated = await client.query<BoardRow>(
        `UPDATE huddlecanvas_boards
            SET title = $2,
                document = $3::jsonb,
                revision = $4,
                updated_at = NOW(),
                updated_by = $5
          WHERE id = $1
          RETURNING ${BOARD_COLUMNS}`,
        [
          input.boardId,
          restored.title,
          JSON.stringify(restored),
          revision,
          input.actorId,
        ],
      );
      await client.query(
        `INSERT INTO huddlecanvas_board_versions
          (id, board_id, revision, document, created_at, created_by, reason)
         VALUES ($1, $2, $3, $4::jsonb, NOW(), $5, $6)`,
        [
          id("ver"),
          input.boardId,
          revision,
          JSON.stringify(restored),
          input.actorId,
          `Restored revision ${source.revision}`,
        ],
      );
      return boardRecord(updated.rows[0]!);
    });
  }
}
