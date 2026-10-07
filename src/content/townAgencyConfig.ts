/**
 * LM-E1 (spec docs/design/town-agency.md): the town agency's numbers — who builds what, their savings, the reasons'
 * weights and the lord's conditions. Balance values, not historical figures (the week is the calendar's seventh day).
 */
import type { BuildingKind } from "./buildingConfig";
import type { ActorKind, EstatePolicy, ReasonName } from "../engine/townAgency.types";

/** TA-3: the agency's week, in ticks (a year of 4,000 ticks is 360 days; a week is seven). */
export const AGENCY_WEEK_TICKS = 78;

/** TA-2: the actors, in their order of turns. */
export const AGENCY_ACTORS: readonly ActorKind[] = ["community", "households", "merchants", "guild", "church"];

/** TA-2: who builds which kinds; every other kind is the households' (the guild's work goes to the merchants until a
 * guild is founded). A list by actor, not a table over every kind (BLD-REG: those live in the building catalog). */
export const BUILDERS: readonly (readonly [ActorKind, readonly BuildingKind[]])[] = [
  ["merchants", ["market", "storehouse", "granary", "sawmill", "masonry"]],
  ["guild", ["weaver_house", "fulling_mill", "dyehouse", "tenter_yard"]],
  ["community", ["well", "keep", "manor_house"]],
  ["church", ["chapel", "church"]],
];

export function builderOfKind(kind: BuildingKind): ActorKind {
  return BUILDERS.find(([, kinds]) => kinds.includes(kind))?.[0] ?? "households";
}

/** TA-2: an actor's funds at a town's start, pennies. */
export const ACTOR_OPENING_FUNDS: Readonly<Record<ActorKind, number>> = { community: 240, households: 240, merchants: 120, guild: 0, church: 60 };

/**
 * TA-2: each actor's savings each week, pennies:
 * - households: per lived-in house, by its level (the family's surplus once rent is paid);
 * - merchants: per lived-in house (the carrying trade) and per market stall at the lord's dues (less dues, more kept);
 * - guild: per weaver house once the guild stands; community: per household (the common purse); church: per household (tithe).
 */
export const ACTOR_WEEKLY = {
  householdsPerHouseByLevel: [1, 2, 3, 4, 5] as readonly number[],
  merchantsPerStall: 4,
  /** Before and beside the market: the carrying trade, per lived-in house. */
  merchantsPerHouse: 1,
  guildPerWeaver: 3,
  communityPerHouse: 1,
  churchPerHouse: 1,
} as const;

/** TA-4 cost: the pennies a building's materials are worth (the market's buying prices). */
export const MATERIAL_PENNIES: Readonly<Partial<Record<string, number>>> = { timber: 6, stone: 8, logs: 2, stone_raw: 3 };
/** TA-4 cost: a road tile's labour, pennies. */
export const ROAD_TILE_PENNIES = 1;

/** TA-5: a needed project (need at least this) its actor cannot pay borrows the rest from the community's purse. */
export const LOAN_NEED = 70;
/** TA-5: a proposal is started when its score reaches this and its actor can pay. */
export const START_SCORE = 40;
/**
 * DTR-15 (the user's instruction 2026-10-07): a need its builder refuses (its reasons under the start) falls to the
 * community only after it has waited a year, and costs half as much again — no merchants' capital, credit or carters;
 * the premium from the lord's treasury as far as it holds, the rest from the community's purse.
 */
export const COMMUNITY_FALLBACK = {
  waitTicks: 4_000,
  premiumPermille: 500,
  /**
   * The community's own bar for a storage need: stores holding this much of one material (timber, logs, stone) are a
   * hoard, not a want of room — it builds no barn for it (125-year runs: 11–16 storehouses round 1,000–1,800 timber).
   */
  storageHoard: 400,
} as const;
/**
 * LM-E5 (LG-2): an actor chooses by chance, not always the best: a choice's weight is exp((score − best) / spread),
 * the spread its temperament's (a cautious actor mostly takes the best, a bold one often the next). The draw is the
 * game seed's, so the same seed makes the same choices. Only the alternatives within `CHOICE_SPAN` of the best count.
 */
export const TEMPERAMENT_SPREAD = { cautious: 3, bold: 8 } as const;
export const CHOICE_SPAN = 20;
/** TA-5: projects started each week, at most, and construction sites the town keeps open, at most. */
export const STARTS_PER_WEEK = 2;
export const OPEN_SITES_MAX = 4;
/** TA-5: receipts kept (the oldest road receipts go first beyond this). */
export const RECEIPTS_KEPT = 600;

/** TA-4 need: the first planning step's weight, less this for each step further down the bot's priority list. */
export const NEED_TOP = 100;
export const NEED_STEP = 3;

/** TA-6 ①: the policy's weight on each kind of project (added to its score); lists of pairs, not tables over the kinds. */
export const POLICY_WEIGHTS: Readonly<Record<EstatePolicy, readonly (readonly [string, number])[]>> = {
  growth: [["house", 20], ["fill_plot", 20], ["market", 15], ["granary", 10], ["well", 10], ["road", 5], ["zone", 10]],
  revenue: [["market", 25], ["mill", 20], ["malt_kiln", 20], ["sawmill", 15], ["masonry", 15], ["weaver_house", 20], ["fulling_mill", 20],
    ["dyehouse", 20], ["tenter_yard", 20], ["house", -10]],
  stability: [["granary", 25], ["well", 20], ["farmstead", 20], ["chapel", 15], ["church", 15], ["storehouse", 10], ["market", -10]],
  defence: [["road", 15], ["storehouse", 20], ["quarry", 20], ["masonry", 20], ["keep", 25], ["logging_camp", 10], ["house", -10]],
};

/** TA-6 ①: a policy's weight on a project key (a building kind, "road", "zone", "fill_plot"); 0 when it has none. */
export function policyWeight(policy: EstatePolicy, key: string): number {
  return POLICY_WEIGHTS[policy].find(([name]) => name === key)?.[1] ?? 0;
}

/** TA-4: an opportunity (no need behind it) counts its policy's weight this many times. */
export const OPPORTUNITY_POLICY_FACTOR = 2;
/** TA-6 ②: a subsidy adds this many points per 10 pennies (and pays the pennies). */
export const SUBSIDY_POINTS_PER_10D = 4;
/** TA-6 ③: the merchants' projects gain this many points per 100 ‰ the dues are below the usual (lose above). */
export const DUES_POINTS_PER_100_PERMILLE = 5;
/** TA-4 risk: points lost per wooden house within two tiles of a new house (fire). */
export const FIRE_NEIGHBOUR_POINTS = 2;
/** TA-4 stuck: points a mill, granary or road gains per 100 wheat held stuck (FIX-11 stuckStock). */
export const STUCK_POINTS_PER_100 = 5;
/** TA-4: the order reasons are shown in when tied. */
export const REASON_ORDER: readonly ReasonName[] = ["need", "subsidy", "policy", "dues", "stuck", "access", "land", "plan", "relation", "risk", "cost"];

/** TA-10: a building project's candidate sites — the plan's own and at most this many in all. */
export const SITE_CANDIDATES_MAX = 5;
/** TA-10: other sites are sought within this many tiles of the plan's (each axis). */
export const SITE_SEARCH_RADIUS = 8;
/** TA-10: at most this many sites (best by their site reasons first) go through the plan's full checks. */
export const SITE_FULL_CHECKS_MAX = 12;
/** TA-10 plan: the site the bot's planning step chose (it knows the chain it serves — fields, barns, lots). */
export const PLAN_SITE_POINTS = 4;
/**
 * TA-10 land: land near the town's centre (its first market, else its houses' middle) — a home or a shop gains, a
 * workshop pays: max(0, reach − distance) ÷ step points, at most 6 either way.
 */
export const LAND_REACH = 18;
export const LAND_STEP = 3;
/** TA-10 land: the kinds that gain by the centre (every other kind pays for it). */
export const CENTRE_KINDS: readonly BuildingKind[] = ["house", "market", "well", "chapel", "church", "granary"];

/** TA-12: a town ready for its market charter holds new buildings at most this many weeks while it waits. */
export const CHARTER_HOLD_WEEKS = 8;
/** TA-12: the population the bot's era step asks before it proclaims (`autoplayEraAction`). */
export const CHARTER_POPULATION = 60;

/** TA-6 ②: the subsidies offered, together, at most this share of the treasury (‰) when one is set. */
export const SUBSIDY_TREASURY_PERMILLE = 250;
/** TA-6: lord-mode opportunity projects: kinds an actor may propose without a need when a subsidy or the policy backs them. */
// Houses come only as needs (a burgage plot, the housing step): a house on the first legal tile would break the lots' plan.
export const OPPORTUNITY_KINDS: readonly BuildingKind[] = ["market", "granary", "storehouse", "well", "mill", "malt_kiln", "chapel",
  "sawmill", "masonry", "weaver_house", "fulling_mill", "dyehouse", "tenter_yard", "farmstead", "logging_camp", "quarry"];
/** TA-13 (LM-E9b): a walk that started nothing is reused at most a season (1,000 ticks) from the tick it ran. */
export const WALK_REUSE_TICKS = 1_000;
/**
 * TA-13: a walk is reused only in a full town (the plan's housing lots all built, `LORD_MODE_POLICY.maxHousingLots`)
 * after this many weeks in a row started nothing. A growing town walks every week: reusing there slowed early growth
 * (seed 1 13 houses by 1305 against 18, seed 2 12 against 20; four idle weeks first still 15 and 14).
 */
export const WALK_REUSE_IDLE_WEEKS = 1;
