import { foodCoverageAction } from './autoplayFoodCoverage';
import { foodRecoveryKind } from './autoplayFoodThroughput';
import { housingLotCount } from "../population/housing";
import { houseLotArea } from "../geometry/buildingFootprint";
import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../content/buildingConfig";
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from "../content/houseFoodConfig";
import { HOUSING_CONFIG } from "../content/housingConfig";
import { isBuildingConstructionSite } from "../economy/construction";
import type { AutoplayAction } from "./autoplay.types";
import type { GameState } from "./engine.types";

type BuildAction = (state: GameState, kind: BuildingKind) => AutoplayAction;

const PRESSURE_FOOD_CHAIN_TARGET = 2;


function breadStock(state: GameState): number {
  const buildingBread = state.buildings.reduce((total, building) => total + (building.inventory.bread ?? 0), 0);
  const houseBread = state.houses.reduce((total, house) => total + house.breadStock, 0);
  return buildingBread + houseBread;
}

function builtOrPlannedCount(state: GameState, kind: BuildingKind): number {
  const built = state.buildings.filter((building) => building.kind === kind).length;
  const planned = state.constructionSites.filter((site) =>
    isBuildingConstructionSite(site) && site.kind === kind
  ).length;
  return built + planned;
}

export function hasPendingFoodChain(state: GameState): boolean {
  return state.constructionSites.some((site) =>
    isBuildingConstructionSite(site) &&
    (site.kind === "wheat_farm" || site.kind === "mill" || site.kind === "granary")
  );
}

function houseCapacity(state: GameState): number {
  return state.houses.reduce((total, house) => {
    const capacity = HOUSING_CONFIG.find((definition) => definition.level === house.level)?.capacity ?? 0;
    return total + capacity * houseLotArea(state.buildings.find((building) => building.id === house.buildingId));
  }, 0);
}

function hasHousingPressure(state: GameState): boolean {
  return state.idleWorkers > 6 && state.population >= houseCapacity(state);
}

function targetFoodChains(state: GameState): number {
  const pressureTarget = hasHousingPressure(state) && housingLotCount(state) >= 4 ? PRESSURE_FOOD_CHAIN_TARGET : 0;
  if (breadStock(state) >= 20) return pressureTarget;
  const expansionTarget = housingLotCount(state) > 4 ? housingLotCount(state) - 3 : 0;
  return Math.max(1, expansionTarget, pressureTarget);
}

function rationDemand(state: GameState): number {
  const projectedHomes = housingLotCount(state) + (hasHousingPressure(state) ? 1 : 0);
  return Math.max(state.houses.reduce((sum, house) => sum + houseFoodRation(house), 0), projectedHomes * 3);
}

function targetWheatCount(state: GameState, millCount: number): number {
  if (millCount === 0) return 0;
  return Math.ceil(rationDemand(state) / 5);
}

function targetMillCount(state: GameState): number {
  const production = BUILDING_CONFIG_BY_KIND.mill.production;
  if (production === null) return 0;
  // Fetching grain and delivering bread share one carter, so reserve 25% for hauling.
  const breadPerMeal = HOUSE_FOOD_INTERVAL / production.ticksPerOutput * 0.75;
  return Math.ceil(rationDemand(state) / breadPerMeal);
}

export function foodAction(state: GameState, buildAction: BuildAction): AutoplayAction {
  if (housingLotCount(state) === 0) return { kind: "none" };
  const wheatCount = builtOrPlannedCount(state, "wheat_farm");
  const millCount = builtOrPlannedCount(state, "mill");
  const granaryCount = builtOrPlannedCount(state, "granary");
  const target = targetFoodChains(state);
  if (hasPendingFoodChain(state)) return { kind: "none" };
  const coverage = foodCoverageAction(state);
  if (coverage.kind !== 'none') return coverage;
  const recovery = foodRecoveryKind(state, rationDemand(state));
  if (recovery !== null) return buildAction(state, recovery);
  if (wheatCount < target && wheatCount <= millCount) return buildAction(state, "wheat_farm");
  if (millCount < target && millCount <= granaryCount) return buildAction(state, "mill");
  if (wheatCount < target) return buildAction(state, "wheat_farm");
  if (granaryCount < target) return buildAction(state, "granary");
  if (millCount < target) return buildAction(state, "mill");
  if (millCount > 0 && millCount < targetMillCount(state)) return buildAction(state, "mill");
  if (wheatCount < targetWheatCount(state, millCount)) return buildAction(state, "wheat_farm");
  return { kind: "none" };
}
