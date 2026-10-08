/**
 * DEC-TRACE §2–§4 (docs/design/dec-trace.md, save v52): the thread of consequence. Each decision of the lord's (and each
 * answer the steward gave by the lord's standing policy) is kept with what it touched; what later happens to those
 * things — a faction's act, a household leaving or arriving, a suit's turn, a marriage's turn, a project started, goods
 * delivered, an estate's audit or mood, a right's first income, the first payment of a line it set going — is written in the history with the decisions behind
 * it (`HistoryRecord.because`). Lord mode only.
 */
import type { DecisionWeight, StandingSetting } from "../content/stewardPolicyConfig";

/** What a decision answered or set. */
export type TracedDecisionKind = "registry" | "manor_petition" | "estate_petition" | "chapter_petition" | "famine" | "suit" | "marriage"
  | "oversight" | "audit" | "policy" | "subsidy" | "dues" | "timber" | "standing_policy";

export interface TracedDecision {
  /** The decision's own history record id (`h-000001`): the card's answer, the steward's, or the silence that let it lapse. */
  readonly id: string;
  readonly tick: number;
  readonly by: "lord" | "steward";
  readonly kind: TracedDecisionKind;
  /** What was decided, as the factions' memories key it: `registry:<entry>:<choice>`, `manor_petition:<kind>:<answer>`, … */
  readonly source: string;
  /** P-D5: the weights that made it the lord's (empty for the steward's and the lord's own small settings). */
  readonly weights: readonly DecisionWeight[];
  /** The steward's: the standing policy he followed. */
  readonly policy?: StandingSetting;
  /** What it touched: `faction:<id>`, `suit:<id>`, `negotiation:<id>`, `promise:<id>`, `estate:<id>`, `subsidy:<kind>`, `build:<kind>`, `right:<id>`, `flow:<ledger category>`, `policy`, `dues`, `timber`, `war_tax`, `guild`. */
  readonly targets: readonly string[];
  /** The later commands that carried on the same matter and joined it (their keys, for the factions' memories), and the last one's tick. */
  readonly also?: readonly string[];
  readonly lastTick?: number;
  /** The silence that let it lapse (its deadline passed unanswered: P-D2, silence is a decision too). */
  readonly lapsed?: true;
}

/** What followed (the key the screens word, `HistoryBecause.key`). */
export const CONSEQUENCE_KEYS = ["faction_act", "households_left", "households_arrived", "suit_turned", "marriage_turned", "promise_made", "promise_kept",
  "promise_broken", "project_started", "goods_delivered", "audit", "estate_mood", "right_income", "payment_flow", "community_built", "dues_held", "agreement_broken", "suit_rent", "crisis_prepared", "crisis_outcome"] as const;
export type ConsequenceKey = (typeof CONSEQUENCE_KEYS)[number];

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
  readonly acts: readonly FactionAct[];
}
