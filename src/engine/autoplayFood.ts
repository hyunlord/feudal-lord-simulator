import type { BuildingKind } from "../content/buildingConfig";
import { HOUSING_CONFIG } from "../content/housingConfig";
import { isBuildingConstructionSite } from "../economy/construction";
import type { AutoplayAction } from "./autoplay.types";
import type { GameState } from "./engine.types";

type BuildAction = (state: GameState, kind: BuildingKind) => AutoplayAction;

const PRESSURE_FOOD_CHAIN_TARGET = 2;
const EXPANDED_HOUSING_WHEAT_TARGET = 3;

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
    return total + capacity;
  }, 0);
}

function hasHousingPressure(state: GameState): boolean {
  return state.idleWorkers > 6 && state.population >= houseCapacity(state);
}

function targetFoodChains(state: GameState): number {
  const pressureTarget = hasHousingPressure(state) && state.houses.length >= 4 ? PRESSURE_FOOD_CHAIN_TARGET : 0;
  if (breadStock(state) >= 20) return pressureTarget;
  const expansionTarget = state.houses.length > 4 ? state.houses.length - 3 : 0;
  return Math.max(1, expansionTarget, pressureTarget);
}

function targetWheatCount(state: GameState, millCount: number): number {
  if (state.houses.length <= 4) return 0;
  return Math.min(EXPANDED_HOUSING_WHEAT_TARGET, millCount + 1);
}

export function foodAction(state: GameState, buildAction: BuildAction): AutoplayAction {
  if (state.houses.length === 0) return { kind: "none" };
  const wheatCount = builtOrPlannedCount(state, "wheat_farm");
  const millCount = builtOrPlannedCount(state, "mill");
  const granaryCount = builtOrPlannedCount(state, "granary");
  const target = targetFoodChains(state);
  if (hasPendingFoodChain(state)) return { kind: "none" };
  if (wheatCount < target && wheatCount <= millCount) return buildAction(state, "wheat_farm");
  if (millCount < target && millCount <= granaryCount) return buildAction(state, "mill");
  if (wheatCount < target) return buildAction(state, "wheat_farm");
  if (granaryCount < target) return buildAction(state, "granary");
  if (millCount < target) return buildAction(state, "mill");
  if (wheatCount < targetWheatCount(state, millCount)) return buildAction(state, "wheat_farm");
  return { kind: "none" };
}
