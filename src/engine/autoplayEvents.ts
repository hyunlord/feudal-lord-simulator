/**
 * F0-B bot steps for events (spec docs/design/flow-events.md EV-7): rebuild burnt houses, and plant for a rumoured or
 * signed dearth. The naive variant (`--naive-reserve`, FP-6) rebuilds too (rebuilding is not a reserve measure) but
 * does not stock up for the dearth.
 */
import { LAND_REDISTRIBUTION_PETITION_ID, PLAGUE_PETITION_IDS } from "../content/plagueConfig";
import { REORGANISATION_PETITION_IDS } from "../content/reorganisationConfig";
import { LEGACY_PETITION_IDS } from "../content/legacyConfig";
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import { EVENT_DEF_BY_ID } from "../content/eventConfig";
import { foodReserveTicks } from "../population/foodReserve";
import { isBuildingConstructionSite } from "../economy/construction";
import type { FamineResponseAdvice, PetitionResponseAdvice, RebuildHouseAdvice } from "./autoplayBotRecovery";
import { RESTORE_RIGHT_PETITION_ID, type FamineResponseChoice, type PetitionResponse } from "../content/chapterConfig";
import { LORDSHIP_BALANCE } from "../content/lordshipConfig";
import { LEVY_RESPONSE_PETITION_ID, REFUGEE_ADMISSION_PETITION_ID, WALL_OR_MARKET_PETITION_ID, WAR_BALANCE, WAR_FUNDING_PETITION_ID,
  WAR_PETITION_IDS, WOOL_PAYMENT_PETITION_ID } from "../content/warConfig";
import { levyMen, refugeeRoom, woolLevyAmount } from "./war";
import { canProclaimStoneTownEra } from "./era";
import { treasuryBalance } from "../ledger/ledger";
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
export function chapterDecisionAction(state: GameState, famine: FamineResponseChoice, petition: PetitionResponse,
  restoration: "pay" | "refuse" = "pay", wallChoice?: "wall" | "market"): FamineResponseAdvice | PetitionResponseAdvice | null {
  if ((famineStatus(state)?.choices.length ?? 0) > 0) return { kind: "famine_response", choice: famine };
  const open = openPetitions(state)[0];
  if (open === undefined) return null;
  // FAIL-3 (FL-11): a restoration is bought back when the treasury has the fee, haggled when it has half (the naive
  // variant refuses: it never pays for a right).
  if (open.defId === RESTORE_RIGHT_PETITION_ID) {
    const cash = treasuryBalance(state);
    const response: PetitionResponse = restoration === "refuse" ? "refuse"
      : cash >= LORDSHIP_BALANCE.restoreFee ? "accept" : cash >= LORDSHIP_BALANCE.restoreFeeHaggled ? "accept_with_price" : "refuse";
    return { kind: "petition_response", petitionId: open.id, response };
  }
  // F2-A (WR-10): the war's decisions by the bot's own rule.
  if ((WAR_PETITION_IDS as readonly string[]).includes(open.defId)) return { kind: "petition_response", petitionId: open.id, response: warAnswer(state, open.defId, wallChoice) };
  // F3-A (PL-11): the pestilence's decisions by the bot's standard rule — the monastery's priest, wages raised, new
  // settlers into the empty plots, labour services commuted to money rent.
  if ((PLAGUE_PETITION_IDS as readonly string[]).includes(open.defId)) {
    return { kind: "petition_response", petitionId: open.id, response: open.defId === LAND_REDISTRIBUTION_PETITION_ID ? "accept_with_price" : "accept" };
  }
  // F4-A (RG-11): the reorganisation's by the bot's standard rule — the guild granted, the tax left to the town, the
  // demesne turned to cloth, the charter granted in part (every card's `accept`).
  if ((REORGANISATION_PETITION_IDS as readonly string[]).includes(open.defId)) return { kind: "petition_response", petitionId: open.id, response: "accept" };
  // F5-A (LG-10): chapter 5's by the bot's standard rule — the Crown paid, the eldest son (else the first heir there
  // is), the charter sealed, the town's legacy (every card's `accept`, the heir's the first it offers).
  if ((LEGACY_PETITION_IDS as readonly string[]).includes(open.defId)) return { kind: "petition_response", petitionId: open.id, response: open.options?.[0] ?? "accept" };
  return { kind: "petition_response", petitionId: open.id, response: petition };
}

/** Coins the bot keeps back when it pays a war charge in cash. */
const WAR_CASH_RESERVE = 50;

/**
 * F2-A (WR-10): wool and the exemption in cash when the treasury has them and a reserve (else in kind, else the men),
 * the subsidy on the merchants' loan, refugees as far as the empty homes and room hold them, and the stone wall only
 * when its project can begin now or has (with murage while the Crown favours the town) — else the market, which ends
 * the chapter rather than leave a wall unbuilt at 1348 (the first run: every seed chose murage and built too late).
 */
function warAnswer(state: GameState, defId: string, wallChoice?: "wall" | "market"): PetitionResponse {
  const cash = treasuryBalance(state);
  switch (defId) {
    case WOOL_PAYMENT_PETITION_ID: return cash >= woolLevyAmount(state) + WAR_CASH_RESERVE ? "accept_with_price" : "accept";
    case LEVY_RESPONSE_PETITION_ID: return cash >= levyMen(state) * WAR_BALANCE.exemptionPerMan + WAR_CASH_RESERVE ? "accept_with_price" : "accept";
    case WAR_FUNDING_PETITION_ID: return "accept";
    case REFUGEE_ADMISSION_PETITION_ID: {
      const room = refugeeRoom(state);
      const all = WAR_BALANCE.refugeeHouseholds * WAR_BALANCE.refugeesPerHousehold;
      return room >= all ? "accept" : room >= all / 2 ? "accept_with_price" : "refuse";
    }
    case WALL_OR_MARKET_PETITION_ID: {
      if (wallChoice === "market") return "refuse";
      const wall = state.war?.favour === true ? "accept_with_price" : "accept";
      return wallChoice === "wall" || state.era === "stone_town" || canProclaimStoneTownEra(state) ? wall : "refuse";
    }
    default: return "accept";
  }
}
