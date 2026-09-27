// UX-0b2 capture states: the seed 1 determinism town (two markets, a tick on so PERSON-0 has named its people) for the
// MARKET-1 chip and reach, and the seed 3 walled town (WALL-2's own test town: a built wall with fields by it) for the
// expansion. Beside them, moments.json: free road-side tiles where a house would be within and beyond a market's road
// reach, road-side tiles for a new market (what each reaches), the standing market, and one side of the wall that dragged outward makes
// an expansion the engine accepts, taking fields in (the run's middle and where to drag it, in tile-edge points).
//   tsx scripts/ux0b2States.ts <out-dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { previewPalisadeExpansion } from "../src/engine/palisade";
import { advanceTick } from "../src/engine/tick";
import { canPlaceBuilding } from "../src/world/placement";
import { dragPalisadeRun } from "../src/world/palisadeGeometry";
import { houseMarketDistance } from "../src/ui/marketReachModel";
import { buildingPlacementPrediction, virtualFacility } from "../src/ui/placementPrediction";
import { expansionDraftFootprints, expansionStartCandidate } from "../src/ui/wallExpansionModel";
import { loadAutoplayFixture } from "./autoplayStallProbe";

const [out] = process.argv.slice(2);
mkdirSync(out!, { recursive: true });
const moments: Record<string, unknown> = {};

// MARKET-1: the market town.
const town = advanceTick(JSON.parse(readFileSync("fixtures/determinism/seed1/final-state.json", "utf8")) as GameState);
writeFileSync(join(out!, "market-town.json"), JSON.stringify(town));
const roadSide = town.tiles.filter(tile => !tile.hasRoad && tile.buildingId === null && tile.terrain === "grass"
  && [[0, 1], [1, 0], [0, -1], [-1, 0]].some(([dx, dy]) => town.tiles[(tile.ty + dy!) * town.width + tile.tx + dx!]?.hasRoad === true));
const houseSpots = roadSide.filter(tile => canPlaceBuilding(town, "house", tile.tx, tile.ty).ok)
  .map(tile => ({ tile: { tx: tile.tx, ty: tile.ty }, distance: houseMarketDistance(town, virtualFacility(town, "house", tile)) }));
const near = houseSpots.filter(spot => spot.distance?.steps !== null && (spot.distance?.steps ?? 99) <= 40).sort((a, b) => (a.distance!.steps ?? 0) - (b.distance!.steps ?? 0))[3];
const far = houseSpots.find(spot => spot.distance !== null && (spot.distance.steps === null || spot.distance.steps > 40));
// A new market's spot: of the road-side places a market can go, the one whose road reach takes in the most homes (in
// this walled town every free one is outside the wall: its road tiles reach no home within 40 steps).
const spots = roadSide.filter(tile => canPlaceBuilding(town, "market", tile.tx, tile.ty).ok)
  .map(tile => { const prediction = buildingPlacementPrediction(town, "market", tile); return { tile, homes: prediction.houseIds.length, roadTiles: prediction.reachTiles?.length ?? 0 }; })
  .sort((a, b) => b.homes - a.homes || b.roadTiles - a.roadTiles);
const marketSpot = spots[0]?.tile;
const market = town.buildings.find(building => building.kind === "market")!;
moments.market = { tick: town.tick, near, far: far ?? null, marketSpot: marketSpot === undefined ? null : { tx: marketSpot.tx, ty: marketSpot.ty },
  marketSpots: spots.map(spot => ({ tx: spot.tile.tx, ty: spot.tile.ty, homes: spot.homes, roadTiles: spot.roadTiles })),
  market: { id: market.id, tx: market.tx, ty: market.ty } };

// WALL-2: the walled town and a side that widens it.
const walled = loadAutoplayFixture("fixtures/autoplay/seed3-792000.json.gz");
writeFileSync(join(out!, "walled-town.json"), JSON.stringify(walled));
const start = expansionStartCandidate(walled)!;
const { footprints, enclosure } = expansionDraftFootprints(walled);
let drag: Record<string, unknown> | null = null;
for (let run = 0; run < start.runs.length && drag === null; run += 1) {
  const side = start.runs[run]!;
  // An axis-aligned side of four steps or more (a pointer on its middle is clear of its corners).
  if (side.steps < 4 || (side.normal.x !== 0 && side.normal.y !== 0)) continue;
  for (let steps = 2; steps <= 6; steps += 1) {
    const moved = dragPalisadeRun(walled, start, run, steps, footprints, enclosure, 1);
    if (!moved.ok) continue;
    const preview = previewPalisadeExpansion(walled, moved.candidate.path);
    if (!preview.ok || preview.enclosedArableCells.length === 0) continue;
    const a = start.path[side.startIndex]!; const b = start.path[side.endIndex]!;
    const middle = { x: Math.round((a.x + b.x) / 2), y: Math.round((a.y + b.y) / 2) };
    drag = { run, steps, normal: side.normal, middle, target: { x: middle.x + side.normal.x * steps, y: middle.y + side.normal.y * steps },
      newSteps: preview.newSteps, timber: preview.timber, fields: preview.enclosedArableCells.length, before: preview.interiorBefore, after: preview.interiorAfter };
    break;
  }
}
moments.wall = { tick: walled.tick, era: walled.era, runs: start.runs.length, drag };
writeFileSync(join(out!, "moments.json"), JSON.stringify(moments, null, 1) + "\n");
console.log(JSON.stringify(moments));
if (near === undefined || drag === null) process.exit(1);
