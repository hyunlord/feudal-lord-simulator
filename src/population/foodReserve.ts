import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import { HOUSE_FOOD_INTERVAL, houseFoodRation, isWinterTick } from "../content/houseFoodConfig";
import { SEASON_TICKS } from "../content/packSettings";

/** The parts of the game state the reserve reads (population may not import the engine's state type). */
export interface FoodReserveWorld {
  readonly houses: readonly { readonly residents: number }[];
  readonly buildings: readonly {
    readonly kind: string;
    readonly workers: number;
    readonly inventory: Partial<Record<string, number>>;
    readonly operationPaused?: boolean;
    readonly upkeepUnpaid?: boolean;
    readonly stuckSinceTick?: Partial<Record<string, number>>;
  }[];
  readonly walkers: readonly { readonly cargo: { readonly resource: string; readonly amount: number } | null }[];
}

/** FIX-4 E5: wheat per tick the mills grind now — mills that are staffed and neither paused nor stopped for upkeep. */
export function millGrindRate(state: Pick<FoodReserveWorld, "buildings">): number {
  const mill = BUILDING_CONFIG_BY_KIND.mill;
  const production = mill.production;
  if (production === null || production.ticksPerOutput <= 0) return 0;
  const running = state.buildings.filter(building => building.kind === "mill" && building.operationPaused !== true && building.upkeepUnpaid !== true
    && building.workers >= mill.workersRequired).length;
  return running * production.inputPerOutput / production.ticksPerOutput;
}

/** FIX-16: wheat in buildings whose wheat the stuck-stock check marks stuck (SK-3 `stuckSinceTick`) — bound wheat. */
export function boundWheatOf(buildings: FoodReserveWorld["buildings"]): number {
  return buildings.reduce((sum, building) => sum + (building.stuckSinceTick?.wheat === undefined ? 0 : Math.max(0, building.inventory.wheat ?? 0)), 0);
}

/**
 * FIX-1 food reserve: how long the town's stored food lasts at its current consumption, in ticks. Stored food is the
 * bread and wheat in buildings and on carts (the resource bar's stock; household larders excluded).
 *
 * FIX-4 E5 (HR-5): wheat counts only as the bread the mills can make of it in that time. With bread B, wheat W,
 * consumption c bread a tick and mills grinding r wheat a tick (2 wheat → 1 bread), the food lasts the T where
 * B + min(W, r·T)/2 = c·T. Was B + W/2 whatever the mills: the UX-0b audit town read 900 days with its only mill
 * stopped, so the ladder, the first-winter warning and the season hint stayed quiet while it starved.
 * FIX-16: wheat the stuck-stock check marks bound is left out.
 * Null when no house eats.
 */
export function foodReserveTicks(state: FoodReserveWorld): number | null {
  const ration = state.houses.reduce((sum, house) => sum + (house.residents > 0 ? houseFoodRation(house) : 0), 0);
  if (ration <= 0) return null;
  const amount = (resource: "bread" | "wheat") => state.buildings.reduce((sum, building) => sum + Math.max(0, building.inventory[resource] ?? 0), 0)
    + state.walkers.reduce((sum, walker) => sum + (walker.cargo?.resource === resource ? Math.max(0, walker.cargo.amount) : 0), 0);
  const wheatPerBread = BUILDING_CONFIG_BY_KIND.mill.production?.inputPerOutput ?? 2;
  const bread = amount("bread");
  // FIX-16: bound wheat (a barn that cannot hand it on) is no food until it moves; engine/foodShortage reports it apart.
  const wheat = Math.max(0, amount("wheat") - boundWheatOf(state.buildings));
  const eat = ration / HOUSE_FOOD_INTERVAL;
  const grind = millGrindRate(state) / wheatPerBread;
  // The mills keep up (or the wheat runs out first): every grain becomes bread in time.
  const whole = (bread + Math.floor(wheat / wheatPerBread)) / eat;
  if (grind >= eat || grind * whole * wheatPerBread >= wheat) return Math.floor(whole);
  // The mills fall behind: bread runs down at c − r/2 while the wheat lasts.
  return Math.floor(bread / (eat - grind));
}

/**
 * A settlement is stable only with at least one season of stored food (1,000 ticks = 90 calendar days = 50 game
 * seconds at 1×; the year is 4,000 ticks, 360 days). The UX-0 audit city with 30 game seconds of bread and no wheat
 * was reported stable.
 */
export const FOOD_RESERVE_STABLE_TICKS = SEASON_TICKS;

export function foodReserveShort(state: FoodReserveWorld): boolean {
  const reserve = foodReserveTicks(state);
  return reserve !== null && reserve < FOOD_RESERVE_STABLE_TICKS;
}

/**
 * FP-3/FP-4: the reserve at the consumption of the season `tick` falls in (winter eats 1.2× the ration), in ticks.
 * Null when no house eats.
 */
export function seasonalFoodReserveTicks(state: FoodReserveWorld, tick: number): number | null {
  const reserve = foodReserveTicks(state);
  if (reserve === null || !isWinterTick(tick)) return reserve;
  return Math.floor(reserve * 1000 / PRESSURE_BALANCE.winterRationPermille);
}

/** FP-3: the town's stored food will not last a season at this season's consumption. */
export function seasonalFoodReserveShort(state: FoodReserveWorld, tick: number): boolean {
  const reserve = seasonalFoodReserveTicks(state, tick);
  return reserve !== null && reserve < FOOD_RESERVE_STABLE_TICKS;
}
