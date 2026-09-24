import { BALANCE } from '../content/balanceConfig';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { availableStock } from '../economy/storage';
import { placementSpendableResource } from '../world/placement';
import { canStaffFoodExpansion } from './autoplayFoodBottleneck';
import { foodEfficiencyMetrics } from './autoplayFoodEfficiency';
import { foodFacilityWithinLimit } from './autoplayFoodLimits';
import { lateFoodBuildSites } from './autoplayFoodPlacement';
import { blocksRepeatedFoodExpansion } from './autoplayFoodThroughput';
import { hasConnectedConstructionRoute } from './autoplayConstructionRoute';
import { preserveRoadExpansion } from './autoplayExpansion';
import { preservesAutoplayServiceSpace } from './autoplayServiceSpace';
import { preservesAutoplayWallSpace } from './autoplayWallSpace';
import { feasibleDistributorDistance } from './distributorAccess';
import { resolveBuildingRoute } from './routing';
import type { AutoplayAction } from './autoplay.types';
import type { GameState } from './engine.types';

/** S8-R8: process stranded stocked grain near demand after one observation interval.
 * Existing empty mills still prohibit expansion; this repairs a backed-up pool,
 * rather than hiding missing input with additional idle conversion buildings. */
export function wheatTransportCapacityAction(state: GameState): AutoplayAction {
  const none = { kind: 'none' } as const;
  const sample = foodEfficiencyMetrics(state);
  const config = BUILDING_CONFIG_BY_KIND.mill;
  if (!sample.fullWindow || !sample.known || sample.rawStarvedTicks === 0
    || sample.breadProduced >= sample.requestedBread * BALANCE.FOOD_PRODUCTION_MARGIN_FACTOR + sample.breadExported
    || !foodFacilityWithinLimit(state, 'mill') || blocksRepeatedFoodExpansion(state, 'mill')
    || !canStaffFoodExpansion(state, 'mill')
    || (['timber', 'stone'] as const).some(resource => placementSpendableResource(state, resource) < (config.buildCost[resource] ?? 0))) return none;
  const stores = state.buildings.filter(b => b.kind === 'granary' && availableStock(b, 'wheat') >= BALANCE.CARTER_CAPACITY);
  if (stores.length === 0) return none;
  const hungry = state.houses.filter(h => h.residents > 0 && h.breadStock === 0);
  const candidates = (lateFoodBuildSites(state, 'mill') ?? []).map(tile => {
    const candidate: Building = { id: `transport-mill-${tile.tx}-${tile.ty}`, kind: 'mill', ...tile,
      workers: config.workersRequired, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
    const supply = Math.min(...stores.map(store => (resolveBuildingRoute(state, candidate, store).path?.length ?? Infinity) - 1));
    const demand = hungry.length === 0 ? 0 : Math.min(...hungry.map(home => feasibleDistributorDistance(state, candidate, home.buildingId) ?? Infinity));
    return { candidate, supply, demand };
  }).filter(entry => Number.isFinite(entry.supply) && Number.isFinite(entry.demand))
    .sort((a, b) => a.supply + a.demand - b.supply - b.demand || a.candidate.ty - b.candidate.ty || a.candidate.tx - b.candidate.tx);
  for (const { candidate } of candidates.slice(0, 24)) {
    const action = { kind: 'place_building', building: 'mill', tx: candidate.tx, ty: candidate.ty } as const;
    if (!hasConnectedConstructionRoute(state, candidate) || !preservesAutoplayWallSpace(state, 'mill', candidate)
      || !preservesAutoplayServiceSpace(state, action)) continue;
    const road = preserveRoadExpansion(state, candidate);
    if (road?.kind === 'none') continue;
    return road ?? action;
  }
  return none;
}
