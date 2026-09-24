/**
 * Stroke → cell membership (spec Z-2…Z-4, Z-10). Integer arithmetic only: stroke values are stored as
 * multiples of 1/8 tile and every inside test runs on those eighths, so the result is exact and does
 * not depend on stroke order, vertex order or platform.
 */
import { ZONE_STROKE_LIMITS } from "../content/zoneConfig";
import type { TileCoordinate } from "../geometry/tileGeometry";
import type { Tile } from "../world/world.types";
import type { Zone, ZoneStroke, ZoneStrokePoint } from "./zone.types";

/** Eighths of a tile per tile. */
export const ZONE_Q = 8;

export interface ZoneGrid {
  readonly width: number;
  readonly height: number;
  readonly tiles: readonly Pick<Tile, "terrain">[];
}

const quantize = (value: number): number => Math.round(value * ZONE_Q) / ZONE_Q;

/** Z-2: snaps a stroke to 1/8 tile and checks its limits. Returns null for a stroke the rules reject. */
export function normalizeZoneStroke(stroke: ZoneStroke): ZoneStroke | null {
  if (stroke === null || typeof stroke !== "object" || !Array.isArray(stroke.points)) return null;
  if (stroke.tool !== "brush" && stroke.tool !== "polygon") return null;
  const count = stroke.points.length;
  if (count === 0 || count > ZONE_STROKE_LIMITS.maxPoints || (stroke.tool === "polygon" && count < 3)) return null;
  const points: ZoneStrokePoint[] = [];
  for (const point of stroke.points) {
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return null;
    points.push({ x: quantize(point.x), y: quantize(point.y) });
  }
  if (stroke.tool === "polygon") return { tool: "polygon", points };
  const radius = stroke.radius;
  if (radius === undefined || !Number.isFinite(radius)) return null;
  const snapped = quantize(radius);
  if (snapped < ZONE_STROKE_LIMITS.minBrushRadius || snapped > ZONE_STROKE_LIMITS.maxBrushRadius) return null;
  return { tool: "brush", points, radius: snapped };
}

type QPoint = { readonly x: number; readonly y: number };

function qPoints(stroke: ZoneStroke): readonly QPoint[] {
  return stroke.points.map(point => ({ x: Math.round(point.x * ZONE_Q), y: Math.round(point.y * ZONE_Q) }));
}

/** Squared distance test from P to segment AB, exact on integers: |P−AB|² ≤ r². */
function withinSegment(px: number, py: number, a: QPoint, b: QPoint, r2: number): boolean {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = px - a.x;
  const apy = py - a.y;
  const dot = apx * abx + apy * aby;
  const len2 = abx * abx + aby * aby;
  if (dot <= 0 || len2 === 0) return apx * apx + apy * apy <= r2;
  if (dot >= len2) {
    const bpx = px - b.x;
    const bpy = py - b.y;
    return bpx * bpx + bpy * bpy <= r2;
  }
  const cross = abx * apy - aby * apx;
  return cross * cross <= r2 * len2;
}

/**
 * Crossing number with the half-open rule on y. The crossing x is the same line for (a,b) and (b,a),
 * so reversing or rotating the vertex list never changes the answer, even on an edge.
 */
function insidePolygon(px: number, py: number, polygon: readonly QPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    if ((a.y > py) === (b.y > py)) continue;
    // px < a.x + (py − a.y)(b.x − a.x)/(b.y − a.y), without division.
    const lhs = (px - a.x) * (b.y - a.y);
    const rhs = (py - a.y) * (b.x - a.x);
    if (b.y - a.y > 0 ? lhs < rhs : lhs > rhs) inside = !inside;
  }
  return inside;
}

/** Z-3: cells whose centre lies in the stroke, ascending by tile index. Water and off-map cells never count. */
export function rasterizeZoneStroke(stroke: ZoneStroke, grid: ZoneGrid): readonly number[] {
  const points = qPoints(stroke);
  const r = stroke.tool === "brush" ? Math.round((stroke.radius ?? 0) * ZONE_Q) : 0;
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const minTx = Math.max(0, Math.floor((Math.min(...xs) - r) / ZONE_Q) - 1);
  const maxTx = Math.min(grid.width - 1, Math.ceil((Math.max(...xs) + r) / ZONE_Q) + 1);
  const minTy = Math.max(0, Math.floor((Math.min(...ys) - r) / ZONE_Q) - 1);
  const maxTy = Math.min(grid.height - 1, Math.ceil((Math.max(...ys) + r) / ZONE_Q) + 1);
  const r2 = r * r;
  const cells: number[] = [];
  for (let ty = minTy; ty <= maxTy; ty += 1) {
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      const index = ty * grid.width + tx;
      if (grid.tiles[index]?.terrain === "water") continue;
      const cx = tx * ZONE_Q + ZONE_Q / 2;
      const cy = ty * ZONE_Q + ZONE_Q / 2;
      const inside = stroke.tool === "polygon"
        ? insidePolygon(cx, cy, points)
        : points.length === 1
          ? withinSegment(cx, cy, points[0]!, points[0]!, r2)
          : points.some((point, i) => i > 0 && withinSegment(cx, cy, points[i - 1]!, point, r2));
      if (inside) cells.push(index);
    }
  }
  return cells;
}

/** Union of the rasters of several strokes (order-free). */
export function rasterizeZoneStrokes(strokes: readonly ZoneStroke[], grid: ZoneGrid): readonly number[] {
  const cells = new Set<number>();
  for (const stroke of strokes) for (const cell of rasterizeZoneStroke(stroke, grid)) cells.add(cell);
  return [...cells].sort((left, right) => left - right);
}

export function cellIndex(width: number, tile: TileCoordinate): number {
  return tile.ty * width + tile.tx;
}

export function cellCoordinate(width: number, index: number): TileCoordinate {
  return { tx: index % width, ty: Math.floor(index / width) };
}

/** FNV-1a over the membership indices and the grid width (hex). */
export function zoneMembershipHash(membership: readonly number[], width: number): string {
  let hash = 0x811c9dc5 ^ width;
  for (const cell of membership) {
    hash ^= cell & 0xffff;
    hash = Math.imul(hash, 0x01000193);
    hash ^= cell >>> 16;
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(16)}:${membership.length}`;
}

export interface FootprintSize {
  readonly width: number;
  readonly height: number;
}

/**
 * Cache for `interiorPlacementTiles` (AGENTS rule 10).
 * (a) Key: membership hash + membership length + grid width + footprint size.
 * (b) The result depends only on the membership set, the grid width that decodes it and the footprint
 *     size; kind, strokes, label and the rest of the state do not enter it. A hash collision would need
 *     equal FNV-1a and equal length on different sets; the value is recomputed on any mismatch of the
 *     stored membership reference as a guard.
 * (c) Measured in docs/verification/zones/REPORT.md (cold vs warm call on a 160-cell zone).
 */
const interiorCache = new Map<string, { readonly membership: readonly number[]; readonly anchors: ReadonlySet<number> }>();
const INTERIOR_CACHE_LIMIT = 256;

/** Z-10: anchor cells whose whole `size` footprint lies inside the zone. */
export function interiorPlacementTiles(zone: Pick<Zone, "membership">, size: FootprintSize, gridWidth: number): ReadonlySet<number> {
  const key = `${zoneMembershipHash(zone.membership, gridWidth)}:${gridWidth}:${size.width}x${size.height}`;
  const cached = interiorCache.get(key);
  if (cached !== undefined && (cached.membership === zone.membership || sameMembership(cached.membership, zone.membership))) {
    return cached.anchors;
  }
  const members = new Set(zone.membership);
  const anchors = new Set<number>();
  for (const cell of zone.membership) {
    const tx = cell % gridWidth;
    if (tx + size.width > gridWidth) continue;
    let whole = true;
    for (let dy = 0; dy < size.height && whole; dy += 1) {
      for (let dx = 0; dx < size.width && whole; dx += 1) {
        if (!members.has(cell + dy * gridWidth + dx)) whole = false;
      }
    }
    if (whole) anchors.add(cell);
  }
  if (interiorCache.size >= INTERIOR_CACHE_LIMIT) interiorCache.clear();
  interiorCache.set(key, { membership: zone.membership, anchors });
  return anchors;
}

function sameMembership(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((cell, index) => cell === right[index]);
}
