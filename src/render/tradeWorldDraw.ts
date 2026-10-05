import type { GameState } from '../engine/engine.types';
import type { RenderQueueItem } from './objectRenderTypes';
import { tileIsVisibleInRange, type TileRange } from './renderVisibility';
import { depthKey, tileToScreen } from './iso';
import { BLOCKS_MAX_ZOOM } from './buildingVisualState';
import { TRADE_WORLD_ART } from './tradeWorldArt';
import { tradeWorldGroundProps, type TradeWorldProp } from './tradeWorldGround';
import { compareRenderItems } from './objectRenderSort';

export function withTradeWorldProps(queue: readonly RenderQueueItem[], state: GameState, range: TileRange): readonly RenderQueueItem[] {
  const props = tradeWorldGroundProps(state).filter(prop => tileIsVisibleInRange(prop.cell.tx, prop.cell.ty, range));
  if (props.length === 0) return queue;
  const items: RenderQueueItem[] = props.map(prop => ({ kind: 'trade_prop', id: prop.id, prop, depth: depthKey(prop.x, prop.y), anchorTx: prop.x }));
  items.sort(compareRenderItems);
  // Walls may already follow a topological order that differs from depth order.
  const result: RenderQueueItem[] = [];
  let next = 0;
  for (const existing of queue) {
    let prop = items[next];
    while (prop !== undefined && compareRenderItems(prop, existing) < 0) {
      result.push(prop);
      next += 1;
      prop = items[next];
    }
    result.push(existing);
  }
  return result.concat(items.slice(next));
}
export function drawTradeWorldProp(context: CanvasRenderingContext2D, prop: TradeWorldProp, zoom: number): boolean {
  if (zoom <= BLOCKS_MAX_ZOOM) return false;
  const foot = tileToScreen(prop.x, prop.y);
  return TRADE_WORLD_ART.draw(context, prop.assetId, { at: { x: foot.sx, y: foot.sy } });
}
