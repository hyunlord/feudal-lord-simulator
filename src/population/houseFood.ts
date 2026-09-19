import { BALANCE } from "../content/balanceConfig";
import type { House } from "./population.types";

import { HOUSE_FOOD_INTERVAL, houseFoodRation } from "../content/houseFoodConfig";
export { HOUSE_FOOD_INTERVAL, houseFoodRation, houseBreadCapacity } from "../content/houseFoodConfig";

export function houseHasFood(house: { readonly breadStock: number }): boolean {
  return house.breadStock > 0;
}

export function houseIsStarving(house: House, tick: number): boolean {
  return house.residents > 0 && !houseHasFood(house)
    && tick > (house.starvationGraceUntilTick ?? 0)
    && (house.emptyFoodTicks ?? 0) > BALANCE.STARVATION_WINDOW;
}

export function stepHouseFood(house: House, tick: number): House {
  const breadStock = tick > 0 && tick % HOUSE_FOOD_INTERVAL === 0
    ? Math.max(0, house.breadStock - houseFoodRation(house)) : house.breadStock;
  const emptyFoodTicks = breadStock > 0 || house.residents === 0
    || tick <= (house.starvationGraceUntilTick ?? 0)
    ? 0 : (house.emptyFoodTicks ?? 0) + 1;
  if (breadStock === house.breadStock && emptyFoodTicks === (house.emptyFoodTicks ?? 0)) return house;
  return { ...house, breadStock, emptyFoodTicks };
}

export function houseGrowthPhase(buildingId: string): number {
  let hash = 0;
  for (const character of buildingId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % BALANCE.GROWTH_INTERVAL;
}
