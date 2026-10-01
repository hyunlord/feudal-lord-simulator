/**
 * LM-E3 negotiation, promises and the marriage contract (spec docs/design/negotiation.md NG-1…NG-10): an offer is a
 * bundle of terms each side gives; the other side's acceptance is a sum of named reasons, read as five tiers; a counter
 * is the smallest bundle that lifts it just over the line; every future term is a promise kept or broken by its
 * deadline; the marriage contract with the third neighbour's house runs through its middle events to the inheritance.
 */
import type { HolderId } from "./estates.types";

/** NG-2: the kinds of term. The lord's side gives the first five, the counterpart's the last five. */
export type TermKind =
  | "cash" | "pension" | "right_piece" | "political_support" | "debt_assumption"
  | "consent" | "inheritance_non_infringement" | "residence" | "land_use" | "wardship";

export interface Term {
  readonly kind: TermKind;
  /** Who gives it. */
  readonly giver: "proposer" | "counterpart";
  /** Pennies (cash, a year's pension, debt), years (pension, support, the debt's instalments — FIX-12), or nothing. */
  readonly amount?: number;
  readonly years?: number;
  /** A right piece's id (right_piece, land_use). */
  readonly pieceId?: string;
}

/** NG-3: a named reason of the acceptance score. */
export type AcceptanceReasonName =
  | "base" | "relation" | "material" | "political" | "trust" | "urgency" | "concession"
  | "rank" | "inheritance_risk" | "broken_promises" | "red_line";

export interface AcceptanceReason { readonly name: AcceptanceReasonName; readonly value: number; readonly detail?: string }

/** NG-3: the five tiers the screens show (the probability stays inside). */
export type AcceptanceTier = "impossible" | "unlikely" | "close" | "likely" | "almost_certain";

export interface Acceptance {
  readonly score: number;
  readonly reasons: readonly AcceptanceReason[];
  /** The top three to five reasons by size. */
  readonly top: readonly AcceptanceReason[];
  /** Permille: σ((A − θ) / s) × 1000, rounded. */
  readonly permille: number;
  readonly tier: AcceptanceTier;
}

/** NG-5: what changed between an offer and its counter (the screens mark only these). */
export interface TermChange {
  readonly kind: TermKind;
  readonly change: "added" | "raised" | "removed";
  readonly from?: number;
  readonly to?: number;
}

export interface Negotiation {
  readonly id: string;
  readonly proposer: HolderId;
  readonly counterpart: HolderId;
  /** What it is for (the marriage of `groomId` and `brideId`). */
  readonly purpose: "marriage";
  readonly groomId: string;
  readonly brideId: string;
  readonly terms: readonly Term[];
  readonly acceptance: Acceptance;
  readonly status: "countered" | "accepted" | "rejected" | "withdrawn";
  /** NG-5: the counterpart's counter (its terms and what changed). */
  readonly counter?: { readonly terms: readonly Term[]; readonly changes: readonly TermChange[]; readonly acceptance: Acceptance };
  readonly tick: number;
  /** The deadline for the proposer to answer a counter. */
  readonly deadline: number;
}

/** NG-6: a promise — kept by its deadline, else broken. No lying button: what is done by then is kept. */
export interface PromiseRecord {
  readonly id: string;
  readonly promisor: HolderId;
  readonly promisee: HolderId;
  /** The term it carries out (a payment of `amount`, support, not infringing the inheritance). */
  readonly term: TermKind;
  readonly amount?: number;
  readonly deadline: number;
  /** The factions that saw it made (their memory keeps a breach). */
  readonly witnesses: readonly string[];
  /** What a breach costs: trust with the promisee, relation, acceptance in later negotiations. */
  readonly stake: { readonly trust: number; readonly relation: number };
  readonly status: "open" | "kept" | "broken";
  readonly negotiationId: string;
  readonly settledTick?: number;
}

/** NG-8: the marriage's stages, in order. */
export type MarriageStage = "contracted" | "bride_arrived" | "child_born" | "father_ill" | "will_change" | "inherited" | "lost" | "contested";

export interface MarriagePlan {
  readonly negotiationId: string;
  readonly groomId: string;
  readonly brideId: string;
  readonly estateId: string;
  readonly contractedTick: number;
  readonly stage: MarriageStage;
  /** The claim of the inheritance expectation (LM-E2 claim, basis marriage). */
  readonly claimId: string;
  /** NG-8: the middle events as they fell (their ticks). */
  readonly events: Readonly<Partial<Record<"bride_arrived" | "child_born" | "brother_in_law_born" | "father_ill" | "will_change" | "will_dropped" | "father_died", number>>>;
  /** The brother-in-law, when one was born (an estate person). */
  readonly brotherInLawId?: string;
  /** The will-change attempt's answer, and the rival it named when it stood. */
  readonly willAnswer?: "favour" | "support_promise" | "let_it_be";
  readonly rival?: HolderId;
}

export interface DiplomacyState {
  readonly negotiations: readonly Negotiation[];
  readonly promises: readonly PromiseRecord[];
  readonly marriage?: MarriagePlan;
  /** NG-3: relations with the houses that are not factions (the third neighbour's), −100…100. */
  readonly relations: Readonly<Record<string, number>>;
  readonly nextNegotiation: number;
  readonly nextPromise: number;
}
