/**
 * F0-A bot reserve measure (spec docs/design/flow-pressure.md FP-6): in autumn the bot checks the stored food against
 * the winter and the spring after it; short, it plants for a larger harvest (arable margin 1.6) and builds a granary
 * if the town has none. The `--naive-reserve` variant skips this step and plants for the year's need only.
 */
import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../content/buildingConfig";
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import type { TileCoordinate } from "../geometry/tileGeometry";
import { foodReserveTicks } from "../population/foodReserve";
import { arableAction, arableSupplyShort, type FarmsteadBuildAction } from "./autoplayArable";
import { canStaffFoodExpansion } from "./autoplayFoodBottleneck";
import type { AutoplayAction } from "./autoplay.types";
import type { GameState } from "./engine.types";
import { stateCalendar } from "./scenarioState";
import { WINTER_NEED_TICKS } from "./seasonPressure";

const NONE = { kind: "none" } as const satisfies AutoplayAction;

/** FP-6: stored food the bot wants at autumn: the winter (× 1.2) and the spring after it, in ticks at the normal ration. */
export const WINTER_RESERVE_TARGET_TICKS = WINTER_NEED_TICKS + PRESSURE_BALANCE.seasonTicks;
/** FP-6: the harvest margin the bot plants for when autumn finds the reserve short. */
export const WINTER_RESERVE_MARGIN_PERMILLE = 1600;

export function winterReserveShort(state: GameState): boolean {
  if (stateCalendar(state).season !== 2) return false;
  const reserve = foodReserveTicks(state);
  return reserve !== null && reserve < WINTER_RESERVE_TARGET_TICKS;
}

export function winterReserveAction(
  state: GameState,
  buildAction: (state: GameState, kind: BuildingKind, accepts?: (coordinate: TileCoordinate) => boolean) => AutoplayAction,
): AutoplayAction {
  if (!winterReserveShort(state)) return NONE;
  if (arableSupplyShort(state, WINTER_RESERVE_MARGIN_PERMILLE)) {
    const action = arableAction(state, buildAction as FarmsteadBuildAction, canStaffFoodExpansion(state, "farmstead"));
    if (action.kind !== "none") return action;
  }
  if (state.buildings.some(building => building.kind === "granary") || state.constructionSites.some(site => "kind" in site && site.kind === "granary")) return NONE;
  return state.idleWorkers >= BUILDING_CONFIG_BY_KIND.granary.workersRequired ? buildAction(state, "granary") : NONE;
}
