/**
 * CHURCH-25 diagnosis (the user's ruling 2026-10-20): why a town with houses outside its church's reach builds no second
 * church (seed 25's 14 houses, seed 32's), and why seed 32's storehouse filled with raw stone stood alone — diagnosis
 * only, nothing changed. The lord slice played by the lord bot; at each season's end from `fromYear`:
 *  - the church service (`householdServices`): houses served, outside the reach, missing, over capacity; churches built
 *    and begun; the cap (`ceil(lots / 32) + 1`, `urbanServiceAction`);
 *  - the bot's church step, replayed with its own checks in order (`urbanServiceAction`, `autoplayServices.ts`): the
 *    houses that need a building, the cap, idle workers, sites within the reach (clearance, placeable before the road),
 *    of those reached by road, and the first refusal of each (placement, wall space, service space); what
 *    `urbanServiceAction` itself returns;
 *  - the town's proposals naming a church (`townProposals`);
 *  - the storehouses: count, held of capacity, the bot's storehouse step (`autoplayBuildAction`).
 * Usage: npx tsx scripts/churchReachProbe.ts <seed> <years> [fromYear] > out.json
 */
import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { isBuildingConstructionSite } from "../src/economy/construction";
import { buildingFootprintDistance } from "../src/geometry/buildingDistance";
import { autoplayBuildAction } from "../src/engine/autoplay";
import { hasConnectedConstructionRoute } from "../src/engine/autoplayConstructionRoute";
import { serviceAccessDistances } from "../src/engine/autoplayServiceAccess";
import { urbanServiceAction, type ServicePlanningCollector } from "../src/engine/autoplayServices";
import { preservesAutoplayServiceSpace } from "../src/engine/autoplayServiceSpace";
import { hasAutoplayBuildingClearance } from "../src/engine/autoplaySetback";
import { preservesAutoplayWallSpace } from "../src/engine/autoplayWallSpace";
import type { GameState } from "../src/engine/engine.types";
import { householdServices } from "../src/engine/householdServices";
import { lordBotCommands } from "../src/engine/lordBot";
import { stateCalendar } from "../src/engine/scenarioState";
import { advanceTick } from "../src/engine/tick";
import { townProposals } from "../src/engine/townAgency";
import { housingLotCount } from "../src/population/housing";
import { availableWorkers } from "../src/population/labour";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { canPlaceBuilding, canPlaceBuildingBeforeRoad } from "../src/world/placement";

const seed = Number(process.argv[2] ?? 25);
const years = Number(process.argv[3] ?? 30);
const held = (b: Building) => Object.values(b.inventory).reduce((s, v) => s + (v ?? 0), 0);

function churchStep(state: GameState) {
  const definition = BUILDING_CONFIG_BY_KIND.church;
  const current = householdServices(state);
  const access: Record<string, number> = {};
  for (const home of state.buildings.filter(b => b.kind === "house")) {
    const kind = current.houses.get(home.id)?.church.kind ?? "none";
    access[kind] = (access[kind] ?? 0) + 1;
  }
  const providers = state.buildings.filter(b => b.kind === "church");
  const begun = state.constructionSites.filter(site => isBuildingConstructionSite(site) && site.kind === "church").length;
  const cap = Math.ceil(housingLotCount(state) / 32) + 1;
  const needsBuilding = state.buildings.filter(home => {
    if (home.kind !== "house") return false;
    const a = current.houses.get(home.id)?.church;
    if (a === undefined || a.kind === "served") return false;
    const reusable = providers.some(provider => {
      const allocation = current.providers.get(provider.id);
      return allocation !== undefined && allocation.capacity - allocation.used >= (a.demand ?? 1) && buildingFootprintDistance(home, provider) <= definition.serviceRadius;
    });
    return !reusable && (a.kind === "missing" || a.kind === "outside" || a.kind === "capacity");
  });
  const planned = state.constructionSites.filter(isBuildingConstructionSite);
  const committed = state.buildings.reduce((s, b) => s + BUILDING_CONFIG_BY_KIND[b.kind].workersRequired, 0) + planned.reduce((s, site) => s + BUILDING_CONFIG_BY_KIND[site.kind].workersRequired, 0);
  const workersOk = state.idleWorkers >= definition.workersRequired && availableWorkers(state.population) - committed >= definition.workersRequired;
  const refusals: Record<string, number> = {};
  let sites = 0, reached = 0;
  if (needsBuilding.length > 0) {
    const roadDistance = serviceAccessDistances(state);
    for (const tile of state.tiles) {
      const candidate: Building = { id: "probe-church", kind: "church", tx: tile.tx, ty: tile.ty, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
      if (!needsBuilding.some(home => buildingFootprintDistance(home, candidate) <= definition.serviceRadius)) continue;
      if (!hasAutoplayBuildingClearance(state, "church", tile)) { refusals.clearance = (refusals.clearance ?? 0) + 1; continue; }
      const before = canPlaceBuildingBeforeRoad(state, "church", tile.tx, tile.ty);
      if (!before.ok) { refusals[`before_road:${before.reason}`] = (refusals[`before_road:${before.reason}`] ?? 0) + 1; continue; }
      sites += 1;
      if (!Number.isFinite(roadDistance(candidate)) || !hasConnectedConstructionRoute(state, candidate)) { refusals.no_road_route = (refusals.no_road_route ?? 0) + 1; continue; }
      reached += 1;
      const placed = canPlaceBuilding(state, "church", tile.tx, tile.ty);
      const action = { kind: "place_building", building: "church", tx: tile.tx, ty: tile.ty } as const;
      const why = !placed.ok ? `placement:${placed.reason}` : !preservesAutoplayWallSpace(state, "church", tile) ? "wall_space"
        : !preservesAutoplayServiceSpace(state, action) ? "service_space" : "ok";
      refusals[why] = (refusals[why] ?? 0) + 1;
    }
  }
  const diagnostic: ServicePlanningCollector = {};
  const action = urbanServiceAction(state, diagnostic);
  return { access, churches: providers.length, begun, cap, needsBuilding: needsBuilding.length, workersOk, sites, reached, refusals,
    urbanService: action.kind === "none" ? "none" : JSON.stringify(action).slice(0, 80), diagnostic: diagnostic.services ?? [],
    stone: state.buildings.reduce((s, b) => s + (b.inventory.stone ?? 0), 0), timber: state.buildings.reduce((s, b) => s + (b.inventory.timber ?? 0), 0) };
}

let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed }) as GameState;
const start = stateCalendar(state).year;
const fromYear = Number(process.argv[4] ?? start + 15);
const rows: unknown[] = [];
while (stateCalendar(state).year < start + years) {
  for (const { command } of lordBotCommands(state)) { const next = gameReducer(state, command); if (next !== state) state = next; }
  state = advanceTick(state);
  const calendar = stateCalendar(state);
  if (calendar.year < fromYear || state.tick % 1_000 !== 0) continue;
  const stores = state.buildings.filter(b => b.kind === "storehouse");
  rows.push({ year: calendar.year, season: Math.floor((state.tick % 4_000) / 1_000), era: state.era, population: state.population,
    church: churchStep(state),
    churchProposals: townProposals(state).filter(p => p.what === "church").map(p => `${p.actor}/${p.planner}:${p.score}`),
    storehouses: { count: stores.length, held: stores.map(b => `${held(b)}/${BUILDING_CONFIG_BY_KIND.storehouse.storageCapacity}`),
      rawStone: stores.reduce((s, b) => s + (b.inventory.stone_raw ?? 0), 0), step: JSON.stringify(autoplayBuildAction(state, "storehouse")).slice(0, 80) } });
}
console.log(JSON.stringify({ seed, years, fromYear, rows }, null, 1));
