import { autoplayCanPlace, clearZoneExclusions, excludeZoneRefusal, zoneRefusesAction } from "./autoplayZones";
import { zoneRuleActive } from "../zones/zonePlacement";
import { zoneFillAction } from "../zones/zoneFillAgent";
import { autoplaySearchExhausted, runAutoplaySearch, runAutoplaySearchPhase } from './autoplaySearchBudget';
import { resetAutoplayServiceSearch } from './autoplayServiceSpace';
import type { FoodDiagnosticCollector } from './autoplayFoodDiagnostic';
import { timberExpansionKind } from './autoplayTimberRecovery';
import { needsStoneStorageRecovery } from './autoplayStorageRecovery';
import { materialRecoveryAction } from './autoplayMaterialRecovery';
import { constructionLogisticsAction } from './autoplayConstructionLogistics';
import { carryFoodTransient, type FoodTransientMetadata } from './autoplayFoodTransient';
import { autoplayEraAction } from './autoplayEra';
import { preservesAutoplayServiceSpace, serviceSafeRoadAction } from './autoplayServiceSpace';
import { preservesAutoplayWallSpace } from './autoplayWallSpace';
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
export type { AutoplayAction } from "./autoplay.types";
export const AUTOPLAY_MAX_HOUSING_LOTS = 8;
export interface AutoplayPolicy { readonly maxHousingLots: number }
const DEFAULT_AUTOPLAY_POLICY = { maxHousingLots: AUTOPLAY_MAX_HOUSING_LOTS } as const;
const NONE = { kind: "none" } as const satisfies AutoplayAction;
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
): TileCoordinate | null {
  if (autoplaySearchExhausted()) return null;
  const coordinates = lateFoodBuildSites(state, kind) ?? state.tiles.filter(tile =>
    tile.tx > 0 && tile.ty > 0 && tile.tx < state.width - 1 && tile.ty < state.height - 1);
  for (const coordinate of coordinates) {
    // Every candidate still needs a service proof; an exhausted phase cannot supply one.
    if (autoplaySearchExhausted()) return null;
    if (!hasAutoplayBuildingClearance(state, kind, coordinate) || !accepts(coordinate)) continue;
    if (autoplayCanPlace(state, kind, coordinate.tx, coordinate.ty) && preservesAutoplayWallSpace(state, kind, coordinate)
      && preservesAutoplayServiceSpace(state, { kind: 'place_building', building: kind, tx: coordinate.tx, ty: coordinate.ty })
      && preserveRoadExpansion(state, { ...coordinate, kind })?.kind !== 'none') return coordinate;
  }
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

function buildAction(state: GameState, kind: BuildingKind): AutoplayAction {
  if (kind === 'market') return urbanServiceAction(state);
  const output = BUILDING_CONFIG_BY_KIND[kind].production?.output;
  // A full material destination cannot accept another producer's output.
  if (output === 'logs' || output === 'timber' || output === 'stone_raw' || output === 'stone') {
    if (storageCapacityBlock(state.buildings, output) !== null) return NONE;
  }
  const cost = BUILDING_CONFIG_BY_KIND[kind].buildCost;
  if ((["timber", "stone"] as const).some(resource => (cost[resource] ?? 0) > placementSpendableResource(state, resource))) return NONE;
  const site = findBuildSite(state, kind, (coordinate) =>
    !BUILDING_CONFIG_BY_KIND[kind].requiresRoad ||
    hasConnectedConstructionRoute(state, virtualBuilding(kind, coordinate)),
  );
  if (site !== null) return preserveRoadExpansion(state, { ...site, kind }) ?? { kind: "place_building", building: kind, tx: site.tx, ty: site.ty };
  if (autoplaySearchExhausted()) return NONE;
  const roads = roadTiles(state);
  const candidates = state.tiles.filter(tile => hasAutoplayBuildingClearance(state, kind, tile) && autoplayCanPlace(state, kind, tile.tx, tile.ty))
    .map(tile => ({ tile, distance: Math.min(...roads.map(road => Math.abs(road.tx - tile.tx) + Math.abs(road.ty - tile.ty))) }))
    .sort((a, b) => a.distance - b.distance || compareCoordinates(a.tile, b.tile));
  for (const candidate of candidates.slice(0, 24)) {
    if (autoplaySearchExhausted()) return NONE;
    if (!preservesAutoplayWallSpace(state, kind, candidate.tile) || !preservesAutoplayServiceSpace(state, { kind: 'place_building', building: kind, tx: candidate.tile.tx, ty: candidate.tile.ty })) continue;
    const road = plannedBuildingRoadAction(state, virtualBuilding(kind, candidate.tile));
    if (road.kind !== "none") return road;
  }
  return NONE;
}

function timberAction(state: GameState): AutoplayAction {
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
  if (housingLotCount(state) >= policy.maxHousingLots || state.idleWorkers <= 6 || state.population < houseCapacity(state) || breadStock(state) < 20 || hasPendingFoodChain(state) || hasPlannedBuilding(state, "house")) return NONE;
  const roads = new Set(roadTiles(state).map(coordinateKey));
  const accepts = (coordinate: TileCoordinate): boolean =>
    isGrassOrigin(state, coordinate) &&
    [
      { tx: coordinate.tx, ty: coordinate.ty - 1 },
      { tx: coordinate.tx + 1, ty: coordinate.ty },
      { tx: coordinate.tx, ty: coordinate.ty + 1 },
      { tx: coordinate.tx - 1, ty: coordinate.ty },
    ].some((neighbor) => roads.has(coordinateKey(neighbor)));
  const site = findBuildSite(state, "house", (coordinate) =>
    accepts(coordinate) && !splitsExistingHousePair(state, coordinate)
  ) ?? findBuildSite(state, "house", accepts);
  return site === null ? buildAction(state, "house") : preserveRoadExpansion(state, { ...site, kind: "house" }) ?? { kind: "place_building", building: "house", tx: site.tx, ty: site.ty };
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


function decideNextActionWithinBudget(state: GameState, policy: AutoplayPolicy = DEFAULT_AUTOPLAY_POLICY, diagnostic?: FoodDiagnosticCollector): AutoplayAction {
  let metadata: FoodTransientMetadata = {};
  if (reserveDeadlock(state) !== null) return { kind: 'set_wall_construction_priority', priority: 'priority' };
  if (state.era === "stone_town") {
    for (const decide of [networkRoadAction, roadAccessAction, constructionRoadAction,
      (current: GameState) => foodAction(current, buildAction, diagnostic), constructionLogisticsAction, (current: GameState) => urbanServiceAction(current, diagnostic), waterAction, materialRecoveryAction,
      (current: GameState) => housingAction(current, policy)]) {
      const action = runAutoplaySearchPhase(() => decide(state));
      if (action.foodTransient !== undefined) metadata = action;
      if (action.kind !== "none") return carryFoodTransient(action, metadata);
    }
    return carryFoodTransient(NONE, metadata);
  }
  for (const decide of [
    () => waterAction(state),
    () => roadAccessAction(state),
    () => networkRoadAction(state),
    () => constructionRoadAction(state),
    () => timberAction(state),
    () => foodAction(state, buildAction, diagnostic),
    () => housingAction(state, policy),
    () => urbanServiceAction(state, diagnostic),
    () => storageAction(state),
    () => autoplayEraAction(state, buildAction),
  ]) {
    const action = runAutoplaySearchPhase(decide);
    if (action.foodTransient !== undefined) metadata = action;
    if (action.kind !== "none") return carryFoodTransient(action, metadata);
  }
  return carryFoodTransient(NONE, metadata);
}

export function decideNextAction(state: GameState, policy: AutoplayPolicy = DEFAULT_AUTOPLAY_POLICY, diagnostic?: FoodDiagnosticCollector): AutoplayAction {
  // Spec Z-15: only a town with a burgage zone consults ZoneFillAgent, and only below the policy's lot cap
  // (C1c); with no burgage zone this is never called.
  if (zoneRuleActive(state, "burgage") && housingLotCount(state) < policy.maxHousingLots) {
    const fill = zoneFillAction(state);
    if (fill !== null) return fill;
  }
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
