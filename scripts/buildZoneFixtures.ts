// Builds fixtures/zones/town-with-arable.json from a natural seed-2 growth state (bare GameState JSON),
// and with --zoned-save the v6 save fixture that carries zones (so the schema watcher sees the Zone shape).
// Usage: tsx scripts/buildZoneFixtures.ts <seed-2 final-state.json> | --zoned-save
// The B2 guardrail run (efficientGrowthRun.ts 24 1200000 <out> 2 at 21caf65) wrote the source used in
// the committed fixture; its sha256 is recorded in the fixture. Tests read only the committed fixture.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { GameState } from "../src/engine/engine.types";
import { placeRoadLine } from "../src/engine/gameActions";
import { encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { gameReducer, DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { planZoneFill } from "../src/zones/zoneFillAgent";
import { rasterizeZoneStroke } from "../src/zones/zoneRaster";
import { cellInsideWall } from "../src/zones/zoneEdits";
import type { ZoneStroke } from "../src/zones/zone.types";

const ROOT = fileURLToPath(new URL("../", import.meta.url));

/** Fields placement and zone rules read. Walkers, path cache and autoplay memory are dropped. */
const KEPT_KEYS = [
  "scenarioId", "settlement", "tick", "seed", "tiles", "width", "height", "buildings", "constructionSites", "houses",
  "population", "idleWorkers", "treasuryTimber", "treasuryCoin", "wallTick", "era", "eraProclaimedTick", "palisade",
  "forestHarvests", "nextConstructionOrdinal", "roadRevision",
] as const satisfies readonly (keyof GameState)[];

/** West of the wall, beside the western road (column 38): grass, rock and one farm. */
export const OUTSIDE_ARABLE: ZoneStroke = { tool: "polygon", points: [{ x: 26, y: 40 }, { x: 38, y: 40 }, { x: 38, y: 48 }, { x: 26, y: 48 }] };
/** Inside the stone-and-timber wall, east of the market street. */
export const INSIDE_ARABLE: ZoneStroke = { tool: "polygon", points: [{ x: 44, y: 38 }, { x: 52, y: 38 }, { x: 52, y: 42 }, { x: 44, y: 42 }] };
/** A burgage brush along the western road, north of the arable block. */
export const OUTSIDE_BURGAGE: ZoneStroke = { tool: "brush", radius: 1.5, points: [{ x: 36.5, y: 30.5 }, { x: 36.5, y: 38.5 }] };

/** The opening village with a road south, a burgage brush along it, an arable block west and the first fill batch. */
export function zonedOpeningState(): GameState {
  let state = placeRoadLine(structuredClone(DEFAULT_GAME_STATE), { tx: 43, ty: 42 }, { tx: 43, ty: 52 });
  state = gameReducer(state, { type: "zone_paint", kind: "burgage", stroke: { tool: "brush", radius: 2, points: [{ x: 43.5, y: 43 }, { x: 43.5, y: 52.5 }] } });
  state = gameReducer(state, { type: "zone_paint", kind: "arable", stroke: { tool: "polygon", points: [{ x: 32, y: 46 }, { x: 40, y: 46 }, { x: 40, y: 53 }, { x: 32, y: 53 }] } });
  for (const placement of planZoneFill(state).placements) {
    state = gameReducer(state, { type: "place_building", kind: "house", tx: placement.tile.tx, ty: placement.tile.ty });
  }
  return state;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === "--zoned-save") {
  const state = zonedOpeningState();
  const fixed = "2026-09-24T00:00:00.000Z";
  const encoded = encodeSave({ state, createdAt: fixed, savedAt: fixed, gameVersion: "0.1.0+fixture" });
  const directory = resolve(ROOT, `fixtures/saves/v${SAVE_SCHEMA_VERSION}`);
  writeFileSync(resolve(directory, "zoned-opening.save.json"), encoded.bytes);
  const manifestPath = resolve(directory, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { fixtures: Record<string, unknown>[] };
  manifest.fixtures = manifest.fixtures.filter(entry => entry.id !== "zoned-opening");
  manifest.fixtures.push({ id: "zoned-opening", description: "DEFAULT_GAME_STATE plus a road, a burgage brush, an arable block and the first ZoneFillAgent batch (actions only, no ticks)",
    provenance: "Built by scripts/buildZoneFixtures.ts --zoned-save through the reducer actions road/zone_paint/place_building. Not a growth run.",
    file: "zoned-opening.save.json", bytes: encoded.bytes.byteLength, tick: state.tick, population: state.population, era: state.era,
    buildings: state.buildings.length, houses: state.houses.length, constructionSites: state.constructionSites.length, zones: state.zones?.length ?? 0 });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ zones: state.zones?.map(zone => [zone.id, zone.kind, zone.membership.length]), sites: state.constructionSites.length })}\n`);
} else if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const source = process.argv[2];
  if (source === undefined) throw new RangeError("Usage: buildZoneFixtures.ts <seed-2 final-state.json>");
  const bytes = readFileSync(source);
  const full = JSON.parse(bytes.toString("utf8")) as GameState;
  if (full.seed !== 2 || full.palisade === null) throw new Error("Expected the seed-2 walled town");
  const state = Object.fromEntries(KEPT_KEYS.filter(key => key in full).map(key => [key, full[key]])) as Partial<GameState>;
  const outside = rasterizeZoneStroke(OUTSIDE_ARABLE, full);
  const inside = rasterizeZoneStroke(INSIDE_ARABLE, full);
  if (outside.some(cell => cellInsideWall(full, cell))) throw new Error("Outside arable stroke reaches inside the wall");
  if (!inside.some(cell => cellInsideWall(full, cell))) throw new Error("Inside arable stroke misses the wall interior");
  const fixture = {
    id: "town-with-arable",
    description: "Seed-2 walled town (B2 guardrail final state) trimmed to the fields placement reads, with an arable stroke outside the wall, one inside it (rejected) and a burgage brush by the western road.",
    source: {
      run: "scripts/efficientGrowthRun.ts 24 1200000 <out> 2 at 21caf65 (B2 guardrail)",
      sha256: createHash("sha256").update(bytes).digest("hex"),
      tick: full.tick,
      droppedKeys: Object.keys(full).filter(key => !(KEPT_KEYS as readonly string[]).includes(key)),
    },
    strokes: { outsideArable: OUTSIDE_ARABLE, insideArable: INSIDE_ARABLE, outsideBurgage: OUTSIDE_BURGAGE },
    state,
  };
  const out = resolve(ROOT, "fixtures/zones/town-with-arable.json");
  writeFileSync(out, `${JSON.stringify(fixture)}\n`);
  process.stdout.write(`${JSON.stringify({ out, outsideCells: outside.length, insideCells: inside.length, bytes: JSON.stringify(fixture).length })}\n`);
}
