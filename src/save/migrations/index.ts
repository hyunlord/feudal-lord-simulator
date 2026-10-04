import { migrateV3ToV4 } from './v3ToV4';
import { migrateV4ToV5 } from './v4ToV5';
import { migrateV5ToV6 } from './v5ToV6';
import { migrateV6ToV7 } from './v6ToV7';
import { migrateV7ToV8 } from './v7ToV8';
import { migrateV8ToV9 } from './v8ToV9';
import { migrateV9ToV10 } from './v9ToV10';
import { migrateV10ToV11 } from './v10ToV11';
import { migrateV11ToV12 } from './v11ToV12';
import { migrateV12ToV13 } from './v12ToV13';
import { migrateV13ToV14 } from './v13ToV14';
import { migrateV14ToV15 } from './v14ToV15';
import { migrateV15ToV16 } from './v15ToV16';
import { migrateV16ToV17 } from './v16ToV17';
import { migrateV17ToV18 } from './v17ToV18';
import { migrateV18ToV19 } from './v18ToV19';
import { migrateV19ToV20 } from './v19ToV20';
import { migrateV20ToV21 } from './v20ToV21';
import { migrateV21ToV22 } from './v21ToV22';
import { migrateV22ToV23 } from './v22ToV23';
import { migrateV23ToV24 } from './v23ToV24';
import { migrateV24ToV25 } from './v24ToV25';
import { migrateV25ToV26 } from './v25ToV26';
import { migrateV26ToV27 } from './v26ToV27';
import { migrateV27ToV28 } from './v27ToV28';
import { migrateV28ToV29 } from './v28ToV29';
import { migrateV29ToV30 } from './v29ToV30';
import { migrateV30ToV31 } from './v30ToV31';
import { migrateV31ToV32 } from './v31ToV32';
import { migrateV32ToV33 } from './v32ToV33';
import { migrateV33ToV34 } from './v33ToV34';
import { migrateV34ToV35 } from './v34ToV35';
import { migrateV35ToV36 } from './v35ToV36';
import { migrateV36ToV37 } from './v36ToV37';
import { migrateV37ToV38 } from './v37ToV38';
import { migrateV38ToV39 } from './v38ToV39';
import { migrateV39ToV40 } from './v39ToV40';
import { migrateV40ToV41 } from './v40ToV41';
import { migrateV41ToV42 } from './v41ToV42';
import { migrateV42ToV43 } from './v42ToV43';
import { migrateV43ToV44 } from './v43ToV44';
import { migrateV44ToV45 } from './v44ToV45';
import { migrateV45ToV46 } from './v45ToV46';
import { migrateV46ToV47 } from './v46ToV47';
import { migrateV47ToV48 } from './v47ToV48';
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
  { from: 6, to: 7, migrate: migrateV6ToV7 },
  { from: 7, to: 8, migrate: migrateV7ToV8 },
  { from: 8, to: 9, migrate: migrateV8ToV9 },
  { from: 9, to: 10, migrate: migrateV9ToV10 },
  { from: 10, to: 11, migrate: migrateV10ToV11 },
  { from: 11, to: 12, migrate: migrateV11ToV12 },
  { from: 12, to: 13, migrate: migrateV12ToV13 },
  { from: 13, to: 14, migrate: migrateV13ToV14 },
  { from: 14, to: 15, migrate: migrateV14ToV15 },
  { from: 15, to: 16, migrate: migrateV15ToV16 },
  { from: 16, to: 17, migrate: migrateV16ToV17 },
  { from: 17, to: 18, migrate: migrateV17ToV18 },
  { from: 18, to: 19, migrate: migrateV18ToV19 },
  { from: 19, to: 20, migrate: migrateV19ToV20 },
  { from: 20, to: 21, migrate: migrateV20ToV21 },
  { from: 21, to: 22, migrate: migrateV21ToV22 },
  { from: 22, to: 23, migrate: migrateV22ToV23 },
  { from: 23, to: 24, migrate: migrateV23ToV24 },
  { from: 24, to: 25, migrate: migrateV24ToV25 },
  { from: 25, to: 26, migrate: migrateV25ToV26 },
  { from: 26, to: 27, migrate: migrateV26ToV27 },
  { from: 27, to: 28, migrate: migrateV27ToV28 },
  { from: 28, to: 29, migrate: migrateV28ToV29 },
  { from: 29, to: 30, migrate: migrateV29ToV30 },
  { from: 30, to: 31, migrate: migrateV30ToV31 },
  { from: 31, to: 32, migrate: migrateV31ToV32 },
  { from: 32, to: 33, migrate: migrateV32ToV33 },
  { from: 33, to: 34, migrate: migrateV33ToV34 },
  { from: 34, to: 35, migrate: migrateV34ToV35 },
  { from: 35, to: 36, migrate: migrateV35ToV36 },
  { from: 36, to: 37, migrate: migrateV36ToV37 },
  { from: 37, to: 38, migrate: migrateV37ToV38 },
  { from: 38, to: 39, migrate: migrateV38ToV39 },
  { from: 39, to: 40, migrate: migrateV39ToV40 },
  { from: 40, to: 41, migrate: migrateV40ToV41 },
  { from: 41, to: 42, migrate: migrateV41ToV42 },
  { from: 42, to: 43, migrate: migrateV42ToV43 },
  { from: 43, to: 44, migrate: migrateV43ToV44 },
  { from: 44, to: 45, migrate: migrateV44ToV45 },
  { from: 45, to: 46, migrate: migrateV45ToV46 },
  { from: 46, to: 47, migrate: migrateV46ToV47 },
  { from: 47, to: 48, migrate: migrateV47ToV48 },
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
