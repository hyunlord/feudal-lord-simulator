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

function roadCoordinateKey(coordinate: TileCoordinate): string {
  return `${coordinate.tx},${coordinate.ty}`;
}

function isRoadTile(grid: Grid, coordinate: TileCoordinate): boolean {
  return getTile(grid, coordinate)?.hasRoad === true;
}

export function existingRoadComponent(
  grid: Grid,
  starts: readonly TileCoordinate[],
): readonly TileCoordinate[] {
  const frontier = starts.filter((start) => isRoadTile(grid, start));
  const component: TileCoordinate[] = [];
  const visited = new Set<string>();

  for (let queueIndex = 0; queueIndex < frontier.length; queueIndex += 1) {
    const current = frontier[queueIndex];
    if (current === undefined) continue;
    const currentKey = roadCoordinateKey(current);
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);
    component.push(current);

    for (const neighbor of getOrthogonalRoadNeighbors(grid, current)) {
      if (!visited.has(roadCoordinateKey(neighbor))) frontier.push(neighbor);
    }
  }

  return component;
}

function reconstructRoadPath(
  parents: ReadonlyMap<string, TileCoordinate | null>,
  startKey: string,
  destination: TileCoordinate,
): readonly TileCoordinate[] | null {
  const path: TileCoordinate[] = [];
  let current: TileCoordinate | null = destination;

  while (current !== null) {
    path.push(current);
    const currentKey = roadCoordinateKey(current);
    if (currentKey === startKey) return path.reverse();

    const parent = parents.get(currentKey);
    if (parent === undefined) return null;
    current = parent;
  }

  return null;
}

export function findExistingRoadPath(
  grid: Grid,
  request: RoadPathRequest,
): readonly TileCoordinate[] | null {
  if (!isRoadTile(grid, request.start) || !isRoadTile(grid, request.destination)) {
    return null;
  }

  const startKey = roadCoordinateKey(request.start);
  const destinationKey = roadCoordinateKey(request.destination);
  const frontier: TileCoordinate[] = [request.start];
  const parents = new Map<string, TileCoordinate | null>([[startKey, null]]);

  for (let queueIndex = 0; queueIndex < frontier.length; queueIndex += 1) {
    const current = frontier[queueIndex];
    if (current === undefined) return null;

    const currentKey = roadCoordinateKey(current);
    if (currentKey === destinationKey) {
      return reconstructRoadPath(parents, startKey, request.destination);
    }

    for (const neighbor of getOrthogonalRoadNeighbors(grid, current)) {
      const neighborKey = roadCoordinateKey(neighbor);
      if (parents.has(neighborKey)) continue;

      parents.set(neighborKey, current);
      frontier.push(neighbor);
    }
  }

  return null;
}

export function findRoadPath(
  grid: Grid,
  request: RoadPathRequest,
): readonly TileCoordinate[] | null {
  const line = roadLine(request.start, request.destination);
  if (!line.every((coordinate) => canPlaceRoad(grid, coordinate))) return null;

  return line;
}
