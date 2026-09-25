import { foodFacilityWithinLimit } from './autoplayFoodLimits';
import { recurringDeliveryHomes } from './autoplayRecurringDelivery';
import { canStaffRecurringGranary } from './autoplayRecurringDeliveryStaffing';
import { preservesAutoplayServiceSpace } from './autoplayServiceSpace';
import { preservesAutoplayWallSpace } from './autoplayWallSpace';
import { BALANCE } from '../content/balanceConfig';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { availableStock } from '../economy/storage';
import { isBuildingConstructionSite } from '../economy/construction';
import { buildingFootprint } from '../geometry/buildingFootprint';
import { canPlaceBuilding, placementSpendableResource } from '../world/placement';
import type { RoamingHouse } from '../agents/roamingTypes';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';
import { civicConstructionReserve } from './autoplayCivicReserve';
import { hasConnectedConstructionRoute } from './autoplayConstructionRoute';
import { plannedBuildingRoadAction } from './autoplayConstructionRoads';
import { hasAutoplayBuildingClearance } from './autoplaySetback';
import { placeRoadLine } from './gameActions';
import { canPlaceRoad, getOrthogonalRoadNeighbors } from '../world/roadGraph';
import { buildingRoadAccessTiles } from './routing';
import { buildingHasRequiredRoadAccess } from './roadAccess';
import { feasibleDistributorDistance } from './distributorAccess';
import { overloadedDeliveryHomes, persistentEmptyDeliveryHomes } from './autoplayFoodDeliveryCapacity';
import { hasActiveFoodObservation } from './autoplayFoodThroughput';
import { preserveRoadExpansion } from './autoplayExpansion';

const NONE = { kind: 'none' } as const;

function coverageGranary(position: { readonly tx: number; readonly ty: number }): Building {
  return { id: 'autoplay-food-coverage', kind: 'granary', tx: position.tx, ty: position.ty,
    workers: BUILDING_CONFIG_BY_KIND.granary.workersRequired, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
}

function outsideHomes(state: GameState): readonly RoamingHouse[] {
  const starts = state.buildings.filter(b => b.kind === 'granary').map(building => ({ building, stocked: availableStock(building, 'bread') > 0 }));
  return state.houses.flatMap(house => {
    const building = state.buildings.find(b => b.id === house.buildingId);
    if (building === undefined) return [];
    const home = { ...house, tx: building.tx, ty: building.ty, ...buildingFootprint(building) };
    const paths = starts.flatMap(start => {
      const edges = feasibleDistributorDistance(state, start.building, home.buildingId);
      return edges === null ? [] : [{ edges, stocked: start.stocked }];
    });
    // Disconnection and empty stores require their own repairs, not new storage.
    return paths.some(path => path.stocked) && Math.min(...paths.map(path => path.edges)) > BALANCE.DISTRIBUTOR_RANGE ? [home] : [];
  });
}

function affordable(state: GameState): boolean {
  const reserve = civicConstructionReserve(state);
  const cost = BUILDING_CONFIG_BY_KIND.granary.buildCost;
  return (['timber', 'stone'] as const).every(resource =>
    placementSpendableResource(state, resource) >= (cost[resource] ?? 0) + reserve[resource]);
}

export function projectGranaryAccess(state: GameState, candidate: Building): { state: GameState; first: AutoplayAction; added: number } | null {
  let projected = state;
  let first: AutoplayAction = NONE;
  const before = state.tiles.filter(tile => tile.hasRoad).length;
  // Each successful step adds at least one road tile; map area is the finite bound.
  for (let step = 0; step < state.tiles.length; step += 1) {
    if (buildingHasRequiredRoadAccess(projected, candidate)) {
      return { state: projected, first, added: projected.tiles.filter(tile => tile.hasRoad).length - before };
    }
    const action = plannedBuildingRoadAction(projected, candidate);
    if (action.kind !== 'place_road') return null;
    const next = placeRoadLine(projected, action.from, action.to);
    if (next === projected || next.tiles.every((tile, index) => tile.hasRoad === projected.tiles[index]?.hasRoad)) return null;
    if (first.kind === 'none') first = action;
    projected = next;
  }
  return null;
}

export function foodCoverageAction(state: GameState): AutoplayAction {
  if (!foodFacilityWithinLimit(state, 'granary') || hasActiveFoodObservation(state)) return NONE;
  const observation = state.autoplayFoodObservation;
  const failed = observation?.kind === 'granary' && (observation.outcome?.deliveredBreadDelta ?? 0) === 0 ? observation : undefined;
  if (failed !== undefined && failed.targetHouseIds === undefined) return NONE;
  if (state.constructionSites.some(site => isBuildingConstructionSite(site)
    && ['granary', 'mill', 'farmstead'].includes(site.kind))) return NONE;
  const recurring = recurringDeliveryHomes(state);
  const requiresProjection = state.idleWorkers < BUILDING_CONFIG_BY_KIND.granary.workersRequired;
  if ((requiresProjection && recurring.length === 0) || !affordable(state)) return NONE;
  const granaries = state.buildings.filter(building => building.kind === 'granary');
  if (granaries.some(building => building.workers < BUILDING_CONFIG_BY_KIND.granary.workersRequired)
    || !granaries.some(building => availableStock(building, 'bread') > 0)) return NONE;
  const rangeGap = outsideHomes(state);
  const overloaded = rangeGap.length > 0 ? [] : overloadedDeliveryHomes(state);
  const ordinary = rangeGap.length > 0 ? rangeGap : overloaded.length > 0 ? overloaded : persistentEmptyDeliveryHomes(state);
  const recurringRecovery = requiresProjection || ordinary.length === 0;
  const outside = retryableTargets(state, recurringRecovery ? recurring : ordinary);
  if (outside.length === 0) return NONE;
  const rangeRecovery = !recurringRecovery && rangeGap.length > 0;
  const distanceToTarget = recurringRecovery || (!rangeRecovery && overloaded.length === 0) ? potentialCoverageDistance(state, outside) : null;
  const candidates = state.tiles.filter(tile => hasAutoplayBuildingClearance(state, 'granary', tile)
    && canPlaceBuilding(state, 'granary', tile.tx, tile.ty).ok)
    .map(tile => ({ tile, distance: distanceToTarget?.(coverageGranary(tile))
      ?? Math.min(...outside.map(home => Math.abs(home.tx - tile.tx) + Math.abs(home.ty - tile.ty))) }))
    .filter(candidate => Number.isFinite(candidate.distance))
    .sort((a, b) => a.distance - b.distance || a.tile.ty - b.tile.ty || a.tile.tx - b.tile.tx);
  let best: { action: AutoplayAction; covered: number; roads: number } | null = null;
  // Match the existing civic advisor's bounded search rather than scanning road plans for the whole map.
  for (const { tile } of candidates.slice(0, 24)) {
    if (!preservesAutoplayWallSpace(state, "granary", tile) || !preservesAutoplayServiceSpace(state, { kind: 'place_building', building: 'granary', tx: tile.tx, ty: tile.ty })) continue;
    const candidate = coverageGranary(tile);
    const access = projectGranaryAccess(state, candidate);
    if (access === null || !affordable(access.state) || !hasConnectedConstructionRoute(access.state, candidate)) continue;
    if (recurringRecovery && !canStaffRecurringGranary(access.state, candidate)) continue;
    const projected = { ...access.state, buildings: [...access.state.buildings, candidate], pathCache: {},
      tiles: access.state.tiles.map(tile => tile.tx >= candidate.tx && tile.tx < candidate.tx + BUILDING_CONFIG_BY_KIND.granary.width && tile.ty >= candidate.ty && tile.ty < candidate.ty + BUILDING_CONFIG_BY_KIND.granary.height
        ? { ...tile, buildingId: candidate.id } : tile) };
    const remainingGap = rangeRecovery ? new Set(outsideHomes(projected).map(home => home.buildingId)) : null;
    const covered = remainingGap !== null ? outside.filter(home => !remainingGap.has(home.buildingId)).length
      : outside.filter(home => {
        const edges = feasibleDistributorDistance(projected, candidate, home.buildingId);
        return edges !== null && edges <= BALANCE.DISTRIBUTOR_RANGE;
      }).length;
    if (covered <= 0 || (best !== null && (covered < best.covered || (covered === best.covered && access.added >= best.roads)))) continue;
    const action = access.first.kind === 'none'
      ? preserveRoadExpansion(state, candidate) ?? { kind: 'place_building' as const, building: 'granary' as const, tx: candidate.tx, ty: candidate.ty } : access.first;
    if (action.kind === 'none') continue;
    best = { covered, roads: access.added, action };
  }
  return best?.action ?? NONE;
}

export function granaryCoverageTargetIds(state: GameState, position: { readonly tx: number; readonly ty: number }): readonly string[] {
  const gap = outsideHomes(state);
  const overloaded = gap.length > 0 ? [] : overloadedDeliveryHomes(state);
  const ordinary = gap.length > 0 ? gap : overloaded.length > 0 ? overloaded : persistentEmptyDeliveryHomes(state);
  const recurring = recurringDeliveryHomes(state);
  const targets = retryableTargets(state, state.idleWorkers < BUILDING_CONFIG_BY_KIND.granary.workersRequired
    ? recurring : ordinary.length > 0 ? ordinary : recurring);
  const candidate = coverageGranary(position);
  const projected = { ...state, buildings: [...state.buildings, candidate], pathCache: {},
    tiles: state.tiles.map(tile => tile.tx >= candidate.tx && tile.tx < candidate.tx + BUILDING_CONFIG_BY_KIND.granary.width
      && tile.ty >= candidate.ty && tile.ty < candidate.ty + BUILDING_CONFIG_BY_KIND.granary.height
      ? { ...tile, buildingId: candidate.id } : tile) };
  return targets.filter(home => {
    const edges = feasibleDistributorDistance(projected, candidate, home.buildingId);
    return edges !== null && edges <= BALANCE.DISTRIBUTOR_RANGE;
  }).map(home => home.buildingId);
}

function potentialCoverageDistance(state: GameState, homes: readonly RoamingHouse[]): (building: Building) => number {
  const potential = { ...state, tiles: state.tiles.map(tile => ({ ...tile, hasRoad: tile.hasRoad || canPlaceRoad(state, tile) })) };
  const queue = homes.flatMap(home => {
    const building = state.buildings.find(candidate => candidate.id === home.buildingId);
    return building === undefined ? [] : buildingRoadAccessTiles(state, building);
  });
  const key = (tile: { readonly tx: number; readonly ty: number }) => `${tile.tx},${tile.ty}`;
  const distances = new Map(queue.map(tile => [key(tile), 0]));
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (current === undefined) break;
    const distance = distances.get(key(current)) ?? 0;
    if (distance >= BALANCE.DISTRIBUTOR_RANGE) continue;
    for (const neighbor of getOrthogonalRoadNeighbors(potential, current)) {
      if (distances.has(key(neighbor))) continue;
      distances.set(key(neighbor), distance + 1);
      queue.push(neighbor);
    }
  }
  return building => Math.min(...buildingRoadAccessTiles(potential, building).map(tile => distances.get(key(tile)) ?? Infinity));
}

function retryableTargets(state: GameState, targets: readonly RoamingHouse[]): readonly RoamingHouse[] {
  const previous = state.autoplayFoodObservation;
  return targets.filter(home => {
    if (state.autoplayRecurringDelivery?.homes.some(entry => entry.buildingId === home.buildingId && entry.attemptedSiteId !== undefined)) return false;
    const episode = state.autoplayEmptyHomes?.find(entry => entry.buildingId === home.buildingId);
    if (episode?.failedRecovery && episode.lastServicedTick === home.lastServicedTick) return false;
    return previous?.kind !== 'granary' || !previous.targetHouseIds?.includes(home.buildingId)
      || previous.deliveredTargetHouseIds?.includes(home.buildingId)
      || (episode?.sinceTick ?? 0) > previous.placedTick;
  });
}
