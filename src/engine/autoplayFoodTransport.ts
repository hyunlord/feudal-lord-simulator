import { BALANCE } from '../content/balanceConfig';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { availableStock } from '../economy/storage';
import { canPlaceBuildingBeforeRoad, placementSpendableResource } from '../world/placement';
import { foodEfficiencyMetrics } from './autoplayFoodEfficiency';
import { foodFacilityWithinLimit } from './autoplayFoodLimits';
import { canStaffRecurringGranary } from './autoplayRecurringDeliveryStaffing';
import { blocksRepeatedFoodExpansion, hasActiveFoodObservation } from './autoplayFoodThroughput';
import { projectGranaryAccess } from './autoplayFoodCoverage';
import { hasAutoplayBuildingClearance } from './autoplaySetback';
import { preservesAutoplayWallSpace } from './autoplayWallSpace';
import { preservesAutoplayServiceSpace } from './autoplayServiceSpace';
import { hasConnectedConstructionRoute } from './autoplayConstructionRoute';
import { preserveRoadExpansion } from './autoplayExpansion';
import { feasibleDistributorDistance } from './distributorAccess';
import { resolveBuildingRoute } from './routing';
import { civicConstructionReserve } from './autoplayCivicReserve';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';

const NONE = { kind: 'none' } as const;
function distance(state: GameState, from: Building, to: Building): number {
  const path = resolveBuildingRoute(state, from, to).path;
  return path === null ? Infinity : path.length - 1;
}

export function foodTransportGranaryAction(state: GameState): AutoplayAction {
  const sample = foodEfficiencyMetrics(state);
  const config = BUILDING_CONFIG_BY_KIND.granary;
  const reserve = civicConstructionReserve(state);
  if (!sample.fullWindow || sample.rawStarvedTicks === 0 || sample.wheatProduced === 0
    || hasActiveFoodObservation(state)
    || !foodFacilityWithinLimit(state, 'granary') || blocksRepeatedFoodExpansion(state, 'granary')
    || state.idleWorkers < config.workersRequired
    || (['timber', 'stone'] as const).some(r => placementSpendableResource(state, r) < (config.buildCost[r] ?? 0) + reserve[r])) return NONE;
  const stores = state.buildings.filter(b => b.kind === 'granary');
  const raw = stores.filter(b => availableStock(b, 'wheat') > 0);
  const mills = state.buildings.filter(b => b.kind === 'mill' && (b.inventory.wheat ?? 0) === 0
    && raw.some(store => Number.isFinite(distance(state, b, store))));
  if (mills.length === 0) return NONE;
  const farms = state.buildings.filter(b => b.kind === 'farmstead' && b.workers >= BUILDING_CONFIG_BY_KIND.farmstead.workersRequired);
  const candidates = state.tiles.filter(tile => hasAutoplayBuildingClearance(state, 'granary', tile)
    && canPlaceBuildingBeforeRoad(state, 'granary', tile.tx, tile.ty).ok)
    .map(tile => ({ tile, proximity: Math.min(...mills.map(m => Math.abs(m.tx - tile.tx) + Math.abs(m.ty - tile.ty))) }))
    .sort((a, b) => a.proximity - b.proximity || a.tile.ty - b.tile.ty || a.tile.tx - b.tile.tx);
  let best: { action: AutoplayAction; improvement: number; homes: number; roads: number } | null = null;
  for (const { tile } of candidates.slice(0, 24)) {
    if (!preservesAutoplayWallSpace(state, 'granary', tile)
      || !preservesAutoplayServiceSpace(state, { kind: 'place_building', building: 'granary', ...tile })) continue;
    const candidate: Building = { id: 'food-transport-granary', kind: 'granary', tx: tile.tx, ty: tile.ty,
      workers: config.workersRequired, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
    const access = projectGranaryAccess(state, candidate);
    if (access === null || !hasConnectedConstructionRoute(access.state, candidate)
      || !canStaffRecurringGranary(access.state, candidate)
      || (['timber', 'stone'] as const).some(r => placementSpendableResource(access.state, r) < (config.buildCost[r] ?? 0) + reserve[r])) continue;
    const projected = { ...access.state, pathCache: {}, buildings: [...access.state.buildings, candidate],
      tiles: access.state.tiles.map(t => t.tx >= tile.tx && t.tx < tile.tx + config.width
        && t.ty >= tile.ty && t.ty < tile.ty + config.height ? { ...t, buildingId: candidate.id } : t) };
    const millGain = Math.max(...mills.map(m => Math.min(...raw.map(g => distance(state, m, g))) - distance(projected, m, candidate)));
    const farmGain = Math.max(...farms.map(f => Math.min(...stores.map(g => distance(state, f, g))) - distance(projected, f, candidate)));
    if (!Number.isFinite(millGain) || millGain <= 0 || !Number.isFinite(farmGain) || farmGain <= 0) continue;
    const homes = state.houses.filter(h => {
      const edges = feasibleDistributorDistance(projected, candidate, h.buildingId);
      return h.residents > 0 && edges !== null && edges <= BALANCE.DISTRIBUTOR_RANGE;
    }).length;
    if (homes === 0) continue;
    const improvement = millGain + farmGain;
    if (best !== null && (improvement < best.improvement || improvement === best.improvement
      && (homes < best.homes || homes === best.homes && access.added >= best.roads))) continue;
    const action = access.first.kind !== 'none' ? access.first : preserveRoadExpansion(state, candidate)
      ?? { kind: 'place_building', building: 'granary', tx: tile.tx, ty: tile.ty };
    if (action.kind !== 'none') best = { action, improvement, homes, roads: access.added };
  }
  return best?.action ?? NONE;
}
