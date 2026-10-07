import { DECISION_COPY } from "../../decisionCopy.ko";
import { Frame } from "../../hud/LordCards";
import { Button } from "../../kit";
import { DECISION_CARDS_COPY as COPY } from "./decisionCardsCopy.ko";
import type { AuditDecisionView, DecisionOption, MarriageDecisionView, OffMapPetitionView } from "./decisionCardsModel";

// LM-R2 (lord mode) the lord's decision cards: state machine modals over the town (time stops while one is up), in the
// petition card's frame as LM-R1's lord cards. The answers are equal choices, so every one is secondary (LR1-D2); an
// answer the engine refuses now is shown disabled with the reason. The contested inheritance has no answer of its own:
// its one act is to open the suit on the lord's ledger screen (its only primary).

function Options<T extends string>({ options, onAnswer }: { readonly options: readonly DecisionOption<T>[]; readonly onAnswer: (choice: T) => void }) {
  return (
    <ol className="petition-options lord-decision-options">
      {options.map(option => (
        <li key={option.choice}>
          <Button type="button" className="petition-option" data-choice={option.choice} data-refused={option.refusal === null ? "false" : "true"}
            aria-label={DECISION_COPY.choose(option.label)} disabled={option.refusal !== null} onPress={() => onAnswer(option.choice)} variant="secondary">
            <strong>{option.label}</strong>
            <span className="lord-card-forecast">{option.refusal ?? option.line}</span>
          </Button>
        </li>
      ))}
    </ol>
  );
}

export function MarriageDecisionModal({ view, onAnswer, onOpenSuit, onLater }: {
  readonly view: MarriageDecisionView; readonly onAnswer: (choice: "favour" | "support_promise" | "let_it_be") => void;
  readonly onOpenSuit: (focus: string) => void; readonly onLater: () => void;
}) {
  return (
    <Frame label={view.title} data={{ "data-lord-decision": view.kind, "data-answers": view.kind === "will_change" ? String(view.options.length) : "1" }}>
      <p className="lord-card-court">{view.court}</p>
      <p className="lord-card-kicker">{view.kind === "will_change" ? COPY.willKicker : view.suit}</p>
      <h2>{view.title}</h2>
      <p>{view.line}</p>
      {view.kind === "will_change" ? <Options options={view.options} onAnswer={onAnswer} /> : (
        <Button type="button" className="lord-decision-open" data-lord-open-suit={view.focus} onPress={() => onOpenSuit(view.focus)} variant="primary">{COPY.contestOpen}</Button>
      )}
      <Button type="button" className="story-modal-later" onPress={() => onLater()} variant="secondary">{view.kind === "will_change" ? DECISION_COPY.later : COPY.close}</Button>
    </Frame>
  );
}

export function AuditDecisionModal({ view, onAnswer, onLater }: {
  readonly view: AuditDecisionView; readonly onAnswer: (choice: "punish" | "replace" | "tolerate") => void; readonly onLater: () => void;
}) {
  return (
    <Frame label={view.title} data={{ "data-lord-decision": "audit", "data-audit": view.auditId, "data-answers": String(view.options.length) }}>
      <p className="lord-card-court">{view.court}</p>
      <p className="lord-card-kicker">{view.kicker} · {view.waits}</p>
      <h2>{view.title}</h2>
      <p>{view.line}</p>
      <Options options={view.options} onAnswer={onAnswer} />
      <Button type="button" className="story-modal-later" onPress={() => onLater()} variant="secondary">{DECISION_COPY.later}</Button>
    </Frame>
  );
}

export function OffMapPetitionModal({ view, onAnswer, onLater }: {
  readonly view: OffMapPetitionView; readonly onAnswer: (grant: boolean) => void; readonly onLater: () => void;
}) {
  return (
    <Frame label={view.title} data={{ "data-lord-decision": "estate_petition_offmap", "data-petition": view.petitionId, "data-answers": "2" }}>
      <p className="lord-card-court">{view.court}</p>
      <p className="lord-card-kicker">{view.kicker} · {view.waits}</p>
      <h2>{view.title}</h2>
      <p>{view.line}</p>
      {view.why === "" ? null : <p className="lord-card-precedent">{view.why}</p>}
      <Options options={view.options} onAnswer={choice => onAnswer(choice === "grant")} />
      <Button type="button" className="story-modal-later" onPress={() => onLater()} variant="secondary">{DECISION_COPY.later}</Button>
    </Frame>
  );
}
