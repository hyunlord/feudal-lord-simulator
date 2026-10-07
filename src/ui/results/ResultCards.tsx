import type { ReactElement, ReactNode } from "react";
import { Button } from "../kit";
import { storyArtStyle } from "../storyArt";
import { wave8FrameLayerStyle } from "../wave8Art";
import type { HouseChangeView, HouseNextAction } from "./houseChange";
import { RESULTS_COPY as COPY } from "./resultsCopy.ko";
import type { YearReviewView } from "./yearReview";

// DEC-CARD (result side): the year's card and the house card in the petition frame (Wave 8), as the decision card is.
// Neither is a choice: the year's card has one primary [계속] and the way to the chronicle; the house card's primary is
// its next act (the estates screen, the lord's card) when it has one, else [계속]. [계속] is the cards' `.story-modal-later`
// (the way every story card is put away). Text 13–14 px, nothing under 12.

const ART_WIDTH = 300;

function Part({ heading, children }: { readonly heading: string; readonly children: ReactNode }): ReactElement {
  return <section className="results-card-part"><h3>{heading}</h3>{children}</section>;
}

const List = ({ lines }: { readonly lines: readonly string[] }): ReactElement => <ul>{lines.map(line => <li key={line}>{line}</li>)}</ul>;

function Frame({ className, label, data, children }: {
  readonly className: string; readonly label: string; readonly data: Readonly<Record<`data-${string}`, string>>; readonly children: ReactNode;
}): ReactElement {
  return (
    <div className="story-modal-backdrop" role="presentation">
      <section className={`story-modal petition-card results-card ${className}`} data-frame="petition" role="dialog" aria-modal="true" aria-label={label} {...data}>
        <span className="petition-frame" aria-hidden="true" style={wave8FrameLayerStyle("frame_petition")} />
        <div className="petition-body results-card-body">{children}</div>
      </section>
    </div>
  );
}

export function YearReviewCard({ view, onContinue, onChronicle }: {
  readonly view: YearReviewView; readonly onContinue: () => void; readonly onChronicle: () => void;
}): ReactElement {
  return (
    <Frame className="year-review" label={view.title} data={{ "data-year-review": String(view.year) }}>
      <h2>{view.title}</h2>
      {view.empty !== null ? <p className="results-card-empty">{view.empty}</p> : <>
        <Part heading={COPY.year.decisions}>
          {view.decisions.length === 0 ? <p className="results-card-none">{COPY.year.noDecision}</p>
            : <ul className="year-review-decisions">{view.decisions.map(decision => <li key={decision.id} data-record={decision.id}>
              <span className="year-review-decision">{decision.line}</span>
              {decision.outcome === "" ? null : <span className="year-review-outcome">{decision.outcome}</span>}
            </li>)}</ul>}
        </Part>
        {view.answers.length === 0 ? null : <Part heading={COPY.year.answers}><List lines={view.answers} /></Part>}
        {view.relations.length === 0 ? null : <Part heading={COPY.year.relations}>
          {view.relations.map(group => <div key={group.key} className="year-review-group" data-reason={group.key}>
            <p className="year-review-group-head">{group.heading}</p><List lines={group.lines} /></div>)}
        </Part>}
        {view.receipts.length === 0 ? null : <Part heading={COPY.year.receipts}><List lines={view.receipts} /></Part>}
        {view.town.length === 0 ? null : <Part heading={COPY.year.town}><List lines={view.town} /></Part>}
      </>}
      <div className="results-card-actions">
        <Button type="button" className="results-card-chronicle" variant="secondary" onPress={() => onChronicle()}>{COPY.year.chronicle}</Button>
        <Button type="button" className="story-modal-later results-card-continue" variant="primary" onPress={() => onContinue()}>{COPY.year.continue}</Button>
      </div>
    </Frame>
  );
}

export function HouseChangeCard({ view, onContinue, onNext }: {
  readonly view: HouseChangeView; readonly onContinue: () => void; readonly onNext: (next: HouseNextAction) => void;
}): ReactElement {
  const next = view.next;
  return (
    <Frame className="house-change" label={view.title} data={{ "data-house-change": view.kind, "data-record": view.id }}>
      <p className="results-card-court">{view.court}</p>
      <header className="results-card-head">
        {view.illustration === null ? null : <div className="results-card-art" aria-hidden="true" style={storyArtStyle(view.illustration, ART_WIDTH)} />}
        <div className="results-card-heading">
          <p className="results-card-from">{COPY.house.from}</p>
          <h2>{view.title}</h2>
          <Part heading={COPY.house.happened}><List lines={view.happened} /></Part>
        </div>
      </header>
      <Part heading={COPY.house.heir}><p className="house-change-heir">{view.heir}</p></Part>
      <Part heading={COPY.house.rights}><List lines={view.rights} /></Part>
      {view.promises.length === 0 ? null : <Part heading={COPY.house.promises}><List lines={view.promises} /></Part>}
      {next === null ? null : <Part heading={COPY.house.next}>
        <Button type="button" className="house-change-next" data-next={next.kind === "screen" ? next.screen : "person"} variant="primary"
          onPress={() => onNext(next)}>{next.label}</Button></Part>}
      <div className="results-card-actions">
        <Button type="button" className="story-modal-later results-card-continue" variant={next === null ? "primary" : "secondary"} onPress={() => onContinue()}>{COPY.house.continue}</Button>
      </div>
    </Frame>
  );
}
