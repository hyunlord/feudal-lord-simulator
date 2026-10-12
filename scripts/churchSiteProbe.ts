// Stall table "church out of range — no site" (the user's ruling 2026-10-12, seed 12): from a save where houses below L4
// have no church within reach and the cap allows another, which of the second church's checks refuses each candidate site.
// The checks run in `urbanServiceAction`'s order (src/engine/autoplayServices.ts): within reach of the houses needing it,
// building clearance, placement before the road, a road distance, a construction route, placement, keeping the walled
// lots their house sites (AR-7, as the planner asks), the wall's space, the service space; then the lord town's own site
// check (`townSiteRefusal`). Each site counts once, at its first refusal (`no_gain`: it would serve none of the houses it
// is meant for). The planner's second branch, a site with its road planned to it, is counted beside (`roadPlans`). The service space is judged twice: under one
// shared search budget in rank order as the planner runs it (a refusal after the budget ran out is the budget's, not the
// rule's), and with each site judged on its own (the rule's answer).
//   tsx scripts/churchSiteProbe.ts <save .save.json[.gz]> > out.json
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import { isBuildingConstructionSite } from "../src/economy/construction";
import { buildingFootprintDistance } from "../src/geometry/buildingDistance";
import { townSiteRefusal } from "../src/engine/autoplay";
import { hasConnectedConstructionRoute } from "../src/engine/autoplayConstructionRoute";
import { keepsInteriorHouseSites } from "../src/engine/autoplayInteriorPlots";
import { autoplaySearchExhausted, runAutoplaySearch } from "../src/engine/autoplaySearchBudget";
import { serviceAccessDistances } from "../src/engine/autoplayServiceAccess";
import { rankServiceCandidates } from "../src/engine/autoplayServiceCandidates";
import { rankServiceRoadPlans } from "../src/engine/autoplayServiceRoadPlans";
import { plannedBuildingRoadAction } from "../src/engine/autoplayConstructionRoads";
import { preservesAutoplayServiceSpace, resetAutoplayServiceSearch } from "../src/engine/autoplayServiceSpace";
import { hasAutoplayBuildingClearance } from "../src/engine/autoplaySetback";
import { preservesAutoplayWallSpace } from "../src/engine/autoplayWallSpace";
import type { GameState } from "../src/engine/engine.types";
import { householdServices } from "../src/engine/householdServices";
import { marketRoadService } from "../src/engine/marketService";
import { stateCalendar } from "../src/engine/scenarioState";
import { LORD_MODE_POLICY } from "../src/engine/townAgency";
import { housingLotCount } from "../src/population/housing";
import { decodeSave } from "../src/save/saveCodec";
import { canPlaceBuilding, canPlaceBuildingBeforeRoad } from "../src/world/placement";

const [path] = process.argv.slice(2);
if (path === undefined) throw new Error("usage: churchSiteProbe.ts <save .save.json[.gz]>");
const bytes = readFileSync(path);
const state = decodeSave(new Uint8Array(path.endsWith(".gz") ? gunzipSync(bytes) : bytes)).envelope.state as GameState;

const kind = "church" as const;
const definition = BUILDING_CONFIG_BY_KIND[kind];
const current = householdServices(state);
const providers = state.buildings.filter(building => building.kind === kind);
const underserved = state.buildings.filter(home => home.kind === "house" && current.houses.get(home.id)?.[kind].kind !== undefined
  && current.houses.get(home.id)?.[kind].kind !== "served");
const needsBuilding = underserved.filter(home => {
  const access = current.houses.get(home.id)?.[kind];
  const reusable = providers.some(provider => {
    const allocation = current.providers.get(provider.id);
    return allocation !== undefined && allocation.capacity - allocation.used >= (access?.demand ?? 1)
      && buildingFootprintDistance(home, provider) <= definition.serviceRadius;
  });
  return !reusable && ["missing", "outside", "capacity"].includes(access?.kind ?? "");
});
const planned = state.constructionSites.filter(isBuildingConstructionSite);
const cap = Math.ceil(housingLotCount(state) / 32) + 1;
const candidate = (tx: number, ty: number): Building => ({ id: "autoplay-service-candidate", kind, tx, ty, workers: 0,
  inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 });

const firstRefusal: Record<string, number> = {};
const refuse = (check: string) => { firstRefusal[check] = (firstRefusal[check] ?? 0) + 1; };
const roadDistance = serviceAccessDistances(state);
const placed: { building: Building; roadDistance: number }[] = [];
let inReach = 0;
const beforeRoad: Building[] = [];
for (const tile of state.tiles) {
  const site = candidate(tile.tx, tile.ty);
  if (!needsBuilding.some(home => buildingFootprintDistance(home, site) <= definition.serviceRadius)) continue;
  inReach += 1;
  if (!hasAutoplayBuildingClearance(state, kind, tile)) { refuse("clearance"); continue; }
  if (!canPlaceBuildingBeforeRoad(state, kind, tile.tx, tile.ty).ok) { refuse("placement_before_road"); continue; }
  beforeRoad.push(site);
  if (!Number.isFinite(roadDistance(site))) { refuse("road_distance"); continue; }
  if (!hasConnectedConstructionRoute(state, site)) { refuse("construction_route"); continue; }
  placed.push({ building: site, roadDistance: roadDistance(site) });
}
const ranked = rankServiceCandidates({ service: kind, allocation: { houses: state.houses, buildings: state.buildings, roadService: marketRoadService(state) },
  current, candidates: placed });
// A site that serves no house it is meant for (no road between them, or it would take a served house away) drops out of the ranking.
if (placed.length > ranked.length) firstRefusal.no_gain = placed.length - ranked.length;
// The planner's second branch: a site still without its road, with the road planned to it.
const roadPlanSites = rankServiceRoadPlans(state, kind, beforeRoad).map(entry => entry.building);
const action = (site: Building) => ({ kind: "place_building", building: kind, tx: site.tx, ty: site.ty } as const);
const afterPlacement: Building[] = [];
for (const { building: site } of ranked) {
  if (!canPlaceBuilding(state, kind, site.tx, site.ty).ok) { refuse("placement"); continue; }
  if (!keepsInteriorHouseSites(state, action(site), LORD_MODE_POLICY.maxHousingLots, "check")) { refuse("house_sites"); continue; }
  if (!preservesAutoplayWallSpace(state, kind, site)) { refuse("wall_space"); continue; }
  afterPlacement.push(site);
}
// The service space as the planner runs it: one shared budget, in rank order.
resetAutoplayServiceSearch();
const shared = { passed: 0, refused: 0, budgetRefused: 0 };
runAutoplaySearch(() => {
  for (const site of afterPlacement) {
    if (preservesAutoplayServiceSpace(state, action(site))) { shared.passed += 1; continue; }
    if (autoplaySearchExhausted()) shared.budgetRefused += 1; else shared.refused += 1;
  }
});
// The rule's own answer: each site with its own budget.
const own = { passed: [] as Building[], refused: 0, budgetRefused: 0 };
for (const site of afterPlacement) {
  resetAutoplayServiceSearch();
  let exhausted = false;
  const ok = runAutoplaySearch(() => { const answer = preservesAutoplayServiceSpace(state, action(site)); exhausted = autoplaySearchExhausted(); return answer; });
  if (ok) own.passed.push(site); else if (exhausted) own.budgetRefused += 1; else own.refused += 1;
}
// The second branch's checks, in its order: house sites, wall space, service space (own budget), the road to it.
const roadPlanRefusal: Record<string, number> = {};
for (const site of roadPlanSites) {
  const step = !keepsInteriorHouseSites(state, action(site), LORD_MODE_POLICY.maxHousingLots, "check") ? "house_sites"
    : !preservesAutoplayWallSpace(state, kind, site) ? "wall_space"
    : !(resetAutoplayServiceSearch(), runAutoplaySearch(() => preservesAutoplayServiceSpace(state, action(site)))) ? "service_space"
    : plannedBuildingRoadAction(state, site).kind === "none" ? "no_road" : "accepted";
  roadPlanRefusal[step] = (roadPlanRefusal[step] ?? 0) + 1;
}
const townRefusals: Record<string, number> = {};
for (const site of own.passed) {
  const reason = townSiteRefusal(state, kind, site, site, LORD_MODE_POLICY) ?? "accepted";
  townRefusals[reason] = (townRefusals[reason] ?? 0) + 1;
}
process.stdout.write(`${JSON.stringify({
  save: path, year: stateCalendar(state).year, tick: state.tick,
  churches: providers.length, churchSites: planned.filter(site => site.kind === kind).length, cap, lots: housingLotCount(state),
  underserved: underserved.length, needsBuilding: needsBuilding.map(home => ({ id: home.id, access: current.houses.get(home.id)?.[kind].kind })),
  candidates: { inReach, firstRefusal, routed: placed.length, ranked: ranked.length, roadPlans: { sites: roadPlanSites.length, firstRefusal: roadPlanRefusal }, afterPlacement: afterPlacement.length, serviceSpaceShared: shared,
    serviceSpaceOwn: { passed: own.passed.length, refused: own.refused, budgetRefused: own.budgetRefused }, townSiteCheck: townRefusals },
})}\n`);
