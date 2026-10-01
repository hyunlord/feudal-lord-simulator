// Prints the benchmark cities as JSON, migrated to the current save schema through the save codec, so render
// scripts never inject an old-shape GameState. new game = DEFAULT_GAME_STATE (null: the page's own default).
// Usage: npx tsx scripts/renderFixtureStates.ts [--cities fen_works,coastal_port,...] > states.json
// LAND-UI: the land cities (a grown town per new land, scripts/landStates.ts: seed 1, the bot from a new game for 30,000
// ticks and on to mid-summer; fen_works = the fen town with its three drainage works) take the bot's run each, so they are
// built only when --cities names them; `landTiles` gives each one's camera tile (its town centre, the works' centre).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";
import { fixedSceneState, seedGroundState } from "./boundaryFixtureStates";
import { c25ZonedState } from "./c25Board";
import { fenWorks, grownLand, townCentre } from "./landStates";
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
  readonly fixed12: GameState; readonly seed2: GameState; readonly seed3: GameState; readonly seed4: GameState; readonly c25zoned: GameState; readonly gallery: GameState;
  readonly pop176turn: GameState } {
  const pop176 = decode(newestSaveFixture("population-176.save.json"));
  return {
    newgame: null,
    // Curved-ground evidence (D1a): the 12x12 fixed scene on the new-game map, and the seed 2 final city.
    fixed12: fixedSceneState(),
    seed2: seedGroundState(2),
    // Visual variants (V1): the seed 3 final town, and the injected all-variants x all-conditions gallery.
    seed3: seedGroundState(3),
    // Road portals (D1a-2): a straight gate crossing with the earth-to-stone change.
    seed4: seedGroundState(4),
    // Zone brush (C1b): the C25 board with painted zones.
    c25zoned: c25ZonedState(),
    gallery: variantGallery().state,
    pop176,
    // INSTALL-15 season turn: pop176 80 ticks before autumn turns to winter (27,000); the scene runs 1.5 s before each
    // measured window, so at 1x the turn falls ~2.5 s into the ~4 s window and its 1.5 s change is measured whole.
    pop176turn: { ...pop176, tick: 26_920 },
    // A bare GameState (schema v0); decodeSave migrates it step by step to the current version.
    lots24: decode("fixtures/determinism/seed1/final-state.json"),
  };
}

/** LAND-UI land cities by name, the four new lands and the fen works (the riverside is newgame, pop176, lots24). */
export const LAND_CITIES = { coastal_port: "core:coastal_port", chalk_downs: "core:chalk_downs", forest_edge: "core:forest_edge", fen_drainage: "core:fen_drainage",
  fen_works: "core:fen_drainage" } as const;
export function landBenchmarkCities(names: readonly string[], ticks = 30_000): { cities: Record<string, GameState>; landTiles: Record<string, [number, number]> } {
  const cities: Record<string, GameState> = {}; const landTiles: Record<string, [number, number]> = {};
  for (const name of names) {
    if (!(name in LAND_CITIES)) continue;
    const { summer } = grownLand(LAND_CITIES[name as keyof typeof LAND_CITIES], ticks);
    const city = name === "fen_works" ? fenWorks(summer) : null;
    cities[name] = city?.state ?? summer;
    const tile = city?.focus ?? townCentre(summer);
    landTiles[name] = [tile.tx, tile.ty];
  }
  return { cities, landTiles };
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const at = process.argv.indexOf("--cities");
  const lands = landBenchmarkCities(at > 0 ? (process.argv[at + 1] ?? "").split(",").filter(Boolean) : []);
  process.stdout.write(JSON.stringify({ ...benchmarkCities(), ...lands.cities, landTiles: lands.landTiles, galleryEntries: variantGallery().entries }));
}
