import { DecisionCard } from "../decisionCard/DecisionCard";
import type { DecisionCardView } from "../decisionCard/decisionCardTypes";
import { EmblemImage, type EmblemSpec } from "../heraldry/EmblemImage";
import { Button } from "../kit";
import { LORD_CARDS_COPY } from "../lordCardsCopy.ko";
import type { LordRequestView, PrecedentView } from "../lordCardsModel";
import { wave44ImageStyle, type Wave44ImageId } from "../wave44Art";
import { wave8FrameLayerStyle } from "../wave8Art";

// LM-R1 (petitions) the lord's cards (lord mode only; state machine modals: time stops while one is up). They wear the
// petition card's Wave 8 frame and body as the political petitions do; the Wave 44 picture is shown whole (16:9), the
// title, the request and the answers are text over nothing painted. Answers are kit buttons with their seal; each shows
// the engine's numbers for it (the treasury now and the factions' relation moves).

const SCENE_WIDTH = 320;

function Scene({ art }: { readonly art: Wave44ImageId | null }) {
  return art === null ? null : <div className="petition-scene"><div className="story-modal-art lord-card-art" aria-hidden="true" data-art={art} style={wave44ImageStyle(art, SCENE_WIDTH)} /></div>;
}

/** The lord's exception rule `recurring` ("선례가 있어도 다시 올린다") as a switch. */
export function RecurringSwitch({ on, onToggle }: { readonly on: boolean; readonly onToggle: (next: boolean) => void }) {
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

/** DEC-CARD: the town's request in the heavy card's layout (src/ui/decisionCard/families/lordRequestCard.ts). */
export function LordRequestModal({ view, card, onGrant, onLater }: {
  readonly view: LordRequestView; readonly card: DecisionCardView; readonly onGrant: () => void; readonly onLater: () => void;
}) {
  return <DecisionCard view={card} className="lord-card" data={{ "data-lord-request": view.kind }} onChoose={() => onGrant()} onLater={onLater} />;
}
