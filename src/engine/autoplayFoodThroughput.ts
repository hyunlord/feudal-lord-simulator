import { BALANCE } from '../content/balanceConfig';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { HOUSE_FOOD_INTERVAL } from '../content/houseFoodConfig';
import { houseIsStarving } from '../population/houseFood';
import type {
  AutoplayFoodObservation,
  AutoplayFoodObservationOutcome,
  AutoplayFoodObservationSnapshot,
  GameState,
} from './engine.types';
import { buildingHasRequiredRoadAccess } from './roadAccess';
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

export function foodObservationTicks(state: GameState, building: Building): number {
  const production = BUILDING_CONFIG_BY_KIND[building.kind].production;
  const routeTicks = roundTripTicks(routeEdgesToGranary(state, building));
  const distributorTicks = BALANCE.DISTRIBUTOR_INTERVAL +
    Math.ceil(BALANCE.DISTRIBUTOR_RANGE / BALANCE.DISTRIBUTOR_SPEED);
  if (production === null) return distributorTicks;
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

export function startFoodObservation(
  state: GameState,
  observation: AutoplayFoodObservation,
  building: Building,
): AutoplayFoodObservation {
  const baseline = foodObservationSnapshot(state);
  return {
    ...observation,
    completedTick: state.tick,
    observeUntilTick: state.tick + foodObservationTicks(state, building),
    baseline,
    latest: baseline,
    outcome: foodObservationOutcome(baseline, baseline),
  };
}

export function refreshFoodObservation(state: GameState): GameState {
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
      outcome: foodObservationOutcome(observation.baseline, latest),
    },
  };
}

export function recordFoodObservationActivity(
  state: GameState,
  activity: { readonly outputProduced?: number; readonly deliveredBread?: number },
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
    outputTotal: current.outputTotal + Math.max(0, activity.outputProduced ?? 0),
    houseBread: current.houseBread + Math.max(0, activity.deliveredBread ?? 0),
    starvingHomes: starvingHomeCount(state),
  };
  return {
    ...state,
    autoplayFoodObservation: {
      ...observation,
      latest,
      outcome: foodObservationOutcome(observation.baseline, latest),
    },
  };
}

export function blocksRepeatedFoodExpansion(state: GameState, kind: AutoplayFoodObservation["kind"]): boolean {
  const observation = state.autoplayFoodObservation;
  return observation !== undefined &&
    observation.kind === kind &&
    observation.observeUntilTick !== undefined &&
    state.tick >= observation.observeUntilTick &&
    observation.outcome?.effective === false;
}

export function foodRecoveryKind(state: GameState, mealDemand: number): 'wheat_farm' | 'mill' | null {
  if (!state.houses.some(house => houseIsStarving(house, state.tick))) return null;
  const granaries = state.buildings.filter(building => building.kind === 'granary');
  const producers = state.buildings.filter(building => building.kind === 'mill' || building.kind === 'wheat_farm');
  if (granaries.length === 0 || producers.length === 0) return null;
  if ([...granaries, ...producers].some(building =>
    building.workers < BUILDING_CONFIG_BY_KIND[building.kind].workersRequired || !buildingHasRequiredRoadAccess(state, building))) return null;

  const distances = (building: Building): readonly number[] => granaries.flatMap(granary => {
    const path = resolveBuildingRoute(state, building, granary).path;
    return path === null ? [] : [Math.max(0, path.length - 1)];
  });
  let wheatPerMeal = 0;
  let breadPerMeal = 0;
  for (const building of producers) {
    const paths = distances(building);
    if (paths.length === 0) return null;
    const production = BUILDING_CONFIG_BY_KIND[building.kind].production;
    if (production === null) continue;
    if (building.kind === 'wheat_farm') {
      const batch = BALANCE.CARTER_CAPACITY;
      const cycle = Math.max(batch * production.ticksPerOutput, roundTripTicks(Math.min(...paths)));
      wheatPerMeal += HOUSE_FOOD_INTERVAL * batch / cycle;
    } else {
      const batch = BALANCE.CARTER_CAPACITY / production.inputPerOutput;
      const cycle = batch * production.ticksPerOutput + roundTripTicks(Math.min(...paths)) + roundTripTicks(Math.max(...paths));
      breadPerMeal += HOUSE_FOOD_INTERVAL * batch / cycle;
    }
  }
  const inputPerBread = BUILDING_CONFIG_BY_KIND.mill.production?.inputPerOutput ?? 0;
  if (wheatPerMeal < mealDemand * inputPerBread) return 'wheat_farm';
  return breadPerMeal < mealDemand ? 'mill' : null;
}
