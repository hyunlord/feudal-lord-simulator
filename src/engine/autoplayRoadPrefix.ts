import { getTile, type TileCoordinate } from '../world/grid';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';

/** First unbuilt straight prefix after an existing road; every returned tile is new. */
export function roadPrefixAction(state: GameState, path: readonly TileCoordinate[]): AutoplayAction {
  const index = path.findIndex(tile => !getTile(state, tile)?.hasRoad);
  const from = path[index];
  const previous = path[index - 1];
  if (from === undefined || previous === undefined) return { kind: 'none' };
  const dx = from.tx - previous.tx;
  const dy = from.ty - previous.ty;
  let to = from;
  for (const next of path.slice(index + 1)) {
    if (getTile(state, next)?.hasRoad || next.tx - to.tx !== dx || next.ty - to.ty !== dy) break;
    to = next;
  }
  return { kind: 'place_road', from, to };
}
