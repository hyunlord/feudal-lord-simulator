import type { GameState } from '../engine/engine.types';
import type { RenderQueueItem } from './objectRenderTypes';
import { depthKey, tileToScreen } from './iso';
import { tileIsVisibleInRange, type TileRange } from './renderVisibility';
import { mergeObjectRenderItems } from './objectRenderMerge';
import { boundaryV2Enabled } from './renderBoundaryFlag';
import { MUSTER_FIELD_ART } from './musterFieldArt';
import { musterFieldProps, type MusterFieldProp } from './musterFieldPlacement';
import { BLOCKS_MAX_ZOOM } from './buildingVisualState';

export function withMusterFieldProps(queue: readonly RenderQueueItem[], state: GameState, range: TileRange): readonly RenderQueueItem[] {
  if (!boundaryV2Enabled()) return queue;
  const props = musterFieldProps(state, MUSTER_FIELD_ART.readyEntry()).filter(p => tileIsVisibleInRange(p.tx, p.ty, range));
  if (!props.length) return queue;
  return mergeObjectRenderItems(queue, props.map(prop => ({ kind: 'muster_field' as const, id: prop.id, prop, depth: depthKey(prop.tx, prop.ty), anchorTx: prop.tx })));
}
export function drawMusterField(context: CanvasRenderingContext2D, prop: MusterFieldProp, zoom: number): boolean {
  if (zoom <= BLOCKS_MAX_ZOOM) return false;
  const at = tileToScreen(prop.tx, prop.ty);
  return MUSTER_FIELD_ART.draw(context, prop.assetId, { at: { x: at.sx, y: at.sy } });
}
