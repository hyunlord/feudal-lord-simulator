import type { GameState } from '../engine/engine.types';
import { selectLandArt } from './art/wave42Registry';
import { abandonedFenceOwners, collapsedFenceBindings, type CollapsedFenceBinding } from './collapsedFenceBinding';
import { groundBoundaryScene, type GroundBoundaryScene } from './groundBoundaryScene';
import { hurdleAssetKey } from './hurdleArt';
import { compareObjectRenderItems, mergeObjectRenderItems } from './objectRenderMerge';
import type { ObjectRenderItem, RenderQueueItem } from './objectRenderTypes';
import { boundaryV2Enabled } from './renderBoundaryFlag';
import { tileIsVisibleInRange, type TileRange } from './renderVisibility';
import { stageArtReady } from './wave42StageArt';

const editions = {
  summer: selectLandArt('yard-fence', { family: 'yard-fence', stage: 'collapsed', season: 'summer' }).id,
  winter: selectLandArt('yard-fence', { family: 'yard-fence', stage: 'collapsed', season: 'winter' }).id,
};
type CacheEntry = { readonly owners: string; readonly bindings: readonly CollapsedFenceBinding[];
  readonly ready: boolean; readonly items: readonly ObjectRenderItem[] };

/** Geometry identity + eligible owner IDs + both decoded editions. Tick rewind and resettlement change owners.
 * Readiness is checked every frame; never remove a source panel before both replacement images can draw.
 * One entry per scene bounds memory; unchanged occupancy never rebuilds/sorts its panels.
 */
export function createYardHurdleItems(ready: (keys: readonly string[]) => boolean = stageArtReady) {
  const cache = new WeakMap<GroundBoundaryScene, CacheEntry>();
  return (state: Pick<GameState, 'houses' | 'tick'>, scene: GroundBoundaryScene): readonly ObjectRenderItem[] => {
    const owners = JSON.stringify(abandonedFenceOwners(state));
    const previous = cache.get(scene);
    const bindings = previous?.owners === owners ? previous.bindings : collapsedFenceBindings(state, scene);
    const decoded = bindings.length > 0 && ready([editions.summer, editions.winter]);
    if (previous?.owners === owners && previous.ready === decoded) return previous.items;
    const replaced = new Set(decoded ? bindings.map(binding => binding.panelId) : []);
    const items: ObjectRenderItem[] = scene.yardProps.hurdles.filter(piece => !replaced.has(piece.id)).map(piece => ({
      kind: 'zone_prop', id: piece.id, depth: piece.depth, anchorTx: Math.round(piece.anchor.x),
      prop: { kind: hurdleAssetKey(piece), x: piece.anchor.x, y: piece.anchor.y,
        flip: piece.mirror, scale: 1, id: piece.id, depth: piece.depth },
    }));
    if (decoded) for (const binding of bindings) items.push({
      kind: 'land_stage', id: `collapsed:${binding.panelId}`, depth: binding.tx + binding.ty, anchorTx: binding.tx,
      piece: { picture: 'collapsed', editions, tx: binding.tx, ty: binding.ty, salt: 0 },
    });
    items.sort(compareObjectRenderItems);
    cache.set(scene, { owners, bindings, ready: decoded, items });
    return items;
  };
}
const yardHurdleItems = createYardHurdleItems();

export function withYardHurdles(items: readonly RenderQueueItem[], input: {
  readonly state: GameState; readonly range: TileRange;
}): readonly RenderQueueItem[] {
  if (!boundaryV2Enabled()) return items;
  const scene = groundBoundaryScene(input.state);
  if (scene.yardProps.hurdles.length === 0) return items;
  const visible = yardHurdleItems(input.state, scene).filter(item => {
    if (item.kind === 'zone_prop') return tileIsVisibleInRange(Math.round(item.prop.x), Math.round(item.prop.y), input.range);
    return item.kind === 'land_stage' && tileIsVisibleInRange(item.piece.tx, item.piece.ty, input.range);
  });
  return visible.length === 0 ? items : mergeObjectRenderItems(items, visible);
}
