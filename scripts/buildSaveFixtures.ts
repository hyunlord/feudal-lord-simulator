// Regenerates fixtures/saves/v1/*.save.json with fixed timestamps so the files are reproducible.
// Usage: tsx scripts/buildSaveFixtures.ts [outputDirectory=fixtures/saves/v1]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { encodeSave } from "../src/save/saveCodec";
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

/** The 24-lot L4 city is not duplicated as a v1 fixture: the five v0 seed final states already in the repo cover it. */
export const V0_SAVE_FIXTURES = [1, 2, 3, 4, 5].map(seed => `output/playtest-a-double-prime/seeds/final-689bda7/seed${seed}/final-state.json`);

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
  const out = resolve(process.argv[2] ?? resolve(ROOT, "fixtures/saves/v1"));
  mkdirSync(out, { recursive: true });
  const states = buildSaveFixtureStates();
  const manifest = SAVE_FIXTURES.map(fixture => {
    const state = states[fixture.id];
    const encoded = encodeSave({ state, createdAt: FIXED_TIME, savedAt: FIXED_TIME, gameVersion: GAME_VERSION });
    writeFileSync(resolve(out, `${fixture.id}.save.json`), encoded.bytes);
    return { ...fixture, file: `${fixture.id}.save.json`, bytes: encoded.bytes.byteLength, tick: state.tick,
      population: state.population, era: state.era, buildings: state.buildings.length, houses: state.houses.length,
      palisadeSegments: state.palisade?.segments.length ?? 0,
      completedPalisadeSegments: state.palisade?.segments.filter(segment => segment.completed).length ?? 0,
      saveSerializeMs: Number(encoded.saveSerializeMs.toFixed(2)) };
  });
  writeFileSync(resolve(out, "manifest.json"), `${JSON.stringify({ schemaVersion: 1, fixtures: manifest, v0Fixtures: V0_SAVE_FIXTURES }, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}
