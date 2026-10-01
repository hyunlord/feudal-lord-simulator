/**
 * LM-E4 (spec docs/design/stewardship.md): the numbers of delegation, attention and the audit. Pennies are the game's;
 * an off-map estate's season is a quarter of its card's year (the third neighbour's estate: 4,000d a year).
 */
import type { EstatePetitionKind, StewardDisposition } from "../engine/stewardship.types";

/** SW-1: the estates a lord oversees himself (the home estate is one) — two, more with a grown heir at home, fewer when old or a ward, or for a year after an audit visit. */
export const ATTENTION_BASE = 2;
export const ATTENTION_HEIR = 1;
export const ATTENTION_OLD_AGE = 60;
export const ATTENTION_AGE_LOSS = 1;
export const ATTENTION_VISIT_LOSS = 1;
/** SW-1: an overloaded lord's direct estate — its petitions reach him a season late (relation lost), its books err more. */
export const OVERLOAD_PETITION_DELAY = 1000;
export const OVERLOAD_WAIT_RELATION = 3;
export const OVERLOAD_ERROR_PERMILLE = 200;

/** SW-3: each disposition's dues (rent, market dues, permille of the old rate) and how it answers each group. */
export const DISPOSITION_RATES: Readonly<Record<StewardDisposition, { readonly rent: number; readonly dues: number }>> = {
  merchant: { rent: 1000, dues: 800 }, peasant: { rent: 850, dues: 1000 }, greedy: { rent: 1150, dues: 1150 },
};
/** SW-3: a direct estate keeps the old rates. */
export const DIRECT_RATES = { rent: 1000, dues: 1000 } as const;
/** SW-3: an estate's year is rent (seven tenths) and market dues (three tenths). */
export const RENT_SHARE = 700;
/** SW-3: a rate above the old one costs the group's goodwill each season (per permille over), one below gains it. */
export const RATE_RELATION_PER_PERMILLE = 0.04;
/** SW-3: an estate whose tenants are this sour yields a fifth less. */
export const SOUR_TENANTS = -30;
export const SOUR_YIELD_LOSS = 200;

/** SW-3: a steward keeps back permille of a season: a greedy one 100 + (100 − loyalty), another (100 − loyalty) / 2; a third of it when the lord oversees directly. */
export const GREEDY_KEEP_BASE = 100;
export const DIRECT_KEEP_SHARE = 333;
/** SW-3: a season's books err with (100 − ability) × 2.5 permille, a tenth of the season lost. */
export const ERROR_PER_ABILITY = 2.5;
export const ERROR_SHARE = 100;

/** SW-4: each kind of petition — its group, its size (permille of a season), whether it touches a right or a marriage. */
export const PETITION_KINDS: Readonly<Record<EstatePetitionKind, { readonly group: "tenants" | "merchants"; readonly size: readonly [number, number];
  readonly rights?: true; readonly marriage?: true }>> = {
  rent_relief: { group: "tenants", size: [150, 300] }, market_dues: { group: "merchants", size: [100, 200] },
  repair: { group: "tenants", size: [200, 400] }, common_dispute: { group: "tenants", size: [0, 0] },
  charter_request: { group: "merchants", size: [50, 100], rights: true }, marriage_licence: { group: "tenants", size: [20, 60], marriage: true },
};
/** SW-4: a petition granted or refused moves its group (a dispute: the side favoured and the other). */
export const GRANT_RELATION = 8;
export const REFUSE_RELATION = -6;
/** SW-4: a repair refused wears the estate (its card's year, permille). */
export const NEGLECT_PERMILLE = 20;
/** SW-4: a petition brought to the lord is answered within a season, else it lapses (refused, and the wait remembered). */
export const PETITION_ANSWER_TICKS = 1000;

/** SW-5: the lord's exceptions at first (none: the steward decides all). */
export const DEFAULT_RULES = { amountAtLeast: null, rights: false, marriage: false } as const;

/** SW-6: Michaelmas (29 September, the autumn's 29th day) in the year's ticks; the accounting year runs Michaelmas to Michaelmas. */
export const MICHAELMAS_IN_YEAR = 2320;
/** SW-6: the audit finds what was kept back by permille: by letter 300, a visit 850, plus (100 − ability) × 3. Errors always show. */
export const AUDIT_FIND = { accounts: 300, visit: 850 } as const;
export const AUDIT_FIND_PER_ABILITY = 3;
/** SW-6: a punishment recovers half of what was found; the tenants approve, the steward's faction does not. */
export const PUNISH_RECOVERY = 500;
export const PUNISH_TENANTS = 5;
export const PUNISH_CONNECTION_RELATION = -5;
export const TOLERATE_LOYALTY = 10;
/** SW-6: the lord answers an audit within a season (unanswered: tolerated). */
export const AUDIT_ANSWER_TICKS = 1000;

/** SW-7: the seasons of summaries kept for each estate. */
export const SUMMARIES_KEPT = 8;
