// Prints the benchmark cities as JSON, migrated to the current save schema through the save codec, so render
// scripts never inject an old-shape GameState. new game = DEFAULT_GAME_STATE (null: the page's own default).
// Usage: npx tsx scripts/renderFixtureStates.ts > states.json
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";
import { fixedSceneState, seedGroundState } from "./boundaryFixtureStates";
import { variantGallery } from "./variantGalleryState";

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

export function benchmarkCities(): { readonly newgame: null; readonly pop176: GameState; readonly lots24: GameState;
  readonly fixed12: GameState; readonly seed2: GameState; readonly seed3: GameState; readonly seed4: GameState; readonly gallery: GameState } {
  return {
    newgame: null,
    // Curved-ground evidence (D1a): the 12x12 fixed scene on the new-game map, and the seed 2 final city.
    fixed12: fixedSceneState(),
    seed2: seedGroundState(2),
    // Visual variants (V1): the seed 3 final town, and the injected all-variants x all-conditions gallery.
    seed3: seedGroundState(3),
    // Road portals (D1a-2): a straight gate crossing with the earth-to-stone change.
    seed4: seedGroundState(4),
    gallery: variantGallery().state,
    pop176: decode(newestSaveFixture("population-176.save.json")),
    // A bare GameState (schema v0); decodeSave migrates it step by step to the current version.
    lots24: decode("fixtures/determinism/seed1/final-state.json"),
  };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(JSON.stringify({ ...benchmarkCities(), galleryEntries: variantGallery().entries }));
}
