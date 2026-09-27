/**
 * Plot settlement (FIX-4 E6, spec docs/design/human-play-rules.md HR-6). Households move in and build on painted
 * burgage plots in every game: the player's as well as the bot's. Before this only the bot's ZoneFillAgent filled
 * plots, so a player who painted plots saw them stay empty for good (new houses may stand only inside plots once one
 * is painted).
 *
 * - Every `ZONE_SETTLEMENT.cadenceTicks` (the bot's decision cadence, so a town fills as fast as auto growth does)
 *   one L0 house is placed on the first empty plot, through the ordinary placement rules (`placeBuilding`).
 * - Only while newcomers would come: no household is starving or getting ready to leave (FP-3 stage 1), and fewer
 *   than `ZONE_SETTLEMENT.maxWaitingHomes` homes wait for their first household (standing empty houses and house
 *   sites; burnt and abandoned houses have their own rules). A plot house without water or bread therefore stops the
 *   next one instead of a row of empty houses going up.
 * - Plot order, the in-progress cap and the labour check are ZoneFillAgent's (`planZoneFill`).
 */
import { ZONE_SETTLEMENT } from "../content/zoneConfig";
import { isBuildingConstructionSite } from "../economy/construction";
import type { GameState } from "../engine/engine.types";
import { placeBuilding } from "../engine/gameActions";
import { houseIsStarving } from "../population/houseFood";
import { planZoneFill, type ZoneFillDiagnosis } from "./zoneFillAgent";
import { zoneRuleActive } from "./zonePlacement";

/** HR-6: homes waiting for their first household — standing empty houses (not burnt or abandoned) and house sites. */
export function homesAwaitingHouseholds(state: Pick<GameState, "houses" | "constructionSites">): number {
  const empty = state.houses.filter(house => house.residents <= 0 && house.burntTick === undefined && house.abandonedTick === undefined).length;
  return empty + state.constructionSites.filter(site => isBuildingConstructionSite(site) && site.kind === "house").length;
}

/** HR-6: a household is starving or getting ready to leave, so no newcomer comes. */
export function townHungry(state: Pick<GameState, "houses" | "tick">): boolean {
  return state.houses.some(house => house.leavingSinceTick !== undefined || houseIsStarving(house, state.tick));
}

export type ZoneSettlementStatus =
  | { readonly kind: "no_zone" }
  | { readonly kind: "hungry" }
  | { readonly kind: "homes_waiting"; readonly homes: number }
  | { readonly kind: "blocked"; readonly reason: ZoneFillDiagnosis }
  | { readonly kind: "settling"; readonly parcelId: string; readonly tile: { readonly tx: number; readonly ty: number } }
  | { readonly kind: "full" };

/** HR-6: what plot settlement would do now (for the next cadence tick and the plot panel). */
export function zoneSettlementStatus(state: GameState): ZoneSettlementStatus {
  if (!zoneRuleActive(state, "burgage")) return { kind: "no_zone" };
  if (townHungry(state)) return { kind: "hungry" };
  const homes = homesAwaitingHouseholds(state);
  if (homes >= ZONE_SETTLEMENT.maxWaitingHomes) return { kind: "homes_waiting", homes };
  const plan = planZoneFill(state);
  const next = plan.placements[0];
  if (next !== undefined) return { kind: "settling", parcelId: next.parcelId, tile: next.tile };
  const blocked = plan.blocked[0];
  return blocked === undefined ? { kind: "full" } : { kind: "blocked", reason: blocked.reason };
}

/** One tick of plot settlement: on cadence ticks, a household builds on the first empty plot when newcomers would come. */
export function advanceZoneSettlement(state: GameState): GameState {
  if (state.tick <= 0 || state.tick % ZONE_SETTLEMENT.cadenceTicks !== 0 || !zoneRuleActive(state, "burgage")) return state;
  const status = zoneSettlementStatus(state);
  return status.kind === "settling" ? placeBuilding(state, "house", status.tile) : state;
}
