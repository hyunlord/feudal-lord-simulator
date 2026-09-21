import { diagnosticAction, initialFoodDiagnostic, transientSummary, type FoodDiagnosticCollector, type FoodDiagnosticReason, type FoodKind } from './autoplayFoodDiagnostic';
import { carryFoodTransient, transientFoodDecision } from './autoplayFoodTransient';
import { canStaffFoodExpansion } from './autoplayFoodBottleneck';
import { measuredFoodFlow } from './autoplayFoodFlow';
import { houseIsStarving } from '../population/houseFood';
import { foodCoverageAction } from './autoplayFoodCoverage';
import {
  blocksRepeatedFoodExpansion,
  foodRecoveryKind,
  hasActiveFoodObservation,
} from './autoplayFoodThroughput';
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

export function foodAction(state: GameState, buildAction: BuildAction, collector?: FoodDiagnosticCollector): AutoplayAction {
  let diagnostic = collector === undefined ? undefined : initialFoodDiagnostic(state);
  const finish = (action: AutoplayAction, reason: FoodDiagnosticReason): AutoplayAction => {
    if (collector !== undefined && diagnostic !== undefined) collector.food = { ...diagnostic, reached: true, reason, action: diagnosticAction(action) };
    return action;
  };
  const check = (phase: 'transition' | 'build', kind: FoodKind, name: 'repeat' | 'staff', result: boolean): boolean => {
    if (diagnostic !== undefined) diagnostic = { ...diagnostic, checks: [...diagnostic.checks, { phase, kind, check: name, result }],
      evaluation: { ...diagnostic.evaluation, [phase + (name === 'repeat' ? 'Repeat' : 'Staff')]: result } };
    return result;
  };
  if (housingLotCount(state) === 0) return finish({ kind: "none" }, 'no_housing');
  const wheatCount = builtOrPlannedCount(state, "wheat_farm");
  const millCount = builtOrPlannedCount(state, "mill");
  const granaryCount = builtOrPlannedCount(state, "granary");
  const target = targetFoodChains(state);
  if (diagnostic !== undefined) diagnostic = { ...diagnostic, counts: { wheat: wheatCount, mill: millCount, granary: granaryCount, target } };
  if (hasPendingFoodChain(state)) return finish({ kind: "none" }, 'pending_chain');
  if (hasActiveFoodObservation(state)) return finish({ kind: "none" }, 'active_observation');
  const coverage = foodCoverageAction(state);
  if (coverage.kind !== 'none') return finish(coverage, 'coverage_selected');
  const completeChain = wheatCount > 0 && millCount > 0 && granaryCount > 0;
  const recovery = completeChain ? foodRecoveryKind(state, rationDemand(state)) : null;
  if (diagnostic !== undefined) diagnostic = { ...diagnostic, completeChain, recovery };
  let buildReason: FoodDiagnosticReason = 'bootstrap_selected';
  const foodBuildAction = (kind: FoodKind): AutoplayAction => {
    if (check('build', kind, 'repeat', blocksRepeatedFoodExpansion(state, kind))) {
      buildReason = 'repeat_blocked'; return { kind: 'none' };
    }
    if (completeChain && !check('build', kind, 'staff', canStaffFoodExpansion(state, kind))) {
      buildReason = 'staff_blocked'; return { kind: 'none' };
    }
    const action = buildAction(state, kind);
    if (action.kind === 'none') buildReason = 'build_returned_none';
    return action;
  };
  const transition = transientFoodDecision(state, rationDemand(state), recovery === "mill"
    && !check('transition', 'mill', 'repeat', blocksRepeatedFoodExpansion(state, "mill"))
    && check('transition', 'mill', 'staff', canStaffFoodExpansion(state, "mill")));
  if (diagnostic !== undefined) diagnostic = { ...diagnostic, transition: { defer: transition.defer, metadata: transientSummary(transition.foodTransient) } };
  if (recovery !== null) {
    buildReason = 'recovery_selected';
    const action = carryFoodTransient(transition.defer ? { kind: "none" } : foodBuildAction(recovery), transition);
    return finish(action, transition.defer ? 'recovery_deferred' : buildReason);
  }
  if (transition.foodTransient !== undefined) return finish(carryFoodTransient({ kind: 'none' }, transition), 'transient_metadata_only');
  if (completeChain && measuredFoodFlow(state) !== undefined) return finish({ kind: 'none' }, 'measured_no_recovery');
  if (state.autoplayFoodFlow !== undefined && state.houses.some(house => houseIsStarving(house, state.tick))
    && completeChain) return finish({ kind: 'none' }, 'unmeasured_starving_guard');
  if (wheatCount < target && wheatCount <= millCount) return finish(foodBuildAction("wheat_farm"), buildReason);
  if (millCount < target && millCount <= granaryCount) return finish(foodBuildAction("mill"), buildReason);
  if (wheatCount < target) return finish(foodBuildAction("wheat_farm"), buildReason);
  if (granaryCount < target) return finish(foodBuildAction("granary"), buildReason);
  if (millCount < target) return finish(foodBuildAction("mill"), buildReason);
  if (millCount > 0 && millCount < targetMillCount(state)) return finish(foodBuildAction("mill"), buildReason);
  if (wheatCount < targetWheatCount(state, millCount)) return finish(foodBuildAction("wheat_farm"), buildReason);
  return finish({ kind: 'none' }, 'bootstrap_exhausted');
}
