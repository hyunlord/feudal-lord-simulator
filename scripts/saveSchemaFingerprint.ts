// Computes the save-schema fingerprint and, with --write, updates the versioned fingerprint.
// Refuses to write when the shape changed but SAVE_SCHEMA_VERSION did not (or has no migration).
// Usage: tsx scripts/saveSchemaFingerprint.ts [--write]
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { SAVE_MIGRATIONS } from "../src/save/migrations";
import { decodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { declaredGameStateKeys, schemaShape } from "../src/save/schemaFingerprint";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const FINGERPRINT_PATH = resolve(ROOT, `src/save/schemaFingerprint.v${SAVE_SCHEMA_VERSION}.json`);
export const FINGERPRINT_FIXTURES = [
  "fixtures/saves/v1/new-game.save.json",
  "fixtures/saves/v1/population-176.save.json",
  "fixtures/saves/v1/palisade-construction.save.json",
  "fixtures/saves/v3/paused-farm.save.json",
  "fixtures/saves/v4/timber-shortage.save.json",
  "fixtures/saves/v5/new-game.save.json",
  "fixtures/saves/v6/zoned-opening.save.json",
  "fixtures/saves/v7/ledger-rollup.save.json",
  "fixtures/saves/v2/new-game.save.json",
  "fixtures/saves/v2/population-176.save.json",
  "fixtures/saves/v2/palisade-construction.save.json",
  "fixtures/determinism/seed1/final-state.json",
] as const;
/** Fixture states are advanced through current code so fields the engine writes appear in the shape. */
const ADVANCE_TICKS = 300;

export const FINGERPRINT_CHANGED_MESSAGE =
  "게임 상태 모양이 바뀌었습니다. SAVE_SCHEMA_VERSION을 올리고 migrations/에 vN→vN+1을 추가한 뒤 지문을 갱신하세요 (npm run save:fingerprint).";

export interface StoredFingerprint {
  readonly schemaVersion: number;
  readonly sha256: string;
  readonly inputs: readonly string[];
  readonly advanceTicks: number;
  readonly paths: readonly string[];
}

export function currentFingerprint(): StoredFingerprint {
  const states: GameState[] = [structuredClone(DEFAULT_GAME_STATE)];
  for (const file of FINGERPRINT_FIXTURES) {
    let state = decodeSave(new Uint8Array(readFileSync(resolve(ROOT, file)))).envelope.state;
    states.push(state);
    for (let tick = 0; tick < ADVANCE_TICKS; tick += 1) state = advanceTick(state);
    states.push(state);
  }
  const declared = declaredGameStateKeys(readFileSync(resolve(ROOT, "src/engine/engine.types.ts"), "utf8"));
  const shape = schemaShape(states, declared);
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    sha256: createHash("sha256").update(shape.sha256Input).digest("hex"),
    inputs: ["DEFAULT_GAME_STATE", ...FINGERPRINT_FIXTURES, "interface GameState keys (src/engine/engine.types.ts)"],
    advanceTicks: ADVANCE_TICKS,
    paths: shape.paths,
  };
}

export function readStoredFingerprint(): StoredFingerprint | null {
  return existsSync(FINGERPRINT_PATH) ? JSON.parse(readFileSync(FINGERPRINT_PATH, "utf8")) as StoredFingerprint : null;
}

export function diffPaths(before: readonly string[], after: readonly string[]): { added: string[]; removed: string[] } {
  const a = new Set(before), b = new Set(after);
  return { added: after.filter(path => !a.has(path)), removed: before.filter(path => !b.has(path)) };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const write = process.argv.includes("--write");
  const current = currentFingerprint();
  const previousPath = resolve(ROOT, `src/save/schemaFingerprint.v${SAVE_SCHEMA_VERSION - 1}.json`);
  const stored = readStoredFingerprint() ?? (existsSync(previousPath)
    ? JSON.parse(readFileSync(previousPath, "utf8")) as StoredFingerprint : null);
  if (stored !== null && stored.sha256 === current.sha256 && stored.schemaVersion === current.schemaVersion) {
    process.stdout.write(`save schema fingerprint unchanged (v${current.schemaVersion}, ${current.sha256.slice(0, 12)})\n`);
  } else if (!write) {
    process.stdout.write(`fingerprint differs: stored v${stored?.schemaVersion ?? "-"} ${stored?.sha256.slice(0, 12) ?? "-"} → current v${current.schemaVersion} ${current.sha256.slice(0, 12)}\n`);
    process.exitCode = 1;
  } else if (stored !== null && stored.sha256 !== current.sha256 && current.schemaVersion <= stored.schemaVersion) {
    const diff = diffPaths(stored.paths, current.paths);
    process.stderr.write(`Refusing to update: the state shape changed but SAVE_SCHEMA_VERSION is still ${current.schemaVersion}.\n` +
      `${FINGERPRINT_CHANGED_MESSAGE}\nadded: ${diff.added.slice(0, 20).join(", ")}\nremoved: ${diff.removed.slice(0, 20).join(", ")}\n`);
    process.exitCode = 1;
  } else if (!SAVE_MIGRATIONS.some(step => step.to === current.schemaVersion) && current.schemaVersion > 0) {
    process.stderr.write(`Refusing to update: no migration reaches schema ${current.schemaVersion}.\n`);
    process.exitCode = 1;
  } else {
    writeFileSync(FINGERPRINT_PATH, `${JSON.stringify(current, null, 2)}\n`);
    process.stdout.write(`wrote ${FINGERPRINT_PATH} (v${current.schemaVersion}, ${current.sha256.slice(0, 12)}, ${current.paths.length} paths)\n`);
  }
}
