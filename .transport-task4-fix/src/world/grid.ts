import type { Tile } from "./world.types";

export interface Grid {
  readonly tiles: readonly Tile[];
  readonly width: number;
  readonly height: number;
}

export interface TileCoordinate {
  readonly tx: number;
  readonly ty: number;
}

export function isInBounds(grid: Grid, coordinate: TileCoordinate): boolean {
  return (
    Number.isInteger(coordinate.tx) &&
    Number.isInteger(coordinate.ty) &&
    coordinate.tx >= 0 &&
    coordinate.ty >= 0 &&
    coordinate.tx < grid.width &&
    coordinate.ty < grid.height
  );
}

export function getTile(grid: Grid, coordinate: TileCoordinate): Tile | null {
  if (!isInBounds(grid, coordinate)) return null;

  return grid.tiles[coordinate.ty * grid.width + coordinate.tx] ?? null;
}
