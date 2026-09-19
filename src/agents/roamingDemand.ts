import { houseBreadCapacity, houseFoodRation } from "../content/houseFoodConfig";
import type { RoamingHouse, RoamingRoutePort } from "./roamingTypes";
import type { TilePos } from "./walker.types";

export function nextHouseDemandTile(
  current: TilePos,
  houses: readonly RoamingHouse[],
  routes: RoamingRoutePort,
  remainingRange: number,
): TilePos | null {
  if (routes.servicePath === undefined) return null;
  const candidates = houses.flatMap((house) => {
    if (house.breadStock >= houseBreadCapacity(house)) return [];
    const path = routes.servicePath?.(current, house);
    if (path == null || path.length < 2 || path.length - 1 > remainingRange) return [];
    return [{
      house,
      path,
      meals: house.breadStock / Math.max(1, houseFoodRation(house)),
    }];
  });
  candidates.sort((left, right) => left.meals - right.meals
    || left.path.length - right.path.length
    || left.house.lastServicedTick - right.house.lastServicedTick
    || left.house.buildingId.localeCompare(right.house.buildingId));
  return candidates[0]?.path[1] ?? null;
}
