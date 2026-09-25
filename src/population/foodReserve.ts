import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { BALANCE } from "../content/balanceConfig";
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from "../content/houseFoodConfig";

/** The parts of the game state the reserve reads (population may not import the engine's state type). */
export interface FoodReserveWorld {
  readonly houses: readonly { readonly residents: number }[];
  readonly buildings: readonly { readonly inventory: Partial<Record<string, number>> }[];
  readonly walkers: readonly { readonly cargo: { readonly resource: string; readonly amount: number } | null }[];
}

/**
 * FIX-1 food reserve: how long the town's stored food lasts at its current consumption, in ticks. Stored food is the
 * bread and wheat in buildings and on carts (the resource bar's stock; household larders excluded), wheat counted as
 * the bread a mill makes of it (2 wheat → 1 bread). Consumption is every occupied house's ration per meal interval.
 * Null when no house eats.
 */
export function foodReserveTicks(state: FoodReserveWorld): number | null {
  const ration = state.houses.reduce((sum, house) => sum + (house.residents > 0 ? houseFoodRation(house) : 0), 0);
  if (ration <= 0) return null;
  const amount = (resource: "bread" | "wheat") => state.buildings.reduce((sum, building) => sum + Math.max(0, building.inventory[resource] ?? 0), 0)
    + state.walkers.reduce((sum, walker) => sum + (walker.cargo?.resource === resource ? Math.max(0, walker.cargo.amount) : 0), 0);
  const wheatPerBread = BUILDING_CONFIG_BY_KIND.mill.production?.inputPerOutput ?? 2;
  const bread = amount("bread") + Math.floor(amount("wheat") / wheatPerBread);
  return Math.floor(bread * HOUSE_FOOD_INTERVAL / ration);
}

/**
 * A settlement is stable only with at least one season of stored food (1,000 ticks = 50 game seconds at 1×; the
 * calendar has no day, `TICKS_PER_YEAR` 4,000 is four seasons). The UX-0 audit city with 30 game seconds of bread
 * and no wheat was reported stable.
 */
export const FOOD_RESERVE_STABLE_TICKS = BALANCE.TICKS_PER_YEAR / 4;

export function foodReserveShort(state: FoodReserveWorld): boolean {
  const reserve = foodReserveTicks(state);
  return reserve !== null && reserve < FOOD_RESERVE_STABLE_TICKS;
}
