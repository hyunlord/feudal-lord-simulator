// Prints the benchmark cities as JSON, migrated to the current save schema through the save codec, so render
// scripts never inject an old-shape GameState. new game = DEFAULT_GAME_STATE (null: the page's own default).
// Usage: npx tsx scripts/renderFixtureStates.ts > states.json
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const decode = (file: string) => decodeSave(new Uint8Array(readFileSync(resolve(ROOT, file)))).envelope.state;

/** population-176 from the newest fixtures/saves/vN that has it. */
function newestSaveFixture(name: string): string {
  const versions = readdirSync(resolve(ROOT, "fixtures/saves")).filter(entry => /^v\d+$/.test(entry))
    .sort((a, b) => Number(b.slice(1)) - Number(a.slice(1)));
  const version = versions.find(entry => existsSync(resolve(ROOT, "fixtures/saves", entry, name)));
  if (version === undefined) throw new Error(`No fixtures/saves/vN/${name}`);
  return `fixtures/saves/${version}/${name}`;
}

export function benchmarkCities(): { readonly newgame: null; readonly pop176: GameState; readonly lots24: GameState } {
  return {
    newgame: null,
    pop176: decode(newestSaveFixture("population-176.save.json")),
    // A bare GameState (schema v0); decodeSave migrates it step by step to the current version.
    lots24: decode("fixtures/determinism/seed1/final-state.json"),
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify(benchmarkCities()));
}
