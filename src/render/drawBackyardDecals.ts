import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../geometry/tileGeometry";
import { backyardPlan, type BackyardDecal } from "./backyardDecals";
import { CART_LOAD_MIN_ZOOM } from "./drawWalkers";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { manifestArt } from "./manifestArt";
import { tileIsVisibleInRange, type TileRange } from "./renderVisibility";
import { WAVE27_YARD_IMAGES, type Wave27YardKey } from "./wave27YardManifest.generated";
import { drawCroppedWorldSprite } from "./worldSprite";

// INSTALL-27 backyard decals on the ground (backyardDecals.ts says which and where). Drawn in the ground pass after
// the terrain and roads and before the season decals, so the house, its neighbours, walkers and animals (the object
// pass) all stand over it. The art loads on the first draw that needs it (like village life), not at startup.
//  - LOD: from YARD_DECAL_MIN_ZOOM, the IN7-D1 prop rule (the cart loads' CART_LOAD_MIN_ZOOM, the stock piles' full
//    detail): below it the yard is a few pixels of clutter.
//  - Scale: the 2 x 1 pictures at YARD_SCALE, not Astra's 0.5: measured on the flat state pictures (hungry, newcomer,
//    strained, vacant, winter), their painted ground is a 2 x 1 cell rectangle 1.25 times this game's 64 x 32 tile at
//    0.5, so 0.4 lays it on the two back cells. Their measured ground centre (YARD_GROUND_CENTRE, the alpha centroid of
//    those pictures, 125-132 x 66-75) goes on the pair's centre; Astra's anchor (128, 104) then falls 14 px lower, on
//    the pair's front. The 1 x 1 shared props at 0.5 (their 60 x 29 px props fit one tile) with their anchor (64, 52) a
//    quarter tile below the cell's centre.
//  - Clip: each picture is clipped to its cells' diamonds carried straight up by YARD_CLIP_RISE (so fences, racks and
//    trees keep their tops) plus the flat diamonds of the free cells around them (`spill`: no road, water, rock or
//    field), so an edge never lies over a road.
export const YARD_DECAL_MIN_ZOOM = CART_LOAD_MIN_ZOOM;
export const YARD_SCALE = 0.4;
export const YARD_SHARED_SCALE = 0.5;
export const YARD_GROUND_CENTRE = { x: 128, y: 68 } as const;
const YARD_CLIP_RISE = TILE_H * 2.5;

const yards = manifestArt<Wave27YardKey>(Object.fromEntries((Object.keys(WAVE27_YARD_IMAGES) as Wave27YardKey[]).map(key => {
  const meta = WAVE27_YARD_IMAGES[key];
  return [key, { url: meta.url, width: meta.width, height: meta.height, pivot: meta.anchor }];
})) as Readonly<Record<Wave27YardKey, { readonly url: string; readonly width: number; readonly height: number; readonly pivot: { readonly x: number; readonly y: number } }>>);
export const wave27YardArt = yards.art;

export function yardDecalsDrawnAt(zoom: number): boolean {
  return zoom >= YARD_DECAL_MIN_ZOOM;
}

/** Where a decal's canvas goes on screen (world px, before any mirror about `centre.sx`). */
export function yardDecalRect(decal: Pick<BackyardDecal, "key" | "x" | "y">) {
  const meta = WAVE27_YARD_IMAGES[decal.key];
  const centre = tileToScreen(decal.x, decal.y);
  const shared = meta.category === "common";
  const scale = shared ? YARD_SHARED_SCALE : YARD_SCALE;
  const pivot = shared ? { x: meta.anchor.x, y: meta.anchor.y } : YARD_GROUND_CENTRE;
  const groundY = centre.sy + (shared ? TILE_H / 4 : 0);
  return { centre, source: { x: 0, y: 0, width: meta.width, height: meta.height },
    x: centre.sx - pivot.x * scale, y: groundY - pivot.y * scale, width: meta.width * scale, height: meta.height * scale };
}

/** Clip polygons (screen px): each cell's diamond carried up by `rise` for `cells`, the flat diamond for `spill`. */
export function yardClipPolygons(cells: readonly TileCoordinate[], spill: readonly TileCoordinate[], rise = YARD_CLIP_RISE) {
  const diamond = (cell: TileCoordinate, up: number) => {
    const { sx, sy } = tileToScreen(cell.tx, cell.ty);
    // West, south, east, then the same diamond's east, north and west `up` px higher (a flat diamond when up = 0).
    return [{ x: sx - TILE_W / 2, y: sy }, { x: sx, y: sy + TILE_H / 2 }, { x: sx + TILE_W / 2, y: sy },
      { x: sx + TILE_W / 2, y: sy - up }, { x: sx, y: sy - TILE_H / 2 - up }, { x: sx - TILE_W / 2, y: sy - up }];
  };
  return [...cells.map(cell => diamond(cell, rise)), ...spill.map(cell => diamond(cell, 0))];
}

export function drawBackyardDecals(context: CanvasRenderingContext2D, state: GameState, range: TileRange, zoom: number): void {
  if (!yardDecalsDrawnAt(zoom)) return;
  for (const decal of backyardPlan(state)) {
    if (!decal.cells.some(cell => tileIsVisibleInRange(cell.tx, cell.ty, range))) continue;
    const image = wave27YardArt(decal.key);
    if (image === null) continue;
    const rect = yardDecalRect(decal);
    context.save();
    try {
      context.beginPath();
      for (const polygon of yardClipPolygons(decal.cells, decal.spill)) {
        polygon.forEach((point, index) => { if (index === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y); });
        context.closePath();
      }
      context.clip();
      // The art's long side runs along +x; a pair along y takes it mirrored about the pair's centre.
      if (decal.mirror) { context.translate(rect.centre.sx * 2, 0); context.scale(-1, 1); }
      drawCroppedWorldSprite(context, image, rect.source, { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, false, true);
    } finally {
      context.restore();
    }
  }
}
