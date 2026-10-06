import { DecisionCard } from "../../decisionCard/DecisionCard";
import { Button } from "../../kit";
import { DECISION_CARDS_COPY as COPY } from "./decisionCardsCopy.ko";
import type { AuditDecisionView, MarriageDecisionView, OffMapPetitionView } from "./decisionCardsModel";

// LM-R2 (lord mode) the lord's decision cards: state machine modals over the town (time stops while one is up). DEC-CARD:
// each is the heavy decision card (src/ui/decisionCard/DecisionCard.tsx) — what is happening, what is at stake, until
// when, and each answer's now / later / who remembers; the answers are equal choices, all secondary (LR1-D2), and one the
// engine refuses now is shown shut with its reason. The contested inheritance has no answer of its own: its one act is
// to open the suit on the lord's ledger screen (its only primary). Class `lord-card` and `data-lord-decision` stay the
// selectors the geometry rows, the skin audit and the captures find the cards by.

export function MarriageDecisionModal({ view, onAnswer, onOpenSuit, onLater }: {
  readonly view: MarriageDecisionView; readonly onAnswer: (choice: "favour" | "support_promise" | "let_it_be") => void;
  readonly onOpenSuit: (focus: string) => void; readonly onLater: () => void;
}) {
  if (view.kind === "contested") {
    return <DecisionCard view={view.card} className="lord-card" data={{ "data-lord-decision": "contested", "data-answers": "1" }} laterLabel={COPY.close}
      onChoose={() => undefined} onLater={onLater}
      extra={<Button type="button" className="lord-decision-open" data-lord-open-suit={view.focus} onPress={() => onOpenSuit(view.focus)} variant="primary">{COPY.contestOpen}</Button>} />;
  }
  return <DecisionCard view={view.card} className="lord-card" data={{ "data-lord-decision": "will_change" }} onLater={onLater}
    onChoose={choice => onAnswer(choice as "favour" | "support_promise" | "let_it_be")} />;
}

export function AuditDecisionModal({ view, onAnswer, onLater }: {
  readonly view: AuditDecisionView; readonly onAnswer: (choice: "punish" | "replace" | "tolerate") => void; readonly onLater: () => void;
}) {
  return <DecisionCard view={view.card} className="lord-card" data={{ "data-lord-decision": "audit", "data-audit": view.auditId }} onLater={onLater}
    onChoose={choice => onAnswer(choice as "punish" | "replace" | "tolerate")} />;
}

export function OffMapPetitionModal({ view, onAnswer, onLater }: {
  readonly view: OffMapPetitionView; readonly onAnswer: (grant: boolean) => void; readonly onLater: () => void;
}) {
  return <DecisionCard view={view.card} className="lord-card" data={{ "data-lord-decision": "estate_petition_offmap", "data-petition": view.petitionId }}
    onLater={onLater} onChoose={choice => onAnswer(choice === "grant")} />;
}
