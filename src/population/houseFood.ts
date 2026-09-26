import { BALANCE } from "../content/balanceConfig";
import type { House } from "./population.types";

import { HOUSE_FOOD_INTERVAL, houseFoodRation, mealBread } from "../content/houseFoodConfig";
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
  // FP-4: a winter meal eats the ration × 1.2 (the fraction carried to the next winter meal).
  const meal = tick > 0 && tick % HOUSE_FOOD_INTERVAL === 0 ? mealBread(houseFoodRation(house), tick, house.winterRationCarry ?? 0) : null;
  const breadStock = meal === null ? house.breadStock : Math.max(0, house.breadStock - meal.bread);
  const emptyFoodTicks = breadStock > 0 || house.residents === 0
    || tick <= (house.starvationGraceUntilTick ?? 0)
    ? 0 : (house.emptyFoodTicks ?? 0) + 1;
  const carry = meal === null ? house.winterRationCarry ?? 0 : meal.carry;
  if (breadStock === house.breadStock && emptyFoodTicks === (house.emptyFoodTicks ?? 0) && carry === (house.winterRationCarry ?? 0)) return house;
  const next: House = { ...house, breadStock, emptyFoodTicks };
  if (carry === 0) delete next.winterRationCarry; else next.winterRationCarry = carry;
  return next;
}

export function houseGrowthPhase(buildingId: string): number {
  let hash = 0;
  for (const character of buildingId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % BALANCE.GROWTH_INTERVAL;
}
