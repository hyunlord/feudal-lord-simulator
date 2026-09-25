/**
 * F0-A failure ladder, stages 1–2 (spec docs/design/flow-pressure.md FP-3): what a house's saved pressure fields mean.
 * The engine (`src/engine/seasonPressure.ts`) moves a house between the stages; this module only reads them.
 */
import type { House } from "./population.types";

/** `settled` = no stage; `leaving` = stage 1 (떠날 준비); `abandoned` = stage 2 (the household left, the house stands empty). */
export type HousePressureStatus = "settled" | "leaving" | "abandoned";

export function housePressureStatus(house: Pick<House, "leavingSinceTick" | "abandonedTick">): HousePressureStatus {
  if (house.abandonedTick !== undefined) return "abandoned";
  return house.leavingSinceTick !== undefined ? "leaving" : "settled";
}

/** Cause of stage 1 (the only one in F0-A): the household or the town ran short of food for a season. */
export type HousePressureCause = "food_shortage";

export function housePressureCause(house: Pick<House, "leavingSinceTick" | "abandonedTick">): HousePressureCause | null {
  return housePressureStatus(house) === "settled" ? null : "food_shortage";
}

/**
 * FP-3: a household is short of food when its larder is empty or the town's stored food will not last a season
 * (at the season's consumption). Empty houses have no household to be short.
 */
export function householdShortOfFood(house: Pick<House, "residents" | "breadStock">, townReserveShort: boolean): boolean {
  return house.residents > 0 && (house.breadStock <= 0 || townReserveShort);
}
