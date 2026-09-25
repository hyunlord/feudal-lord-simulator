import { BALANCE, PRESSURE_BALANCE } from "./balanceConfig";

export const HOUSE_FOOD_INTERVAL = 400;

export function houseFoodRation(house: { readonly residents?: number }): number {
  return Math.ceil(Math.max(0, house.residents ?? 0) / 8);
}

export function houseBreadCapacity(house: { readonly residents?: number }): number {
  return Math.max(3, houseFoodRation(house) * 3);
}

/** FP-4: the calendar's winter (in-year ticks from `winterFrom` to the year end), from the tick alone. */
export function isWinterTick(tick: number): boolean {
  const inYear = ((Math.floor(tick) % BALANCE.TICKS_PER_YEAR) + BALANCE.TICKS_PER_YEAR) % BALANCE.TICKS_PER_YEAR;
  return inYear >= PRESSURE_BALANCE.winterFrom;
}

/**
 * FP-4: bread one meal takes. Outside winter it is the ration; in winter the ration × 1.2, the fraction carried in
 * thousandths (`carry`, 0–999) to the next winter meal, so a winter's meals eat exactly 1.2× their rations.
 */
export function mealBread(ration: number, tick: number, carry: number): { readonly bread: number; readonly carry: number } {
  if (!isWinterTick(tick) || ration <= 0) return { bread: ration, carry };
  const owed = carry + ration * (PRESSURE_BALANCE.winterRationPermille - 1000);
  return { bread: ration + Math.floor(owed / 1000), carry: owed % 1000 };
}
