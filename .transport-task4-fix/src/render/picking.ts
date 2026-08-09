import type { Point } from "./camera";
import { TILE_H, TILE_W, screenToTile, tileToScreen } from "./iso";

const CONTAINMENT_EPSILON = 1e-9;
const CANDIDATE_OFFSETS = [-1, 0, 1] as const;

export interface TileCoord {
  readonly tx: number;
  readonly ty: number;
}

export function tileCenter(tx: number, ty: number): Point {
  const center = tileToScreen(tx, ty);
  return { x: center.sx, y: center.sy };
}

export function containsPointInTile(point: Point, tile: TileCoord): boolean {
  const center = tileCenter(tile.tx, tile.ty);
  const normalizedDistance =
    Math.abs(point.x - center.x) / (TILE_W / 2) +
    Math.abs(point.y - center.y) / (TILE_H / 2);

  return normalizedDistance <= 1 + CONTAINMENT_EPSILON;
}

export function pickTile(point: Point): TileCoord | null {
  const rough = screenToTile(point.x, point.y);
  const base = {
    tx: Math.floor(rough.tx),
    ty: Math.floor(rough.ty),
  };

  for (const txOffset of CANDIDATE_OFFSETS) {
    for (const tyOffset of CANDIDATE_OFFSETS) {
      const candidate = {
        tx: base.tx + txOffset,
        ty: base.ty + tyOffset,
      };

      if (containsPointInTile(point, candidate)) {
        return candidate;
      }
    }
  }

  return null;
}
