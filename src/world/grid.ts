import type { Tile } from "./world.types";

export interface Grid {
  tiles: readonly Tile[];
  width: number;
  height: number;
}

export interface TileCoordinate {
  tx: number;
  ty: number;
}

export function getTile(_grid: Grid, _coordinate: TileCoordinate): Tile | null {
  throw new Error("not implemented");
}

export function isInBounds(_grid: Grid, _coordinate: TileCoordinate): boolean {
  throw new Error("not implemented");
}
