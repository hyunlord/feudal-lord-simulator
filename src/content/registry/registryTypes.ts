/**
 * LM-E9 (spec docs/design/registry.md ER-1): the registry's entries — petitions, events and annual rules as data. An
 * entry's conditions are a tree over an allow-listed read model (no code runs), its choices are commands the engine
 * already has, bound to a real instance (an estate, an audit, a suit, a steward). Words live in `*.ko.ts`.
 */

export const REGISTRY_KINDS = ["petition", "event", "annual_rule"] as const;
export type RegistryKind = (typeof REGISTRY_KINDS)[number];

/** ER-1: the read model a condition may name (the adapter in engine/registry.ts reads each from the state). */
export const REGISTRY_FIELDS = [
  "calendar.year", "calendar.season", "population", "treasury",
  "estates.heldOffMap", "estates.delegated", "estates.direct",
  "audit.pending", "suit.open", "claim.open",
  "steward.rules.recurring", "attention.overloaded",
  "faction.relation", "market.exists", "lord.heirAdult", "marriage.open",
  "market.duesPermille", "agency.policy", "timber.order", "steward.lordDecided", "steward.rules.amountAtLeast",
  // The bound target's own facts (an audit, a suit).
  "bound.revealedKept", "bound.stewardLoyalty", "bound.stewardConnected", "bound.suitStage", "bound.evidence",
] as const;
export type RegistryField = (typeof REGISTRY_FIELDS)[number];

/** `has`/`lacks`: a list field (the bound suit's evidence) holds / does not hold the value. */
export const REGISTRY_OPS = ["eq", "ne", "gte", "lte", "in", "has", "lacks"] as const;
export type RegistryOp = (typeof REGISTRY_OPS)[number];

export type RegistryCondition =
  | { readonly all: readonly RegistryCondition[] }
  | { readonly any: readonly RegistryCondition[] }
  | { readonly not: RegistryCondition }
  | { readonly field: RegistryField; readonly op: RegistryOp; readonly value: number | string | boolean | readonly (number | string)[]; readonly faction?: string };

/** ER-1: what an occurrence is bound to (its commands take their target from it). */
export const REGISTRY_BINDS = ["none", "delegated_estate", "held_estate", "pending_audit", "open_suit", "open_claim"] as const;
export type RegistryBind = (typeof REGISTRY_BINDS)[number];

/** ER-1: an effect — a command the engine has (the bound target fills its ids), or a ledger line / timed term. */
export type RegistryEffect =
  | { readonly command: "set_project_subsidy"; readonly kind: string; readonly amount: number }
  | { readonly command: "set_market_dues"; readonly permille: number }
  | { readonly command: "set_estate_policy"; readonly policy: "growth" | "revenue" | "stability" | "defence" }
  | { readonly command: "set_audit_mode"; readonly mode: "accounts" | "visit" }
  | { readonly command: "answer_audit"; readonly choice: "punish" | "replace" | "tolerate" }
  | { readonly command: "set_estate_oversight"; readonly mode: "steward" | "direct" }
  | { readonly command: "add_suit_evidence"; readonly evidence: "charter" | "witnesses" | "deed" | "court_roll" | "possession_years" }
  | { readonly command: "file_suit" }
  | { readonly command: "order_timber"; readonly amount: number }
  | { readonly command: "faction_relation"; readonly faction: string; readonly delta: number }
  | { readonly command: "treasury"; readonly amount: number }
  | { readonly command: "term"; readonly term: "remission" | "installments"; readonly what: string; readonly amountPerYear: number; readonly years: number }
  | { readonly command: "rights_scope"; readonly sharePermille: number }
  | { readonly command: "set_exception_rules"; readonly recurring?: boolean; readonly amountAtLeast?: number | null }
  | { readonly command: "enforce_possession" }
  | { readonly command: "none" };

export interface RegistryChoice {
  readonly id: string;
  readonly effects: readonly RegistryEffect[];
  /** A choice's own precondition (the drafts' "this choice only when …"). */
  readonly requires?: RegistryCondition;
}

export interface RegistryEntry {
  readonly id: string;
  readonly kind: RegistryKind;
  /** Where it came from (a content draft's id, FIX-14's home petitions). */
  readonly source: string;
  readonly years: { readonly fromYear: number; readonly toYear: number };
  /** Seasons it may come in (0 spring … 3 winter); absent = any. */
  readonly seasons?: readonly number[];
  readonly conditions?: RegistryCondition;
  readonly frequency: { readonly chancePermille: number; readonly weight: number; readonly minGapSeasons: number; readonly maxPerYear: number };
  /** `once`: one in the whole game; `once_per_target`: one per bound instance; `cooldown`: again after its seasons. */
  readonly recurrence: { readonly mode: "once" | "once_per_target" | "cooldown"; readonly cooldownSeasons: number; readonly maxOccurrences: number };
  readonly exclusiveGroup?: string;
  /** The faction that sends it (the card's sender). */
  readonly sender: string;
  readonly bind: RegistryBind;
  readonly choices: readonly RegistryChoice[];
  /** The choice applied once when an offer lapses unanswered (absent = nothing). */
  readonly lapseChoice?: string;
  /** May a steward answer it by precedent (ER-6)? */
  readonly precedent: boolean;
  /** The picture's id; null = none yet (the Astra request list). */
  readonly artId: string | null;
  /** A generator the engine runs instead of the generic draw (FIX-14's home cycle). */
  readonly generator?: "home_cycle";
}
