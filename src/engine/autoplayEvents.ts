/**
 * F0-B bot steps for events (spec docs/design/flow-events.md EV-7): rebuild burnt houses, and plant for a rumoured or
 * signed dearth. The naive variant (`--naive-reserve`, FP-6) rebuilds too (rebuilding is not a reserve measure) but
 * does not stock up for the dearth.
 */
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import { EVENT_DEF_BY_ID } from "../content/eventConfig";
import { foodReserveTicks } from "../population/foodReserve";
import { isBuildingConstructionSite } from "../economy/construction";
import type { FamineResponseAdvice, PetitionResponseAdvice, RebuildHouseAdvice } from "./autoplayBotRecovery";
import type { FamineResponseChoice, PetitionResponse } from "../content/chapterConfig";
import { famineStatus, openPetitions } from "./politics";
import type { GameState } from "./engine.types";
import { eventForecast } from "./eventSchedule";

/** EV-7: the first burnt house (by id) with no rebuild site yet, or null. */
export function rebuildBurntHouseAction(state: GameState): RebuildHouseAdvice | null {
  const rebuilding = new Set(state.constructionSites.flatMap(site => isBuildingConstructionSite(site) && site.rebuildOf !== undefined ? [site.rebuildOf] : []));
  const burnt = state.houses.filter(house => house.burntTick !== undefined && !rebuilding.has(house.buildingId))
    .map(house => house.buildingId).sort();
  return burnt[0] === undefined ? null : { kind: "rebuild_house", buildingId: burnt[0] };
}

/** A dearth is rumoured, signed or arriving. */
function dearthComing(state: GameState): readonly number[] {
  return eventForecast(state).flatMap(entry => entry.kind === "dearth" && (entry.stage === "rumour" || entry.stage === "sign" || entry.stage === "arrival")
    ? [EVENT_DEF_BY_ID.get(entry.defId)?.harvestPermille ?? 1000] : []);
}

/**
 * EV-7: while a dearth is coming or arriving, the standard bot adds no house until the stored food lasts
 * `DEARTH_HOLD_TICKS` (two seasons) — the town does not grow into a bad harvest.
 */
export const DEARTH_HOLD_TICKS = 4 * PRESSURE_BALANCE.seasonTicks;

export function dearthHoldsGrowth(state: GameState): boolean {
  return dearthComing(state).length > 0 && (foodReserveTicks(state) ?? Infinity) < DEARTH_HOLD_TICKS;
}

/**
 * EV-7: the arable margin while a dearth is rumoured, signed or arriving: the usual margin ÷ the dearth's harvest share
 * (1.2 ÷ 0.7 ≈ 1.72), so the fields sown before the bad summer still feed the town; the usual margin otherwise.
 */
export function dearthArableMargin(state: GameState, margin: number): number {
  // FC-6: at most × 1.5 (a famine's half harvest would double the fields; the reserve hold does the rest).
  const harvest = Math.max(667, Math.min(1000, ...dearthComing(state)));
  return harvest >= 1000 ? margin : Math.ceil(margin * 1000 / harvest);
}

/** FC-6: the bot's answer to an arriving famine it has not answered, then to an open petition; null when none waits. */
export function chapterDecisionAction(state: GameState, famine: FamineResponseChoice, petition: PetitionResponse): FamineResponseAdvice | PetitionResponseAdvice | null {
  if ((famineStatus(state)?.choices.length ?? 0) > 0) return { kind: "famine_response", choice: famine };
  const open = openPetitions(state)[0];
  return open === undefined ? null : { kind: "petition_response", petitionId: open.id, response: petition };
}
