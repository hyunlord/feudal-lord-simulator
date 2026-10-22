/**
 * LOT-GAP (the user's ruling 2026-10-22): why LOT-FIX did not run in a walled lord-mode town still short of lots —
 * diagnosis only, read from a save. Prints LOT-FIX's four conditions (`enclosedFieldLot`), the housing step's own gates
 * (`housingAction`), and for every interior house site beside a road — free, or under a field once that field is erased —
 * the bot's site check and the service-space proofs (the citywide plan, the new home's own, old homes losing theirs).
 * Usage: npx tsx scripts/lotGapProbe.ts <save.json[.gz]>...
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { autoplaySiteCheck, planningNeeds } from "../src/engine/autoplay";
import { outsideFieldBlockExists } from "../src/engine/autoplayArable";
import { keepsHouseInMarketReach } from "../src/engine/autoplayBotRecovery";
import { dearthHoldsGrowth } from "../src/engine/autoplayEvents";
import { hasPendingFoodChain } from "../src/engine/autoplayFood";
import { housingLotsStillNeeded, interiorHouseSites } from "../src/engine/autoplayInteriorPlots";
import { searchBudgetedServicePlan } from "../src/engine/autoplayServiceBudget";
import { findAutoplayServiceWitness } from "../src/engine/autoplayServiceSpaceWitness";
import { projectServiceAction, serviceSpaceBuildings } from "../src/engine/autoplayServiceSpaceRoutes";
import { enclosedFieldLot } from "../src/engine/enclosedFieldLots";
import type { GameState } from "../src/engine/engine.types";
import { derelictPermille } from "../src/engine/lordship";
import { LORD_MODE_POLICY } from "../src/engine/townAgency";
import type { TileCoordinate } from "../src/geometry/tileGeometry";
import { housingLotCount } from "../src/population/housing";
import { decodeSave } from "../src/save/saveCodec";
import { applyErase, zonesOf } from "../src/zones/zoneEdits";

const SIDES = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
const load = (path: string) => {
  const raw = readFileSync(path);
  return decodeSave(new Uint8Array(path.endsWith(".gz") ? gunzipSync(raw) : raw)).envelope.state as GameState;
};
const cellStroke = (cell: TileCoordinate) => ({ tool: "polygon" as const, points: [{ x: cell.tx, y: cell.ty }, { x: cell.tx + 1, y: cell.ty }, { x: cell.tx + 1, y: cell.ty + 1 }, { x: cell.tx, y: cell.ty + 1 }] });

function serviceProofs(state: GameState, site: TileCoordinate) {
  const projected = projectServiceAction(state, { kind: "place_building", building: "house", tx: site.tx, ty: site.ty });
  const home = projected.buildings.find(building => building.id === "autoplay-service-space-new");
  const oldHomes = serviceSpaceBuildings(projected).filter(building => building.kind === "house" && building.id !== home?.id);
  return {
    citywide: searchBudgetedServicePlan(projected).witness !== null,
    newHome: home !== undefined && findAutoplayServiceWitness(projected, home) !== null,
    oldHomesLosing: oldHomes.filter(old => findAutoplayServiceWitness(state, old) !== null && findAutoplayServiceWitness(projected, old) === null).length,
  };
}

for (const path of process.argv.slice(2)) {
  const state = load(path);
  const tile = (site: TileCoordinate) => state.tiles[site.ty * state.width + site.tx];
  const beside = (site: TileCoordinate) => SIDES.some(([dx, dy]) => state.tiles[(site.ty + dy) * state.width + site.tx + dx]?.hasRoad === true);
  const zones = zonesOf(state);
  const zoned = new Set(zones.flatMap(zone => zone.membership));
  const arable = new Set(zones.filter(zone => zone.kind === "arable").flatMap(zone => zone.membership));
  const sites = interiorHouseSites(state).filter(site => tile(site)?.terrain === "grass" && beside(site));
  const reach = keepsHouseInMarketReach(state, LORD_MODE_POLICY.maxHousingLots);
  const plan = searchBudgetedServicePlan(state);
  const report = {
    save: path.split("/").pop(), tick: state.tick,
    lotFix: { closedTick: state.palisade?.closedTick ?? null, lotsStillNeeded: housingLotsStillNeeded(state, LORD_MODE_POLICY.maxHousingLots),
      freeSites: sites.filter(site => !zoned.has(site.ty * state.width + site.tx)).length, fieldSites: sites.filter(site => arable.has(site.ty * state.width + site.tx)).length,
      outsideFieldBlock: outsideFieldBlockExists(state), cell: enclosedFieldLot(state) },
    housingGates: { lots: housingLotCount(state), idleWorkers: state.idleWorkers, population: state.population, dearthHold: dearthHoldsGrowth(state),
      pendingFoodChain: hasPendingFoodChain(state), derelictPermille: derelictPermille(state) },
    citywideServicePlan: { witness: plan.witness !== null, complete: plan.complete },
    housingNeed: planningNeeds(state, LORD_MODE_POLICY).filter(need => need.planner === "housing").map(need => need.action),
    sites: sites.map(site => {
      const field = arable.has(site.ty * state.width + site.tx);
      const at = field ? applyErase(state, cellStroke(site)) : state;
      const atReach = field ? keepsHouseInMarketReach(at, LORD_MODE_POLICY.maxHousingLots) : reach;
      return { ...site, field, reach: atReach(site), siteCheck: autoplaySiteCheck(at, "house", site, atReach), ...serviceProofs(at, site) };
    }),
  };
  console.log(JSON.stringify(report));
}
