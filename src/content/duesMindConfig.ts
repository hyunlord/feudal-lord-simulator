/**
 * DUES-REL (docs/design/dec-trace.md §3, decision DTR-18; the user's instruction 2026-10-08): the merchant houses' mind
 * follows the stall fee as it stands, not each change of it. While the fee is above the level agreed with them (a registry
 * answer that set it, for ten years) or, without one, the custom, they sour a little each season; below it they warm a
 * little. The lord who raises it over an agreement of his own breaks it: once, sharply.
 */
import { BALANCE } from "./balanceConfig";

export const DUES_MIND = {
  /** The custom: the usual fee (permille of the usual stall fee). */
  customPermille: 1000,
  /** Each season, one point per this much above or below the reference, at most `seasonCap`. */
  stepPermille: 100,
  seasonCap: 3,
  /** The season's souring stops here, its warming there (a fee held high is a grievance, not a rupture). */
  floor: -40,
  ceiling: 30,
  /** An agreed fee binds this long. */
  agreementTicks: 10 * BALANCE.TICKS_PER_YEAR,
  /** An agreement broken: the house it was made with, the other. */
  breachParty: -15,
  breachOther: -5,
} as const;

/** The houses the fee touches. */
export const DUES_FACTIONS: readonly string[] = ["merchant_house_1", "merchant_house_2"];
