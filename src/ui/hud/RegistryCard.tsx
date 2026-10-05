import { DECISION_COPY } from "../decisionCopy.ko";
import { eventArtStyle, type EventArtId } from "../eventArt";
import { Button } from "../kit";
import { LORD_CARDS_COPY } from "../lordCardsCopy.ko";
import { REGISTRY_CARD_COPY } from "../registryCardCopy.ko";
import type { RegistryOfferView } from "../registryCardModel";
import { Frame } from "./LordCards";

// EVENT-ART: the registry's event card (lord mode only; a state machine modal: time stops while it is up). It wears the
// petition card's Wave 8 frame as LM-R1's lord cards do; the event picture is shown whole (16:9, contain) beside the
// court and sender lines, or not at all when the entry has none. Equal answers are all secondary (LR1-D2: one primary per screen); each says its tradeoff (the
// canon's), a hold also what it costs (ER-19), and the treasury it moves now when it moves any; an answer the engine would
// not carry out now is shut, with why.

/** The picture beside the court and sender lines (not above them): the canon v4's longer answers and holds fit the card. */
const SCENE_WIDTH = 240;

function Scene({ art }: { readonly art: EventArtId | null }) {
  return art === null ? null
    : <div className="petition-scene"><div className="story-modal-art lord-card-art" aria-hidden="true" data-art={art} style={eventArtStyle(art, SCENE_WIDTH)} /></div>;
}

export function RegistryOfferModal({ view, onAnswer, onLater }: {
  readonly view: RegistryOfferView; readonly onAnswer: (choiceId: string) => void; readonly onLater: () => void;
}) {
  return (
    <Frame label={view.title} data={{ "data-registry-offer": view.entryId, "data-occurrence": view.occurrenceId, "data-answers": String(view.choices.length) }}>
      <div className="registry-card-head">
        <Scene art={view.art} />
        <div className="registry-card-head-text">
          <p className="lord-card-court">{view.court}</p>
          <p className="lord-card-kicker">{view.from} · {view.waits}</p>
        </div>
      </div>
      <h2>{view.title}</h2>
      <p>{view.body}</p>
      <section className="registry-card-why" aria-label={REGISTRY_CARD_COPY.whyHeading}>
        <h3>{REGISTRY_CARD_COPY.whyHeading}</h3>
        <ul>{view.why.map((line, index) => <li key={index}>{line}</li>)}</ul>
      </section>
      <ol className="petition-options registry-card-options">
        {view.choices.map(choice => (
          <li key={choice.id}>
            <Button type="button" className="petition-option registry-card-option" data-choice={choice.id} data-enabled={choice.enabled ? "true" : "false"} data-hold={choice.hold ? "true" : "false"}
              disabled={!choice.enabled} aria-label={DECISION_COPY.choose(choice.label)} onPress={() => onAnswer(choice.id)} variant="secondary">
              <strong>{choice.label}</strong>
              <span className="lord-card-forecast" {...(choice.treasury === null ? {} : { "data-treasury": String(choice.treasury) })}>{choice.line}</span>
              {choice.cost === null ? null : <span className="registry-card-hold">{choice.cost}</span>}
              {choice.treasury === null || choice.treasury === 0 ? null : <span className="registry-card-money">{LORD_CARDS_COPY.treasury(choice.treasury)}</span>}
            </Button>
          </li>
        ))}
      </ol>
      <p className="lord-card-precedent">{view.lapse}</p>
      <div className="lord-card-actions">
        <Button type="button" className="story-modal-later" onPress={() => onLater()} variant="secondary">{DECISION_COPY.later}</Button>
      </div>
    </Frame>
  );
}
