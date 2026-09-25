import { BALANCE } from '../content/balanceConfig';
import { strandedFoodSupply } from './autoplayFoodRoutes';
import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { availableSpace, availableStock } from '../economy/storage';
import { arableSupplyShort } from './autoplayArable';
import { buildingHasRequiredRoadAccess } from './roadAccess';
import { foodEfficiencyMetrics } from './autoplayFoodEfficiency';
import { foodFacilityWithinLimit } from './autoplayFoodLimits';
import { feasibleDistributorDistance } from './distributorAccess';
import { resolveBuildingRoute } from './routing';
import type { GameState } from './engine.types';

export type MeasuredFoodReason = 'observation_warmup' | 'food_staff_shortage' | 'food_route_blocked'
  | 'wheat_transport_blocked' | 'food_supply_sufficient' | 'actual_wheat_deficit' | 'actual_bread_deficit';
export interface MeasuredFoodDecision {
  readonly kind: 'farmstead' | 'mill' | null;
  readonly reason: MeasuredFoodReason;
}

/**
 * AF-13: wheat comes once a year, so grain is judged by the expected harvest (`arableSupplyShort`), not by a
 * 2,400-tick flow; bread and mills keep the measured rules (A⁵-1 margin, starvation and transport checks).
 */
export function measuredFoodDecision(state: GameState, options: { readonly ignoreGrain?: boolean } = {}): MeasuredFoodDecision {
  const sample = foodEfficiencyMetrics(state);
  if (!sample.fullWindow || !sample.known) return { kind: null, reason: 'observation_warmup' };
  const facilities = state.buildings.filter(b => ['farmstead', 'mill', 'granary'].includes(b.kind));
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
  // `ignoreGrain`: the grain step had nothing to do, so the bread and mill rules decide on their own.
  const grainShort = options.ignoreGrain !== true && arableSupplyShort(state);
  const missedMeals = sample.consumedBread < sample.requestedBread;
  const breadDeficit = sample.requestedBread + sample.breadExported - sample.breadProduced;
  const breadMarginDeficit = sample.requestedBread > 0
    && sample.breadProduced < sample.requestedBread * BALANCE.FOOD_PRODUCTION_MARGIN_FACTOR;
  // Household bread cannot be redistributed to homes whose meals were missed.
  const stockedBread = facilities.reduce((sum, b) => sum + availableStock(b, 'bread'), 0)
    + (sample.requestedBread === sample.consumedBread
      ? state.houses.reduce((sum, h) => sum + h.breadStock, 0) : 0);
  if (!grainShort && !breadMarginDeficit
    && (breadDeficit <= 0 || !missedMeals && stockedBread >= breadDeficit)) {
    return { kind: null, reason: 'food_supply_sufficient' };
  }
  if (grainShort) return { kind: 'farmstead', reason: 'actual_wheat_deficit' };
  const stockedWheat = facilities.reduce((sum, b) => sum + availableStock(b, 'wheat'), 0);
  const mills = facilities.filter(b => b.kind === 'mill');
  // A full barn with starving mills is a hauling problem, not a grain problem (R-8 transport recovery).
  if (facilities.some(b => b.kind === 'farmstead' && availableSpace(b, BUILDING_CONFIG_BY_KIND.farmstead) === 0)
    && sample.eligibleMillTicks > 0 && sample.rawStarvedTicks > 0) {
    return { kind: null, reason: 'wheat_transport_blocked' };
  }
  const millsSupplied = sample.eligibleMillTicks > 0 && sample.rawStarvedTicks / sample.eligibleMillTicks < 0.2
    && mills.length > 0 && mills.every(b => (b.inventory.wheat ?? 0) > 0);
  if (breadDeficit > 0 && millsSupplied && foodFacilityWithinLimit(state, 'mill')
    && stockedWheat >= Math.max(0, breadDeficit) * (BUILDING_CONFIG_BY_KIND.mill.production?.inputPerOutput ?? 2)) {
    return { kind: 'mill', reason: 'actual_bread_deficit' };
  }
  if (!millsSupplied) return { kind: null, reason: 'wheat_transport_blocked' };
  return { kind: 'mill', reason: 'actual_bread_deficit' };
}
