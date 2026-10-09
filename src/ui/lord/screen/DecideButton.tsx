import type { ReactElement } from "react";
import type { GameState } from "../../../engine/engine.types";
import { Button } from "../../kit";
import { homePetitionView } from "../../lordCardsModel";
import { auditDecisionHead, marriageDecisionHead, offMapPetitionHead } from "../decisions/decisionCardsModel";
import { LORD_SCREEN_COPY as COPY } from "./lordScreenCopy.ko";
import type { LordDecisionModal } from "./lordScreenTypes";

// LM-R2: a waiting decision's way to its card from a lord screen. A card shows the first waiting decision of its kind
// (the story chip's), so the button sits only on that one; another of the same kind says it comes after.

/** The id the card of a kind shows now, or null (none waiting). Read per state (the heads run no command). */
export function decidingId(state: GameState, modal: LordDecisionModal): string | null {
  if (modal === "audit_decision") return auditDecisionHead(state)?.auditId ?? null;
  if (modal === "estate_petition") return homePetitionView(state)?.petitionId ?? null;
  // SUIT-THREAD: the will's card by the marriage's claim (the contested inheritance is answered by its suit, not here).
  if (modal === "marriage_decision") { const head = marriageDecisionHead(state); return head?.kind === "will_change" ? head.claimId : null; }
  return offMapPetitionHead(state)?.petitionId ?? null;
}

export function DecideButton({ state, modal, id, onDecide }: {
  readonly state: GameState; readonly modal: LordDecisionModal; readonly id: string; readonly onDecide: ((modal: LordDecisionModal) => void) | undefined;
}): ReactElement | null {
  if (onDecide === undefined) return null;
  const current = decidingId(state, modal);
  if (current === null) return null;
  return current === id
    ? <Button type="button" className="lord-decide" data-decide={modal} data-decide-id={id} variant="secondary" size="md" onPress={() => onDecide(modal)}>{COPY.decide}</Button>
    : <span className="lord-decide-after">{COPY.decideAfter}</span>;
}
