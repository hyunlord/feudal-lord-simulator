/**
 * STONE-SINK (the user's ruling 2026-10-20): why a stone town's wall sites get no stone while the stores hold it —
 * diagnosis only, reads a save and ticks nothing. For each open stone-wall site: its stall, and which buildings holding
 * stone (or storehouses) the delivery port routes to it (`fromBuildingToDestination`), with each holder's stone, what it
 * may give, its road access and whether it stands inside the wall (`palisadeProtectionForBuilding`); the wall reserve's
 * floors (`wallConstructionReserve`).
 * Usage: npx tsx scripts/wallStoneRouteProbe.ts <save.json.gz>
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { buildingHasRequiredRoadAccess } from "../src/engine/roadAccess";
import { createDeliveryInventoryPort, createSimulationRoutePorts } from "../src/engine/simulationPorts";
import { palisadeProtectionForBuilding } from "../src/geometry/palisadeProtection";
import { decodeSave } from "../src/save/saveCodec";

const state = decodeSave(new Uint8Array(gunzipSync(readFileSync(process.argv[2]!)))).envelope.state as GameState;
const inventory = createDeliveryInventoryPort();
const routes = createSimulationRoutePorts(state).delivery;
const holders = state.buildings.filter(building => (building.inventory.stone ?? 0) > 0 || building.kind === "storehouse");
const sites = state.constructionSites.filter(site => site.kind === "stone_wall_segment");
const holder = (building: Building) => ({
  id: building.id, kind: building.kind, at: `${building.tx},${building.ty}`, stone: building.inventory.stone ?? 0,
  available: inventory.availableStock(building, "stone"), road: buildingHasRequiredRoadAccess(state, building),
  wall: state.palisade === null ? null : palisadeProtectionForBuilding(building, state.palisade),
});
console.log(JSON.stringify({
  tick: state.tick, era: state.era, reserve: state.wallConstructionReserve ?? null, holders: holders.map(holder),
  sites: sites.map(site => ({ id: site.id, stall: site.stall, wanted: (site.required.stone ?? 0) - (site.delivered.stone ?? 0),
    routedFrom: holders.filter(building => routes.fromBuildingToDestination(building.id, { kind: "construction_site", siteId: site.id }) !== null).map(building => building.id) })),
}, null, 1));
