import { TILE_H, TILE_W, tileToScreen } from "./iso";

export type FringePoint = { readonly x: number; readonly y: number };

export function forestEdgeContour(
  tx: number,
  ty: number,
  dx: number,
  dy: number,
  seed: number,
  reach: number,
): readonly FringePoint[] {
  const center = tileToScreen(tx, ty);
  const phase = fringeNoise(tx, ty, seed, 7) * Math.PI * 2;
  const frequency = 0.65 + fringeNoise(tx + dx, ty + dy, seed, 13) * 0.75;
  const project = (t: number, depth: number): FringePoint => ({
    x: center.sx + (dx - dy) * TILE_W / 4 - (dx + dy) * TILE_W / 2 * (t - 0.5) - (dx - dy) * TILE_W * 0.035 * depth,
    y: center.sy + (dx + dy) * TILE_H / 4 + (dx - dy) * TILE_H / 2 * (t - 0.5) - (dx + dy) * TILE_H * 0.035 * depth,
  });
  const points: FringePoint[] = [project(0, 0), project(1, 0)];
  for (let step = 24; step >= 0; step -= 1) {
    const t = step / 24;
    const taper = Math.sin(Math.PI * t);
    const wave = 0.72 + Math.sin(t * Math.PI * frequency + phase) * 0.28;
    points.push(project(t, reach * taper * wave));
  }
  return points;
}

function fringeNoise(tx: number, ty: number, seed: number, salt: number): number {
  let hash = Math.imul(tx, 73_856_093) ^ Math.imul(ty, 19_349_663) ^ Math.imul(seed + salt, 83_492_791);
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 0xffffffff;
}
