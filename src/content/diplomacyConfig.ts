/**
 * LM-E3 (spec docs/design/negotiation.md): the negotiation's numbers — the acceptance line and spread, each reason's
 * weight, what money cannot buy, the counter's margin, the promises' deadlines and stakes, the marriage's middle events.
 * Balance values in the game's pennies (a town's treasury is hundreds to thousands of pence, not Paston's £200: the
 * historical anchors set the shape — a portion, a yearly income, a debt taken on — the sizes follow the game).
 */
import type { AcceptanceTier, TermKind } from "../engine/diplomacy.types";

/** NG-3: the acceptance line θ and the spread s of σ((A − θ) / s). */
export const ACCEPT_THETA = 25;
export const ACCEPT_SPREAD = 4;
/** NG-3: the five tiers by the probability (permille, upper bounds). */
export const TIER_BOUNDS: readonly (readonly [AcceptanceTier, number])[] = [
  ["impossible", 50], ["unlikely", 350], ["close", 650], ["likely", 950], ["almost_certain", 1001],
];

/** NG-3 base: a like-rank marriage is welcome in itself. */
export const BASE_LIKE_RANK = 10;
/** NG-3 material: points per penny (or penny-year) of what the counterpart receives; all of it at most `MATERIAL_CAP`. */
export const MATERIAL_PER_PENNY: Readonly<Partial<Record<TermKind, number>>> = { cash: 1 / 40, pension: 1 / 60, debt_assumption: 1 / 30, right_piece: 1 / 40 };
export const POLITICAL_SUPPORT_POINTS = 8;
/** NG-4: money and goods count this much at most — what money cannot buy stays (rank, inheritance risk, broken word). */
export const MATERIAL_CAP = 35;
/** NG-3 political: the lord's town by its era, and its people (one point a hundred, six at most). */
export const POLITICAL_BY_ERA: Readonly<Record<string, number>> = { hamlet: 0, palisade: 6, stone_town: 10 };
export const POLITICAL_PEOPLE_CAP = 6;
/** NG-3 urgency: the counterpart's debt against its year (six points a year's worth, twelve at most), an old lord, no son. */
export const URGENCY_DEBT_PER_YEAR = 6;
export const URGENCY_DEBT_CAP = 12;
export const URGENCY_OLD_LORD = 4;
export const URGENCY_NO_SON = 4;
/** NG-3 concession: what each term the counterpart gives costs it (land_use by the piece's worth, at most 15). */
export const CONCESSION_COST: Readonly<Partial<Record<TermKind, number>>> = { consent: 0, inheritance_non_infringement: 10, residence: 2, wardship: 12 };
export const LAND_USE_COST_PER_PENNY = 1 / 40;
export const LAND_USE_COST_CAP = 15;
/** NG-4 floors: a lord demoted, an heiress given out of the house, each promise broken to this house (−45 at most). */
export const RANK_GAP_POINTS = 15;
export const INHERITANCE_RISK_POINTS = 10;
export const BROKEN_PROMISE_POINTS = 15;
export const BROKEN_PROMISE_CAP = 45;
/** NG-4: a term past the counterpart's red line makes the offer impossible whatever else it holds. */
export const RED_LINE_POINTS = 100;
/** NG-3 trust: each promise kept to this house, eighteen at most. */
export const KEPT_PROMISE_POINTS = 6;
export const KEPT_PROMISE_CAP = 18;
/** NG-3 relation: half the relation with the house. */
export const RELATION_SHARE = 0.5;

/** NG-5: the counter lifts the score this far over the line, plus the counterpart's greed (0…6, from the seed). */
export const COUNTER_MARGIN = 4;
export const GREED_MAX = 6;
/** NG-5: the order the counterpart asks for things (its most wanted first). */
export const COUNTER_DESIRES: readonly TermKind[] = ["debt_assumption", "cash", "pension", "political_support"];
/**
 * FIX-12 (item 1, NG-5a): a debt is taken on by instalments (deeds paid year by year): a year's instalment is at most
 * this share of the lord's estates' year, over five years at most. A debt the lord cannot carry so is not asked.
 */
export const DEBT_INSTALMENT_SHARE = 0.25;
export const DEBT_INSTALMENT_MAX_YEARS = 5;
/** NG-5: a counter is answered within a season, else it lapses. */
export const COUNTER_ANSWER_TICKS = 1000;

/** NG-6: when the promises fall due, and what a breach costs. */
export const PROMISE_PAYMENT_TICKS = 4000;
export const PROMISE_SUPPORT_TICKS = 8000;
export const PROMISE_STAKE = { trust: 15, relation: 20 } as const;
/** NG-6: the marriage contract is made before these factions (they remember a breach). */
export const MARRIAGE_WITNESSES: readonly string[] = ["bishop", "overlord"];
/** NG-6: a breach costs each witness this much relation. */
export const WITNESS_RELATION_LOSS = 5;
/** NG-7: a contract made raises the relation with the house. */
export const CONTRACT_RELATION_GAIN = 10;

/** NG-7: a groom is a man of the lord's house this old (FIX-12: up to 60 — a widowed lord, a cousin), unmarried. */
export const GROOM_MIN_AGE = 14;
export const GROOM_MAX_AGE = 60;
/** NG-9 (FIX-12): the lord-mode bot's one offer waits for this much in the treasury (and an estate year paid in). */
export const BOT_OFFER_TREASURY = 600;

/** NG-8: the middle events after the contract (ticks from it) and their chances (permille, from the seed). */
export const MARRIAGE_TIMES = {
  brideArrives: 1000, childBorn: 4000, brotherInLaw: 6000, fatherIll: 12_000, willChange: 14_000, willAnswer: 1000, fatherDies: 18_000,
} as const;
export const BROTHER_IN_LAW_PERMILLE = 300;
export const WILL_CHANGE_PERMILLE = 500;
/** NG-8: a brother-in-law born lowers the expectation; the counterpart's broken non-infringement raises it. */
export const BROTHER_IN_LAW_CLAIM_LOSS = 30;
export const BREACHED_NON_INFRINGEMENT_GAIN = 15;
/** NG-8: the favour that talks the old lord out of a new will, pennies. */
export const WILL_FAVOUR_PENNIES = 120;
