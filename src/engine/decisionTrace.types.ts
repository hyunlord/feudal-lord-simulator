/**
 * DEC-TRACE §2–§4 (docs/design/dec-trace.md, save v52): the thread of consequence. Each decision of the lord's (and each
 * answer the steward gave by the lord's standing policy) is kept with what it touched; what later happens to those
 * things — a faction's act, a household leaving or arriving, a suit's turn, a marriage's turn, a project started, goods
 * delivered, an estate's audit — is kept with the decisions behind it. Lord mode only.
 */
import type { DecisionWeight, StewardStance } from "../content/stewardPolicyConfig";

/** What a decision answered or set. */
export type TracedDecisionKind = "registry" | "manor_petition" | "estate_petition" | "chapter_petition" | "famine" | "suit" | "marriage"
  | "oversight" | "audit" | "policy" | "subsidy" | "dues" | "timber" | "steward_policy" | "other";

export interface TracedDecision {
  /** `d-000001`, in order. */
  readonly id: string;
  readonly tick: number;
  readonly by: "lord" | "steward";
  readonly kind: TracedDecisionKind;
  /** What was decided, as a key the screens word: `registry:<entry>:<choice>`, `manor_petition:<kind>:<answer>`, … */
  readonly source: string;
  /** P-D5: the weights that made it the lord's (empty for the steward's and the lord's own small settings). */
  readonly weights: readonly DecisionWeight[];
  readonly stance?: StewardStance;
  /** What it touched: `faction:<id>`, `suit:<id>`, `negotiation:<id>`, `promise:<id>`, `estate:<id>`, `subsidy:<kind>`, `policy`, `dues`, `timber`, `war_tax`, `guild`. */
  readonly targets: readonly string[];
  /** The history ledger's decision record of the same command (the town agency's receipts cite it), when there is one. */
  readonly historyId?: string;
  /** The later commands that carried on the same matter and joined it (their keys, for the factions' memories), and the last one's tick. */
  readonly also?: readonly string[];
  readonly lastTick?: number;
}

/** What followed. */
export type ConsequenceKind = "faction_act" | "departure" | "arrival" | "suit" | "marriage" | "promise" | "project" | "goods" | "audit" | "estate" | "income";

export interface Consequence {
  /** `c-000001`, in order. */
  readonly id: string;
  readonly tick: number;
  readonly kind: ConsequenceKind;
  /** The thing it happened to (one of the decisions' targets). */
  readonly target: string;
  /** The decisions behind it, the main one first (P-C3); `partial` when other causes had a share too (P-C2). */
  readonly causes: readonly string[];
  readonly partial: boolean;
  /** What happened, for the words: an act's id, a suit's stage, a project's kind, a count. */
  readonly detail: Readonly<Record<string, string | number>>;
}

/** §3: a faction's act on crossing a threshold (for the once-a-year and once-a-decade limits). */
export interface FactionAct {
  readonly factionId: string;
  readonly tick: number;
  readonly size: "small" | "large";
  readonly direction: 1 | -1;
  readonly act: string;
  /** The relation at the act (the next small act needs it to have moved on by the step). */
  readonly relation: number;
}

export interface TraceState {
  readonly decisions: readonly TracedDecision[];
  readonly consequences: readonly Consequence[];
  readonly acts: readonly FactionAct[];
  readonly nextDecision: number;
  readonly nextConsequence: number;
}
