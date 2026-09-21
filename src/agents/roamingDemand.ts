import { houseBreadCapacity, houseFoodRation } from "../content/houseFoodConfig";
import type { RoamingHouse, RoamingRoutePort } from "./roamingTypes";
import type { TilePos } from "./walker.types";

export interface HouseDemand {
  readonly house: RoamingHouse;
  readonly path: readonly TilePos[];
  readonly meals: number;
}

export function compareHouseDemand(left: HouseDemand, right: HouseDemand): number {
  return left.meals - right.meals || left.path.length - right.path.length
    || left.house.lastServicedTick - right.house.lastServicedTick
    || left.house.buildingId.localeCompare(right.house.buildingId);
}

export function bestHouseDemand(
  current: TilePos,
  houses: readonly RoamingHouse[],
  routes: RoamingRoutePort,
  remainingRange: number,
  minimumEdges: number,
): HouseDemand | null {
  if (routes.servicePath === undefined) return null;
  const candidates = houses.flatMap((house) => {
    if (house.breadStock >= houseBreadCapacity(house)) return [];
    const path = routes.servicePath?.(current, house);
    if (path == null || path.length - 1 < minimumEdges || path.length - 1 > remainingRange) return [];
    return [{
      house,
      path,
      meals: house.breadStock / Math.max(1, houseFoodRation(house)),
    }];
  });
  candidates.sort(compareHouseDemand);
  return candidates[0] ?? null;
}

export function nextHouseDemandTile(
  current: TilePos, houses: readonly RoamingHouse[], routes: RoamingRoutePort, remainingRange: number,
): TilePos | null {
  return bestHouseDemand(current, houses, routes, remainingRange, 1)?.path[1] ?? null;
}
