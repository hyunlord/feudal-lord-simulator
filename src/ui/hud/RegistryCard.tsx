import { DecisionCard } from "../decisionCard/DecisionCard";
import { REGISTRY_CARD_COPY } from "../registryCardCopy.ko";
import type { RegistryOfferView } from "../registryCardModel";
import { SinceLast } from "../lord/since/SinceLast";

// EVENT-ART: the registry's event card (lord mode only; a state machine modal: time stops while it is up). DEC-CARD: it is
// the heavy decision card (src/ui/decisionCard/DecisionCard.tsx) in the petition card's Wave 8 frame: the event picture
// whole (16:9, contain) beside the canon's words, what is at stake, until when, then each answer's now / later / who
// remembers. Equal answers are all secondary (LR1-D2); an answer the engine would not carry out now is shut, with why.
// "Why it came" (the conditions, the bound targets, the draw) stays under the stake. Class `lord-card` and
// `data-registry-offer` stay the selectors the geometry rows and captures find the card by.

export function RegistryOfferModal({ view, onAnswer, onLater }: {
  readonly view: RegistryOfferView; readonly onAnswer: (choiceId: string) => void; readonly onLater: () => void;
}) {
  return (
    <DecisionCard view={view.card} className="lord-card" data={{ "data-registry-offer": view.entryId, "data-occurrence": view.occurrenceId }}
      onChoose={onAnswer} onLater={onLater}
      extra={<><section className="registry-card-why" aria-label={REGISTRY_CARD_COPY.whyHeading}>
        <h3>{REGISTRY_CARD_COPY.whyHeading}</h3>
        <ul>{view.why.map((line, index) => <li key={index}>{line}</li>)}</ul>
      </section><SinceLast view={view.since} /></>} />
  );
}
