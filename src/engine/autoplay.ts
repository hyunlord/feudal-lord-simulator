import { wallConstructionPriority } from "./constructionReserve";
import { MONEY_BALANCE } from "../content/balanceConfig";
import { LORDSHIP_BALANCE } from "../content/lordshipConfig";
import { arrearsPeriods, derelictPermille } from "./lordship";
import { autoplayCanPlace, clearZoneExclusions, excludeZoneRefusal, zoneRefusesAction } from "./autoplayZones";
import { zoneRuleActive } from "../zones/zonePlacement";
import { zoneFillAction } from "../zones/zoneFillAgent";
import { autoplaySearchExhausted, runAutoplaySearch, runAutoplaySearchPhase } from './autoplaySearchBudget';
import { resetAutoplayServiceSearch } from './autoplayServiceSpace';
import type { FoodDiagnosticCollector } from './autoplayFoodDiagnostic';
import { timberExpansionKind } from './autoplayTimberRecovery';
import { botTimberOrder, botTimberOrderFor } from './timberTrade';
import { crossingAction } from './autoplayCrossing';
import { needsStoneStorageRecovery } from './autoplayStorageRecovery';
import { materialRecoveryAction } from './autoplayMaterialRecovery';
import { constructionLogisticsAction } from './autoplayConstructionLogistics';
import { carryFoodTransient, type FoodTransientMetadata } from './autoplayFoodTransient';
import { clothChainAction } from './autoplayCloth';
import { ALE_ARABLE_MARGIN_PERMILLE, aleChainAction, aleWantsBarley, autoplayEraAction, stoneProjectAction } from './autoplayEra';
import { autoplayWallExpansionAction } from './autoplayWallRoom';
import { preservesAutoplayServiceSpace, serviceSafeRoadAction } from './autoplayServiceSpace';
import { preservesAutoplayWallSpace } from './autoplayWallSpace';
import { footprintCorners, isPointInsidePalisade } from "../world/palisadeGeometry";
import { housingLotCount } from "../population/housing";
import { houseLotArea } from "../geometry/buildingFootprint";
import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../content/buildingConfig";
import { HOUSING_CONFIG } from "../content/housingConfig";
import { isBuildingConstructionSite } from "../economy/construction";
import { storageCapacityBlock } from "../economy/storage";
import { buildingHasRequiredRoadAccess } from "./roadAccess";
import { buildingRoadAccessTiles } from "./routing";
import type { GameState } from "./engine.types";
import type { TileCoordinate } from "../world/grid";
import { getTile } from "../world/grid";
import { placementSpendableResource } from "../world/placement";
import { canTraverseRoadBoundary } from "../world/bridges";
import { canPlaceRoad, roadLine } from "../world/roadGraph";
import { hasConnectedConstructionRoute } from "./autoplayConstructionRoute";
import { lateFoodBuildSites } from "./autoplayFoodPlacement";
import { foodAction, hasPendingFoodChain } from "./autoplayFood";
import { constructionRoadAction, roadActionToTargets, plannedBuildingRoadAction } from "./autoplayConstructionRoads";
import { preserveRoadExpansion } from "./autoplayExpansion";
import { networkRoadAction } from "./autoplayNetworkRoads";
import { urbanServiceAction } from './autoplayServices';
import { waterAction } from "./autoplayWater";
import { reserveDeadlock } from "./reserveDeadlock";
import { hasAutoplayBuildingClearance } from "./autoplaySetback";
import type { AutoplayAction } from "./autoplay.types";
import { granaryGapAction, keepsHouseInMarketReach, marketGapAction, marketRelocationAction, recordBotRecovery, type AdvisorAction, type BotRecoveryCollector } from './autoplayBotRecovery';
import { logOverflowKind, timberDemandExpansionKind } from './autoplayTimberDemand';
import { interiorHouseSites, keepsInteriorHouseSites } from './autoplayInteriorPlots';
import { ARABLE_MARGIN_PERMILLE, NAIVE_ARABLE_MARGIN_PERMILLE, withArableMargin } from './autoplayArable';
import { winterReserveAction } from './autoplayWinterReserve';
import { barnMillAction } from './autoplayBarnMill';
import { chapterDecisionAction, dearthArableMargin, dearthHoldsGrowth, rebuildBurntHouseAction } from './autoplayEvents';
/** The advisor's outward action: the placement actions plus BOT-1's house relocation (`demolish_house`). */
export type { AdvisorAction as AutoplayAction } from './autoplayBotRecovery';
export const AUTOPLAY_MAX_HOUSING_LOTS = 8;
/**
 * `naiveReserve` (F0-A FP-6): the variant without reserve measures — no autumn winter check, harvest margin 1.0, and
 * houses whatever the bread stock (the flow design's "expand" over "stock").
 */
export interface AutoplayPolicy {
  readonly maxHousingLots: number;
  readonly naiveReserve?: boolean;
  /** F0-B gate ② (EV-7): the unprepared variant builds no wells beyond the opening one (`--no-wells`). */
  readonly noWells?: boolean;
  /** F0-C1 (FC-6): the bot's famine answer (relief unless a gate variant says otherwise) and petition answer (accept). */
  readonly famineResponse?: import("../content/chapterConfig").FamineResponseChoice;
  readonly petitionResponse?: import("../content/chapterConfig").PetitionResponse;
  /**
   * FAIL-3 gate (FL-12): the naive variant ignores its debts — it builds upkeep facilities in arrears, puts homes before
   * food in a derelict town and never buys a lost right back.
   */
  readonly naiveUpkeep?: boolean;
  /**
   * F2-A gate (WR-10): the wall-or-market answer (the bot's own rule unless a gate variant fixes it). FIX-5 (WR-11):
   * `wall` is the stone-wall variant — from chapter 2 it seeks the stone project right after food (quarry, masonry,
   * stone, the proclamation) and, once proclaimed, puts the wall's work first.
   */
  readonly wallChoice?: "wall" | "market";
}
/** C4 (AL-8): while the kiln waits for a barn the wheat can spare, the food step plants with a wider margin. */
function aleFood(state: GameState, decide: () => AutoplayAction): AutoplayAction {
  return aleWantsBarley(state) ? withArableMargin(ALE_ARABLE_MARGIN_PERMILLE, decide) : decide();
}
const DEFAULT_AUTOPLAY_POLICY = { maxHousingLots: AUTOPLAY_MAX_HOUSING_LOTS } as const;
const NONE = { kind: "none" } as const satisfies AutoplayAction;
const ERA_PHASE_SEARCH_WORK = 768;
const coordinateKey = (coordinate: TileCoordinate): string => `${coordinate.tx},${coordinate.ty}`;
function compareCoordinates(left: TileCoordinate, right: TileCoordinate): number {
  return left.ty - right.ty || left.tx - right.tx;
}
function buildingOrigin(building: Building): TileCoordinate {
  return { tx: building.tx, ty: building.ty };
}
function hasBuiltOrPlannedBuilding(state: GameState, kind: BuildingKind): boolean {
  return state.buildings.some((building) => building.kind === kind) ||
    hasPlannedBuilding(state, kind);
}
function hasPlannedBuilding(state: GameState, kind: BuildingKind): boolean {
  return state.constructionSites.some((site) => isBuildingConstructionSite(site) && site.kind === kind);
}
function breadStock(state: GameState): number {
  const buildingBread = state.buildings.reduce((total, building) => total + (building.inventory.bread ?? 0), 0);
  const houseBread = state.houses.reduce((total, house) => total + house.breadStock, 0);
  return buildingBread + houseBread;
}
function isGrassOrigin(state: GameState, coordinate: TileCoordinate): boolean {
  return getTile(state, coordinate)?.terrain === "grass";
}
function houseCapacity(state: GameState): number {
  return state.houses.reduce((total, house) => {
    const capacity = HOUSING_CONFIG.find((definition) => definition.level === house.level)?.capacity ?? 0;
    return total + capacity * houseLotArea(state.buildings.find((building) => building.id === house.buildingId));
  }, 0);
}
function virtualBuilding(kind: BuildingKind, coordinate: TileCoordinate): Building {
  return {
    id: "autoplay-candidate",
    kind,
    tx: coordinate.tx,
    ty: coordinate.ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}
function findBuildSite(
  state: GameState,
  kind: BuildingKind,
  accepts: (coordinate: TileCoordinate) => boolean = () => true,
  candidates?: readonly TileCoordinate[],
): TileCoordinate | null {
  if (autoplaySearchExhausted()) return null;
  const coordinates = candidates ?? lateFoodBuildSites(state, kind) ?? state.tiles.filter(tile =>
    tile.tx > 0 && tile.ty > 0 && tile.tx < state.width - 1 && tile.ty < state.height - 1);
  for (const coordinate of coordinates) {
    // Every candidate still needs a service proof; an exhausted phase cannot supply one.
    if (autoplaySearchExhausted()) return null;
    const check = autoplaySiteCheck(state, kind, coordinate, accepts);
    if (check === null || check === "road_first") return coordinate;
  }
  return null;
}

/** LM-E1b (TA-10): the site check that failed, in the order the bot runs them. */
export type SiteRefusal = "clearance" | "accepts" | "placement" | "wall_space" | "service_space" | "road_expansion";

/**
 * LM-E1b (TA-10): the bot's checks of one site, lifted out of its site search so the town's candidates take the same:
 * the setback, the step's own test, the placement rules (zones, fields), the wall's room (the palisade still fits, or
 * a house stands inside it), the town's service space, and the road's room to grow. `road_first` is a site that needs
 * its road laid before the building (the bot lays the road; a town candidate is refused).
 */
export function autoplaySiteCheck(state: GameState, kind: BuildingKind, coordinate: TileCoordinate,
  accepts: (coordinate: TileCoordinate) => boolean = () => true): SiteRefusal | "road_first" | null {
  if (!hasAutoplayBuildingClearance(state, kind, coordinate)) return "clearance";
  if (!accepts(coordinate)) return "accepts";
  if (!autoplayCanPlace(state, kind, coordinate.tx, coordinate.ty)) return "placement";
  if (!preservesAutoplayWallSpace(state, kind, coordinate)) return "wall_space";
  if (!preservesAutoplayServiceSpace(state, { kind: 'place_building', building: kind, tx: coordinate.tx, ty: coordinate.ty })) return "service_space";
  const expansion = preserveRoadExpansion(state, { ...coordinate, kind });
  if (expansion?.kind === 'none') return "road_expansion";
  return expansion === null ? null : "road_first";
}

/** LM-E1b (TA-10): what a town candidate fails beyond the bot's site checks. */
export type TownSiteRefusal = SiteRefusal | "road_first" | "wall_side" | "house_lot" | "market_reach" | "route" | "house_sites";

/**
 * LM-E1b (TA-10): every check the bot's plan puts on a site, for one candidate of a town project — the wall and plot
 * rules the bot applies inside its own steps, as one test:
 * - `wall_side`: behind a wall, production and storage stand outside it when the plan's site is outside (LB-11);
 * - `house_lot`: a house takes a grass lot beside a road (the housing step's test);
 * - `market_reach`: with the markets at their cap, a new house stands where a market reaches it (AR-5);
 * - `route`: a building that needs a road has its materials' route (FIX-1);
 * - the bot's site checks above (setback, placement, the wall's room, service space, the road's room);
 * - `house_sites`: behind a wall, a building that leaves the lots still wanted their house sites (AR-7).
 * `planSite` is the site the bot's planning step chose (the wall side follows it). Null when the site passes.
 */
export function townSiteRefusal(state: GameState, kind: BuildingKind, coordinate: TileCoordinate, planSite: TileCoordinate,
  policy: AutoplayPolicy): TownSiteRefusal | null {
  if (state.palisade !== null && OUTSIDE_WALL_KINDS.has(kind) && outsideWall(state, kind, planSite) && !outsideWall(state, kind, coordinate)) return "wall_side";
  if (kind === "house") {
    const roads = [{ tx: 0, ty: -1 }, { tx: 1, ty: 0 }, { tx: 0, ty: 1 }, { tx: -1, ty: 0 }]
      .some(({ tx, ty }) => getTile(state, { tx: coordinate.tx + tx, ty: coordinate.ty + ty })?.hasRoad === true);
    // The housing step's second pass takes a lot between two houses too; the first pass's preference is left to the scores.
    if (!zoneRuleActive(state, "burgage") && (!isGrassOrigin(state, coordinate) || !roads)) return "house_lot";
    if (!keepsHouseInMarketReach(state, policy.maxHousingLots)(coordinate)) return "market_reach";
  }
  const routed = (site: TileCoordinate) => !BUILDING_CONFIG_BY_KIND[kind].requiresRoad || hasConnectedConstructionRoute(state, virtualBuilding(kind, site));
  const check = autoplaySiteCheck(state, kind, coordinate, routed);
  if (check === "accepts") return "route";
  if (check !== null) return check;
  if (!keepsInteriorHouseSites(state, { kind: "place_building", building: kind, tx: coordinate.tx, ty: coordinate.ty }, policy.maxHousingLots)) return "house_sites";
  return null;
}

function roadTiles(state: GameState): readonly TileCoordinate[] {
  return state.tiles
    .filter((tile) => tile.hasRoad)
    .map(({ tx, ty }) => ({ tx, ty }))
    .sort(compareCoordinates);
}

function roadActionForBuilding(state: GameState, building: Building): AutoplayAction {
  let best: { readonly from: TileCoordinate; readonly to: TileCoordinate; readonly length: number } | null = null;
  const accessTiles = buildingRoadAccessTiles({ ...state, tiles: state.tiles.map((tile) => ({ ...tile, hasRoad: true })) }, building)
    .filter((coordinate) => canPlaceRoad(state, coordinate))
    .sort(compareCoordinates);
  for (const road of roadTiles(state)) {
    for (const access of accessTiles) {
      const line = roadLine(road, access);
      const path = line.slice(1);
      const from = path[0];
      const destination = path.at(-1);
      if (
        from === undefined ||
        destination === undefined ||
        destination.tx !== access.tx ||
        destination.ty !== access.ty ||
        !path.every((coordinate, index) => canPlaceRoad(state, coordinate) && canTraverseRoadBoundary(state, line[index] ?? road, coordinate))
      ) continue;
      const safe = serviceSafeRoadAction(state, { kind: 'place_road', from, to: access });
      if (safe.kind !== 'place_road') continue;
      const candidate = { from: safe.from, to: safe.to, length: path.length };
      if (
        best === null ||
        candidate.length < best.length ||
        (candidate.length === best.length && compareCoordinates(candidate.from, best.from) < 0)
      ) {
        best = candidate;
      }
    }
  }
  return best === null ? NONE : { kind: "place_road", from: best.from, to: best.to };
}

function roadAccessAction(state: GameState): AutoplayAction {
  const candidates = state.buildings
    .filter(building => BUILDING_CONFIG_BY_KIND[building.kind].requiresRoad && BUILDING_CONFIG_BY_KIND[building.kind].workersRequired > 0 && building.workers === 0)
    .filter(building => !buildingHasRequiredRoadAccess(state, building))
    .sort((left, right) => compareCoordinates(buildingOrigin(left), buildingOrigin(right)));
  if (candidates.length === 0) return NONE;
  const allRoads = { ...state, tiles: state.tiles.map(tile => ({ ...tile, hasRoad: true })) };
  for (const candidate of candidates) {
    const direct = roadActionForBuilding(state, candidate);
    if (direct.kind !== "none") return direct;
    const routed = roadActionToTargets(state, buildingRoadAccessTiles(allRoads, candidate));
    if (routed.kind !== "none") return routed;
  }
  return NONE;
}

/**
 * LB-11 (C3): behind a wall, production and storage go outside it when a site exists, so the walled plots stay for
 * houses, services and granaries. With better hauling the town grows mills and timber works earlier; inside a
 * palisade they took the last plots (seed 3 stopped short of 24 lots).
 */
// C5 (CL-11): the cloth chain's yards and water mills go outside the wall too (the weaver's house may stand within).
const OUTSIDE_WALL_KINDS: ReadonlySet<BuildingKind> = new Set(["mill", "farmstead", "sawmill", "logging_camp", "quarry", "masonry", "storehouse",
  "pastoral_farm", "fulling_mill", "dyehouse", "tenter_yard"]);

function outsideWall(state: GameState, kind: BuildingKind, coordinate: TileCoordinate): boolean {
  const polygon = state.palisade?.polygon;
  if (polygon === undefined) return true;
  const { width, height } = BUILDING_CONFIG_BY_KIND[kind];
  return !footprintCorners({ id: "autoplay-outside-wall", ...coordinate, width, height }).every(corner => isPointInsidePalisade(corner, polygon));
}

/** The advisor's placement search for one building kind (exported for the LB-11 scenario test). */
export function autoplayBuildAction(state: GameState, kind: BuildingKind, accepts?: (coordinate: TileCoordinate) => boolean): AutoplayAction {
  return runAutoplaySearch(() => buildAction(state, kind, accepts));
}

function buildAction(state: GameState, kind: BuildingKind, accepts: (coordinate: TileCoordinate) => boolean = () => true): AutoplayAction {
  if (kind === 'market') return urbanServiceAction(state);
  const output = BUILDING_CONFIG_BY_KIND[kind].production?.output;
  // A full material destination cannot accept another producer's output.
  if (output === 'logs' || output === 'timber' || output === 'stone_raw' || output === 'stone') {
    if (storageCapacityBlock(state.buildings, output) !== null) return NONE;
  }
  const cost = BUILDING_CONFIG_BY_KIND[kind].buildCost;
  if ((cost.stone ?? 0) > placementSpendableResource(state, "stone")) return NONE;
  if ((cost.timber ?? 0) > placementSpendableResource(state, "timber")) {
    // FIX-10 (TT-4b): short of timber alone while the town's own has stopped — bought from the market's traders.
    const order = botTimberOrderFor(state, cost.timber ?? 0);
    return order === null ? NONE : { kind: "order_timber", amount: order };
  }
  const routed = (coordinate: TileCoordinate) => !BUILDING_CONFIG_BY_KIND[kind].requiresRoad
    || hasConnectedConstructionRoute(state, virtualBuilding(kind, coordinate));
  if (state.palisade !== null && OUTSIDE_WALL_KINDS.has(kind)) {
    const outside = findBuildSite(state, kind, (coordinate) => outsideWall(state, kind, coordinate) && accepts(coordinate) && routed(coordinate));
    if (outside !== null) return preserveRoadExpansion(state, { ...outside, kind }) ?? { kind: "place_building", building: kind, tx: outside.tx, ty: outside.ty };
  }
  const site = findBuildSite(state, kind, (coordinate) => accepts(coordinate) && routed(coordinate));
  if (site !== null) return preserveRoadExpansion(state, { ...site, kind }) ?? { kind: "place_building", building: kind, tx: site.tx, ty: site.ty };
  if (autoplaySearchExhausted()) return NONE;
  const roads = roadTiles(state);
  const candidates = state.tiles.filter(tile => hasAutoplayBuildingClearance(state, kind, tile) && autoplayCanPlace(state, kind, tile.tx, tile.ty, 'later') && accepts(tile))
    .map(tile => ({ tile, distance: Math.min(...roads.map(road => Math.abs(road.tx - tile.tx) + Math.abs(road.ty - tile.ty))) }))
    .sort((a, b) => a.distance - b.distance || compareCoordinates(a.tile, b.tile));
  for (const candidate of candidates.slice(0, 24)) {
    if (autoplaySearchExhausted()) return NONE;
    if (!preservesAutoplayWallSpace(state, kind, candidate.tile) || !preservesAutoplayServiceSpace(state, { kind: 'place_building', building: kind, tx: candidate.tile.tx, ty: candidate.tile.ty })) continue;
    const road = plannedBuildingRoadAction(state, virtualBuilding(kind, candidate.tile));
    if (road.kind !== "none") return road;
  }
  // FIX-10 (FD-4): no site for the quarry or logging camp on this side — a ford or bridge to the far bank's rock or wood.
  return crossingAction(state, kind);
}

function timberAction(state: GameState, diagnostic?: BotRecoveryCollector): AutoplayAction {
  // FIX-10 (TT-4): the construction's missing timber ordered from the market's traders, when the treasury pays for it.
  const order = botTimberOrder(state);
  if (order !== null) return { kind: "order_timber", amount: order };
  // BOT-1 (BT6): timber for the waiting construction, decided while the stock to build the facility is there.
  const demand = timberDemandExpansionKind(state);
  if (demand !== null) {
    const action = buildAction(state, demand);
    if (action.kind !== "none") {
      recordBotRecovery(diagnostic, "timber_demand", [], action);
      return action;
    }
  }
  // F0-C1 (AR-10): logs fill the storehouses while the sawmills are the short side — another sawmill first.
  if (logOverflowKind(state) !== null) {
    const action = buildAction(state, "sawmill");
    if (action.kind !== "none") {
      recordBotRecovery(diagnostic, "log_overflow", [], action);
      return action;
    }
  }
  const reserve = hasBuiltOrPlannedBuilding(state, "logging_camp") ? 120 : 39;
  if (placementSpendableResource(state, "timber") > reserve) return NONE;
  if (!hasBuiltOrPlannedBuilding(state, "logging_camp")) return buildAction(state, "logging_camp");
  if (!hasBuiltOrPlannedBuilding(state, "sawmill")) return buildAction(state, "sawmill");
  const expansion = timberExpansionKind(state);
  return expansion === null ? NONE : buildAction(state, expansion);
}

function splitsExistingHousePair(state: GameState, coordinate: TileCoordinate): boolean {
  const homes = state.buildings.filter((building) => building.kind === "house");
  const horizontal = homes.some((home) => home.ty === coordinate.ty && home.tx === coordinate.tx - 1) &&
    homes.some((home) => home.ty === coordinate.ty && home.tx === coordinate.tx + 1);
  const vertical = homes.some((home) => home.tx === coordinate.tx && home.ty === coordinate.ty - 1) &&
    homes.some((home) => home.tx === coordinate.tx && home.ty === coordinate.ty + 1);
  return horizontal || vertical;
}

function housingAction(state: GameState, policy: AutoplayPolicy): AutoplayAction {
  // Z-15a: with a burgage zone, houses go only onto plots, through ZoneFillAgent in decideNextAction.
  if (zoneRuleActive(state, "burgage")) return NONE;
  // F0-A (FP-6): the bread-stock check is a reserve measure — the naive variant expands whatever the stock.
  // F0-B (EV-7): so is holding growth while a dearth is coming and the stored food lasts less than two seasons.
  const stockShort = policy.naiveReserve !== true && (breadStock(state) < 20 || dearthHoldsGrowth(state));
  if (housingLotCount(state) >= policy.maxHousingLots || state.idleWorkers <= 6 || state.population < houseCapacity(state) || stockShort || hasPendingFoodChain(state) || hasPlannedBuilding(state, "house")) return NONE;
  const roads = new Set(roadTiles(state).map(coordinateKey));
  const accepts = (coordinate: TileCoordinate): boolean =>
    isGrassOrigin(state, coordinate) &&
    [
      { tx: coordinate.tx, ty: coordinate.ty - 1 },
      { tx: coordinate.tx + 1, ty: coordinate.ty },
      { tx: coordinate.tx, ty: coordinate.ty + 1 },
      { tx: coordinate.tx - 1, ty: coordinate.ty },
    ].some((neighbor) => roads.has(coordinateKey(neighbor)));
  // BOT-1 (AR-5): with the markets at the policy's cap, a new lot goes where a standing market reaches it.
  const reach = keepsHouseInMarketReach(state, policy.maxHousingLots);
  // BOT-1 (AR-7): behind a wall a lot can only stand inside it; search those sites, not the map in row order.
  const candidates = state.palisade === null ? undefined : interiorHouseSites(state);
  const site = findBuildSite(state, "house", (coordinate) =>
    accepts(coordinate) && !splitsExistingHousePair(state, coordinate) && reach(coordinate), candidates
  ) ?? findBuildSite(state, "house", (coordinate) => accepts(coordinate) && reach(coordinate), candidates);
  const interior = candidates === undefined ? null : new Set(candidates.map(coordinateKey));
  const roadFirst = (coordinate: TileCoordinate): boolean => reach(coordinate) && (interior === null || interior.has(coordinateKey(coordinate)));
  return site === null ? buildAction(state, "house", roadFirst) : preserveRoadExpansion(state, { ...site, kind: "house" }) ?? { kind: "place_building", building: "house", tx: site.tx, ty: site.ty };
}

function storageAction(state: GameState): AutoplayAction {
  const stores = state.buildings.filter(building => building.kind === "storehouse");
  if (stores.length === 0 || hasPlannedBuilding(state, "storehouse")) return NONE;
  const capacity = stores.reduce((sum, building) => sum + BUILDING_CONFIG_BY_KIND[building.kind].storageCapacity, 0);
  const occupied = stores.reduce((sum, building) => sum + Object.values(building.inventory).reduce((total, amount) => total + (amount ?? 0), 0), 0);
  const target = state.era === "hamlet" ? 400 : 1000;
  return capacity < target && occupied > capacity - 80 || needsStoneStorageRecovery(state)
    ? buildAction(state, "storehouse") : NONE;
}


/** LM-E1 (TA-3): one step of the bot's priority list — its name (the need it answers) and its decision. */
interface PlannerStep { readonly name: string; readonly decide: () => AutoplayAction; readonly wide: boolean }
interface PlannerPlan { readonly early: AutoplayAction | null; readonly steps: readonly PlannerStep[]; readonly accepts: (action: AutoplayAction) => boolean }

/** The bot's priority list for this state, step by step (LM-E1 reads every step; the bot takes the first). */
function plannerPlan(state: GameState, policy: AutoplayPolicy, diagnostic?: FoodDiagnosticCollector): PlannerPlan {
  if (reserveDeadlock(state) !== null) return { early: { kind: 'set_wall_construction_priority', priority: 'priority' }, steps: [], accepts: () => true };
  // LB-14 (C3): a dense walled town's church and market search needs the era phase's work too (seed 2 kept a church
  // unbuilt for 100,000+ ticks at 192: every probe failed within the budget, at 768 the same search finds the site).
  // BOT-1 (AR-7): behind a wall the market or church takes a site that leaves the remaining lots their house sites.
  const serviceDecision = (current: GameState) => urbanServiceAction(current, diagnostic,
    action => keepsInteriorHouseSites(current, action, policy.maxHousingLots, "check"));
  // BOT-1: walled homes out of every granary's road reach get a granary beside them (LB9 seed 3).
  const granaryGap = (current: GameState) => granaryGapAction(current, buildAction, diagnostic);
  // BOT-1: walled homes out of every market's reach get the market the service-space guard refuses (LB9 seed 2).
  const marketGap = (current: GameState) => marketGapAction(current, diagnostic);
  // BOT-1 (AR-7): behind a wall, a road or building that takes the house sites the remaining lots need is refused.
  const keepsSites = (action: AutoplayAction): boolean => {
    if (action.kind === "none" || keepsInteriorHouseSites(state, action, policy.maxHousingLots)) return true;
    recordBotRecovery(diagnostic, "interior_plots", [], action, "refused");
    return false;
  };
  // FAIL-3 (FL-11): in arrears over two periods no new facility that owes upkeep; with a fifth of the houses derelict,
  // food before homes. The naive variant (FL-12) does neither.
  const careful = policy.naiveUpkeep !== true;
  const upkeepHeld = careful && arrearsPeriods(state) >= LORDSHIP_BALANCE.botArrearsPeriods;
  const homesHeld = careful && (derelictPermille(state) ?? 0) >= LORDSHIP_BALANCE.botDerelictPermille;
  const keepsDebts = (action: AutoplayAction): boolean => !upkeepHeld || action.kind !== "place_building" || !(action.building in MONEY_BALANCE.upkeep);
  const accepts = (action: AutoplayAction) => keepsSites(action) && keepsDebts(action);
  // F0-A (FP-6): the autumn winter-reserve check, before the ordinary food step; the naive variant has none.
  const winterReserve = (current: GameState): AutoplayAction => policy.naiveReserve === true ? NONE : winterReserveAction(current, buildAction);
  // F0-B (EV-7): the unprepared variant digs no wells.
  const water = (current: GameState): AutoplayAction => policy.noWells === true ? NONE : waterAction(current);
  // F0-A (AR-8): a mill beside a barn the mills cannot empty while homes lose their levels (seed 4, run 1).
  const barnMill = (current: GameState): AutoplayAction => barnMillAction(current, buildAction, diagnostic);
  const stoneFirst = policy.wallChoice === "wall" && (state.politics?.chapter.number ?? 1) >= 2;
  if (state.era === "stone_town" && stoneFirst && wallConstructionPriority(state) !== "priority") {
    return { early: { kind: 'set_wall_construction_priority', priority: 'priority' }, steps: [], accepts };
  }
  const step = (name: string, decide: () => AutoplayAction, wide = false): PlannerStep => ({ name, decide, wide });
  if (state.era === "stone_town") {
    return { early: null, accepts, steps: [
      step("network_roads", () => networkRoadAction(state)), step("road_access", () => roadAccessAction(state)),
      step("construction_roads", () => constructionRoadAction(state)), step("winter_reserve", () => winterReserve(state)),
      step("barn_mill", () => barnMill(state)), step("food", () => aleFood(state, () => foodAction(state, buildAction, diagnostic))),
      step("ale", () => aleChainAction(state, buildAction)), step("cloth", () => clothChainAction(state, buildAction)),
      step("granary_gap", () => granaryGap(state)), step("construction_logistics", () => constructionLogisticsAction(state)),
      step("services", () => serviceDecision(state), true), step("market_gap", () => marketGap(state)), step("water", () => water(state)),
      step("material_recovery", () => materialRecoveryAction(state)),
      step("housing", (): AutoplayAction => homesHeld ? NONE : housingAction(state, policy)),
    ] };
  }
  // C1c-2: the proclamation checks service space for the whole walled town; with fields taking land near the
  // centre that first layout probe can exceed an ordinary phase, so the era phase gets four phases' work.
  // BOT-1 (AR-7): so does housing behind a wall, whose interior sites each need a service-space proof.
  return { early: null, accepts, steps: [
    step("water", () => water(state)),
    step("road_access", () => roadAccessAction(state)),
    step("network_roads", () => networkRoadAction(state)),
    step("construction_roads", () => constructionRoadAction(state)),
    // BOT-1: the granary site inside the wall before timber takes the stock (houses fill the interior for free).
    step("granary_gap", () => granaryGap(state)),
    step("timber", () => timberAction(state, diagnostic)),
    step("winter_reserve", () => winterReserve(state)),
    step("barn_mill", () => barnMill(state)),
    step("food", () => aleFood(state, () => foodAction(state, buildAction, diagnostic))),
    // C4 (AL-8): the ale chain once it is required.
    step("ale", () => aleChainAction(state, buildAction)),
    // C5 (CL-11): the cloth chain after chapter 3.
    step("cloth", () => clothChainAction(state, buildAction)),
    // FIX-5 (WR-11): the stone-wall variant seeks its project before homes.
    ...(stoneFirst ? [step("stone_project", () => stoneProjectAction(state, buildAction))] : []),
    step("housing", (): AutoplayAction => homesHeld ? NONE : housingAction(state, policy), state.palisade !== null),
    // WALL-2 (AR-12): a built wall too small for the lots still wanted is widened.
    step("wall_expansion", () => autoplayWallExpansionAction(state, policy.maxHousingLots)),
    step("services", () => serviceDecision(state), true),
    step("market_gap", () => marketGap(state)),
    step("storage", () => storageAction(state)),
    step("era", () => autoplayEraAction(state, buildAction, policy.maxHousingLots), true),
  ] };
}

function decideNextActionWithinBudget(state: GameState, policy: AutoplayPolicy = DEFAULT_AUTOPLAY_POLICY, diagnostic?: FoodDiagnosticCollector): AutoplayAction {
  const plan = plannerPlan(state, policy, diagnostic);
  if (plan.early !== null) return plan.early;
  let metadata: FoodTransientMetadata = {};
  for (const step of plan.steps) {
    const action = runAutoplaySearchPhase(step.decide, step.wide ? ERA_PHASE_SEARCH_WORK : undefined);
    if (action.foodTransient !== undefined) metadata = action;
    if (action.kind !== "none" && plan.accepts(action)) return carryFoodTransient(action, metadata);
  }
  return carryFoodTransient(NONE, metadata);
}

export function decideNextAction(state: GameState, policy: AutoplayPolicy = DEFAULT_AUTOPLAY_POLICY, diagnostic?: FoodDiagnosticCollector): AdvisorAction {
  // F0-C1 (FC-6): the famine and the petition are answered as soon as they come.
  const answer = chapterDecisionAction(state, policy.famineResponse ?? "relief", policy.petitionResponse ?? "accept", policy.naiveUpkeep === true ? "refuse" : "pay", policy.wallChoice);
  if (answer !== null) return answer;
  // F0-B (EV-7): a burnt house is rebuilt first (its household waits in the ruin).
  const rebuild = rebuildBurntHouseAction(state);
  if (rebuild !== null) return rebuild;
  // Spec Z-15: only a town with a burgage zone consults ZoneFillAgent, and only below the policy's lot cap
  // (C1c); with no burgage zone this is never called.
  if (zoneRuleActive(state, "burgage") && housingLotCount(state) < policy.maxHousingLots
    && (policy.naiveReserve === true || !dearthHoldsGrowth(state))) {
    const fill = zoneFillAction(state);
    if (fill !== null) return fill;
  }
  // AR-5 (MK-5): a home no market reaches gets a road into reach, else another market, and only then (empty or L0–L1,
  // at the lot target) is it demolished to be rebuilt in reach; behind a wall the road or market keeps the lots' sites (AR-7).
  const relocation = marketRelocationAction(state, policy.maxHousingLots, diagnostic,
    action => keepsInteriorHouseSites(state, action, policy.maxHousingLots));
  if (relocation.kind !== "none") return relocation;
  // F0-B (EV-7): the standard bot plants for a rumoured dearth; the naive variant does not.
  const margin = policy.naiveReserve === true ? NAIVE_ARABLE_MARGIN_PERMILLE : dearthArableMargin(state, ARABLE_MARGIN_PERMILLE);
  return withArableMargin(margin, () => decidePlacement(state, policy, diagnostic));
}

function decidePlacement(state: GameState, policy: AutoplayPolicy, diagnostic?: FoodDiagnosticCollector): AdvisorAction {
  resetAutoplayServiceSearch();
  let action = runAutoplaySearch(() => decideNextActionWithinBudget(state, policy, diagnostic), diagnostic);
  // Z-15a: a zone-refused candidate is excluded and the decision retried; it is never sent to the reducer.
  for (let attempt = 0; attempt < 3 && zoneRefusesAction(state, action); attempt += 1) {
    excludeZoneRefusal(action);
    resetAutoplayServiceSearch();
    action = runAutoplaySearch(() => decideNextActionWithinBudget(state, policy, diagnostic), diagnostic);
  }
  if (zoneRefusesAction(state, action)) {
    excludeZoneRefusal(action);
    action = NONE;
  }
  clearZoneExclusions();
  return action;
}

/**
 * LM-E1b (TA-11): the needs the bot's plan raises before its steps — the wall's priority when the construction reserve
 * locks the work, or the stone wall's priority once the stone town is proclaimed — without walking the steps.
 */
export function planningEarlyNeeds(state: GameState, policy: AutoplayPolicy = DEFAULT_AUTOPLAY_POLICY): readonly PlanningNeed[] {
  const early = plannerPlan(state, policy).early;
  return early === null || early.kind === "none" ? [] : [{ planner: "wall_priority", rank: 0, action: early }];
}

/** LM-E1 (TA-3): a need the bot's planning finds now — which step (its rank in the priority list) and the action. */
export interface PlanningNeed { readonly planner: string; readonly rank: number; readonly action: AdvisorAction }

/**
 * LM-E1 (TA-3): every need the bot's priority list finds in this state, not only its first — the rebuild of a burnt
 * house, a burgage plot to fill, a home out of the market's reach, then each planning step in order, each searched
 * within its own budget. The bot itself (`decideNextAction`) is unchanged; the town's actors read these as the "need"
 * reason of their proposals (the answers to the chapters' petitions stay the lord's).
 */
export function planningNeeds(state: GameState, policy: AutoplayPolicy = DEFAULT_AUTOPLAY_POLICY, skip: readonly string[] = []): readonly PlanningNeed[] {
  const needs: PlanningNeed[] = [];
  const add = (planner: string, rank: number, action: AdvisorAction | null | undefined) => {
    if (action !== null && action !== undefined && action.kind !== "none") needs.push({ planner, rank, action });
  };
  add("rebuild", -3, rebuildBurntHouseAction(state));
  if (zoneRuleActive(state, "burgage") && housingLotCount(state) < policy.maxHousingLots
    && (policy.naiveReserve === true || !dearthHoldsGrowth(state))) add("fill_plot", -2, zoneFillAction(state));
  add("market_reach", -1, marketRelocationAction(state, policy.maxHousingLots, undefined,
    action => keepsInteriorHouseSites(state, action, policy.maxHousingLots)));
  const margin = policy.naiveReserve === true ? NAIVE_ARABLE_MARGIN_PERMILLE : dearthArableMargin(state, ARABLE_MARGIN_PERMILLE);
  withArableMargin(margin, () => {
    resetAutoplayServiceSearch();
    const plan = plannerPlan(state, policy);
    if (plan.early !== null) add("wall_priority", 0, plan.early);
    plan.steps.forEach((step, rank) => {
      // LM-E1b (TA-11): a step the caller knows would find nothing again (the charter's wall search on the same layout).
      if (skip.includes(step.name)) return;
      resetAutoplayServiceSearch();
      const action = runAutoplaySearch(() => runAutoplaySearchPhase(step.decide, step.wide ? ERA_PHASE_SEARCH_WORK : undefined));
      if (action.kind !== "none" && plan.accepts(action) && !zoneRefusesAction(state, action)) add(step.name, rank, action);
    });
    clearZoneExclusions();
  });
  return needs;
}
