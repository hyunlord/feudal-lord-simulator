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
export type ReasonName = "need" | "access" | "cost" | "policy" | "subsidy" | "dues" | "risk" | "relation" | "stuck";

export interface Reason { readonly name: ReasonName; readonly value: number }

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
}
