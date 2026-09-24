import { WALL_CARRY_COST_FACTOR } from '../engine/wallCarryRoute';
import type { CarterWalker, TilePos } from './walker.types';

const distance = (from: TilePos, to: TilePos): number =>
  Math.abs(from.tx - to.tx) + Math.abs(from.ty - to.ty);

function stepCost(from: TilePos, to: TilePos, roadFrom: TilePos,
  isRoad: (tile: TilePos) => boolean): number {
  const length = distance(from, to);
  return length * (!isRoad(roadFrom) || !isRoad(to) ? WALL_CARRY_COST_FACTOR : 1);
}

export function carterPathTravelCost(path: readonly TilePos[], isRoad: (tile: TilePos) => boolean): number {
  let cost = 0;
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1], to = path[index];
    if (from !== undefined && to !== undefined) cost += stepCost(from, to, from, isRoad);
  }
  return cost;
}

export function remainingCarterTravelCost(carter: CarterWalker, isRoad: (tile: TilePos) => boolean): number {
  let cost = 0;
  for (let index = carter.pathIndex; index < carter.path.length - 1; index += 1) {
    const from = carter.path[index], to = carter.path[index + 1];
    if (from !== undefined && to !== undefined) {
      cost += stepCost(index === carter.pathIndex ? carter.position : from, to, from, isRoad);
    }
  }
  return cost;
}
