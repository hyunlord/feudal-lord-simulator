/**
 * Astra lordplay2 ⑦ (the user's instruction 2026-10-08): the lord's matters that wait for his answer by a time — a
 * house's matter he must not lose among the season's news (the will's change, a contested inheritance, a suit against
 * him, a forcible entry forewarned). The screens keep them in the unanswered list until answered or past (render reads
 * this; the steward's petitions and the registry's offers keep their own lists).
 */
import { MARRIAGE_TIMES } from "../content/diplomacyConfig";
import { PRESSURE_BALANCE } from "../content/balanceConfig";
import type { GameState } from "./engine.types";
import { estatesOf, LORD } from "./estates";
import { nextSuitStage } from "./estateSuits";
import { marriageDecisionDue } from "./marriage";

const SEASON = PRESSURE_BALANCE.seasonTicks;

export interface LordMatterDue {
  readonly kind: "will_change" | "contested" | "suit_defence" | "entry_threat";
  /** The negotiation, suit or threat. */
  readonly id: string;
  /** The tick it is decided without him (the will stands, the suit moves on, the men come); null: it waits. */
  readonly dueTick: number | null;
}

/** API: what waits for the lord's answer now, the soonest first (lord mode only). */
export function lordMattersDue(state: GameState): readonly LordMatterDue[] {
  if (state.agency === undefined) return [];
  const due: LordMatterDue[] = [];
  const plan = state.diplomacy?.marriage;
  const marriage = marriageDecisionDue(state);
  if (plan !== undefined && marriage === "will_change") {
    due.push({ kind: "will_change", id: plan.negotiationId, dueTick: plan.contractedTick + MARRIAGE_TIMES.willChange + MARRIAGE_TIMES.willAnswer });
  } else if (plan !== undefined && marriage === "contested") due.push({ kind: "contested", id: plan.negotiationId, dueTick: null });
  for (const suit of estatesOf(state).suits) {
    if (suit.defendant !== LORD || suit.plaintiff === LORD || suit.stage === "closed") continue;
    due.push({ kind: "suit_defence", id: suit.id, dueTick: nextSuitStage(suit) === undefined ? null : Math.ceil((suit.stageSince + SEASON) / SEASON) * SEASON });
  }
  for (const threat of state.estates?.threats ?? []) if (threat.guarded !== true) due.push({ kind: "entry_threat", id: threat.id, dueTick: threat.due });
  return due.sort((a, b) => (a.dueTick ?? Infinity) - (b.dueTick ?? Infinity) || a.id.localeCompare(b.id));
}
