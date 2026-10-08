import type { ReactElement } from "react";
import type { GameState } from "../../../engine/engine.types";
import { Button } from "../../kit";
import { DecideButton } from "../screen/DecideButton";
import type { LordPanelProps } from "../screen/lordScreenTypes";
import { NEGOTIATION_COPY as COPY } from "./negotiationCopy.ko";
import type { TimelineView } from "./negotiationModel";

// LM-R2 (negotiation area): what the marriage's progress waits for — the will's change to answer (SUIT-THREAD: with the
// engine's deadline, and the way to the will's card, where the will's chip opens this page), or the contested estate's
// suit on the ledger screen. The will's [결정하기] is secondary (the card's answers are the choice).

export function ContractDue({ state, view, onOpen, onDecide }: {
  readonly state: GameState; readonly view: TimelineView; readonly onOpen: LordPanelProps["onOpen"]; readonly onDecide: LordPanelProps["onDecide"];
}): ReactElement {
  const plan = state.diplomacy?.marriage;
  return (
    <>
      {view.dueText === null ? null : <p className="lord-neg-due" data-due={view.due ?? ""} role="status">{view.dueText}</p>}
      {view.due !== "will_change" || plan === undefined ? null : (
        <div className="lord-neg-actions"><DecideButton state={state} modal="marriage_decision" id={plan.claimId} onDecide={onDecide} /></div>
      )}
      {view.suitFocus === null ? null : (
        <div className="lord-neg-actions">
          <Button type="button" className="lord-neg-open-suit" data-open-suit={view.suitFocus} aria-label={COPY.openSuitLabel}
            onPress={() => onOpen("ledger", view.suitFocus ?? undefined)}>{COPY.openSuit}</Button>
        </div>
      )}
    </>
  );
}
