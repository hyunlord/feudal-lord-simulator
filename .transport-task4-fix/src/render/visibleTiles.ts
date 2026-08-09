import { getTile, type Grid } from "../world/grid";
import type { Tile } from "../world/world.types";

export interface TileRange {
  readonly minTx: number;
  readonly minTy: number;
  readonly maxTx: number;
  readonly maxTy: number;
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

export function visibleTilesInDrawOrder(
  grid: Grid,
  range: TileRange,
): readonly Tile[] {
  const minTx = clamp(0, grid.width - 1, Math.min(range.minTx, range.maxTx));
  const maxTx = clamp(0, grid.width - 1, Math.max(range.minTx, range.maxTx));
  const minTy = clamp(0, grid.height - 1, Math.min(range.minTy, range.maxTy));
  const maxTy = clamp(0, grid.height - 1, Math.max(range.minTy, range.maxTy));

  if (grid.width <= 0 || grid.height <= 0) return [];
  if (minTx > maxTx || minTy > maxTy) return [];

  const tiles: Tile[] = [];
  for (let ty = minTy; ty <= maxTy; ty += 1) {
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      const tile = getTile(grid, { tx, ty });
      if (tile !== null) tiles.push(tile);
    }
  }
  return tiles;
}
