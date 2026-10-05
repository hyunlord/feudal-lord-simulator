import type { GameState } from "../engine/engine.types";
import { renderDetailLevel } from "./buildingVisualState";
import { drawCountryBlit, pieceBlit, stripBlits } from "./countrysideArt";
import type { CountryStripPiece } from "./countrysideLand";
import { countrysideOf, type CountryPiece, type Countryside } from "./countrysideLayout";
import type { ObjectRenderItem, RenderQueueItem } from "./objectRenderTypes";
import { tileIsVisibleInRange, type TileRange } from "./renderVisibility";
import { DECAL_MIN_ZOOM } from "./seasonalDecals";
import { calendarProgress } from "./calendarProgress";
import { treeProgression } from "./seasonProgression";
import { drawSpringHedge } from './springHedges';

// INSTALL-28 the countryside on screen (layout: countrysideLayout.ts, art: countrysideArt.ts).
//  - Draw order: the wildflower patches are ground decals, drawn in the ground pass after the terrain and before the
//    season decals (frost and leaves lie on them). Strips and point props are depth-sorted objects: a hedge piece sorts
//    by the middle of its tile edge (as the yard hurdles), a prop by its anchor cell, so a hedge in front of a walker,
//    house or tree covers it and one behind is covered.
//  - Detail (renderDetailLevel, the building LOD): above block detail everything draws, by the same rules close up and
//    far out (NAT-2: the small views draw each sprite from its pre-shrunk level); blocks (zoom <= 0.35) draws none. The
//    patches follow the season decals (from DECAL_MIN_ZOOM).
//  - Seasons: each piece turns to the new season's picture at its own fixed phase of the calendar season.

export type CountrysideRenderItem = Extract<ObjectRenderItem, { readonly kind: "countryside" }>;

const itemsByLayout = new WeakMap<Countryside, readonly CountrysideRenderItem[]>();
function countrysideItems(layout: Countryside): readonly CountrysideRenderItem[] {
  let items = itemsByLayout.get(layout);
  if (items === undefined) {
    items = [
      ...layout.strips.map(piece => ({ kind: "countryside" as const, id: piece.id, piece, depth: piece.depth, anchorTx: piece.tx })),
      ...layout.props.map(piece => ({ kind: "countryside" as const, id: piece.id, piece, depth: piece.tx + piece.ty, anchorTx: piece.tx })),
    ].sort(compareItems);
    itemsByLayout.set(layout, items);
  }
  return items;
}

// Cache: the last merge, keyed on the incoming queue, the layout (cached on its inputs, countrysideOf) and the visible
// range; an unchanged frame returns the same queue (no filter, no merge), as the farm props do. The items themselves
// are built and sorted once per layout (itemsByLayout). Measured (headless Chrome --disable-gpu on a Mac, 240 frames at
// 1x, 1440 x 900, render stage probe; the countryside off by a module rewrite for the "before"): zone-undo zoom 1 (55
// countryside items in view) frame p50 1.8 -> 1.8–1.9 ms, p95 2.6–2.7 -> 2.6–2.7 ms, the nature stage p50 0.5 -> 0.6 ms;
// palisade-construction zoom 0.6 p50 4.4–4.7 -> 4.5–4.6 ms; four-farms zoom 1 p50 2.1 -> 2.2 ms.
let lastMerge: { readonly queue: readonly RenderQueueItem[]; readonly layout: Countryside; readonly range: string; readonly result: readonly RenderQueueItem[] } | null = null;

/** The queue with the visible strips and props merged in by depth (the queue is sorted, so is the result). */
export function withCountryside(queue: readonly RenderQueueItem[], state: GameState, range: TileRange): readonly RenderQueueItem[] {
  const layout = countrysideOf(state);
  if (layout.strips.length === 0 && layout.props.length === 0) return queue;
  const rangeKey = `${range.minTx},${range.minTy},${range.maxTx},${range.maxTy},${range.minDepth},${range.maxDepth},${range.minDiagonal},${range.maxDiagonal}`;
  if (lastMerge !== null && lastMerge.queue === queue && lastMerge.layout === layout && lastMerge.range === rangeKey) return lastMerge.result;
  const visible = countrysideItems(layout).filter(item => tileIsVisibleInRange(item.piece.tx, item.piece.ty, range));
  const result = visible.length === 0 ? queue : merge(queue, visible);
  lastMerge = { queue, layout, range: rangeKey, result };
  return result;
}

/** Whether a strip or prop draws at `zoom` (the detail levels above). */
export function countrysideDrawnAt(_piece: CountryStripPiece | CountryPiece, zoom: number): boolean {
  return renderDetailLevel(zoom) !== "blocks";
}

export function drawCountrysideItem(context: CanvasRenderingContext2D, item: CountrysideRenderItem, state: GameState, zoom: number): void {
  if (!countrysideDrawnAt(item.piece, zoom)) return;
  const piece = item.piece;
  const progress = calendarProgress(state);
  const phase = treeProgression(progress, piece.id, progress.year === calendarProgress({ ...state, tick: 0 }).year);
  const season = progress.season === 3 && !phase.snowy ? 2 : phase.season;
  if ("salt" in piece) { drawCountryBlit(context, pieceBlit(piece, season)); return; }
  if (progress.season === 0 && drawSpringHedge(context, piece, season, zoom)) return;
  for (const blit of stripBlits(piece, season)) drawCountryBlit(context, blit);
}

/** Ground pass: the wildflower patches in view. */
export function drawCountryFields(context: CanvasRenderingContext2D, state: GameState, range: TileRange, zoom: number): void {
  if (zoom < DECAL_MIN_ZOOM) return;
  const fields = countrysideOf(state).fields;
  if (fields.length === 0) return;
  const progress = calendarProgress(state);
  const firstYear = progress.year === calendarProgress({ ...state, tick: 0 }).year;
  for (const piece of fields) {
    const phase = treeProgression(progress, piece.id, firstYear);
    const season = progress.season === 3 && !phase.snowy ? 2 : phase.season;
    if (tileIsVisibleInRange(piece.tx, piece.ty, range)) drawCountryBlit(context, pieceBlit(piece, season));
  }
}

function compareItems(left: RenderQueueItem, right: RenderQueueItem): number {
  return left.depth - right.depth || left.anchorTx - right.anchorTx || left.id.localeCompare(right.id);
}

function merge(left: readonly RenderQueueItem[], right: readonly RenderQueueItem[]): readonly RenderQueueItem[] {
  const merged: RenderQueueItem[] = [];
  let a = 0; let b = 0;
  while (a < left.length && b < right.length) merged.push(compareItems(left[a]!, right[b]!) <= 0 ? left[a++]! : right[b++]!);
  while (a < left.length) merged.push(left[a++]!);
  while (b < right.length) merged.push(right[b++]!);
  return merged;
}
