import { BALANCE } from '../content/balanceConfig';
import { strandedFoodSupply } from './autoplayFoodRoutes';
import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { productionOperation } from '../economy/production';
import { availableStock } from '../economy/storage';
import { buildingHasRequiredRoadAccess } from './roadAccess';
import { foodEfficiencyMetrics } from './autoplayFoodEfficiency';
import { foodFacilityWithinLimit } from './autoplayFoodLimits';
import { feasibleDistributorDistance } from './distributorAccess';
import { resolveBuildingRoute } from './routing';
import type { GameState } from './engine.types';

export type MeasuredFoodReason = 'observation_warmup' | 'food_staff_shortage' | 'food_route_blocked'
  | 'wheat_transport_blocked' | 'food_supply_sufficient' | 'actual_wheat_deficit' | 'actual_bread_deficit';
export interface MeasuredFoodDecision {
  readonly kind: 'wheat_farm' | 'mill' | null;
  readonly reason: MeasuredFoodReason;
}
export function measuredFoodDecision(state: GameState): MeasuredFoodDecision {
  const sample = foodEfficiencyMetrics(state);
  if (!sample.fullWindow || !sample.known) return { kind: null, reason: 'observation_warmup' };
  const facilities = state.buildings.filter(b => ['wheat_farm', 'mill', 'granary'].includes(b.kind));
  if (facilities.some(b => b.workers < BUILDING_CONFIG_BY_KIND[b.kind].workersRequired)) {
    return { kind: null, reason: 'food_staff_shortage' };
  }
  const granaries = facilities.filter(b => b.kind === 'granary');
  if (facilities.some(b => !buildingHasRequiredRoadAccess(state, b)
    || !granaries.some(g => g.id === b.id || resolveBuildingRoute(state, b, g).path !== null))) {
    return { kind: null, reason: 'food_route_blocked' };
  }
  if (state.houses.some(h => h.residents > 0
    && !granaries.some(g => (feasibleDistributorDistance(state, g, h.buildingId) ?? Infinity) <= BALANCE.DISTRIBUTOR_RANGE))) {
    return { kind: null, reason: 'food_route_blocked' };
  }
  if (strandedFoodSupply(state) !== null) return { kind: null, reason: 'food_route_blocked' };
  const missedMeals = sample.consumedBread < sample.requestedBread;
  const breadDeficit = sample.requestedBread + sample.breadExported - sample.breadProduced;
  const wheatMarginDeficit = sample.wheatConsumed > 0
    && sample.wheatProduced < sample.wheatConsumed * BALANCE.FOOD_PRODUCTION_MARGIN_FACTOR;
  const breadMarginDeficit = sample.requestedBread > 0
    && sample.breadProduced < sample.requestedBread * BALANCE.FOOD_PRODUCTION_MARGIN_FACTOR;
  // Household bread cannot be redistributed to homes whose meals were missed.
  const stockedBread = facilities.reduce((sum, b) => sum + availableStock(b, 'bread'), 0)
    + (sample.requestedBread === sample.consumedBread
      ? state.houses.reduce((sum, h) => sum + h.breadStock, 0) : 0);
  if (!wheatMarginDeficit && !breadMarginDeficit
    && (breadDeficit <= 0 || !missedMeals && stockedBread >= breadDeficit)) {
    return { kind: null, reason: 'food_supply_sufficient' };
  }
  const conversion = sample.breadProduced > 0 ? sample.wheatConsumed / sample.breadProduced : 0;
  const wheatDemand = Math.max(sample.wheatConsumed, (sample.requestedBread + sample.breadExported) * conversion);
  const rawDeficit = wheatDemand + sample.wheatExported - sample.wheatProduced;
  const stockedWheat = facilities.reduce((sum, b) => sum + availableStock(b, 'wheat'), 0);
  if (facilities.some(b => b.kind === 'wheat_farm' && productionOperation(b, BUILDING_CONFIG_BY_KIND.wheat_farm) === 'output_full')) {
    const mills = facilities.filter(b => b.kind === 'mill');
    const supplied = sample.eligibleMillTicks > 0 && sample.rawStarvedTicks === 0 && mills.length > 0
      && mills.every(m => productionOperation(m, BUILDING_CONFIG_BY_KIND.mill) === 'working');
    const reachableRaw = granaries.filter(g => mills.every(m => resolveBuildingRoute(state, m, g).path !== null))
      .reduce((sum, g) => sum + availableStock(g, 'wheat'), 0);
    if (supplied && sample.breadProduced > 0 && reachableRaw > 0 && reachableRaw >= Math.max(0, rawDeficit)) {
      return { kind: 'mill', reason: 'actual_bread_deficit' };
    }
    return { kind: null, reason: 'wheat_transport_blocked' };
  }
  const mills = facilities.filter(b => b.kind === 'mill');
  const bufferedMillDeficit = wheatMarginDeficit && sample.wheatProduced >= sample.wheatConsumed && breadDeficit > 0
    && foodFacilityWithinLimit(state, 'mill')
    && sample.eligibleMillTicks > 0 && sample.rawStarvedTicks / sample.eligibleMillTicks < 0.2
    && mills.length > 0 && mills.every(b => (b.inventory.wheat ?? 0) > 0)
    && stockedWheat >= Math.max(0, sample.wheatConsumed * BALANCE.FOOD_PRODUCTION_MARGIN_FACTOR - sample.wheatProduced, rawDeficit);
  if (bufferedMillDeficit) return { kind: 'mill', reason: 'actual_bread_deficit' };
  if (wheatMarginDeficit) return { kind: 'wheat_farm', reason: 'actual_wheat_deficit' };
  if (rawDeficit > (missedMeals ? 0 : stockedWheat) || (sample.breadProduced === 0 && stockedWheat === 0)) {
    return { kind: 'wheat_farm', reason: 'actual_wheat_deficit' };
  }
  if (sample.eligibleMillTicks === 0 || sample.rawStarvedTicks / sample.eligibleMillTicks >= 0.2
    || facilities.some(b => b.kind === 'mill' && (b.inventory.wheat ?? 0) === 0)) {
    return { kind: null, reason: 'wheat_transport_blocked' };
  }
  return { kind: 'mill', reason: 'actual_bread_deficit' };
}
