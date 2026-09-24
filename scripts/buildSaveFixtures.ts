// Regenerates fixtures for SAVE_SCHEMA_VERSION with fixed timestamps.
// Usage: tsx scripts/buildSaveFixtures.ts [outputDirectory]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { createAutoplayTraceDriver } from "./economyHarnessAutoplay";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const FIXED_TIME = "2026-09-24T00:00:00.000Z";
const GAME_VERSION = "0.1.0+fixture";
const MAX_GROWTH_TICKS = 400_000;

export const SAVE_FIXTURES = [
  { id: "new-game", description: "DEFAULT_GAME_STATE before the first tick" },
  { id: "population-176", description: "autoplay growth from the default opening, first tick with population >= 176" },
  { id: "palisade-construction", description: "autoplay growth, palisade proclaimed and segments still under construction" },
] as const;

/** The 24-lot L4 city is the v0 seed-1 A'' final state (bare GameState JSON), kept under fixtures/ so CI never reads output/. */
export const V0_SAVE_FIXTURES = ["fixtures/determinism/seed1/final-state.json"];

function palisadeUnderConstruction(state: GameState): boolean {
  return state.palisade !== null && state.palisade.segments.some(segment => !segment.completed)
    && state.palisade.segments.some(segment => segment.completed);
}

export function buildSaveFixtureStates(): Record<(typeof SAVE_FIXTURES)[number]["id"], GameState> {
  const driver = createAutoplayTraceDriver({ id: "b8-fixtures", source: "DEFAULT_GAME_STATE", policy: { maxHousingLots: 24 } });
  let state: GameState = structuredClone(DEFAULT_GAME_STATE);
  let population176: GameState | null = null;
  let palisade: GameState | null = null;
  while ((population176 === null || palisade === null) && state.tick < MAX_GROWTH_TICKS) {
    state = advanceTick(driver.apply(state));
    if (population176 === null && state.population >= 176) population176 = state;
    if (palisade === null && palisadeUnderConstruction(state)) palisade = state;
  }
  if (population176 === null || palisade === null) throw new Error(`Fixture growth stopped at ${state.tick} without every milestone`);
  return { "new-game": structuredClone(DEFAULT_GAME_STATE), "population-176": population176, "palisade-construction": palisade };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const sourceVersion = process.argv[2] === "--from-version" ? Number(process.argv[3]) : null;
  if (sourceVersion !== null && (!Number.isInteger(sourceVersion) || sourceVersion < 1 || sourceVersion >= SAVE_SCHEMA_VERSION)) {
    throw new RangeError("--from-version requires an older released schema version");
  }
  const out = resolve((sourceVersion === null ? process.argv[2] : process.argv[4]) ?? resolve(ROOT, `fixtures/saves/v${SAVE_SCHEMA_VERSION}`));
  mkdirSync(out, { recursive: true });
  const states = sourceVersion === null ? buildSaveFixtureStates() : null;
  // Re-encoding carries every fixture of the source version forward (e.g. v4's hand-added timber-shortage).
  const fixtures: readonly { readonly id: string; readonly description: string }[] = sourceVersion === null ? SAVE_FIXTURES
    : (JSON.parse(readFileSync(resolve(ROOT, `fixtures/saves/v${sourceVersion}/manifest.json`), "utf8")) as { fixtures: { id: string; description: string }[] })
      .fixtures.map(({ id, description }) => ({ id, description }));
  const manifest = fixtures.map(fixture => {
    const sourceFile = sourceVersion === null ? null : `fixtures/saves/v${sourceVersion}/${fixture.id}.save.json`;
    const sourceBytes = sourceFile === null ? null : readFileSync(resolve(ROOT, sourceFile));
    const state = states === null
      ? decodeSave(new Uint8Array(sourceBytes ?? [])).envelope.state
      : states[fixture.id as (typeof SAVE_FIXTURES)[number]["id"]];
    const encoded = encodeSave({ state, createdAt: FIXED_TIME, savedAt: FIXED_TIME, gameVersion: GAME_VERSION });
    writeFileSync(resolve(out, `${fixture.id}.save.json`), encoded.bytes);
    return { ...fixture, ...(sourceBytes === null ? {} : { migratedFrom: sourceVersion, sourceFile,
      sourceSha256: createHash("sha256").update(sourceBytes).digest("hex"), provenance: "Original natural-growth state preserved; re-encoded with the current save schema. Not a new growth run." }),
      file: `${fixture.id}.save.json`, bytes: encoded.bytes.byteLength, tick: state.tick,
      population: state.population, era: state.era, buildings: state.buildings.length, houses: state.houses.length,
      palisadeSegments: state.palisade?.segments.length ?? 0,
      completedPalisadeSegments: state.palisade?.segments.filter(segment => segment.completed).length ?? 0,
      saveSerializeMs: Number(encoded.saveSerializeMs.toFixed(2)) };
  });
  writeFileSync(resolve(out, "manifest.json"), `${JSON.stringify({ schemaVersion: SAVE_SCHEMA_VERSION, fixtures: manifest, v0Fixtures: V0_SAVE_FIXTURES }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}
