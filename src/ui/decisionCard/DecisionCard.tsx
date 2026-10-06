import type { ReactElement, ReactNode } from "react";
import { DECISION_COPY } from "../decisionCopy.ko";
import { EmblemImage, type EmblemSpec } from "../heraldry/EmblemImage";
import { Button } from "../kit";
import { storyArtStyle } from "../storyArt";
import { wave8FrameLayerStyle } from "../wave8Art";
import { DECISION_CARD_COPY as COPY } from "./decisionCardCopy.ko";
import type { DecisionCardView, DecisionChoiceView } from "./decisionCardTypes";

// DEC-CARD: the heavy decision card. Every family's card is this one layout in the petition frame (Wave 8), wider than
// before (only heavy decisions reach the lord now, GP-7): the situation and the stake in words, then the answers side
// by side (stacked on a narrow view), each with what happens now, later, and who will remember it. The answers are
// equal choices, all secondary (LR1-D2, P-D3); an answer the engine refuses is shown shut with its reason. `extra`
// is a family's own part (the heir candidates, the petitioners) under the stake.

const ART_WIDTH = 300;

function Lines({ heading, lines, empty }: { readonly heading: string; readonly lines: readonly string[]; readonly empty: string }): ReactElement {
  return <div className="decision-card-part">
    <span className="decision-card-part-head">{heading}</span>
    {lines.length === 0 ? <span className="decision-card-none">{empty}</span> : <ul>{lines.map(line => <li key={line}>{line}</li>)}</ul>}
  </div>;
}

function Choice({ choice, onChoose }: { readonly choice: DecisionChoiceView; readonly onChoose: (id: string) => void }): ReactElement {
  return <li className="decision-card-choice" data-choice={choice.id} data-refused={choice.refusal === null ? "false" : "true"}>
    <h3>{choice.label}</h3>
    <Lines heading={COPY.now} lines={choice.now} empty={COPY.nothingLater} />
    <Lines heading={COPY.later} lines={choice.later} empty={COPY.nothingLater} />
    <Lines heading={COPY.remembers} lines={choice.remembers.map(entry => `${entry.who}: ${entry.how}`)} empty={COPY.nobodyRemembers} />
    {choice.refusal === null ? null : <p className="decision-card-refusal">{choice.refusal}</p>}
    <Button type="button" className="decision-card-choose" variant="secondary" size="md" data-choose={choice.id} disabled={choice.refusal !== null}
      aria-label={DECISION_COPY.choose(choice.label)} onPress={() => onChoose(choice.id)}>{COPY.choose(choice.label)}</Button>
  </li>;
}

export function DecisionCard({ view, onChoose, onLater, extra = null, laterLabel = COPY.later_, crest = null, className = "", data = {} }: {
  readonly view: DecisionCardView; readonly onChoose: (choiceId: string) => void; readonly onLater: () => void;
  readonly extra?: ReactNode; readonly laterLabel?: string;
  /** Arms in the frame's empty roundel (its top-left corner), as the lord cards show the lord house's (LR1-D5). */
  readonly crest?: Readonly<{ arms: EmblemSpec; label: string }> | null;
  /** A family's own class and data attributes (the selectors its captures and geometry rows already use). */
  readonly className?: string; readonly data?: Readonly<Record<`data-${string}`, string>>;
}): ReactElement {
  return (
    <div className="story-modal-backdrop" role="presentation">
      <section className={`story-modal petition-card decision-card${className === "" ? "" : ` ${className}`}`} data-frame="petition" role="dialog" aria-modal="true"
        aria-label={view.title} data-decision-card={view.family} data-subject={view.subjectId} data-answers={String(view.choices.length)} {...data}>
        <span className="petition-frame" aria-hidden="true" style={wave8FrameLayerStyle("frame_petition")} />
        {crest === null ? null : <span className="petition-roundel"><EmblemImage emblem={crest.arms} size={38} label={crest.label} /></span>}
        <div className="petition-body decision-card-body">
          {view.court === null ? null : <p className="decision-card-court">{view.court}</p>}
          <header className="decision-card-head">
            {view.illustration === null ? null : <div className="decision-card-art" aria-hidden="true" style={storyArtStyle(view.illustration, ART_WIDTH)} />}
            <div className="decision-card-heading">
              {view.from === null ? null : <p className="decision-card-from">{view.from}</p>}
              <h2>{view.title}</h2>
              <p className="decision-card-situation"><span className="decision-card-part-head">{COPY.situation}</span>{view.situation}</p>
              <p className="decision-card-stake"><span className="decision-card-part-head">{COPY.stake}</span>{view.stake}</p>
              {view.deadline === null ? null : <p className="decision-card-deadline">{view.deadline}</p>}
            </div>
          </header>
          {extra}
          <ol className="decision-card-choices">{view.choices.map(choice => <Choice key={choice.id} choice={choice} onChoose={onChoose} />)}</ol>
          <Button type="button" className="story-modal-later" variant="secondary" onPress={() => onLater()}>{laterLabel}</Button>
        </div>
      </section>
    </div>
  );
}
