import type { Grid, TileCoordinate } from "./grid";

export interface BuildingFootprint {
  width: number;
  height: number;
}

export interface PlacementRequest {
  anchor: TileCoordinate;
  footprint: BuildingFootprint;
}

export function canPlaceBuilding(_grid: Grid, _request: PlacementRequest): boolean {
  throw new Error("not implemented");
}
