/**
 * FAIL-3 lordship (spec docs/design/failure-ladder-campaign.md FL-*): the failure ladder's third and fourth rungs — the
 * lord's rights, title and house. Integers: permille for shares, pennies for money, ticks for time.
 */
import { LORD_HOUSE_SURNAMES } from "./gentryNames";
export const LORDSHIP_BALANCE = {
  /** FL-3: a town of `minHouses` houses or more declines when this share of them stands derelict (FP-3 stage 2). */
  derelictPermille: 300,
  minHouses: 8,
  /**
   * FIX-5 (FL-13): a town fallen under this share of its chapter's starting population declines at once (checked at
   * every ladder sample, not the season's start); an empty town declines and its house withdraws at once (FL-14).
   */
  depopulatedPermille: 300,
  /**
   * FL-14 (FIX-5b): the settlers the new house brings in each standing house (one household) come with a season of
   * bread each — into a granary with room, else into their houses — and a meal's grace for the carts to bring it.
   */
  resettleBreadTicks: 1_000,
  resettleGraceTicks: 400,
  /** FL-3: unpaid upkeep spread over this many distinct ledger periods. */
  arrearsPeriods: 4,
  /** FL-6: the restoration's price; haggled down, the title comes back `titleReturnTicks` later. */
  restoreFee: 100,
  restoreFeeHaggled: 50,
  titleReturnTicks: 4_000,
  /** FL-6: a refused (or unpaid) restoration petition comes again this much later. */
  restoreRetryTicks: 4_000,
  /** FL-7: stage 3 unbroken this long replaces the lord's house, which takes this share of the treasury with it. */
  houseChangeTicks: 8_000,
  houseChangeTreasuryLossPermille: 500,
  /** FL-11: the bot builds no new upkeep facility from this many arrears periods, and puts food before homes from this dereliction. */
  botArrearsPeriods: 2,
  botDerelictPermille: 200,
} as const;

/** FL-1: the lord's own rights (franchises), each an income the period close pays while it is held. */
export type LordRightId = "market" | "tolls" | "mill";
export const LORD_RIGHT_IDS = ["market", "tolls", "mill"] as const satisfies readonly LordRightId[];
/** FL-1: the ledger income each right pays. */
export const LORD_RIGHT_INCOME = { market: "stall_fee", tolls: "toll", mill: "mill_toll" } as const satisfies Record<LordRightId, string>;
/** FL-4: breach-based suspension (the overlord, for arrears) takes the tolls first; unilateral seizure (the merchants, for dereliction) the market. */
export const SUSPENSION_ORDER = ["tolls", "mill", "market"] as const satisfies readonly LordRightId[];
export const SEIZURE_ORDER = ["market", "mill", "tolls"] as const satisfies readonly LordRightId[];

/** FL-2: the lord's title from the era, lowest first. */
export type LordTitleRank = "manor" | "market" | "borough";
export const TITLE_RANKS = ["manor", "market", "borough"] as const satisfies readonly LordTitleRank[];

/** FL-7: the lord's houses (by seed and order) — invented Anglo-Norman surnames (FIX-5, decision FN11). */
export const LORD_HOUSE_NAMES = LORD_HOUSE_SURNAMES;

/**
 * MANOR-1 (HOUSE-1): the player's house — the lord's first house in every game — when the new game names none: its
 * name (one of `LORD_HOUSE_NAMES`) and its arms' id (the arms are drawn from `armsHeraldrySeed(arms)`).
 */
export const DEFAULT_PLAYER_HOUSE = { name: "de Haverel", arms: "haverel" } as const;
