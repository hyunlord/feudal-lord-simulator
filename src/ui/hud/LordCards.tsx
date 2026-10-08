import { DecisionCard } from "../decisionCard/DecisionCard";
import type { DecisionCardView } from "../decisionCard/decisionCardTypes";
import { EmblemImage, type EmblemSpec } from "../heraldry/EmblemImage";
import type { LordRequestView } from "../lordCardsModel";
import { wave8FrameLayerStyle } from "../wave8Art";

// LM-R1 (petitions) the lord's cards (lord mode only; state machine modals: time stops while one is up). They wear the
// petition card's Wave 8 frame and body as the political petitions do; the Wave 44 picture is shown whole (16:9), the
// title, the request and the answers are text over nothing painted. Answers are kit buttons with their seal; each shows
// the engine's numbers for it (the treasury now and the factions' relation moves). DEC-CARD-2: the precedent card and
// its switch are gone (DEC-TRACE DTR-1): the steward's season is the season card's, his settings the lord screen's.

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

/** DEC-CARD: the town's request in the heavy card's layout (src/ui/decisionCard/families/lordRequestCard.ts). */
export function LordRequestModal({ view, card, onGrant, onLater }: {
  readonly view: LordRequestView; readonly card: DecisionCardView; readonly onGrant: () => void; readonly onLater: () => void;
}) {
  return <DecisionCard view={card} className="lord-card" data={{ "data-lord-request": view.kind }} onChoose={() => onGrant()} onLater={onLater} />;
}
