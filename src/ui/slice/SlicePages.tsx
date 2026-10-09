import type { ReactElement, ReactNode } from "react";
import type { GameState } from "../../engine/engine.types";
import { SnapshotMapView } from "../chronicle/SnapshotMapView";
import { EmblemImage } from "../heraldry/EmblemImage";
import { Button } from "../kit";
import { UiIcon } from "../UiIcon";
import { wave16Url } from "../wave16Art";
import { wave8ContentStyle, wave8FrameLayerStyle, wave8Url } from "../wave8Art";
import { SLICE_COPY } from "./sliceCopy.ko";
import type { SliceEndView } from "./sliceEndModel";
import type { SliceStartView } from "./sliceStartModel";

// LM-R3 phase 2a: the lord slice's opening page and its end in the chapter page's frame (the chronicle page, Wave 8):
// the lines scroll in their own region, the footer under them holds the one primary (UI-AUDIT-1). The end page's
// secondaries open the chronicle (the slice's years, or one decision's record) over it; closing the chronicle comes back.
// Text 13–15 px, nothing under 12; buttons 48 px (the chapter page's).

function Page({ kind, label, backdrop, footer, children }: {
  readonly kind: "start" | "end"; readonly label: string; readonly backdrop: string; readonly footer: ReactNode; readonly children: ReactNode;
}): ReactElement {
  return (
    <div className="story-modal-backdrop story-modal-backdrop--chronicle" role="presentation" style={{ backgroundImage: `url("${backdrop}")` }}>
      <section className={`chronicle-page slice-page slice-${kind}`} data-frame="chapter-page" data-slice={kind} role="dialog" aria-modal="true" aria-label={label}>
        <span className="chronicle-frame" aria-hidden="true" style={wave8FrameLayerStyle("frame_chronicle_page")} />
        <div className="chapter-page-body chapter-page-main" style={wave8ContentStyle("frame_chronicle_page")}>
          <div className="chapter-page-scroll">{children}</div>
          <div className="chronicle-page-footer"><div className="chronicle-actions">{footer}</div></div>
        </div>
      </section>
    </div>
  );
}

const Lines = ({ lines, className }: { readonly lines: readonly string[]; readonly className?: string }): ReactElement =>
  <ul className={className === undefined ? "slice-lines" : `slice-lines ${className}`}>{lines.map(line => <li key={line}>{line}</li>)}</ul>;

export function SliceStartPage({ view, onBegin }: { readonly view: SliceStartView; readonly onBegin: () => void }): ReactElement {
  const copy = SLICE_COPY.start;
  return (
    <Page kind="start" label={view.title} backdrop={wave8Url("keyart_title_bg")}
      footer={<Button type="button" className="slice-begin chronicle-keep" variant="primary" onPress={() => onBegin()}><UiIcon sheet="time" cell="play" />{copy.begin}</Button>}>
      <p className="slice-kicker">{copy.kicker}</p>
      <header className="slice-start-head">
        <span className="slice-arms"><EmblemImage emblem={view.arms} size={64} label={view.armsLabel} /></span>
        <div className="slice-start-heading">
          <h2>{view.title}</h2>
          <p className="slice-you">{view.house}</p>
          <p>{view.home}</p>
        </div>
      </header>
      <div className="chronicle-columns">
        <section className="slice-part">
          <h3>{copy.town}</h3><p>{view.town}</p>
          <h3>{copy.neighbours}</h3>
          <ul className="slice-lines slice-neighbours">{view.neighbours.map(neighbour => <li key={neighbour.id} data-estate={neighbour.id}>
            <span>{neighbour.line}</span>{neighbour.notes.length === 0 ? null : <span className="slice-note">{SLICE_COPY.end.list(neighbour.notes)}</span>}
          </li>)}</ul>
        </section>
        <section className="slice-part">
          <h3>{copy.factions}</h3>
          <ul className="slice-lines slice-factions">{view.factions.map(faction => <li key={faction.id} data-faction={faction.id}>{faction.line}</li>)}</ul>
          <h3>{copy.slice}</h3><Lines lines={view.slice} className="slice-rules" />
        </section>
      </div>
    </Page>
  );
}

function LastYear({ view, onYearCard, onSeasonCard }: {
  readonly view: SliceEndView; readonly onYearCard: () => void; readonly onSeasonCard: () => void;
}): ReactElement {
  const copy = SLICE_COPY.end;
  const { last } = view;
  return (
    <section className="slice-part slice-last-year" data-year={last.year}>
      <h3>{last.heading}</h3>
      {last.empty !== null ? <p>{last.empty}</p> : <>
        {last.house.length === 0 ? null : <><h4>{copy.lastHouse}</h4><Lines lines={last.house} /></>}
        <h4>{copy.lastDecisions}</h4>
        {last.decisions.length === 0 ? <p className="slice-note">{copy.lastNoDecision}</p> : <Lines lines={last.decisions} />}
        {last.changed.length === 0 ? null : <><h4>{copy.lastChanged}</h4>
          {last.changed.map(group => <div key={group.key} className="slice-last-group"><p className="slice-note">{group.heading}</p><Lines lines={group.lines} /></div>)}
          {last.more === null ? null : <p className="slice-note">{last.more}</p>}</>}
      </>}
      <div className="slice-links">
        <Button type="button" className="slice-year-card" variant="secondary" size="sm" onPress={() => onYearCard()}>{copy.yearCard(last.year)}</Button>
        {view.seasonCard ? <Button type="button" className="slice-season-card" variant="secondary" size="sm" onPress={() => onSeasonCard()}>{copy.seasonCard}</Button> : null}
      </div>
    </section>
  );
}

export function SliceEndPage({ state, view, onContinue, onChronicle, onRecord, onYearCard, onSeasonCard }: {
  readonly state: GameState; readonly view: SliceEndView; readonly onContinue: () => void; readonly onChronicle: () => void;
  readonly onRecord: (recordId: string, tick: number) => void;
  /** The user's ruling: the last year's card and the end season's card, opened over the page (closing them comes back). */
  readonly onYearCard: () => void; readonly onSeasonCard: () => void;
}): ReactElement {
  const copy = SLICE_COPY.end;
  return (
    <Page kind="end" label={view.title} backdrop={wave16Url("chapter1_end")}
      footer={<>
        <Button type="button" className="slice-chronicle" variant="secondary" onPress={() => onChronicle()}><UiIcon sheet="action" cell="log" />{copy.chronicle}</Button>
        <Button type="button" className="slice-continue chronicle-keep" variant="primary" onPress={() => onContinue()}><UiIcon sheet="time" cell="play" />{copy.continue}</Button>
      </>}>
      <p className="slice-kicker">{copy.kicker}</p>
      <h2>{view.title}</h2>
      <LastYear view={view} onYearCard={onYearCard} onSeasonCard={onSeasonCard} />
      <section className="slice-part slice-why"><h3>{copy.why}</h3><p>{view.why}</p></section>
      <section className="slice-part slice-then-now">
        <h3>{copy.thenNow}</h3>
        <SnapshotMapView state={state} snapshot={view.then.snapshot} compare compact />
        <div className="chronicle-columns">
          <div><h4>{view.then.heading}</h4><Lines lines={view.then.lines} /></div>
          <div><h4>{view.now.heading}</h4><Lines lines={view.now.lines} /></div>
        </div>
      </section>
      <section className="slice-part slice-shaped">
        <h3>{copy.shaped}</h3>
        <p className="slice-note">{copy.shapedLead}</p>
        {view.shaped.length === 0 ? <p>{copy.noShaped}</p> : <ol className="slice-decisions">{view.shaped.map(decision => <li key={decision.id} data-record={decision.id}>
          <p className="slice-decision-head"><strong>{decision.heading}</strong><span className="slice-note">{decision.followed}</span></p>
          <Lines lines={decision.lines} />
          <Button type="button" className="slice-record" variant="secondary" size="sm" onPress={() => onRecord(decision.id, decision.tick)}>{copy.toRecord}</Button>
        </li>)}</ol>}
      </section>
      <section className="slice-part slice-remembers">
        <h3>{copy.remembers}</h3>
        {view.remembers.length === 0 ? <p>{copy.noRemembers}</p> : <Lines lines={view.remembers} />}
      </section>
      <section className="slice-part slice-years">
        <h3>{copy.years20}</h3>
        {view.smallTotal === null ? null : <p className="slice-note slice-small-total">{view.smallTotal}</p>}
        <ol className="slice-lines slice-year-lines">{view.years.map(entry => <li key={entry.year} data-year={entry.year}>
          <span>{entry.line}</span>
          {entry.big.length === 0 ? null : <ul className="slice-lines slice-year-big">{entry.big.map(decision => <li key={decision.id} data-record={decision.id}>
            <span>{decision.line} <span className="slice-note">{decision.followed}</span></span>
            {decision.lines.length === 0 ? null : <Lines lines={decision.lines} className="slice-year-followed" />}
          </li>)}</ul>}
          {entry.small === null ? null : <span className="slice-note slice-year-small">{entry.small}</span>}
        </li>)}</ol>
      </section>
      <p className="slice-question">{copy.question}</p>
    </Page>
  );
}
