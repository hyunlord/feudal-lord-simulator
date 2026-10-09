/**
 * LM-E1 (spec docs/design/town-agency.md TA-1…TA-9): lord mode's town agency — the town's actors propose projects each
 * week with named reason scores and build them; the lord sets the conditions (estate policy, subsidies, market dues).
 */
import type { BuildingKind } from "../content/buildingConfig";

/** TA-2: who builds in the town. */
export type ActorKind = "households" | "merchants" | "guild" | "community" | "church";

/** TA-6 ①: the estate's policy — it weighs the reasons. */
export type EstatePolicy = "growth" | "revenue" | "stability" | "defence";

/** TA-4: the named reasons of a proposal's score. */
export type ReasonName = "need" | "access" | "cost" | "policy" | "subsidy" | "dues" | "risk" | "relation" | "stuck" | "land" | "plan";

export interface Reason { readonly name: ReasonName; readonly value: number }

/** LM-E5 (LG-2): how an actor chooses — mostly the best (cautious) or often the next (bold); from the game seed. */
export type Temperament = "cautious" | "bold";

/** LM-E5 (LG-2): a choice made by chance — the chosen option's probability (permille) among how many, by which temperament. */
export interface ChoiceChance {
  readonly permille: number;
  readonly of: number;
  readonly temperament: Temperament;
  /** The chosen option's place among them by score (1 = the best). */
  readonly place: number;
}

export interface AgencyActor {
  readonly kind: ActorKind;
  /** Pennies the actor holds for building. */
  readonly funds: number;
}

/** TA-6 ②: a subsidy the lord offers for a kind of project, paid from the treasury when one is started. */
export interface ProjectSubsidy {
  readonly id: string;
  readonly kind: BuildingKind;
  /** Pennies per project started. */
  readonly amount: number;
}

/** TA-5: why a project was started where it was. */
export interface ProjectReceipt {
  readonly id: string;
  readonly tick: number;
  readonly actor: ActorKind;
  /** The project: a building kind, a road, a zone painted. */
  readonly what: string;
  /** Its site (a building's or a road's first tile), and the construction site id when it made one. */
  readonly tx: number;
  readonly ty: number;
  readonly siteId: string | null;
  /** The need that raised it (the bot's planning step), or "opportunity"; the step's rank in the bot's list (null then). */
  readonly planner: string;
  readonly rank: number | null;
  /** The five largest reasons by size, and the score. */
  readonly reasons: readonly Reason[];
  readonly score: number;
  /** Pennies it cost the actor, and the subsidy paid. */
  readonly cost: number;
  readonly subsidy: number;
  /** Pennies borrowed from the community's purse (TA-5). */
  readonly loan: number;
  /** The lord's decisions in force that moved its score (policy, subsidy, dues): their ledger record ids (TA-6). */
  readonly decisionIds: readonly string[];
  /** TA-10: the sites compared (absent on receipts before v37, and on roads, zones and house works: one site). */
  readonly sites?: ReceiptSites;
  /** LM-E5 (LG-2): chosen by chance — the project among the week's, and its site among its sites (absent before v43). */
  readonly chance?: { readonly project: ChoiceChance; readonly site?: ChoiceChance };
  /** TA-13 (LM-E9b): started from a reused week's judgement — the tick of the walk reused (absent when walked this week). */
  readonly reusedWalk?: number;
  /**
   * DTR-15 (save v52): a need its builder refused, taken up by the community after the wait — the builder, the tick it
   * first refused, and the premium the community's want of capital cost (pennies), of which the treasury paid this much.
   */
  readonly fallback?: { readonly builder: ActorKind; readonly since: number; readonly premium: number; readonly treasury: number };
}

/** DTR-15: a need its builder will not take up — what, who, since when (the community takes it up after the wait). */
export interface RefusedNeed {
  readonly what: string;
  readonly builder: ActorKind;
  readonly since: number;
}

/** TA-10: the candidate sites of a building project — how many, the plan's own, the chosen one's and the next best's. */
export interface ReceiptSites {
  /** Candidates compared (the plan's site and the others that passed its checks). */
  readonly count: number;
  /** The site the bot's planning step chose. */
  readonly planTx: number;
  readonly planTy: number;
  /** The chosen site's site reasons (access, land, risk, plan). */
  readonly reasons: readonly Reason[];
  /** The next best candidate: its site, its site reasons and its whole score; null with one candidate. */
  readonly runnerUp: { readonly tx: number; readonly ty: number; readonly reasons: readonly Reason[]; readonly score: number } | null;
}

/** TA-7: a request the town makes of its lord — the era's proclamation, the wall's priority, timber from the traders. */
export type LordRequest = Extract<import("./autoplay.types").AutoplayAction,
  { readonly kind: "proclaim_era" | "set_wall_construction_priority" | "order_timber" }>;

/** TA-6 ②: why a subsidy was refused — the subsidies offered would pass a quarter of the treasury. */
export interface SubsidyRefusal {
  readonly reason: "over_treasury_share";
  readonly tick: number;
  readonly kind: BuildingKind;
  readonly amount: number;
  /** The subsidies offered with this one, and the most the treasury allows (pennies). */
  readonly total: number;
  readonly limit: number;
}

export interface AgencyState {
  readonly actors: readonly AgencyActor[];
  readonly policy: EstatePolicy;
  readonly subsidies: readonly ProjectSubsidy[];
  /** TA-6 ③: the stall-fee rate the lord asks, permille of the usual (1000). */
  readonly duesPermille: number;
  readonly receipts: readonly ProjectReceipt[];
  readonly nextReceipt: number;
  readonly nextSubsidy: number;
  /** TA-7, TA-11: what the town asks of its lord this week (absent before the first week, and on v36 saves). */
  readonly requests?: readonly LordRequest[];
  /** TA-11: the layout (`needsLayoutKey`) on which the charter's wall search last found no wall (absent otherwise). */
  /**
   * GB-1 (GROW-BLOCK): the charter wall search's last failure — when, why (`CharterWallFailureReason`), the homes a wall
   * would have cut from their service space, and how many searches failed in a row (the next starts elsewhere).
   */
  readonly charterWallFailure?: { readonly tick: number; readonly reason: CharterWallFailureReason; readonly homes: readonly string[]; readonly attempts: number };
  readonly charterWallTried?: string;
  /** TA-12: the tick the town first stood ready for its market charter (absent when it is not waiting). */
  readonly charterSince?: number;
  /** TA-6 ②: the last subsidy refused, with its reason (absent when none was). */
  readonly lastRefusal?: SubsidyRefusal;
  /** TA-13 (LM-E9b, save v48): the last week's walk, kept while it started nothing (absent otherwise and before v48). */
  readonly lastWalk?: AgencyWalk;
  /** DTR-15 (save v52): the needs their builders refuse, while they do (absent when none). */
  readonly refusedNeeds?: readonly RefusedNeed[];
  /** DUES-REL (save v53): the stall fee agreed at a registry answer (absent when none was). */
  readonly duesAgreement?: DuesAgreement;
}

/** DUES-REL: a stall fee agreed with a faction at a registry answer — its rate, when, with whom, the answer; when broken. */
export interface DuesAgreement {
  readonly permille: number;
  readonly tick: number;
  readonly faction: string;
  readonly occurrenceId: string;
  /** The tick the lord raised the fee above it himself (the agreement ends). */
  readonly brokenTick?: number;
}

/** TA-13: a week's walk kept for the next weeks while nothing changes — its needs, proposals and requests. */
export interface AgencyWalk {
  /** The tick the walk ran (a reused walk keeps it). */
  readonly tick: number;
  /** The layout and the lord's conditions it ran on (`walkKey`). */
  readonly key: string;
  readonly needs: readonly import("./autoplay").PlanningNeed[];
  readonly proposals: readonly import("./townAgency").Proposal[];
  readonly requests: readonly LordRequest[];
  /** The least subsidy the treasury could not pay in full at the walk (null when none): reaching it walks again. */
  readonly fundThreshold: number | null;
  /** The TA-11 charter wall record the walk left. */
  readonly charterWallTried?: string;
  /** The weeks in a row that started nothing, this one included (a walk is reused only after WALK_REUSE_IDLE_WEEKS). */
  readonly idleWeeks: number;
}

/** GB-1: why the charter wall was not found — water, the map's edge, the buildings, the homes' service space, the proclamation's rules, the lots, the route, or else. */
export type CharterWallFailureReason = "water" | "edge" | "buildings" | "service_space" | "rules" | "lots" | "route" | "other";
