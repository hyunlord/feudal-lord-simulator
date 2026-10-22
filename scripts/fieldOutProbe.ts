/**
 * FIELD-OUT (the user's ruling 2026-10-22): why a walled lord-mode town short of wheat draws no more fields outside its
 * wall — diagnosis only, read from a save. Prints the grain need against the expected harvest and the arable cap, the
 * food step's own reading (its diagnostic, the measured decision, the waits), what the grain step would do now, and the
 * outside 2×2 field blocks: how many are open (the LOT-FIX condition d), and for each kind of candidate the step uses
 * (beside a farmstead with room / a new block by a road / the 24 nearest a road for a new road) which of its checks
 * refuses them — the setback split into its water ring and its wall clearance (`hasAutoplayBuildingClearance`).
 * Usage: npx tsx scripts/fieldOutProbe.ts <save.json[.gz]>...
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { ARABLE_CONFIG } from "../src/content/arableConfig";
import { planningNeeds } from "../src/engine/autoplay";
import { ARABLE_CELLS_PER_LOT_MAX, annualWheatNeed, arableSupplyShort, fieldBlockAction, hasPendingFarmstead, outsideFieldBlockExists, untendedArableCells } from "../src/engine/autoplayArable";
import { foodAction, hasPendingFoodChain } from "../src/engine/autoplayFood";
import { canStaffFoodExpansion } from "../src/engine/autoplayFoodBottleneck";
import type { FoodDiagnosticCollector } from "../src/engine/autoplayFoodDiagnostic";
import { foodFacilityWithinLimit } from "../src/engine/autoplayFoodLimits";
import { measuredFoodDecision } from "../src/engine/autoplayFoodMeasuredDecision";
import { hasActiveFoodObservation } from "../src/engine/autoplayFoodThroughput";
import { preservesAutoplayServiceSpace } from "../src/engine/autoplayServiceSpace";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { hasBuildingWallClearance } from "../src/world/placement";
import { hasAutoplayBuildingClearance } from "../src/engine/autoplaySetback";
import { preservesAutoplayWallSpace } from "../src/engine/autoplayWallSpace";
import type { GameState } from "../src/engine/engine.types";
import { LORD_MODE_POLICY } from "../src/engine/townAgency";
import { housingLotCount } from "../src/population/housing";
import { decodeSave } from "../src/save/saveCodec";
import { expectedAnnualWheat, farmsteadYears } from "../src/zones/arableOutlook";
import { cellInsideWall, zonesOf } from "../src/zones/zoneEdits";

const load = (path: string) => {
  const raw = readFileSync(path);
  return decodeSave(new Uint8Array(path.endsWith(".gz") ? gunzipSync(raw) : raw)).envelope.state as GameState;
};
const SIDES = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

for (const path of process.argv.slice(2)) {
  const state = load(path);
  const zones = zonesOf(state);
  const zoneCells = new Set(zones.flatMap(zone => zone.membership));
  const arable = zones.filter(zone => zone.kind === "arable").flatMap(zone => zone.membership);
  const inBounds = (tx: number, ty: number) => tx >= 0 && ty >= 0 && tx < state.width && ty < state.height;
  const tileAt = (tx: number, ty: number) => state.tiles[ty * state.width + tx]!;
  const why = (tx: number, ty: number): string => {
    if (!inBounds(tx, ty)) return "edge";
    const tile = tileAt(tx, ty);
    if (tile.terrain !== "grass" && tile.terrain !== "forest") return `terrain:${tile.terrain}`;
    if (tile.buildingId !== null) return "building";
    if (tile.hasRoad) return "road";
    if (zoneCells.has(ty * state.width + tx)) return "zoned";
    if (cellInsideWall(state, ty * state.width + tx)) return "inside_wall";
    return "open";
  };
  const roadBeside = (tx: number, ty: number) => SIDES.some(([dx, dy]) => inBounds(tx + dx, ty + dy) && tileAt(tx + dx, ty + dy).hasRoad);
  const farm = BUILDING_CONFIG_BY_KIND.wheat_farm;
  const setback = (tx: number, ty: number): string => {
    let water = false;
    for (let y = ty - 1; y <= ty + farm.height; y += 1) for (let x = tx - 1; x <= tx + farm.width; x += 1) {
      if (!inBounds(x, y)) return "edge";
      if (tileAt(x, y).terrain === "water") water = true;
    }
    if (water) return "water_ring";
    return hasBuildingWallClearance(state, { tx, ty, width: farm.width, height: farm.height, id: "probe" } as never) ? "clear" : "wall";
  };
  const roads = state.tiles.filter(tile => tile.hasRoad);
  const roadSearch: { anchor: { tx: number; ty: number }; distance: number }[] = [];
  const roomy = farmsteadYears(state).filter(year => year.cells + 4 <= ARABLE_CONFIG.predictedCellsPerFarmstead)
    .flatMap(year => state.buildings.filter(building => building.id === year.farmsteadId));
  const blocks = { open: 0, nearRoomyFarmstead: 0, byRoad: 0 };
  const refusals: Record<string, number> = {};
  for (let ty = 1; ty < state.height - 2; ty += 1) {
    for (let tx = 1; tx < state.width - 2; tx += 1) {
      const cells = [[tx, ty], [tx + 1, ty], [tx, ty + 1], [tx + 1, ty + 1]] as const;
      if (!cells.every(([x, y]) => why(x, y) === "open")) continue;
      blocks.open += 1;
      roadSearch.push({ anchor: { tx, ty }, distance: Math.min(...roads.map(road => Math.abs(road.tx - tx) + Math.abs(road.ty - ty))) });
      const near = roomy.some(farm => Math.max(...cells.map(([x, y]) => Math.abs(x - farm.tx) + Math.abs(y - farm.ty))) <= ARABLE_CONFIG.tendRadius);
      const byRoad = cells.some(([x, y]) => roadBeside(x, y));
      if (near) blocks.nearRoomyFarmstead += 1;
      if (byRoad) blocks.byRoad += 1;
      if (!near && !byRoad) continue;
      const anchor = { tx, ty };
      const refusal = !hasAutoplayBuildingClearance(state, "wheat_farm", anchor) ? `clearance(${setback(tx, ty)})`
        : !preservesAutoplayWallSpace(state, "wheat_farm", anchor) ? "wall_space"
        : !preservesAutoplayServiceSpace(state, { kind: "place_building", building: "wheat_farm", tx, ty }) ? "service_space" : "keeps_space";
      const key = `${near ? "extension" : "fresh"}:${refusal}`;
      refusals[key] = (refusals[key] ?? 0) + 1;
    }
  }
  // The grain step's road search (fieldRoadAction) takes the 24 open blocks nearest a road, then checks their space.
  roadSearch.sort((a, b) => a.distance - b.distance || a.anchor.ty - b.anchor.ty || a.anchor.tx - b.anchor.tx);
  const nearestRoad: Record<string, number> = {};
  for (const { anchor } of roadSearch.slice(0, 24)) {
    const key = hasAutoplayBuildingClearance(state, "wheat_farm", anchor) ? "clearance_ok" : `clearance(${setback(anchor.tx, anchor.ty)})`;
    nearestRoad[key] = (nearestRoad[key] ?? 0) + 1;
  }
  const clearAll = roadSearch.filter(({ anchor }) => setback(anchor.tx, anchor.ty) === "clear");
  const collector: FoodDiagnosticCollector = {};
  const stub = (_state: GameState, kind: string) => ({ kind: "place_building", building: kind, tx: -1, ty: -1 }) as never;
  const food = foodAction(state, stub, collector);
  const decision = measuredFoodDecision(state);
  console.log(JSON.stringify({
    save: path.split("/").pop(), tick: state.tick,
    grain: { arableCells: arable.length, cap: ARABLE_CELLS_PER_LOT_MAX * housingLotCount(state), expected: expectedAnnualWheat(state), need: annualWheatNeed(state),
      supplyShort: arableSupplyShort(state), untended: untendedArableCells(state).length, pendingFarmstead: hasPendingFarmstead(state),
      farmsteads: farmsteadYears(state).map(year => ({ id: year.farmsteadId, cells: year.cells })) },
    food: { action: food, reason: collector.food?.reason, decision: { kind: decision.kind, reason: decision.reason }, pendingChain: hasPendingFoodChain(state),
      observation: hasActiveFoodObservation(state), farmsteadWithinLimit: foodFacilityWithinLimit(state, "farmstead"), staffFarmstead: canStaffFoodExpansion(state, "farmstead") },
    fieldBlock: { withNewFarmstead: fieldBlockAction(state, true), withoutNewFarmstead: fieldBlockAction(state, false) },
    outside: { lotFixConditionD: outsideFieldBlockExists(state), blocks, refusals, roadSearch24: { distances: roadSearch.slice(0, 24).map(entry => entry.distance), nearestRoad },
      setbackClear: { blocks: clearAll.length, nearestRoadDistance: clearAll[0]?.distance ?? null } },
    plannerNeeds: planningNeeds(state, LORD_MODE_POLICY).map(need => ({ planner: need.planner, action: need.action })),
  }));
}
