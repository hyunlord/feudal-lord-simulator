import type { CarterWalker, DistributorWalker, TilePos, Walker } from "./walker.types";

interface MovementState {
  readonly position: TilePos;
  readonly pathIndex: number;
  readonly previousTile: TilePos | null;
}

function distanceBetween(start: TilePos, destination: TilePos): number {
  return Math.abs(destination.tx - start.tx) + Math.abs(destination.ty - start.ty);
}

function interpolateRoadSegment(
  start: TilePos,
  destination: TilePos,
  distance: number,
): TilePos {
  const segmentLength = distanceBetween(start, destination);
  if (segmentLength === 0) return destination;

  const ratio = distance / segmentLength;
  return {
    tx: start.tx + (destination.tx - start.tx) * ratio,
    ty: start.ty + (destination.ty - start.ty) * ratio,
  };
}

function arrivedState(path: readonly TilePos[]): MovementState {
  const finalTile = path[path.length - 1] ?? null;
  return {
    position: finalTile ?? { tx: 0, ty: 0 },
    pathIndex: Math.max(path.length - 1, 0),
    previousTile: path[path.length - 2] ?? null,
  };
}

function nextMovementState(walker: Walker, distance: number): MovementState {
  if (distance <= 0 || hasArrivedAtPathEnd(walker)) {
    return {
      position: walker.position,
      pathIndex: walker.pathIndex,
      previousTile: walker.previousTile,
    };
  }

  let remainingDistance = distance;
  let position = walker.position;
  let pathIndex = walker.pathIndex;
  let previousTile = walker.previousTile;

  while (remainingDistance > 0) {
    const destination = walker.path[pathIndex + 1];
    if (destination === undefined) return arrivedState(walker.path);

    const segmentRemaining = distanceBetween(position, destination);
    if (remainingDistance < segmentRemaining) {
      return {
        position: interpolateRoadSegment(position, destination, remainingDistance),
        pathIndex,
        previousTile,
      };
    }

    remainingDistance -= segmentRemaining;
    previousTile = walker.path[pathIndex] ?? previousTile;
    position = destination;
    pathIndex += 1;
  }

  return { position, pathIndex, previousTile };
}

export function hasArrivedAtPathEnd(walker: Walker): boolean {
  return walker.pathIndex >= Math.max(walker.path.length - 1, 0);
}

// Returns the next road tile the walker is traversing toward, or the final tile after arrival.
export function currentRoadTile(walker: Walker): TilePos | null {
  if (hasArrivedAtPathEnd(walker)) return walker.path[walker.pathIndex] ?? null;

  return walker.path[walker.pathIndex + 1] ?? null;
}

// Returns the last fully reached road tile, suitable for cancellation or replanning snaps.
export function lastReachedRoadTile(walker: Walker): TilePos | null {
  return walker.path[walker.pathIndex] ?? null;
}

export function stepWalkerAlongPath(
  walker: CarterWalker,
  distance: number,
): CarterWalker;
export function stepWalkerAlongPath(
  walker: DistributorWalker,
  distance: number,
): DistributorWalker;
export function stepWalkerAlongPath(walker: Walker, distance: number): Walker;
export function stepWalkerAlongPath(walker: Walker, distance: number): Walker {
  const movement = nextMovementState(walker, distance);
  return {
    ...walker,
    position: movement.position,
    pathIndex: movement.pathIndex,
    previousTile: movement.previousTile,
  };
}

export function stepWalker(walker: Walker, distance: number): Walker {
  return stepWalkerAlongPath(walker, distance);
}
