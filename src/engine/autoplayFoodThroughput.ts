import { FOOD_EFFICIENCY_WINDOW, foodEfficiencyMetrics } from './autoplayFoodEfficiency';
import { measuredFoodDecision } from './autoplayFoodMeasuredDecision';
import { feasibleDistributorDistance } from './distributorAccess';
import { observeEmptyDeliveryHomes } from './autoplayFoodDeliveryCapacity';
import { BALANCE } from '../content/balanceConfig';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { availableStock } from '../economy/storage';
import { houseIsStarving } from '../population/houseFood';
import type {
  AutoplayFoodObservation,
  AutoplayFoodObservationOutcome,
  AutoplayFoodObservationSnapshot,
  GameState,
} from './engine.types';
import { resolveBuildingRoute } from './routing';

function roundTripTicks(edges: number): number {
  return 2 * Math.max(1, Math.ceil(edges / BALANCE.CARTER_SPEED));
}

function routeEdgesToGranary(state: GameState, building: Building): number {
  const distances = state.buildings.filter(candidate => candidate.kind === "granary")
    .flatMap(granary => {
      const path = resolveBuildingRoute(state, building, granary).path;
      return path === null ? [] : [Math.max(0, path.length - 1)];
    });
  return distances.length === 0 ? BALANCE.DISTRIBUTOR_RANGE : Math.min(...distances);
}

export function foodObservationTicks(state: GameState, building: Building, targets?: readonly string[]): number {
  const production = BUILDING_CONFIG_BY_KIND[building.kind].production;
  const routeTicks = roundTripTicks(routeEdgesToGranary(state, building));
  const distributorTicks = BALANCE.DISTRIBUTOR_INTERVAL +
    Math.ceil(BALANCE.DISTRIBUTOR_RANGE / BALANCE.DISTRIBUTOR_SPEED);
  if (production === null) return building.kind === "granary" && targets !== undefined
    ? targetedGranaryTicks(state, building, targets) : distributorTicks;
  const batch = building.kind === "mill"
    ? Math.ceil(BALANCE.CARTER_CAPACITY / Math.max(1, production.inputPerOutput))
    : BALANCE.CARTER_CAPACITY;
  return batch * production.ticksPerOutput + routeTicks + distributorTicks;
}

export function hasActiveFoodObservation(state: GameState): boolean {
  const observation = state.autoplayFoodObservation;
  if (observation === undefined) return false;
  if (observation.observeUntilTick !== undefined) return state.tick < observation.observeUntilTick;
  return state.constructionSites.some(site => site.id === observation.siteId);
}

function currentHouseBread(state: GameState): number {
  return state.houses.reduce((total, house) => total + house.breadStock, 0);
}

function starvingHomeCount(state: GameState): number {
  return state.houses.filter((house) => houseIsStarving(house, state.tick)).length;
}

function foodObservationSnapshot(state: GameState): AutoplayFoodObservationSnapshot {
  return {
    outputTotal: 0,
    houseBread: currentHouseBread(state),
    starvingHomes: starvingHomeCount(state),
  };
}

function foodObservationOutcome(
  baseline: AutoplayFoodObservationSnapshot,
  latest: AutoplayFoodObservationSnapshot,
): AutoplayFoodObservationOutcome {
  const outputDelta = Math.max(0, latest.outputTotal - baseline.outputTotal);
  const deliveredBreadDelta = Math.max(0, latest.houseBread - baseline.houseBread);
  const starvingHomesDelta = Math.max(0, baseline.starvingHomes - latest.starvingHomes);
  return {
    outputDelta,
    deliveredBreadDelta,
    starvingHomesDelta,
    effective: outputDelta > 0 || deliveredBreadDelta > 0,
  };
}

function observedOutcome(state: GameState, observation: AutoplayFoodObservation, latest: AutoplayFoodObservationSnapshot): AutoplayFoodObservationOutcome {
  const baseline = observation.baseline;
  if (baseline === undefined) return { outputDelta: 0, deliveredBreadDelta: 0, starvingHomesDelta: 0, effective: false };
  const outcome = foodObservationOutcome(baseline, latest);
  if (observation.kind !== 'wheat_farm' || observation.requiresDeliveredOutcome === false) return outcome;
  const sample = foodEfficiencyMetrics(state);
  const deliveredWheatDelta = latest.deliveredWheat ?? 0;
  return { ...outcome, deliveredWheatDelta, effective: observation.observeUntilTick !== undefined
    && state.tick >= observation.observeUntilTick && sample.fullWindow && sample.known
    && deliveredWheatDelta > 0 && baseline.breadProduced !== undefined && baseline.missedMeals !== undefined
    && (sample.breadProduced > baseline.breadProduced || sample.requestedBread - sample.consumedBread < baseline.missedMeals) };
}

export function startFoodObservation(
  state: GameState,
  observation: AutoplayFoodObservation,
  building: Building,
): AutoplayFoodObservation {
  const sample = foodEfficiencyMetrics(state);
  const baseline = { ...foodObservationSnapshot(state), deliveredWheat: 0,
    ...(sample.fullWindow && sample.known ? { breadProduced: sample.breadProduced,
      missedMeals: sample.requestedBread - sample.consumedBread } : {}) };
  const completeChain = ['wheat_farm', 'mill', 'granary'].every(kind => state.buildings.some(b => b.kind === kind));
  return {
    ...observation,
    requiresDeliveredOutcome: completeChain,
    completedTick: state.tick,
    observeUntilTick: state.tick + Math.max(completeChain ? FOOD_EFFICIENCY_WINDOW : 0, foodObservationTicks(state, building, observation.targetHouseIds)),
    baseline,
    latest: baseline,
    outcome: foodObservationOutcome(baseline, baseline),
  };
}

export function refreshFoodObservation(input: GameState): GameState {
  const state = observeEmptyDeliveryHomes(input);
  const observation = state.autoplayFoodObservation;
  if (
    observation === undefined ||
    observation.completedTick === undefined ||
    observation.observeUntilTick === undefined ||
    observation.baseline === undefined ||
    state.tick > observation.observeUntilTick
  ) return state;
  const latest = {
    ...(observation.latest ?? observation.baseline),
    starvingHomes: starvingHomeCount(state),
  };
  return {
    ...state,
    autoplayFoodObservation: {
      ...observation,
      latest,
      outcome: observedOutcome(state, observation, latest),
    },
  };
}

export function recordFoodObservationActivity(
  state: GameState,
  activity: { readonly outputProduced?: number; readonly deliveredWheat?: number; readonly deliveredBread?: number; readonly deliveredHouseIds?: readonly string[] },
): GameState {
  const observation = state.autoplayFoodObservation;
  if (
    observation === undefined ||
    observation.completedTick === undefined ||
    observation.observeUntilTick === undefined ||
    observation.baseline === undefined ||
    state.tick > observation.observeUntilTick
  ) return state;
  const current = observation.latest ?? observation.baseline;
  const latest = {
    deliveredWheat: (current.deliveredWheat ?? 0) + Math.max(0, activity.deliveredWheat ?? 0),
    outputTotal: current.outputTotal + Math.max(0, activity.outputProduced ?? 0),
    houseBread: current.houseBread + Math.max(0, activity.deliveredBread ?? 0),
    starvingHomes: starvingHomeCount(state),
  };
  return {
    ...state,
    autoplayFoodObservation: {
      ...observation,
      ...(observation.targetHouseIds === undefined ? {} : {
        deliveredTargetHouseIds: [...new Set([...(observation.deliveredTargetHouseIds ?? []), ...(activity.deliveredHouseIds ?? [])])],
      }),
      latest,
      outcome: observedOutcome(state, observation, latest),
    },
  };
}

export function blocksRepeatedFoodExpansion(state: GameState, kind: AutoplayFoodObservation["kind"]): boolean {
  const observation = state.autoplayFoodObservation;
  if (kind === 'wheat_farm' && observation?.kind === kind
    && observation.requiresDeliveredOutcome === true && observation.completedTick !== undefined
    && observation.observeUntilTick !== undefined && state.tick >= observation.observeUntilTick
    && observation.outcome?.effective === false && (observation.outcome.deliveredWheatDelta ?? 0) > 0
    && observation.baseline?.breadProduced !== undefined) {
    const sample = foodEfficiencyMetrics(state);
    const laterEvidence = sample.breadProduced > observation.baseline.breadProduced
      || observation.outcome.outputDelta > 0 && sample.wheatProduced < sample.wheatConsumed;
    if (sample.fullWindow && sample.known && laterEvidence
      && measuredFoodDecision(state).reason === 'actual_wheat_deficit') return false;
  }
  return observation !== undefined &&
    observation.kind === kind &&
    observation.observeUntilTick !== undefined &&
    state.tick >= observation.observeUntilTick &&
    (observation.outcome?.effective === false
      || kind === 'wheat_farm' && observation.requiresDeliveredOutcome === undefined);
}

export function foodRecoveryKind(state: GameState, _mealDemand: number): 'wheat_farm' | 'mill' | null {
  return measuredFoodDecision(state).kind;
}

function targetedGranaryTicks(state: GameState, building: Building, targets: readonly string[]): number {
  const paths = state.houses.filter(house => targets.includes(house.buildingId)).flatMap(house => {
    const home = state.buildings.find(candidate => candidate.id === house.buildingId);
    if (home === undefined) return [];
    const edges = feasibleDistributorDistance(state, building, house.buildingId);
    return edges === null ? [] : [edges];
  });
  const delivery = BALANCE.DISTRIBUTOR_INTERVAL
    + (2 * BALANCE.DISTRIBUTOR_RANGE + Math.max(0, ...paths)) * Math.ceil(1 / BALANCE.DISTRIBUTOR_SPEED);
  if (availableStock(building, 'bread') > 0) return delivery;
  const supply = state.buildings.filter(candidate => candidate.kind === 'mill').flatMap(mill => {
    const path = resolveBuildingRoute(state, mill, building).path;
    const production = BUILDING_CONFIG_BY_KIND.mill.production;
    if (path === null || production === null) return [];
    const batchTicks = Math.ceil(BALANCE.CARTER_CAPACITY / production.inputPerOutput) * production.ticksPerOutput;
    return [batchTicks + roundTripTicks(path.length - 1)];
  });
  return delivery + (supply.length > 0 ? Math.min(...supply) : 0);
}
