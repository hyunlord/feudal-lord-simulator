import { migrateV3ToV4 } from './v3ToV4';
import { migrateV4ToV5 } from './v4ToV5';
import { migrateV5ToV6 } from './v5ToV6';
import { SAVE_SCHEMA_VERSION } from "../saveTypes";
import { migrateV0ToV1 } from "./v0ToV1";
import { migrateV2ToV3 } from "./v2ToV3";
import { migrateV1ToV2 } from "./v1ToV2";

export interface SaveMigration {
  readonly from: number;
  readonly to: number;
  readonly migrate: (input: unknown) => unknown;
}

/** One step per schema bump: v0→v1→v2… Each step only knows its two neighbours. */
export const SAVE_MIGRATIONS: readonly SaveMigration[] = [
  { from: 0, to: 1, migrate: migrateV0ToV1 },
  { from: 1, to: 2, migrate: migrateV1ToV2 },
  { from: 2, to: 3, migrate: migrateV2ToV3 },
  { from: 3, to: 4, migrate: migrateV3ToV4 },
  { from: 4, to: 5, migrate: migrateV4ToV5 },
  { from: 5, to: 6, migrate: migrateV5ToV6 },
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
