import { SAVE_SCHEMA_VERSION } from "../saveTypes";
import { migrateV0ToV1 } from "./v0ToV1";

export interface SaveMigration {
  readonly from: number;
  readonly to: number;
  readonly migrate: (input: unknown) => unknown;
}

/** One step per schema bump: v0→v1→v2… Each step only knows its two neighbours. */
export const SAVE_MIGRATIONS: readonly SaveMigration[] = [
  { from: 0, to: 1, migrate: migrateV0ToV1 },
];

export class SaveMigrationError extends Error {}

/**
 * v0 is the pre-envelope format: a bare GameState JSON object, as the growth and
 * verification scripts write to final-state.json.
 */
export function saveSchemaVersionOf(raw: unknown): number {
  if (typeof raw !== "object" || raw === null) throw new SaveMigrationError("Save is not a JSON object");
  const record = raw as Record<string, unknown>;
  if (typeof record.schemaVersion === "number") return record.schemaVersion;
  if (Array.isArray(record.tiles) && typeof record.tick === "number") return 0;
  throw new SaveMigrationError("Save has no schemaVersion and is not a v0 state");
}

export function migrateSaveToLatest(raw: unknown): { readonly value: unknown; readonly fromVersion: number } {
  const fromVersion = saveSchemaVersionOf(raw);
  if (fromVersion > SAVE_SCHEMA_VERSION) {
    throw new SaveMigrationError(`Save schema ${fromVersion} is newer than this game (${SAVE_SCHEMA_VERSION})`);
  }
  let version = fromVersion;
  let value = raw;
  while (version < SAVE_SCHEMA_VERSION) {
    const step = SAVE_MIGRATIONS.find(migration => migration.from === version);
    if (step === undefined) throw new SaveMigrationError(`No save migration from schema ${version}`);
    value = step.migrate(value);
    version = step.to;
  }
  return { value, fromVersion };
}
