import { BALANCE } from '../content/balanceConfig';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { HOUSE_FOOD_INTERVAL } from '../content/houseFoodConfig';
import { houseIsStarving } from '../population/houseFood';
import type { GameState } from './engine.types';
import { buildingHasRequiredRoadAccess } from './roadAccess';
import { resolveBuildingRoute } from './routing';

function roundTripTicks(edges: number): number {
  return 2 * Math.max(1, Math.ceil(edges / BALANCE.CARTER_SPEED));
}

/** Route-based planning estimate, not measured output: shared input shortages and overlapping work are not modeled. */
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
