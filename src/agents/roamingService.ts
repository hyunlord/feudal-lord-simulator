import { houseBreadCapacity, houseFoodRation } from "../content/houseFoodConfig";
import type { DistributorWalker, TilePos } from "./walker.types";
import type { RoamingDeliveryEvent, RoamingHouse, RoamingRoutePort } from "./roamingTypes";

function distanceToHouse(house: RoamingHouse, tile: TilePos): number {
  const dx = Math.max(house.tx - tile.tx, 0, tile.tx - (house.tx + (house.width ?? 1) - 1));
  const dy = Math.max(house.ty - tile.ty, 0, tile.ty - (house.ty + (house.height ?? 1) - 1));
  return dx + dy;
}

export function serviceHouses(params: {
  readonly tick: number;
  readonly houses: readonly RoamingHouse[];
  readonly walker: DistributorWalker;
  readonly tile: TilePos;
  readonly routes: RoamingRoutePort;
}): {
  readonly houses: readonly RoamingHouse[];
  readonly walker: DistributorWalker;
  readonly deliveryEvents: readonly RoamingDeliveryEvent[];
} {
  let remaining = params.walker.cargo?.amount ?? 0;
  const deliveryEvents: RoamingDeliveryEvent[] = [];
  const houses = params.houses.map((house) => {
    if (remaining === 0 || distanceToHouse(house, params.tile) > 1) return house;
    if (params.routes.canServiceHouse?.(params.tile, house) === false) return house;
    const capacity = Math.max(0, houseBreadCapacity(house) - house.breadStock);
    const ration = Math.max(houseFoodRation(house), (house.width ?? 1) * (house.height ?? 1));
    const delivered = Math.min(remaining, capacity, ration);
    if (delivered === 0) return house;
    remaining -= delivered;
    deliveryEvents.push({
      homeBuildingId: params.walker.homeBuildingId,
      houseBuildingId: house.buildingId,
      amount: delivered,
    });
    return {
      ...house,
      breadStock: house.breadStock + delivered,
      lastServicedTick: params.tick,
    };
  });
  return {
    houses,
    walker: {
      ...params.walker,
      cargo: remaining > 0 ? { resource: "bread", amount: remaining } : null,
    },
    deliveryEvents,
  };
}
