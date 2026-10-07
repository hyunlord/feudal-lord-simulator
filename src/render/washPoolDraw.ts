import type { GameState } from '../engine/engine.types';
import type { RenderQueueItem } from './objectRenderTypes';
import { tileIsVisibleInRange, type TileRange } from './renderVisibility';
import { depthKey, tileToScreen } from './iso';
import { BLOCKS_MAX_ZOOM } from './buildingVisualState';
import { compareRenderItems } from './objectRenderSort';
import { boundaryV2Enabled } from './renderBoundaryFlag';
import { washPoolProps, type WashPoolProp } from './washPoolPlacement';
import { WASH_POOL_ART } from './washPoolArt';

export function withWashPoolProps(queue: readonly RenderQueueItem[], state: GameState, range: TileRange): readonly RenderQueueItem[] {
  if (!boundaryV2Enabled()) return queue;
  const props = washPoolProps(state, WASH_POOL_ART.readyEntry()).filter(p => tileIsVisibleInRange(p.tx, p.ty, range));
  if (!props.length) return queue;
  const additions: RenderQueueItem[] = props.map(prop => ({ kind: 'wash_pool', id: prop.id, prop, depth: depthKey(prop.tx, prop.ty), anchorTx: prop.tx }));
  additions.sort(compareRenderItems);
  // Preserve the existing wall topological order while inserting new objects.
  const result: RenderQueueItem[] = []; let next = 0;
  for (const existing of queue) {
    let incoming = additions[next];
    while (incoming && compareRenderItems(incoming, existing) < 0) { result.push(incoming); next++; incoming = additions[next]; }
    result.push(existing);
  }
  return result.concat(additions.slice(next));
}
export function drawWashPool(context: CanvasRenderingContext2D, prop: WashPoolProp, zoom: number): boolean {
  if (zoom <= BLOCKS_MAX_ZOOM) return false;
  const foot = tileToScreen(prop.tx, prop.ty);
  return WASH_POOL_ART.draw(context, prop.assetId, { at: { x: foot.sx, y: foot.sy } });
}
