import type { Building } from '../content/buildingConfig';
import { getOrthogonalRoadNeighbors } from '../world/roadGraph';
import { autoplayConstructionSources } from './autoplayConstructionSources';
import { buildingRoadAccessTiles } from './routing';
import { serviceTileKey } from './autoplayServiceSpaceRoutes';
import type { GameState } from './engine.types';

/** Shortest actual road-edge distance from existing construction supply access. */
export function serviceAccessDistances(state: GameState): (building: Building) => number {
  const queue = autoplayConstructionSources(state).flatMap(source => buildingRoadAccessTiles(state, source));
  const distances = new Map(queue.map(tile => [serviceTileKey(tile), 0]));
  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (current === undefined) continue;
    const distance = distances.get(serviceTileKey(current)) ?? 0;
    for (const neighbor of getOrthogonalRoadNeighbors(state, current)) {
      const key = serviceTileKey(neighbor);
      if (distances.has(key)) continue;
      distances.set(key, distance + 1);
      queue.push(neighbor);
    }
  }
  return building => Math.min(...buildingRoadAccessTiles(state, building).map(tile => distances.get(serviceTileKey(tile)) ?? Infinity));
}
