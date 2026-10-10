import type { GameState } from "../../../engine/engine.types";
import { lordMattersDue, type LordMatterDue as EngineMatter } from "../../../engine/lordDue";
import { diplomacyOf } from "../../../engine/negotiation";

// PLAY-2 (Astra's second lord-mode play, friction 8: the will's chip was pushed out by newer ones and the will lapsed
// unanswered): the house's matters that wait for the lord's answer, each by its chip's id. The chips keep these until
// answered or past (useStoryPresentation `storyChips`). SUIT-THREAD: the matters with a deadline are the engine's
// (`lordMattersDue`: the father's will with its `dueTick`, the contested inheritance, a suit against the lord with its
// next stage's tick, a forcible entry forewarned; PLAY-2 §4: a Michaelmas audit's finding and an off-map estate's
// petition brought to the lord, by their deadlines); no deadline rule is computed here, and no matter added of the
// screen's own (decision SUIT-D5's audit and off-map petition now come from the engine's list).

/** The chip id of each matter (lordStoryBeats builds its chips with these). */
export const LORD_MATTER_CHIP = {
  marriage: (kind: string, claimId: string) => `marriage-decision:${kind}:${claimId}`,
  audit: (auditId: string) => `audit:${auditId}`,
  petition: (petitionId: string) => `estate-petition:${petitionId}`,
  suit: (suitId: string) => `suit-defence:${suitId}`,
  entry: (threatId: string) => `entry-threat:${threatId}`,
} as const;

/** A matter's chip id: the will and the contested inheritance by the marriage's claim (the engine names its negotiation). */
function chipOf(state: GameState, matter: EngineMatter): string | null {
  switch (matter.kind) {
    case "will_change": case "contested": {
      const plan = diplomacyOf(state).marriage;
      return plan === undefined || plan.negotiationId !== matter.id ? null : LORD_MATTER_CHIP.marriage(matter.kind, plan.claimId);
    }
    case "suit_defence": return LORD_MATTER_CHIP.suit(matter.id);
    case "entry_threat": return LORD_MATTER_CHIP.entry(matter.id);
    case "audit": return LORD_MATTER_CHIP.audit(matter.id);
    case "estate_petition": return LORD_MATTER_CHIP.petition(matter.id);
  }
}

/** The chips that stay until answered: the engine's matters due, each by its chip's id. */
export function lordMatterChipIds(state: GameState): ReadonlySet<string> {
  return new Set(lordMattersDue(state).flatMap(matter => { const id = chipOf(state, matter); return id === null ? [] : [id]; }));
}

/** The engine's matter of a kind with this id (the will's deadline, a suit's next stage, a threat's coming), or null. */
export function lordMatter(state: GameState, kind: EngineMatter["kind"], id: string): EngineMatter | null {
  return lordMattersDue(state).find(matter => matter.kind === kind && matter.id === id) ?? null;
}
