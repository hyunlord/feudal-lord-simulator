import type { BoundaryPoint } from "../world/boundary/boundaryGeometry";
import type { ShoreLoop } from "../world/boundary/shoreline";
import { STRIP_PX_PER_TILE, WATERLINE_ROW } from "./drawShoreline";
import { tileToScreen } from "./iso";

// INSTALL-29 shore bands: the foam (animated) and the winter ice rim (static) along each shore loop segment, in the
// shore strip's own mapping (drawShoreline.ts: u = arc length at 128 px a tile, v across, land up): rows [top, bottom)
// of its 512 x 96 canvas, the sheets' placement offset (0, 27) with their 32 rows (records/assets.csv). Pure in the loop.

/** Tiles a simplified shore line may leave the smoothed one by (the foam and ice bands). */
export const BAND_TOLERANCE = 0.03;

/**
 * The closed line with the points dropped that lie within `tolerance` tiles of the chord kept around them
 * (Douglas-Peucker per stretch; the first point, the middle one and every change of `walled` are always kept). The
 * smoothed shore has ~4 points a tile edge: a band quad a point was 437 fills a frame over the pop176 lake at zoom
 * 1.1 and a water stage of 0.38-0.42 ms (headless Chrome --disable-gpu on the Mac, mean of 200 frames); the simplified
 * line (0.03 tile, about a pixel at zoom 1) makes 122 fills and 0.20 ms.
 */
export function simplifiedLoop(points: readonly BoundaryPoint[], walled: readonly boolean[], tolerance: number): { readonly points: readonly BoundaryPoint[]; readonly walled: readonly boolean[] } {
  const count = points.length;
  if (count < 4) return { points, walled };
  const keep = new Uint8Array(count + 1);
  keep[0] = 1; keep[count] = 1; keep[Math.floor(count / 2)] = 1;
  for (let index = 1; index < count; index += 1) if ((walled[index] === true) !== (walled[index - 1] === true)) { keep[index] = 1; keep[index - 1] = 1; }
  const at = (index: number) => points[index % count] as BoundaryPoint;
  const reduce = (from: number, to: number): void => {
    const a = at(from); const b = at(to); const length = Math.hypot(b.x - a.x, b.y - a.y);
    let worst = -1; let far = 0;
    for (let index = from + 1; index < to; index += 1) {
      const p = at(index);
      const distance = length === 0 ? Math.hypot(p.x - a.x, p.y - a.y) : Math.abs((b.x - a.x) * (a.y - p.y) - (a.x - p.x) * (b.y - a.y)) / length;
      if (distance > far) { far = distance; worst = index; }
    }
    if (worst < 0 || far <= tolerance) return;
    keep[worst] = 1; reduce(from, worst); reduce(worst, to);
  };
  let from = 0;
  for (let index = 1; index <= count; index += 1) if (keep[index] === 1) { reduce(from, index); from = index; }
  const kept: number[] = [];
  for (let index = 0; index < count; index += 1) if (keep[index] === 1) kept.push(index);
  return { points: kept.map(index => at(index)), walled: kept.map(index => walled[index] === true) };
}

export interface BandQuad {
  /** World px corners (land-side start, land-side end, water-side end, water-side start). */
  readonly corners: readonly (readonly [number, number])[];
  /** Texture px of the band's frame -> world px (the pattern transform). */
  readonly matrix: { readonly a: number; readonly b: number; readonly c: number; readonly d: number; readonly e: number; readonly f: number };
  readonly bounds: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };
}

/**
 * The quads of a band of the shore strip's rows [top, bottom) along `loop` (frame `period` px wide, repeating along
 * the shore), one per segment; walled segments are left out when `walls` (the strip stops there too).
 */
export function shoreBandQuads(loop: ShoreLoop, top: number, bottom: number, period: number, walls: boolean): readonly BandQuad[] {
  const { points: line, walled } = simplifiedLoop(loop.smoothed, loop.walled, BAND_TOLERANCE);
  const count = line.length;
  const landHalf = (WATERLINE_ROW - top) / STRIP_PX_PER_TILE; const waterHalf = (bottom - WATERLINE_ROW) / STRIP_PX_PER_TILE;
  const segmentNormal = (index: number): BoundaryPoint => {
    const a = line[index % count] as BoundaryPoint; const b = line[(index + 1) % count] as BoundaryPoint;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / length * loop.landSide, y: (b.x - a.x) / length * loop.landSide };
  };
  const vertexNormal = (index: number): BoundaryPoint => {
    const p = segmentNormal((index - 1 + count) % count); const q = segmentNormal(index);
    const length = Math.hypot(p.x + q.x, p.y + q.y) || 1;
    return { x: (p.x + q.x) / length, y: (p.y + q.y) / length };
  };
  const iso = (v: BoundaryPoint) => ({ x: (v.x - v.y) * 32, y: (v.x + v.y) * 16 });
  const quads: BandQuad[] = [];
  let arc = 0;
  for (let index = 0; index < count; index += 1) {
    const a = line[index] as BoundaryPoint; const b = line[(index + 1) % count] as BoundaryPoint;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const start = arc; arc += length;
    if (length === 0 || (walls && walled[index] === true && walled[(index + 1) % count] === true)) continue;
    const t = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const na = vertexNormal(index); const nb = vertexNormal(index + 1); const n = segmentNormal(index);
    const overlap = 0.01;
    const a0 = { x: a.x - t.x * overlap, y: a.y - t.y * overlap }; const b0 = { x: b.x + t.x * overlap, y: b.y + t.y * overlap };
    const corners = [
      { x: a0.x + na.x * landHalf, y: a0.y + na.y * landHalf }, { x: b0.x + nb.x * landHalf, y: b0.y + nb.y * landHalf },
      { x: b0.x - nb.x * waterHalf, y: b0.y - nb.y * waterHalf }, { x: a0.x - na.x * waterHalf, y: a0.y - na.y * waterHalf },
    ].map(point => { const s = tileToScreen(point.x, point.y); return [s.sx, s.sy] as const; });
    const u0 = ((start * STRIP_PX_PER_TILE) % period + period) % period;
    const u = iso({ x: t.x / STRIP_PX_PER_TILE, y: t.y / STRIP_PX_PER_TILE }); const v = iso({ x: -n.x / STRIP_PX_PER_TILE, y: -n.y / STRIP_PX_PER_TILE });
    const base = tileToScreen(a.x, a.y);
    const xs = corners.map(corner => corner[0]); const ys = corners.map(corner => corner[1]);
    quads.push({ corners, bounds: { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) },
      matrix: { a: u.x, b: u.y, c: v.x, d: v.y, e: base.sx - u.x * u0 + v.x * (top - WATERLINE_ROW), f: base.sy - u.y * u0 + v.y * (top - WATERLINE_ROW) } });
  }
  return quads;
}
