import { useEffect, useMemo, useRef, useState } from "react";
import { PRESSURE_BALANCE } from "../../content/balanceConfig";
import type { GameState } from "../../engine/engine.types";
import type { HistorySeverity } from "../../engine/history.types";
import { UiIcon } from "../UiIcon";
import { wave19ImageStyle } from "../wave19Art";
import { BIOGRAPHY_PAGE, BiographyPage } from "./BiographyPage";
import { ChronicleTimeline } from "./ChronicleTimeline";
import { CHRONICLE_SCREEN_COPY as COPY } from "./chronicleScreenCopy.ko";
import {
  biographyView, CHRONICLE_KINDS, chronicleDate, chronicleItems, chroniclePeople, chronicleYears, decisionCompare, DEFAULT_CHRONICLE_FILTER,
  itemIndexAt, recordCard, seasonWindow, timelineChapters, timelineMarkers, timelineSegments, timelineTickAt,
  type ChronicleFilter, type ChronicleItem, type ChronicleKind, type TimelineMarkerKind,
} from "./chronicleScreenModel";
import { DECISION_FRAME, DecisionCompareFrame } from "./DecisionCompareFrame";
import { CARD_ROW, RecordCardView } from "./RecordCardView";
import { SnapshotMapView } from "./SnapshotMapView";

// CHRON-1 chronicle screen (CHRONICLE_DESIGN 2.1, 2.2, 2.4): a full-screen modal over the town (the state machine's
// `history` modal: time stops while it is up). The timeline on top, the filters, the record cards (a virtual list:
// only the rows in view are built, so 30,000 records open like 30), and beside them the picked record — the map as it
// was (and today's beside it), or a decision's record. A person opens their biography in place of the list.
const SEASON = PRESSURE_BALANCE.seasonTicks;
const OVERSCAN = 3;
/** Room above the first card and below the last for the picked card's ring. */
const LIST_PAD = 4;
/** The detail pane's width (CSS `.chronicle-detail`) and the decision frame's scale in it. */
const DECISION_SCALE = 0.96;

type Tile = { readonly tx: number; readonly ty: number };

/** The picked record: a decision's record (or, on [그때 지도], its map), any other record's map as it was. */
function ChronicleDetail({ state, item, view, compare, onView, onCompare, onLookAt, onPerson }: {
  readonly state: GameState; readonly item: ChronicleItem; readonly view: "record" | "map"; readonly compare: boolean;
  readonly onView: (view: "record" | "map") => void; readonly onCompare: () => void;
  readonly onLookAt: (tile: Tile) => void; readonly onPerson: (personId: string) => void;
}) {
  const card = recordCard(state, item);
  const decision = decisionCompare(state, item.record);
  const showMap = decision === null || view === "map";
  return (
    <div className="chronicle-detail-body" data-detail={card.id} data-kind={card.kind} data-view={showMap ? "map" : "record"}>
      <h3 className="chronicle-detail-date">{card.date}</h3>
      <p className="chronicle-detail-line">{card.sentence}</p>
      {card.numbers === null ? null : <p className="chronicle-detail-numbers">{card.numbers}</p>}
      {card.folded ? <p className="chronicle-detail-note">{COPY.rollupNote}</p> : null}
      {showMap ? null : <DecisionCompareFrame view={decision} scale={DECISION_SCALE} />}
      <div className="chronicle-detail-map">
        {showMap ? <SnapshotMapView state={state} snapshot={card.snapshot} compare={compare} compact={false} /> : null}
        <div className="chronicle-detail-actions">
          {decision === null ? null : showMap
            ? <button type="button" className="chronicle-detail-action" onClick={() => onView("record")}><UiIcon sheet="action" cell="log" />{COPY.decisionRecord}</button>
            : card.snapshot === null ? null : <button type="button" className="chronicle-detail-action" aria-label={COPY.thenMapLabel(card.date)}
              onClick={() => onView("map")}><UiIcon sheet="layer" cell="zone" />{COPY.thenMap}</button>}
          {!showMap || card.snapshot === null ? null : <button type="button" className="chronicle-detail-action" aria-pressed={compare} aria-label={COPY.mapCompareLabel}
            onClick={() => onCompare()}><UiIcon sheet="layer" cell="zone" />{COPY.mapCompare}</button>}
          {card.place === null ? null : <button type="button" className="chronicle-detail-action" aria-label={COPY.lookAtLabel(card.date)}
            onClick={() => { if (card.place !== null) onLookAt(card.place); }}><UiIcon sheet="action" cell="look" />{COPY.lookAt}</button>}
          {card.personId === null || card.personName === null ? null : <button type="button" className="chronicle-detail-action" aria-label={COPY.personLabelFor(card.personName)}
            onClick={() => { if (card.personId !== null) onPerson(card.personId); }}><UiIcon sheet="resource" cell="population" />{COPY.person}</button>}
        </div>
      </div>
    </div>
  );
}

export function ChronicleScreen({ state, onClose, onLookAt, initialPersonId = null }: {
  readonly state: GameState; readonly onClose: () => void; readonly onLookAt: (tile: Tile) => void;
  /** UI-5: opened from a person card's [전기 보기], on that person's biography. */
  readonly initialPersonId?: string | null;
}) {
  const [filter, setFilter] = useState<ChronicleFilter>(DEFAULT_CHRONICLE_FILTER);
  const [selected, setSelected] = useState<string | null>(null);
  const [pickedTick, setPickedTick] = useState(state.tick);
  const [zoomed, setZoomed] = useState(false);
  const [zoomTick, setZoomTick] = useState(state.tick);
  const [compare, setCompare] = useState(false);
  const [detailView, setDetailView] = useState<"record" | "map">("record");
  const [personId, setPersonId] = useState<string | null>(initialPersonId);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState({ list: 480, page: 640 });
  const list = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);

  // Memo (key: the ledger and the filter; the timeline adds the eras and now): the rows filter and fold the whole ledger,
  // and time is stopped while the screen is up, so nothing else rebuilds them. Measured (chron1Captures, DGX): 30,000
  // records open, rows to first painted frame, in 57–162 ms; the model part alone about 12 ms (tests/chronicleScreen).
  const items = useMemo(() => chronicleItems(state, filter), [state.history, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const indexOf = useMemo(() => new Map(items.map((item, index) => [item.key, index])), [items]);
  const segments = useMemo(() => timelineSegments(state), [state.scenarioId, state.historicalEras, state.tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const markers = useMemo(() => timelineMarkers(items.map(item => item.record), segments), [items, segments]);
  const chapters = useMemo(() => timelineChapters(state), [state.politics, state.tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const people = useMemo(() => chroniclePeople(state), [state.history, state.persons]); // eslint-disable-line react-hooks/exhaustive-deps
  const years = useMemo(() => chronicleYears(state), [state.scenarioId, state.tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const seasons = useMemo(() => zoomed ? seasonWindow(state, items, zoomTick) : [], [zoomed, items, zoomTick, state.tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const biography = useMemo(() => personId === null ? null : biographyView(state, personId), [personId, state.history, state.persons]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const observer = new ResizeObserver(() => {
      setViewport({ list: list.current?.clientHeight ?? 480, page: body.current?.clientHeight ?? 640 });
    });
    if (list.current !== null) observer.observe(list.current);
    if (body.current !== null) observer.observe(body.current);
    return () => observer.disconnect();
  }, [personId === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const scrollTo = (index: number) => {
    const top = Math.max(0, index * CARD_ROW - CARD_ROW);
    if (list.current !== null) list.current.scrollTop = top;
    setScrollTop(top);
  };
  const changeFilter = (next: ChronicleFilter) => {
    setFilter(next); setSelected(null); setCompare(false);
    if (list.current !== null) list.current.scrollTop = 0;
    setScrollTop(0);
  };
  const goTo = (tick: number) => {
    const at = Math.min(state.tick, Math.max(0, tick));
    setPickedTick(at); setZoomTick(at);
    if (items.length === 0) return;
    const index = itemIndexAt(items, at);
    setSelected(items[index]!.key); scrollTo(index);
  };
  const openPerson = (id: string) => { setPersonId(id); };
  const openRecord = (recordId: string, tick: number) => {
    // A record from a biography: the person's whole ledger (every severity), with it picked.
    const person = personId;
    setPersonId(null);
    setFilter({ ...DEFAULT_CHRONICLE_FILTER, severity: 0, personId: person });
    setSelected(recordId); setPickedTick(tick); setZoomTick(tick);
  };
  // After a biography's record link, scroll to the record once the list is back.
  useEffect(() => {
    if (personId !== null || selected === null) return;
    const index = indexOf.get(selected);
    if (index !== undefined && list.current !== null && (index * CARD_ROW < list.current.scrollTop || index * CARD_ROW > list.current.scrollTop + viewport.list)) scrollTo(index);
  }, [personId, indexOf]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedIndex = selected === null ? (items.length > 0 ? 0 : -1) : indexOf.get(selected) ?? -1;
  const selectedItem = selectedIndex < 0 ? undefined : items[selectedIndex];
  const first = Math.max(0, Math.floor(scrollTop / CARD_ROW) - OVERSCAN);
  const last = Math.min(items.length, Math.ceil((scrollTop + viewport.list) / CARD_ROW) + OVERSCAN);
  const visible = items.slice(first, last);
  const toggleKind = (kind: ChronicleKind) => changeFilter({ ...filter,
    kinds: filter.kinds.includes(kind) ? filter.kinds.filter(entry => entry !== kind) : CHRONICLE_KINDS.filter(entry => entry === kind || filter.kinds.includes(entry)) });
  const yearValue = (value: string) => value === "" ? null : Number(value);
  const pageScale = Math.min(1, Math.max(0.5, (viewport.page - 8) / BIOGRAPHY_PAGE.height));

  return (
    <div className="chronicle-screen" role="dialog" aria-modal="true" aria-label={COPY.title} data-chronicle="open" data-records={items.length}
      data-view={personId === null ? "records" : "person"}>
      <header className="chronicle-header">
        <h2>{COPY.title}</h2>
        <span className="chronicle-now">{COPY.now(chronicleDate(state, state.tick))}</span>
        {personId === null ? (
          <ul className="chronicle-legend" aria-label={COPY.legendLabel}>
            {(Object.keys(COPY.markerLegend) as TimelineMarkerKind[]).map(kind => (
              <li key={kind}><span aria-hidden="true" style={wave19ImageStyle(`timeline_marker_${kind}`, 18)} />{COPY.markerLegend[kind]}</li>
            ))}
          </ul>
        ) : <button type="button" className="chronicle-back" onClick={() => setPersonId(null)}><UiIcon sheet="action" cell="log" />{COPY.back}</button>}
        <button type="button" className="chronicle-close" aria-label={COPY.closeLabel} onClick={() => onClose()}>{COPY.close}</button>
      </header>
      {personId !== null ? (
        <div className="chronicle-page-body" ref={body}>
          {biography === null ? <p className="chronicle-empty">{COPY.lifeEmpty}</p>
            : <BiographyPage view={biography} scale={pageScale} onPerson={id => openPerson(id)} onRecord={(recordId, tick) => openRecord(recordId, tick)} />}
        </div>
      ) : <>
        <ChronicleTimeline segments={segments} markers={markers} chapters={chapters} nowTick={state.tick} pickedTick={pickedTick} zoomed={zoomed}
          seasons={seasons} pickedSeason={Math.floor(pickedTick / SEASON)}
          onPick={fraction => { if (fraction === null) setZoomed(true); else goTo(timelineTickAt(segments, fraction)); }}
          onPickSeason={cell => goTo(cell.to)} onZoom={() => { setZoomTick(pickedTick); setZoomed(value => !value); }}
          onShift={step => setZoomTick(tick => Math.min(state.tick, Math.max(0, tick + step * SEASON)))} />
        <div className="chronicle-filters" role="group" aria-label={COPY.filtersLabel}>
          <div className="chronicle-kinds">
            {CHRONICLE_KINDS.map(kind => {
              const on = filter.kinds.includes(kind);
              return <button key={kind} type="button" className="chronicle-kind" data-kind={kind} aria-pressed={on} aria-label={COPY.kindToggle(COPY.kinds[kind], on)}
                onClick={() => toggleKind(kind)}>{COPY.kinds[kind]}</button>;
            })}
          </div>
          <label className="chronicle-select">{COPY.severityLabel}
            <select value={filter.severity} onChange={event => changeFilter({ ...filter, severity: Number(event.currentTarget.value) as HistorySeverity })}>
              {COPY.severities.map((name, level) => <option key={name} value={level}>{name}</option>)}
            </select></label>
          <label className="chronicle-select">{COPY.fromLabel}
            <select value={filter.fromYear ?? ""} onChange={event => changeFilter({ ...filter, fromYear: yearValue(event.currentTarget.value) })}>
              <option value="">{COPY.firstYear}</option>
              {years.map(year => <option key={year} value={year}>{year}</option>)}
            </select></label>
          <label className="chronicle-select">{COPY.toLabel}
            <select value={filter.toYear ?? ""} onChange={event => changeFilter({ ...filter, toYear: yearValue(event.currentTarget.value) })}>
              <option value="">{COPY.lastYear}</option>
              {years.map(year => <option key={year} value={year}>{year}</option>)}
            </select></label>
          <label className="chronicle-select chronicle-select--person">{COPY.personLabel}
            <select value={filter.personId ?? ""} onChange={event => {
              const id = event.currentTarget.value === "" ? null : event.currentTarget.value;
              // A person's own lines are mostly everyday: choosing one shows every severity.
              changeFilter({ ...filter, personId: id, severity: id === null ? filter.severity : 0 });
            }}>
              <option value="">{COPY.anyPerson}</option>
              {people.map(person => <option key={person.id} value={person.id}>{COPY.personOption(person.name, person.count)}</option>)}
            </select></label>
          <span className="chronicle-count" role="status">{COPY.count(items.length)}</span>
        </div>
        <div className="chronicle-body">
          <div className="chronicle-list" ref={list} onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
            {items.length === 0 ? <p className="chronicle-empty">{COPY.empty}</p> : (
              <div className="chronicle-list-space" role="list" aria-label={COPY.count(items.length)} style={{ height: items.length * CARD_ROW + LIST_PAD * 2 }}>
                {visible.map((item, offset) => (
                  <RecordCardView key={item.key} card={recordCard(state, item)} selected={first + offset === selectedIndex} position={first + offset + 1} total={items.length}
                    style={{ top: LIST_PAD + (first + offset) * CARD_ROW }}
                    onSelect={id => { setSelected(id); setPickedTick(item.tick); setDetailView("record"); }}
                    onLookAt={tile => onLookAt(tile)}
                    onMap={id => { setSelected(id); setPickedTick(item.tick); setDetailView("map"); }}
                    onPerson={id => openPerson(id)} />
                ))}
              </div>)}
          </div>
          <aside className="chronicle-detail" aria-label={COPY.thenMap} style={{ width: DECISION_FRAME.width * DECISION_SCALE + 24 }}>
            {selectedItem === undefined ? <p className="chronicle-hint">{COPY.pickHint}</p>
              : <ChronicleDetail state={state} item={selectedItem} view={detailView} compare={compare} onView={view => setDetailView(view)}
                onCompare={() => setCompare(value => !value)}
                onLookAt={tile => onLookAt(tile)} onPerson={id => openPerson(id)} />}
          </aside>
        </div>
      </>}
    </div>
  );
}
