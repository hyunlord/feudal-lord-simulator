import { DECISION_COPY } from "../decisionCopy.ko";
import { EmblemImage, type EmblemSpec } from "../heraldry/EmblemImage";
import { Button } from "../kit";
import { LORD_CARDS_COPY } from "../lordCardsCopy.ko";
import type { HomePetitionView, LordRequestView, PrecedentView } from "../lordCardsModel";
import { storyArtStyle, type StoryIllustration } from "../storyArt";
import { wave44ImageStyle, type Wave44ImageId } from "../wave44Art";
import { wave8FrameLayerStyle, wave8ImageStyle } from "../wave8Art";

// LM-R1 (petitions) the lord's cards (lord mode only; state machine modals: time stops while one is up). They wear the
// petition card's Wave 8 frame and body as the political petitions do; the Wave 44 picture is shown whole (16:9), the
// title, the request and the answers are text over nothing painted. Answers are kit buttons with their seal; each shows
// the engine's numbers for it (the treasury now and the factions' relation moves).

const SCENE_WIDTH = 320;

function Scene({ art }: { readonly art: Wave44ImageId | null }) {
  return art === null ? null : <div className="petition-scene"><div className="story-modal-art lord-card-art" aria-hidden="true" data-art={art} style={wave44ImageStyle(art, SCENE_WIDTH)} /></div>;
}

/** The lord's exception rule `recurring` ("선례가 있어도 다시 올린다") as a switch. */
function RecurringSwitch({ on, onToggle }: { readonly on: boolean; readonly onToggle: (next: boolean) => void }) {
  return (
    <Button type="button" className="lord-card-recurring" variant="toggle" aria-pressed={on} onPress={() => onToggle(!on)}>
      {LORD_CARDS_COPY.recurring} · {on ? LORD_CARDS_COPY.recurringOn : LORD_CARDS_COPY.recurringOff}
    </Button>
  );
}

export function Frame({ label, data, children, crest = null }: {
  readonly label: string; readonly data: Readonly<Record<`data-${string}`, string>>; readonly children: React.ReactNode;
  /** LR1-D5: arms in the frame's empty roundel (its top-left corner), as the political cards show the sender's. */
  readonly crest?: Readonly<{ arms: EmblemSpec; label: string }> | null;
}) {
  return (
    <div className="story-modal-backdrop" role="presentation">
      <section className="story-modal petition-card lord-card" data-frame="petition" role="dialog" aria-modal="true" aria-label={label} {...data}>
        <span className="petition-frame" aria-hidden="true" style={wave8FrameLayerStyle("frame_petition")} />
        {crest === null ? null : <span className="petition-roundel"><EmblemImage emblem={crest.arms} size={38} label={crest.label} /></span>}
        <div className="petition-body">{children}</div>
      </section>
    </div>
  );
}

export function HomePetitionModal({ view, onAnswer, onRecurring, onLater }: {
  readonly view: HomePetitionView; readonly onAnswer: (grant: boolean) => void; readonly onRecurring: (next: boolean) => void; readonly onLater: () => void;
}) {
  return (
    <Frame label={view.title} data={{ "data-home-petition": view.kind, "data-petition": view.petitionId, "data-answers": "2" }} crest={{ arms: view.arms, label: view.armsLabel }}>
      <p className="lord-card-court">{view.court}</p>
      <Scene art={view.art} />
      <p className="lord-card-kicker">{LORD_CARDS_COPY.homeFrom} · {view.waits}</p>
      <h2>{view.title}</h2>
      <p>{view.demand}</p>
      <ol className="petition-options">
        {view.options.map(option => (
          <li key={option.grant ? "grant" : "refuse"}>
            <Button type="button" className="petition-option" data-grant={option.grant ? "true" : "false"} aria-label={DECISION_COPY.choose(option.label)}
              onPress={() => onAnswer(option.grant)} variant="secondary">
              <span className="petition-seal" aria-hidden="true" style={wave8ImageStyle(option.grant ? "seal_petition_accept" : "seal_petition_reject", 44)} />
              <strong>{option.label}</strong>
              <span className="lord-card-forecast" data-treasury={option.treasury}
                data-relations={option.relations.map(move => `${move.factionId}:${move.delta}`).join(",")}>{option.line}</span>
            </Button>
          </li>
        ))}
      </ol>
      {view.precedent === null ? null : <p className="lord-card-precedent">{view.precedent}</p>}
      <div className="lord-card-actions">
        <RecurringSwitch on={view.recurring} onToggle={onRecurring} />
        <Button type="button" className="story-modal-later" onPress={() => onLater()} variant="secondary">{DECISION_COPY.later}</Button>
      </div>
    </Frame>
  );
}

export function PrecedentModal({ view, onRecurring, onClose }: {
  readonly view: PrecedentView; readonly onRecurring: (next: boolean) => void; readonly onClose: () => void;
}) {
  return (
    <Frame label={LORD_CARDS_COPY.precedentTitle} data={{ "data-precedent": view.key, "data-answers": "1" }}>
      <p className="lord-card-court">{view.court}</p>
      <Scene art={view.art} />
      <h2>{LORD_CARDS_COPY.precedentTitle}</h2>
      <p>{LORD_CARDS_COPY.precedentLine}</p>
      <ul className="lord-card-precedents">{view.items.map(item => <li key={item}>{item}</li>)}</ul>
      <div className="lord-card-actions">
        <RecurringSwitch on={view.recurring} onToggle={onRecurring} />
        <Button type="button" className="story-modal-later" onPress={() => onClose()} variant="secondary">{LORD_CARDS_COPY.precedentClose}</Button>
      </div>
    </Frame>
  );
}

export function LordRequestModal({ view, art, onGrant, onLater }: {
  readonly view: LordRequestView; readonly art: StoryIllustration | null; readonly onGrant: () => void; readonly onLater: () => void;
}) {
  return (
    <Frame label={view.title} data={{ "data-lord-request": view.kind, "data-answers": "1" }}>
      <p className="lord-card-court">{view.court}</p>
      {art === null ? null : <div className="petition-scene"><div className="story-modal-art" aria-hidden="true" style={storyArtStyle(art, 300)} /></div>}
      <p className="lord-card-kicker">{LORD_CARDS_COPY.requestFrom}{view.more === "" ? "" : ` · ${view.more}`}</p>
      <h2>{view.title}</h2>
      <p>{view.demand}</p>
      <ol className="petition-options">
        <li>
          <Button type="button" className="petition-option" data-grant="true" aria-label={DECISION_COPY.choose(view.grant)} onPress={() => onGrant()} variant="primary">
            <span className="petition-seal" aria-hidden="true" style={wave8ImageStyle("seal_petition_accept", 44)} />
            <strong>{view.grant}</strong>
          </Button>
        </li>
      </ol>
      <Button type="button" className="story-modal-later" onPress={() => onLater()} variant="secondary">{DECISION_COPY.later}</Button>
    </Frame>
  );
}
