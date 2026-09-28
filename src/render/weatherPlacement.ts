import type { Tile } from "../world/world.types";
import { TILE_H, tileToScreen } from "./iso";

// INSTALL-23 weather placement (weatherLayers.ts head comment: each layer covers a pixel at most once, and the water
// and land layers never meet). Pure in (the seed, the tiles, the clock); no Math.random.
//  - shore: fog banks anchored on water tiles at the shore (a seeded pick), kept only when a bank's reach (its rect
//    widened by its drift) meets no other bank's reach;
//  - lattice: land spots on the tiles whose tx and ty are both multiples of LATTICE (a seeded pick of them). Two such
//    tiles differ by (128 (a - b), 64 (a + b)) px for whole a, b not both 0, so they are at least 128 px apart across
//    or, when a = b, 128 px apart down the screen: spots up to LATTICE_MAX_W x LATTICE_MAX_H never overlap;
//    a wet spot inside any fog bank's reach is dropped;
//  - lanes: screen-space rows a gap apart, a few sprites per row spaced wider than one, all moving at the row's speed;
//  - clouds: a world lattice of cells larger than a cloud, moving together.
export interface Rect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

export const FOG_SCALE = 1;
export const FOG_SIZE = { width: 512 * FOG_SCALE, height: 256 * FOG_SCALE } as const;
/** Fog drifts sideways by up to this many world px (a slow sine). */
export const FOG_DRIFT = 32;
const FOG_PICK = 2;
export const LATTICE = 4;
export const LATTICE_MAX_W = 128;
export const LATTICE_MAX_H = 128;
const SPOT_PICK = 2;

export const mix = (...values: readonly number[]): number => {
  let hash = 2_166_136_261;
  for (const value of values) { hash ^= Math.round(value); hash = Math.imul(hash, 16_777_619); hash ^= hash >>> 13; }
  return hash >>> 0;
};

export const rectsMeet = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** A tile's centre in world px. */
export function tileCentre(tx: number, ty: number): { readonly x: number; readonly y: number } {
  const at = tileToScreen(tx, ty);
  return { x: at.sx, y: at.sy + TILE_H / 2 };
}

export interface FogAnchor { readonly x: number; readonly y: number; readonly hash: number; readonly reach: Rect }

function isShore(tiles: readonly Tile[], width: number, height: number, tile: Tile): boolean {
  if (tile.terrain !== "water") return false;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const x = tile.tx + dx, y = tile.ty + dy;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    if (tiles[y * width + x]?.terrain !== "water") return true;
  }
  return false;
}

/** The fog banks of the map (world px), in tile order. */
export function fogAnchors(seed: number, tiles: readonly Tile[], width: number, height: number): readonly FogAnchor[] {
  const anchors: FogAnchor[] = [];
  for (const tile of tiles) {
    if (!isShore(tiles, width, height, tile)) continue;
    const hash = mix(seed, tile.tx, tile.ty, 23_101);
    if (hash % FOG_PICK !== 0) continue;
    const centre = tileCentre(tile.tx, tile.ty);
    const reach = { x: centre.x - FOG_SIZE.width / 2 - FOG_DRIFT, y: centre.y - FOG_SIZE.height / 2,
      width: FOG_SIZE.width + 2 * FOG_DRIFT, height: FOG_SIZE.height };
    if (anchors.some(anchor => rectsMeet(anchor.reach, reach))) continue;
    anchors.push({ ...centre, hash, reach });
  }
  return anchors;
}

/** Where a fog bank is drawn at `nowMs` (its rect lies inside its reach). */
export function fogRect(anchor: FogAnchor, nowMs: number): Rect {
  const drift = FOG_DRIFT * Math.sin((nowMs / 1000) * (2 * Math.PI / 26) + (anchor.hash % 628) / 100);
  return { x: anchor.x - FOG_SIZE.width / 2 + drift, y: anchor.y - FOG_SIZE.height / 2, ...FOG_SIZE };
}

export interface LandSpot { readonly x: number; readonly y: number; readonly hash: number }

/**
 * The land spots among `tiles` (world px centres): open grass (no building; `roads` false keeps them off roads), on
 * the lattice, a seeded pick. `clearOf`: reaches a spot of `size` must not meet.
 */
export function landSpots(seed: number, tiles: readonly Tile[], salt: number, options: { readonly roads: boolean; readonly size: { readonly width: number; readonly height: number };
  readonly clearOf: readonly Rect[] }): readonly LandSpot[] {
  const spots: LandSpot[] = [];
  for (const tile of tiles) {
    if (tile.tx % LATTICE !== 0 || tile.ty % LATTICE !== 0 || tile.terrain !== "grass" || tile.buildingId !== null) continue;
    if (!options.roads && tile.hasRoad) continue;
    const hash = mix(seed, tile.tx, tile.ty, salt);
    if (hash % SPOT_PICK !== 0) continue;
    const centre = tileCentre(tile.tx, tile.ty);
    const rect = { x: centre.x - options.size.width / 2, y: centre.y - options.size.height / 2, ...options.size };
    if (options.clearOf.some(reach => rectsMeet(reach, rect))) continue;
    spots.push({ ...centre, hash });
  }
  return spots;
}

export interface LaneSprite { readonly x: number; readonly y: number; readonly variant: number }

/**
 * Screen-space sprites of `size` in rows `gap` apart (gap >= size.height), `perRow` per row a period / perRow apart (the
 * period is the view's width plus perRow sprite widths, so they never meet), moving at the row's speed (px/s, + right).
 */
export function laneSprites(viewport: { readonly width: number; readonly height: number }, nowMs: number, size: { readonly width: number; readonly height: number },
  gap: number, speeds: readonly number[], salt: number, perRow = 2): readonly LaneSprite[] {
  const sprites: LaneSprite[] = [];
  const period = viewport.width + perRow * size.width;
  for (let row = 0; row * gap - size.height / 4 < viewport.height; row += 1) {
    const speed = speeds[row % speeds.length] ?? 0;
    const phase = mix(salt, row) % period;
    for (let index = 0; index < perRow; index += 1) {
      const travelled = ((((nowMs / 1000) * speed + phase + index * period / perRow) % period) + period) % period;
      sprites.push({ x: travelled - size.width, y: row * gap - size.height / 4, variant: row + index });
    }
  }
  return sprites;
}

/** A deck of cloud shadows: square clouds of `size` world px in cells larger than a cloud, all at one velocity. */
export interface CloudDeck { readonly size: number; readonly cell: { readonly width: number; readonly height: number }; readonly velocity: { readonly x: number; readonly y: number } }
export const CLOUD_DECKS: readonly CloudDeck[] = [
  { size: 512 * 1.2, cell: { width: 1_250, height: 900 }, velocity: { x: 20, y: 8 } },
  { size: 512 * 1.6, cell: { width: 1_700, height: 1_150 }, velocity: { x: 12, y: 5 } },
];

/** A deck's cloud shadows over the world rect `view` (world px): top-left corners, all moving together. */
export function cloudSprites(deck: CloudDeck, view: Rect, nowMs: number): readonly LaneSprite[] {
  const t = nowMs / 1000;
  const { cell, size } = deck;
  // The lattice shift wraps after an even number of cells (the column parity keeps its row offset), about an hour.
  const shiftX = (t * deck.velocity.x) % (cell.width * 64); const shiftY = (t * deck.velocity.y) % (cell.height * 64);
  const sprites: LaneSprite[] = [];
  const firstColumn = Math.floor((view.x - shiftX - size) / cell.width);
  for (let column = firstColumn; column * cell.width + shiftX < view.x + view.width; column += 1) {
    const offsetY = (((column % 2) + 2) % 2) * cell.height / 2;
    const firstRow = Math.floor((view.y - shiftY - offsetY - size) / cell.height);
    for (let row = firstRow; row * cell.height + offsetY + shiftY < view.y + view.height; row += 1) {
      sprites.push({ x: column * cell.width + shiftX, y: row * cell.height + offsetY + shiftY, variant: 0 });
    }
  }
  return sprites;
}
