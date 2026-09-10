import { CURRENT_SCHEMA_VERSION, type BoardDocument } from "./types.ts";
import { assertBoardDocument } from "./validation.ts";

export type BoardMigration = (
  input: Readonly<Record<string, unknown>>,
) => Record<string, unknown>;

const migrations = new Map<number, BoardMigration>();

export function registerMigration(
  fromVersion: number,
  migration: BoardMigration,
): void {
  if (!Number.isInteger(fromVersion) || fromVersion < 1)
    throw new Error("Migration version must be a positive integer.");
  if (migrations.has(fromVersion))
    throw new Error(
      `Migration from version ${fromVersion} is already registered.`,
    );
  migrations.set(fromVersion, migration);
}

export function migrateBoardDocument(input: unknown): BoardDocument {
  if (typeof input !== "object" || input === null || Array.isArray(input))
    throw new Error("Board document must be an object.");
  let working = structuredClone(input) as Record<string, unknown>;
  let version = Number(working.schemaVersion);
  if (!Number.isInteger(version))
    throw new Error("Board document has no valid schema version.");
  if (version > CURRENT_SCHEMA_VERSION)
    throw new Error(
      `Board schema ${version} is newer than this application supports.`,
    );
  while (version < CURRENT_SCHEMA_VERSION) {
    const migration = migrations.get(version);
    if (!migration)
      throw new Error(
        `No migration is registered from board schema ${version}.`,
      );
    working = migration(working);
    version += 1;
    working.schemaVersion = version;
  }
  return assertBoardDocument(working);
}

export function registeredMigrationVersions(): number[] {
  return [...migrations.keys()].sort((a, b) => a - b);
}
