import { existingRoadComponent } from '../world/roadGraph';
import { buildingRoadAccessTiles } from './routing';
import { roadActionToTargets } from './autoplayConstructionRoads';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';

export function networkRoadAction(state: GameState): AutoplayAction {
  if (!state.palisade?.segments.some(segment => segment.completed)) return { kind: 'none' };
  const source = state.buildings.find(building => building.kind === 'storehouse');
  if (source === undefined) return { kind: 'none' };
  const roots = buildingRoadAccessTiles(state, source);
  const connected = new Set(existingRoadComponent(state, roots).map(tile => `${tile.tx},${tile.ty}`));
  const disconnected = state.buildings.flatMap(building => buildingRoadAccessTiles(state, building))
    .filter(tile => !connected.has(`${tile.tx},${tile.ty}`));
  return disconnected.length === 0 ? { kind: 'none' } : roadActionToTargets(state, disconnected, roots);
}
