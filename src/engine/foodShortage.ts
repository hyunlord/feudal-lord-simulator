/**
 * FIX-16: the food the town holds but cannot eat now, and the households going hungry (render LM-R1's food breakdown
 * reads these; Astra's first playthrough read "식량 277일" beside a barn of 782 bound wheat and hunger deaths).
 *
 * - A household is short of food when it has starved past the grace window (`houseIsStarving`), or when the Great
 *   Famine's prices shut the poorest out of the market and the lord gave no relief (`famineShortHouses`). The season's
 *   death roll puts most of dear bread's extra deaths on these households (persons.ts `householdMortalityWeight`).
 * - Bound wheat is the wheat in a building whose wheat the stuck-stock check marks stuck (SK-3 `stuckSinceTick`, brought
 *   up to date every `STUCK_STOCK_CHECK_TICKS`): a barn that cannot hand it on, for want of a road, carters or a
 *   receiver with room. It is left out of the food reserve and reported apart, with the days it would add if released.
 */
import { BALANCE } from "../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, operationSuspended } from "../content/buildingConfig";
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from "../content/houseFoodConfig";
import { boundWheatOf } from "../population/foodReserve";
import { houseIsStarving } from "../population/houseFood";
import type { GameState } from "./engine.types";
import { famineShortHouses } from "./eventSchedule";

const DAYS_PER_YEAR = 360;

type ShortageWorld = Pick<GameState, "events" | "houses" | "tick" | "seed" | "scenarioId">;

/** The lived-in households short of food now, by building id. */
export function foodShortHouseIds(state: ShortageWorld): ReadonlySet<string> {
  const short = new Set(famineShortHouses(state));
  for (const house of state.houses) if (houseIsStarving(house, state.tick)) short.add(house.buildingId);
  return new Set([...short].filter(id => state.houses.some(house => house.buildingId === id && house.residents > 0 && house.abandonedTick === undefined)));
}

/** How many households go hungry now. */
export function starvingHouseholds(state: ShortageWorld): number {
  return foodShortHouseIds(state).size;
}

/** Bound wheat in the town's buildings. */
export function boundWheat(state: Pick<GameState, "buildings">): number {
  return boundWheatOf(state.buildings);
}

/** Calendar days of food the bound wheat would add to the stores once released (0 when no mill can grind it). */
export function boundWheatReleaseDays(state: Pick<GameState, "buildings" | "houses">): number {
  const ration = state.houses.reduce((sum, house) => sum + (house.residents > 0 ? houseFoodRation(house) : 0), 0);
  const grinds = state.buildings.some(building => building.kind === "mill" && !operationSuspended(building));
  if (ration <= 0 || !grinds) return 0;
  const bread = Math.floor(boundWheat(state) / (BUILDING_CONFIG_BY_KIND.mill.production?.inputPerOutput ?? 2));
  return Math.floor(bread * HOUSE_FOOD_INTERVAL / ration * DAYS_PER_YEAR / BALANCE.TICKS_PER_YEAR);
}

/** The breakdown render LM-R1 shows: "묶인 밀 782 — 풀리면 +91일", and the households going hungry. */
export function foodShortage(state: GameState): { readonly starvingHouseholds: number; readonly boundWheat: number; readonly releaseDays: number } {
  return { starvingHouseholds: starvingHouseholds(state), boundWheat: boundWheat(state), releaseDays: boundWheatReleaseDays(state) };
}
