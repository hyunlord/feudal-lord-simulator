import type { Grid, TileCoordinate } from "./grid";
import { getTile } from "./grid";

export interface RoadPathRequest {
  readonly start: TileCoordinate;
  readonly destination: TileCoordinate;
}

export function canPlaceRoad(grid: Grid, coordinate: TileCoordinate): boolean {
  const tile = getTile(grid, coordinate);
  return (
    tile !== null &&
    tile.buildingId === null &&
    !tile.hasRoad &&
    tile.terrain !== "water"
  );
}

export function roadLine(
  start: TileCoordinate,
  destination: TileCoordinate,
): readonly TileCoordinate[] {
  const deltaX = destination.tx - start.tx;
  const deltaY = destination.ty - start.ty;
  // Equal diagonal drags resolve horizontally for stable pointer behavior.
  const horizontal = Math.abs(deltaX) >= Math.abs(deltaY);
  const steps = Math.abs(horizontal ? deltaX : deltaY);
  const direction = Math.sign(horizontal ? deltaX : deltaY);
  const coordinates: TileCoordinate[] = [];

  for (let step = 0; step <= steps; step += 1) {
    coordinates.push(
      horizontal
        ? { tx: start.tx + step * direction, ty: start.ty }
        : { tx: start.tx, ty: start.ty + step * direction },
    );
  }

  return coordinates;
}

export function getOrthogonalRoadNeighbors(
  grid: Grid,
  coordinate: TileCoordinate,
): readonly TileCoordinate[] {
  const candidates = [
    { tx: coordinate.tx, ty: coordinate.ty - 1 },
    { tx: coordinate.tx + 1, ty: coordinate.ty },
    { tx: coordinate.tx, ty: coordinate.ty + 1 },
    { tx: coordinate.tx - 1, ty: coordinate.ty },
  ] as const;

  return candidates.filter((candidate) => getTile(grid, candidate)?.hasRoad === true);
}

export function findRoadPath(
  grid: Grid,
  request: RoadPathRequest,
): readonly TileCoordinate[] | null {
  const line = roadLine(request.start, request.destination);
  if (!line.every((coordinate) => canPlaceRoad(grid, coordinate))) return null;

  return line;
}
