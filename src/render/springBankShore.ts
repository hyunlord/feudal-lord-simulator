import type { GameState } from '../engine/engine.types';
import type { TileCoordinate } from '../geometry/tileGeometry';
import type { Shoreline } from '../world/boundary/shoreline';
import type { SpringWorldEntry } from './art/artContract';
import { screenToTile, tileToScreen } from './iso';

// Native full-source landmarks (256x128, pivot130,117), inspected on swollen_stream_bank_spring.png.
// Each column crosses grassy/rooted land, the wet edge, then open water. No reflection or rotation is permitted.
const LAND = [[16, 78], [24, 84], [48, 84], [80, 69], [112, 60], [144, 54], [176, 36], [208, 30], [232, 27]] as const;
const WATER = [[48, 103], [80, 87], [112, 80], [144, 78], [176, 57], [208, 54], [232, 44], [64, 104], [96, 102], [128, 94], [160, 86], [192, 78], [224, 65], [244, 51]] as const;
const SEAM = [128, 69] as const;
function sourcePoint(entry: SpringWorldEntry, anchor: TileCoordinate, x: number, y: number): TileCoordinate {
  const foot = tileToScreen(anchor.tx, anchor.ty), { pivot, scale } = entry.geometry;
  return screenToTile(foot.sx + (x - pivot.x) * scale, foot.sy + (y - pivot.y) * scale);
}
function waterSampler(shore: Shoreline): (point: TileCoordinate) => boolean {
  type Edge = { readonly ax: number; readonly ay: number; readonly bx: number; readonly by: number };
  const rows = new Map<number, Edge[]>();
  for (const loop of shore.loops) for (const [index, a] of loop.smoothed.entries()) {
    const b = loop.smoothed[(index + 1) % loop.smoothed.length]; if (b === undefined || a.y === b.y) continue;
    for (let row = Math.floor(Math.min(a.y, b.y)); row <= Math.floor(Math.max(a.y, b.y)); row++) {
      const edges = rows.get(row) ?? []; edges.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y }); rows.set(row, edges);
    }
  }
  return point => {
    let inside = false;
    for (const edge of rows.get(Math.floor(point.ty)) ?? []) {
      if ((edge.ay > point.ty) !== (edge.by > point.ty) && point.tx < (edge.bx - edge.ax) * (point.ty - edge.ay) / (edge.by - edge.ay) + edge.ax) inside = !inside;
    }
    return inside;
  };
}
/** Match the actual smoothed water polygon used by drawShoreline, not merely a neighboring logical water cell. */
export function springBankFitsShore(state: Pick<GameState, 'width' | 'height' | 'tiles'>, shore: Shoreline, entry: SpringWorldEntry, anchor: TileCoordinate): boolean {
  return fits(state, entry, anchor, waterSampler(shore));
}
function fits(state: Pick<GameState, 'width' | 'height' | 'tiles'>, entry: SpringWorldEntry, anchor: TileCoordinate, isWater: (point: TileCoordinate) => boolean): boolean {
  for (const [points, water] of [[LAND, false], [WATER, true]] as const) for (const [x, y] of points) {
    const point = sourcePoint(entry, anchor, x, y), tx = Math.round(point.tx), ty = Math.round(point.ty);
    if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return false;
    const tile = state.tiles[ty * state.width + tx];
    if (tile === undefined || tile.hasRoad || tile.buildingId !== null || (tile.terrain !== 'grass' && tile.terrain !== 'water') || isWater(point) !== water) return false;
  }
  return true;
}
/** Align the painted waterline centre to a real shore vertex; the PNG's bottom pivot is NOT the bank contact. */
export function springBankAnchors(state: Pick<GameState, 'width' | 'height' | 'tiles'>, shore: Shoreline, entry: SpringWorldEntry): readonly TileCoordinate[] {
  const offset = screenToTile((entry.geometry.pivot.x - SEAM[0]) * entry.geometry.scale, (entry.geometry.pivot.y - SEAM[1]) * entry.geometry.scale);
  const result: TileCoordinate[] = [], isWater = waterSampler(shore);
  for (const loop of shore.loops) for (const [index, point] of loop.smoothed.entries()) {
    if (loop.walled[index]) continue;
    // The painted wet transition is a band, not a mathematical line. Search only within four world pixels
    // of the real waterline; every source land/water landmark must still lie on its matching actual side.
    for (const y of [0, -2, 2, -4, 4]) {
      const correction = screenToTile(0, y);
      const anchor = { tx: point.x + offset.tx + correction.tx, ty: point.y + offset.ty + correction.ty };
      if (fits(state, entry, anchor, isWater)) { result.push(anchor); break; }
    }
  }
  return result;
}
/** All logical cells touched by the full rectangular ground canvas, including at fractional shore anchors. */
export function springBankSupport(entry: SpringWorldEntry, anchor: TileCoordinate): readonly TileCoordinate[] {
  const foot = tileToScreen(anchor.tx, anchor.ty), { pivot, scale } = entry.geometry;
  const left = foot.sx - pivot.x * scale, top = foot.sy - pivot.y * scale;
  const width = entry.image.width * scale, height = entry.image.height * scale;
  const corners = [[left, top], [left + width, top], [left, top + height], [left + width, top + height]].map(([x = 0, y = 0]) => screenToTile(x, y));
  const cells: TileCoordinate[] = [];
  for (let ty = Math.floor(Math.min(...corners.map(p => p.ty)) - 0.5); ty <= Math.ceil(Math.max(...corners.map(p => p.ty)) + 0.5); ty++) {
    for (let tx = Math.floor(Math.min(...corners.map(p => p.tx)) - 0.5); tx <= Math.ceil(Math.max(...corners.map(p => p.tx)) + 0.5); tx++) {
      const centre = tileToScreen(tx, ty);
      const dx = Math.max(0, Math.abs(centre.sx - left - width / 2) - width / 2);
      const dy = Math.max(0, Math.abs(centre.sy - top - height / 2) - height / 2);
      if (dx / 32 + dy / 16 < 1) cells.push({ tx, ty });
    }
  }
  return cells;
}
