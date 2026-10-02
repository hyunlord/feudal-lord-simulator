import { FNV_OFFSET, avalanche, mixNumber, mixString } from "../content/seedHash";
import type { BoundaryPoint } from "../world/boundary/boundaryGeometry";

// NAT-5 (QA-039, QA-040, vision checker TOP10 #5 / #10): the land fill regions and the rock (archetypeGroundRegions.ts,
// landRockRegions.ts) are outlined by marching squares over the tile centres and two rounds of Chaikin, which rounds the
// corners but keeps every run along the tile grid: a staircase becomes one long screen-horizontal or -vertical line, a
// tile row one long diagonal, and the fills meet the meadow as big right-angled plates. Each smoothed outline point is
// now moved by one smooth warp of the whole tile plane: per axis three octaves of gradient noise (unit gradients at the
// lattice points by a hash of the land's seed, quintic fade; gradient rather than value noise, whose zero slope at every
// lattice point left straight runs of 3+ tiles), the coarsest 13 tiles across so a plate's long side bends as a whole,
// not only wiggles. One field for every fill region, so where two fills share an outline both move it alike and still
// meet; the rock takes the same field at ROCK_WARP_SCALE (it is drawn over the fills, never shares their outline, and
// should stay near its tiles: they cannot be built on). It folds nothing, so no outline crosses itself or another:
// measured over seeds 1-60 on a 0.31-tile grid of a 64 x 64 map, border fade included, det(I + J) >= 0.38 (offset <= 1.7 tiles)
// (tests/landRegionWarp.test.ts checks the determinant on seeds 1-20, and that no outline of the five lands crosses
// another). The warp fades out over WARP_EDGE_FADE tiles towards the map's border (an outline along the border stays on
// it, under the map's edge) and towards drained cells (their edge is the drain strip on the tile edges, LU-D5, which the
// fen's outline must keep meeting).
// Baked once per land layer with the regions (no per-frame work).

/** Octaves: amplitude (tiles; the noise spans about -1 to 1), lattice cell (tiles) and a lattice offset (cells). */
export const WARP_OCTAVES = [
  { amplitude: 1.25, cell: 13, offset: 0 }, { amplitude: 0.45, cell: 5.5, offset: 0.37 }, { amplitude: 0.13, cell: 2.2, offset: 0.74 },
] as const;
/** The fade to no warp at the map's border and at drained cells, in tiles. */
export const WARP_EDGE_FADE = 4;
/** The rock's share of the warp. */
export const ROCK_WARP_SCALE = 0.55;
/** Bumped when the field changes: part of every warped loop's hash (so of the chunk content keys). */
export const WARP_VERSION = 2;

const SALT = mixString(FNV_OFFSET, "nat5:land-warp");
/** 2D gradient noise with unit gradients spans about +-0.7: scaled to about +-1. */
const NOISE_SCALE = 1.4;

/** The unit gradient at lattice point (x, y) of a channel, dotted with (dx, dy). */
function lattice(seed: number, channel: number, x: number, y: number, dx: number, dy: number): number {
  const angle = ((avalanche(mixNumber(mixNumber(mixNumber(mixNumber(SALT, seed), channel), x), y)) % 3600) / 3600) * Math.PI * 2;
  return Math.cos(angle) * dx + Math.sin(angle) * dy;
}

const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function gradientNoise(seed: number, channel: number, u: number, v: number): number {
  const ix = Math.floor(u); const iy = Math.floor(v); const fx = u - ix; const fy = v - iy;
  const sx = fade(fx); const sy = fade(fy);
  const top = lattice(seed, channel, ix, iy, fx, fy) * (1 - sx) + lattice(seed, channel, ix + 1, iy, fx - 1, fy) * sx;
  const bottom = lattice(seed, channel, ix, iy + 1, fx, fy - 1) * (1 - sx) + lattice(seed, channel, ix + 1, iy + 1, fx - 1, fy - 1) * sx;
  return (top * (1 - sy) + bottom * sy) * NOISE_SCALE;
}

/**
 * One warp of a land's tile plane (tile centres at integers, the border at -0.5): its seed and map size, the share of the
 * field it takes, and the distance from a point to the nearest pinned feature (a drained cell), if any.
 */
export type WarpField = { readonly seed: number; readonly width: number; readonly height: number; readonly scale: number;
  readonly pinned?: (point: BoundaryPoint) => number };

export function warpPoint(field: WarpField, point: BoundaryPoint): BoundaryPoint {
  let dx = 0; let dy = 0;
  WARP_OCTAVES.forEach(({ amplitude, cell, offset }, octave) => {
    const u = point.x / cell + offset; const v = point.y / cell + offset * 1.6;
    dx += amplitude * gradientNoise(field.seed, octave * 2, u, v);
    dy += amplitude * gradientNoise(field.seed, octave * 2 + 1, u, v);
  });
  const border = Math.min(point.x + 0.5, point.y + 0.5, field.width - 0.5 - point.x, field.height - 0.5 - point.y, field.pinned?.(point) ?? Infinity);
  const weight = smoothstep(border / WARP_EDGE_FADE) * field.scale;
  return { x: point.x + dx * weight, y: point.y + dy * weight };
}

/** A smoothed outline, warped point by point (the same count, so per-segment data keeps its index). */
export function warpLine(field: WarpField, line: readonly BoundaryPoint[]): BoundaryPoint[] {
  return line.map(point => warpPoint(field, point));
}

/** The distance from a point to the nearest cell `flag` marks (its tile square), or Infinity beyond WARP_EDGE_FADE. */
export function distanceToCells(width: number, height: number, flag: Uint8Array): ((point: BoundaryPoint) => number) | undefined {
  if (!flag.includes(1)) return undefined;
  const reach = Math.ceil(WARP_EDGE_FADE) + 1;
  return point => {
    let best = Infinity;
    const cx = Math.round(point.x); const cy = Math.round(point.y);
    for (let ty = Math.max(0, cy - reach); ty <= Math.min(height - 1, cy + reach); ty += 1) {
      for (let tx = Math.max(0, cx - reach); tx <= Math.min(width - 1, cx + reach); tx += 1) {
        if (flag[ty * width + tx] !== 1) continue;
        const ox = Math.max(0, Math.abs(point.x - tx) - 0.5); const oy = Math.max(0, Math.abs(point.y - ty) - 0.5);
        best = Math.min(best, Math.hypot(ox, oy));
      }
    }
    return best;
  };
}
