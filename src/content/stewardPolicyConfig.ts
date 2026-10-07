/**
 * DEC-TRACE §1 (docs/design/dec-trace.md, game principles P-T3·P-D5, decision GP-7): the layers of decision. Small
 * matters are the steward's from the first, answered by the lord's standing policy for their kind; only the heavy ones
 * (rights, land, marriage, inheritance, wardship, a large sum, a promise of years, a faction's rupture, a crisis) come
 * to the lord. Lord mode only.
 */
import type { HomePetitionKind } from "../engine/stewardship.types";

/**
 * The lord's standing policy for a kind of small matter: as custom has it, lightly (the petitioner's side), strictly
 * (the purse's and the lord's rights' side), or "bring it to me".
 */
export const STANDING_SETTINGS = ["customary", "lenient", "strict", "lord"] as const;
export type StandingSetting = (typeof STANDING_SETTINGS)[number];
export const DEFAULT_STANDING_SETTING: StandingSetting = "customary";

/**
 * The customary answer to each home petition (true: granted). Manor custom: the heriot, the wardship's profit, the
 * pannage and the ale fines are taken; suit of the mill is owed; a merchet is licensed for its fine, a newcomer
 * admitted for his entry fine; the common's stint and the old bounds stand; a stall stays with its holder; the lord
 * repairs the road, the bridge and (as rector) the chancel.
 */
export const HOME_PETITION_CUSTOM: Readonly<Record<HomePetitionKind, boolean>> = {
  boundary_dispute: true,
  mill_suit: false,
  heriot: false,
  merchet: true,
  ale_fines: false,
  road_bridge: true,
  stall_dispute: false,
  wardship: false,
  common_pasture: true,
  newcomer: true,
  pannage: false,
  chancel_repair: true,
};

/** P-D5: the kinds of weight that bring a matter to the lord. */
export const DECISION_WEIGHTS = ["rights", "land", "marriage", "inheritance", "wardship", "large_sum", "years_promise", "faction_rupture", "crisis"] as const;
export type DecisionWeight = (typeof DECISION_WEIGHTS)[number];

export const DECISION_WEIGHT_BALANCE = {
  /** The user's decision (2026-10-06): a large sum is a tenth of the estate's year of income, a pound at least. */
  largeSumPermille: 100,
  largeSumFloor: 240,
  /** A choice that could take a faction's relation to this or below is a rupture. */
  ruptureRelation: -60,
  /** P-T1: heavy decisions a year that come to the lord, at most (the gate's 1~4). */
  heavyPerYear: 4,
  /**
   * DTR-14: the registry's heavy offer waits when this many heavy matters already came to the lord within the year —
   * one place kept for what cannot wait (a crisis petition, an audit, an estate's large sum).
   */
  registryCrowded: 3,
} as const;

/**
 * P-T1: the lord's own initiatives (a suit he files and presses, a marriage he proposes and its promises he keeps, his
 * settings) are not matters that came to him; their keys (`TracedDecision.source`) start with these.
 */
export const LORD_INITIATIVES = ["file_suit", "add_suit_evidence", "seek_suit_patron", "enforce_possession", "propose_marriage", "keep_promise",
  "set_estate_oversight", "set_audit_mode", "set_exception_rules", "set_estate_policy", "set_project_subsidy", "set_market_dues", "order_timber",
  "set_standing_policy"] as const;

/** The weight a registry command carries by itself (the rest weigh by their sums, or nothing). */
export const COMMAND_WEIGHT: Readonly<Record<string, DecisionWeight>> = {
  propose_marriage: "marriage",
  answer_counter: "marriage",
  keep_promise: "marriage",
  answer_will_change: "inheritance",
  file_suit: "rights",
  add_suit_evidence: "rights",
  enforce_possession: "land",
  // Who governs an estate and who is answerable for it is the land's matter (a steward does not judge his own audit).
  set_estate_oversight: "land",
  set_audit_mode: "land",
  answer_audit: "land",
  petition_response: "crisis",
  famine_response: "crisis",
};
