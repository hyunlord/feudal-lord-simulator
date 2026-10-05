import type { ForestHarvest, GameState } from "../engine/engine.types";
import { landOf } from "../engine/land";
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import { renderDetailLevel } from "./buildingVisualState";
import { depthKey, tileToScreen } from "./iso";
import { cellHash, fallowStageArt, nextTreePictureTick, stageSeason, treeStageArt, type LandStagePicture } from "./landStageModel";
import type { ObjectRenderItem, RenderQueueItem } from "./objectRenderTypes";
import { tileIsVisibleInRange, type TileRange } from "./renderVisibility";
import { seasonBlend, seasonForObject } from "./seasonTransition";
import { drawStageArt } from "./wave42StageArt";
import type { ArtRegistry } from './art/artRegistry';
import { ART_REGISTRY } from './art/wave42Registry';

// NAT-5 (Wave 42): the land change stages that stand up from the ground — a felled tree's stump, saplings and young
// wood, and a fallow cell's grass, bramble and saplings — are objects of the object pass, depth-sorted like the trees,
// not decals baked into the ground chunks: each picture rises 40 to 86 world px above its cell (pivot on the cell
// centre), so a walker or building behind it must be covered by it and one in front must cover it. They change on the
// engine's ticks (landStageModel.ts), so they cost no chunk re-raster at all; the object queue's static cache key carries
// their signature. A felled tree replaces its cell's trees (stumpRenderItems.ts) until the engine drops the record; a
// house plot's fallow sorts just before its house. Above block detail only (as the countryside props), each turns to
// the new season at its own moment (seasonForObject).

export type LandStagePiece = { readonly picture: LandStagePicture; readonly tx: number; readonly ty: number; readonly salt: number;
  readonly editions: { readonly summer: string; readonly winter: string } };
export type LandStageRenderItem = Extract<ObjectRenderItem, { readonly kind: "land_stage" }>;

const YEAR = 4 * PRESSURE_BALANCE.seasonTicks;

function stageItem(id: string, picture: LandStagePicture, editions: LandStagePiece['editions'], tx: number, ty: number, depthBias = 0): LandStageRenderItem {
  return { kind: "land_stage", id, piece: { picture, editions, tx, ty, salt: cellHash(tx, ty) % 100_000 }, depth: depthKey(tx, ty) + depthBias, anchorTx: tx };
}

/** A felled tree's stage picture on its cell. */
export function treeStageItem(harvest: ForestHarvest, tick: number, registry: ArtRegistry = ART_REGISTRY): LandStageRenderItem {
  const summer = treeStageArt(harvest, tick, 'summer', registry);
  const winter = treeStageArt(harvest, tick, 'winter', registry);
  return stageItem(`felled:${harvest.tx}:${harvest.ty}:${harvest.harvestedAtTick}`, summer.stage,
    { summer: summer.id, winter: winter.id }, harvest.tx, harvest.ty);
}

// Felled trees' signature (the object queue's static cache key, renderObjectFrameCache.ts). Cache (AGENTS rule 10):
// (a) key: the harvests array by identity and the tick window [at, until) in which no felled tree's picture changes
//     (until = the soonest nextTreePictureTick); (b) nothing else enters (the pictures read only the records and the
//     tick); (c) why: the key is asked every frame and a grown town has ~1,500 records, whose pictures turn a few times
//     a season — the joined stage list was rebuilt every frame before.
let signatureMemo: { readonly harvests: readonly ForestHarvest[]; readonly at: number; readonly until: number; readonly signature: string } | null = null;

export function felledTreeSignature(harvests: readonly ForestHarvest[] | undefined, tick: number): string {
  const list = harvests ?? [];
  if (signatureMemo !== null && signatureMemo.harvests === list && tick >= signatureMemo.at && tick < signatureMemo.until) return signatureMemo.signature;
  let hash = 2_166_136_261;
  let until = Number.POSITIVE_INFINITY;
  for (const harvest of list) {
    const text = `${harvest.tx},${harvest.ty},${treeStageArt(harvest, tick, 'summer').id},${treeStageArt(harvest, tick, 'winter').id}|`;
    for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16_777_619);
    until = Math.min(until, nextTreePictureTick(harvest, tick));
  }
  signatureMemo = { harvests: list, at: tick, until, signature: `${(hash >>> 0).toString(36)}.${list.length}` };
  return signatureMemo.signature;
}

// Fallow items. Cache (AGENTS rule 10): (a) key: the land's fallow array and the tiles array by identity and the year
// (fallowStage turns only at a year's start, when the engine also rebuilds the list); (b) nothing else enters; (c) why:
// the object queue is merged every frame. The merge itself is kept for an unchanged queue, item list and range.
let fallowMemo: { readonly fallow: readonly (readonly [number, number])[]; readonly tiles: GameState["tiles"]; readonly year: number;
  readonly items: readonly LandStageRenderItem[] } | null = null;
let lastMerge: { readonly queue: readonly RenderQueueItem[]; readonly items: readonly LandStageRenderItem[]; readonly range: string;
  readonly result: readonly RenderQueueItem[] } | null = null;

export function fallowItems(state: Pick<GameState, "land" | "tiles" | "width" | "tick">): readonly LandStageRenderItem[] {
  const fallow = landOf(state).fallow;
  const year = Math.floor(state.tick / YEAR);
  if (fallowMemo !== null && fallowMemo.fallow === fallow && fallowMemo.tiles === state.tiles && fallowMemo.year === year) return fallowMemo.items;
  const items = fallow.map(([cell, since]) => {
    const tx = cell % state.width, ty = Math.floor(cell / state.width);
    const plot = (state.tiles[cell]?.buildingId ?? null) !== null;
    const summer = fallowStageArt(plot, since, state.tick, 'summer', cellHash(tx, ty));
    const winter = fallowStageArt(plot, since, state.tick, 'winter', cellHash(tx, ty));
    return stageItem(`fallow:${cell}`, summer.stage, { summer: summer.id, winter: winter.id }, tx, ty, plot ? -0.01 : 0);
  }).sort(compareItems);
  fallowMemo = { fallow, tiles: state.tiles, year, items };
  return items;
}

/** The queue with the visible fallow cells merged in by depth (the queue is sorted, so is the result). */
export function withLandFallow(queue: readonly RenderQueueItem[], state: GameState, range: TileRange): readonly RenderQueueItem[] {
  const items = fallowItems(state);
  if (items.length === 0) return queue;
  const rangeKey = `${range.minTx},${range.minTy},${range.maxTx},${range.maxTy},${range.minDepth},${range.maxDepth},${range.minDiagonal},${range.maxDiagonal}`;
  if (lastMerge !== null && lastMerge.queue === queue && lastMerge.items === items && lastMerge.range === rangeKey) return lastMerge.result;
  const visible = items.filter(item => tileIsVisibleInRange(item.piece.tx, item.piece.ty, range));
  const result = visible.length === 0 ? queue : merge(queue, visible);
  lastMerge = { queue, items, range: rangeKey, result };
  return result;
}

export function drawLandStageItem(context: CanvasRenderingContext2D, item: LandStageRenderItem, state: GameState, zoom: number): void {
  if (renderDetailLevel(zoom) === "blocks") return;
  const { editions, tx, ty, salt } = item.piece;
  const at = tileToScreen(tx, ty);
  drawStageArt(context, editions[stageSeason(seasonForObject(seasonBlend(state), salt))], at.sx, at.sy);
}

function compareItems(left: RenderQueueItem, right: RenderQueueItem): number {
  return left.depth - right.depth || left.anchorTx - right.anchorTx || left.id.localeCompare(right.id);
}

function merge(queue: readonly RenderQueueItem[], items: readonly RenderQueueItem[]): RenderQueueItem[] {
  const merged: RenderQueueItem[] = [];
  let left = 0, right = 0;
  while (left < queue.length && right < items.length) {
    const a = queue[left], b = items[right];
    if (a === undefined || b === undefined) break;
    if (compareItems(a, b) <= 0) { merged.push(a); left += 1; } else { merged.push(b); right += 1; }
  }
  for (; left < queue.length; left += 1) { const a = queue[left]; if (a !== undefined) merged.push(a); }
  for (; right < items.length; right += 1) { const b = items[right]; if (b !== undefined) merged.push(b); }
  return merged;
}
