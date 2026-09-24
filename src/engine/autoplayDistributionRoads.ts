import { BALANCE } from '../content/balanceConfig';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { availableStock } from '../economy/storage';
import { getOrthogonalRoadNeighbors } from '../world/roadGraph';
import type { TileCoordinate } from '../world/grid';
import { buildingRoadAccessTiles } from './routing';
import { feasibleDistributorDistance } from './distributorAccess';
import { recurringDeliveryRoutes } from './autoplayRecurringDeliveryRoutes';
import { potentialServiceRoads, serviceSpaceBuildings, serviceTileKey } from './autoplayServiceSpaceRoutes';
import { serviceSafeRoadAction } from './autoplayServiceSpace';
import { autoplaySearchExhausted, markAutoplaySearchLimit, spendAutoplaySearch } from './autoplaySearchBudget';
import { roadPrefixAction } from './autoplayRoadPrefix';
import { placeRoadLine } from './gameActions';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';

const NONE = { kind: 'none' } as const;
const MAX_PAIRS = 24;

function shortageHomes(state: GameState): readonly Building[] {
  const observation = state.autoplayRecurringDelivery;
  if (observation === undefined || observation.tick > state.tick) return [];
  const routes = recurringDeliveryRoutes(state);
  return observation.homes.filter(entry => (entry.qualified || entry.deficientSince !== undefined)
    && routes.homes.some(route => route.buildingId === entry.buildingId && route.identity === entry.identity))
    .sort((a, b) => (a.deficientSince ?? state.tick) - (b.deficientSince ?? state.tick) || a.buildingId.localeCompare(b.buildingId))
    .flatMap(entry => {
      const home = state.buildings.find(building => building.id === entry.buildingId);
      return home !== undefined && state.houses.some(house => house.buildingId === home.id && house.residents > 0) ? [home] : [];
    });
}

function shortestCorridor(state: GameState, potential: GameState, home: Building, granary: Building, maxEdges: number): readonly TileCoordinate[] | null {
  const targets = new Set(buildingRoadAccessTiles(potential, granary).map(serviceTileKey));
  const queue = [...buildingRoadAccessTiles(state, home)];
  const parents = new Map<string, TileCoordinate | null>(queue.map(tile => [serviceTileKey(tile), null]));
  const distances = new Map(queue.map(tile => [serviceTileKey(tile), 0]));
  for (let index = 0; index < queue.length; index++) {
    const tile = queue[index];
    if (tile === undefined) break;
    const key = serviceTileKey(tile);
    if (targets.has(key)) {
      const path: TileCoordinate[] = [];
      let current: TileCoordinate | null = tile;
      while (current !== null) { path.unshift(current); current = parents.get(serviceTileKey(current)) ?? null; }
      return path;
    }
    const distance = distances.get(key) ?? 0;
    if (distance >= maxEdges) continue;
    for (const next of getOrthogonalRoadNeighbors(potential, tile)) {
      const nextKey = serviceTileKey(next);
      if (parents.has(nextKey)) continue;
      parents.set(nextKey, tile); distances.set(nextKey, distance + 1); queue.push(next);
    }
  }
  return null;
}

function proveCorridor(state: GameState, path: readonly TileCoordinate[], granary: Building, home: Building, previousBest: number): AutoplayAction {
  let projected = state;
  let first: AutoplayAction = NONE;
  // Each prefix adds road cells; the finite corridor bounds all projected edits.
  for (let step = 0; step < path.length; step++) {
    const prefix = roadPrefixAction(projected, path);
    if (prefix.kind !== 'place_road') break;
    if (!spendAutoplaySearch()) return NONE;
    const safe = serviceSafeRoadAction(projected, prefix);
    if (safe.kind !== 'place_road' || autoplaySearchExhausted()) return NONE;
    const next = placeRoadLine(projected, safe.from, safe.to);
    if (next === projected) return NONE;
    if (first.kind === 'none') first = safe;
    projected = next;
  }
  const distance = feasibleDistributorDistance(projected, granary, home.id);
  return distance !== null && distance <= BALANCE.DISTRIBUTOR_RANGE && distance < previousBest ? first : NONE;
}

/** Recurring meal failures may need a new granary exit, even at the facility cap.
 * Prove the entire legal corridor and every service-safe prefix before spending anything.
 * No delivery range, wall rule, saved plan or persistent cache is changed. */
export function distributionRoadRecoveryAction(state: GameState): AutoplayAction {
  const homes = shortageHomes(state);
  if (homes.length === 0) return NONE;
  const granaries = state.buildings.filter(building => building.kind === 'granary' && building.operationPaused !== true
    && building.workers >= BUILDING_CONFIG_BY_KIND.granary.workersRequired).sort((a, b) => a.id.localeCompare(b.id));
  const stocked = granaries.filter(granary => availableStock(granary, 'bread') > 0);
  if (stocked.length === 0) return NONE;
  const potential = potentialServiceRoads(state, serviceSpaceBuildings(state));
  let pairs = 0;
  for (const home of homes) {
    const previousBest = Math.min(...granaries.map(granary => feasibleDistributorDistance(state, granary, home.id) ?? Infinity));
    for (const granary of stocked) {
      if (pairs++ >= MAX_PAIRS) { markAutoplaySearchLimit(); return NONE; }
      if (!spendAutoplaySearch()) return NONE;
      const path = shortestCorridor(state, potential, home, granary, Math.min(BALANCE.DISTRIBUTOR_RANGE, previousBest - 1));
      if (path === null) continue;
      const action = proveCorridor(state, path, granary, home, previousBest);
      if (action.kind !== 'none') return action;
      if (autoplaySearchExhausted()) return NONE;
    }
  }
  return NONE;
}
