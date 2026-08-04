import type { Grid, TileCoordinate } from "./grid";

export interface RoadPathRequest {
  start: TileCoordinate;
  destination: TileCoordinate;
}

export function findRoadPath(
  _grid: Grid,
  _request: RoadPathRequest,
): readonly TileCoordinate[] | null {
  throw new Error("not implemented");
}
