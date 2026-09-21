import type { TilePos } from '../agents/walker.types';
import type { Building } from '../content/buildingConfig';
import type { GameState } from './engine.types';
import { buildingRoadAccessTiles, resolveRoadToBuildingRoute } from './routing';
import { getOrthogonalRoadNeighbors } from '../world/roadGraph';

const exitsByState = new WeakMap<GameState, Map<Building, readonly TilePos[]>>();

export function eligibleRoamingExits(state: GameState, building: Building): readonly TilePos[] {
  let cache = exitsByState.get(state);
  if (cache === undefined) { cache = new Map(); exitsByState.set(state, cache); }
  const cached = cache.get(building);
  if (cached !== undefined) return cached;
  const sizes = new Map<string, number>();
  const key = (tile: TilePos) => `${tile.tx},${tile.ty}`;
  const accesses = buildingRoadAccessTiles(state, building);
  for (const access of accesses) {
    if (sizes.has(key(access))) continue;
    const queue = [access];
    const seen = new Set([key(access)]);
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      if (current === undefined) continue;
      for (const neighbor of getOrthogonalRoadNeighbors(state, current)) {
        if (seen.has(key(neighbor))) continue;
        seen.add(key(neighbor)); queue.push(neighbor);
      }
    }
    for (const tile of seen) sizes.set(tile, seen.size);
  }
  const largest = Math.max(0, ...accesses.map(tile => sizes.get(key(tile)) ?? 0));
  const result = accesses.filter(tile => sizes.get(key(tile)) === largest);
  cache.set(building, result);
  return result;
}

// Feasible opportunity across legal exits, never a claim of dispatch or delivery.
export function feasibleDistributorDistance(state: GameState, granary: Building, houseId: string): number | null {
  const house = state.buildings.find(building => building.id === houseId);
  if (house === undefined) return null;
  const distances = eligibleRoamingExits(state, granary).flatMap(start => {
    const path = resolveRoadToBuildingRoute(state, start, house);
    return path === null ? [] : [path.length - 1];
  });
  return distances.length === 0 ? null : Math.min(...distances);
}
