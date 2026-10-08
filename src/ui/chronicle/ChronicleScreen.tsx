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
  biographyView, CHRONICLE_KINDS, chronicleDate, factionNameOf, chronicleItems, chroniclePeople, chronicleYears, decisionCompare, DEFAULT_CHRONICLE_FILTER,
  itemIndexAt, seasonWindow, timelineChapters, timelineMarkers, timelineSegments, timelineTickAt,
  type ChronicleFilter, type ChronicleItem, type ChronicleKind, type TimelineMarkerKind,
  yearOfTick,
} from "./chronicleScreenModel";
import { DECISION_FRAME, DecisionCompareFrame } from "./DecisionCompareFrame";
import { DecisionThread } from "./DecisionThread";
import { chronicleRecordCard, decisionThread } from "./decisionThreadModel";
import { CARD_ROW, RecordCardView } from "./RecordCardView";
import { SnapshotMapView } from "./SnapshotMapView";
import { FACTION_PAGE, FactionPage } from "./FactionPage";
import { FactionTab } from "./FactionTab";
import { FamilyTree } from "./FamilyTree";
import { FAMILY_TREE_COPY } from "./familyTreeCopy.ko";
import { FamilyLinks } from "./FamilyLinks";
import { factionPageView, factionRows, worldLines } from "./factionTabModel";
import { tugOfWarView } from "./factionInfluenceModel";
import type { FactionId } from "../../content/factionConfig";
import { INTENT_ORDER } from "../../input/intentBus";
import { platformServices } from "../../platform/platform";
import { Button, Select, Tabs } from "../kit";
import { LEGACY_SCREEN_COPY } from "../legacy/legacyScreenCopy.ko";
import { chronicleFilterFocus, chronicleFocus, clearChronicleFocus } from "../lord/chronicleFocus";

// CHRON-1 chronicle screen (CHRONICLE_DESIGN 2.1, 2.2, 2.4): a full-screen modal over the town (the state machine's
// `history` modal: time stops while it is up). The timeline on top, the filters, the record cards (a virtual list:
// only the rows in view are built, so 30,000 records open like 30), and beside them the picked record — the map as it
// was (and today's beside it), or a decision's record. A person opens their biography in place of the list.
// UI-6 (CHRON-2 first pass): the "세력" tab beside the records — the nine factions and the world beyond, a faction's
// page in place of the list; its remembered records open in the list (filtered to the faction) with a way back. Esc
// steps back one page (a faction's page -> the factions; a record opened from it -> that page) before it closes.
const SEASON = PRESSURE_BALANCE.seasonTicks;
const OVERSCAN = 3;
/** Room above the first card and below the last for the picked card's ring. */
const LIST_PAD = 4;
/** The detail pane's width (CSS `.chronicle-detail`) and the decision frame's scale in it. */
const DECISION_SCALE = 0.96;

type Tile = { readonly tx: number; readonly ty: number };

/** The picked record: a decision's record (or, on [그때 지도], its map), any other record's map as it was. */
function ChronicleDetail({ state, item, view, compare, onView, onCompare, onLookAt, onPerson, onFaction, onRecord }: {
  readonly state: GameState; readonly item: ChronicleItem; readonly view: "record" | "map"; readonly compare: boolean;
  readonly onView: (view: "record" | "map") => void; readonly onCompare: () => void;
  readonly onLookAt: (tile: Tile) => void; readonly onPerson: (personId: string) => void; readonly onFaction: (factionId: string) => void;
  /** DEC-CARD-2: a thread line opens its record (the decision behind, a consequence). */
  readonly onRecord: (recordId: string, tick: number) => void;
}) {
  const card = chronicleRecordCard(state, item);
  const decision = decisionCompare(state, item.record);
  // DEC-CARD-2 (lord mode): the record's thread. Memo (key: the record and the ledger, the factions' memories, the thread):
  // the list's scroll re-renders the screen, and the thread reads the whole span (time stands still while it is up).
  // why: the thread reads only these parts of the state
  const thread = useMemo(() => decisionThread(state, item.record), [item.record, state.history, state.factions, state.trace]); // eslint-disable-line react-hooks/exhaustive-deps
  const showMap = decision === null || view === "map";
  return (
    <div className="chronicle-detail-body" data-detail={card.id} data-kind={card.kind} data-view={showMap ? "map" : "record"}>
      <h3 className="chronicle-detail-date">{card.date}</h3>
      <p className="chronicle-detail-line">{card.sentence}</p>
      {card.numbers === null ? null : <p className="chronicle-detail-numbers">{card.numbers}</p>}
      {card.folded ? <p className="chronicle-detail-note">{COPY.rollupNote}</p> : null}
      {showMap ? null : <DecisionCompareFrame view={decision} scale={DECISION_SCALE} />}
      {thread === null || (showMap && decision !== null) ? null : <DecisionThread view={thread} onOpen={onRecord} />}
      <div className="chronicle-detail-map">
        {showMap ? <SnapshotMapView state={state} snapshot={card.snapshot} compare={compare} compact={false} /> : null}
        <div className="chronicle-detail-actions">
          {decision === null ? null : showMap
            ? <Button type="button" className="chronicle-detail-action" onPress={() => onView("record")} variant="secondary"><UiIcon sheet="action" cell="log" />{COPY.decisionRecord}</Button>
            : card.snapshot === null ? null : <Button type="button" className="chronicle-detail-action" aria-label={COPY.thenMapLabel(card.date)}
              onPress={() => onView("map")} variant="secondary"><UiIcon sheet="layer" cell="zone" />{COPY.thenMap}</Button>}
          {!showMap || card.snapshot === null ? null : <Button type="button" className="chronicle-detail-action" aria-pressed={compare} aria-label={COPY.mapCompareLabel}
            onPress={() => onCompare()} variant="secondary"><UiIcon sheet="layer" cell="zone" />{COPY.mapCompare}</Button>}
          {card.place === null ? null : <Button type="button" className="chronicle-detail-action" aria-label={COPY.lookAtLabel(card.date)}
            onPress={() => { if (card.place !== null) onLookAt(card.place); }} variant="secondary"><UiIcon sheet="action" cell="look" />{COPY.lookAt}</Button>}
          <FamilyLinks state={state} record={item.record} card={card} onPerson={onPerson} />
          {card.factionId === null || card.factionName === null ? null : <Button type="button" className="chronicle-detail-action" aria-label={COPY.factionLabelFor(card.factionName)}
            onPress={() => { if (card.factionId !== null) onFaction(card.factionId); }} variant="secondary"><UiIcon sheet="cause" cell="rights" />{COPY.faction}</Button>}
        </div>
      </div>
    </div>
  );
}

export function ChronicleScreen({ state, onClose, onLookAt, initialPersonId = null, onBook, onEnding }: {
  readonly state: GameState; readonly onClose: () => void; readonly onLookAt: (tile: Tile) => void;
  /** UI-5: opened from a person card's [전기 보기], on that person's biography. */
  readonly initialPersonId?: string | null;
  /** UI-10 (LG-9): [연대기 책] opens the book so far; [결말 다시 보기] the campaign's ending once it is written. */
  readonly onBook?: () => void;
  readonly onEnding?: (() => void) | null;
}) {
  // LM-R1: opened from a receipt's decision ribbon, on that decision's record.
  const [focus] = useState(chronicleFocus);
  const [filter, setFilter] = useState<ChronicleFilter>(() => chronicleFilterFocus(DEFAULT_CHRONICLE_FILTER)); // PLAY-2: a year card's years
  const [selected, setSelected] = useState<string | null>(focus?.recordId ?? null);
  const [pickedTick, setPickedTick] = useState(focus?.tick ?? state.tick);
  const [zoomed, setZoomed] = useState(false);
  const [zoomTick, setZoomTick] = useState(focus?.tick ?? state.tick);
  const [compare, setCompare] = useState(false);
  const [detailView, setDetailView] = useState<"record" | "map">("record");
  const [personId, setPersonId] = useState<string | null>(initialPersonId);
  // UI-7: a person's page is their biography or their family tree (a frame in the tree opens that person's biography).
  const [personTab, setPersonTab] = useState<"biography" | "tree">("biography");
  const [tab, setTab] = useState<"records" | "factions">("records");
  const [factionId, setFactionId] = useState<FactionId | null>(null);
  /** A record opened from a faction's page: the page Esc (or [세력 연대기로]) returns to. */
  const [returnFaction, setReturnFaction] = useState<FactionId | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState({ list: 480, page: 640 });
  const list = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);

  // Memo (key: the ledger and the filter; the timeline adds the eras and now): the rows filter and fold the whole ledger,
  // and time is stopped while the screen is up, so nothing else rebuilds them. Measured (chron1Captures, DGX): 30,000
  // records open, rows to first painted frame, in 57–162 ms; the model part alone about 12 ms (tests/chronicleScreen).
  // why: the rows read only the ledger (and the scenario, fixed in a game)
  const items = useMemo(() => chronicleItems(state, filter), [state.history, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const indexOf = useMemo(() => new Map(items.map((item, index) => [item.key, index])), [items]);
  // UI-KIT-1: the strip, the chapter bars and the zoomed ruler are keyed by the season, not the tick (they were rebuilt
  // every tick); "now" on them moves by seasons, the now pin keeps the exact tick.
  const seasonNow = Math.floor(state.tick / SEASON) * SEASON;
  const yearNow = yearOfTick(state, state.tick);
  const { scenarioId, historicalEras, politics } = state;
  const scenario = useMemo(() => scenarioId === undefined ? {} : { scenarioId }, [scenarioId]);
  const segments = useMemo(() => timelineSegments({ ...scenario, ...(historicalEras === undefined ? {} : { historicalEras }), tick: seasonNow }), [scenario, historicalEras, seasonNow]);
  const markers = useMemo(() => timelineMarkers(items.map(item => item.record), segments), [items, segments]);
  const chapters = useMemo(() => timelineChapters({ ...(politics === undefined ? {} : { politics }), tick: seasonNow }), [politics, seasonNow]);
  // why: the people come from the ledger and the persons only
  const people = useMemo(() => chroniclePeople(state), [state.history, state.persons]); // eslint-disable-line react-hooks/exhaustive-deps
  // why: a new year adds a year; seasonNow within it gives the same list
  const years = useMemo(() => chronicleYears({ ...scenario, tick: seasonNow }), [scenario, yearNow]); // eslint-disable-line react-hooks/exhaustive-deps
  const seasons = useMemo(() => zoomed ? seasonWindow({ ...scenario, tick: seasonNow }, items, zoomTick) : [], [zoomed, items, zoomTick, scenario, seasonNow]);
  // why: a biography reads the ledger and the persons (time stands still while it is open)
  const biography = useMemo(() => personId === null ? null : biographyView(state, personId), [personId, state.history, state.persons]); // eslint-disable-line react-hooks/exhaustive-deps
  // The faction tab reads the factions, the ledger, the persons, the petitions and the war (time stands still while it is open).
  const view = personId !== null ? "person" : tab === "records" ? "records" : factionId === null ? "factions" : "faction";
  // UI-9: state.reorganisation added — factionRows now reads factionInfluence, which depends on it.
  // why: the rows and the page are rebuilt when the tab or page opens; the state is still while the screen is up
  const rows = useMemo(() => view === "factions" ? factionRows(state) : [], [view, state.factions, state.history, state.politics, state.war, state.reorganisation]); // eslint-disable-line react-hooks/exhaustive-deps
  // why: the world's events move only with the year
  const world = useMemo(() => view === "factions" ? worldLines(state) : [], [view, yearNow]); // eslint-disable-line react-hooks/exhaustive-deps
  // why: as the rows; UI-9: state.reorganisation for revoltPressureSection.
  const factionPage = useMemo(() => view === "faction" && factionId !== null ? factionPageView(state, factionId) : null, [view, factionId, state.factions, state.history, state.politics, state.war, state.reorganisation]); // eslint-disable-line react-hooks/exhaustive-deps
  // UI-9: RG-4 tug-of-war view for the factions tab (null before chapter 4).
  // why: depends on reorganisation (the influence and warningTick it holds).
  const tug = useMemo(() => view === "factions" ? tugOfWarView(state) : null, [view, state.reorganisation]); // eslint-disable-line react-hooks/exhaustive-deps
  const returnName = returnFaction === null ? null : factionNameOf(state, returnFaction);
  const filterFactionName = filter.factionId == null ? null : factionNameOf(state, filter.factionId);

  // The list and the pages swap in and out: observe the one shown.
  const onList = view === "records";
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      // UI-AUDIT-1: a person's page is drawn below its tabs (and the column's 6 px gap): the page fits under them.
      const tabs = body.current?.querySelector<HTMLElement>(".chronicle-person-tabs") ?? null;
      const above = tabs === null ? 0 : tabs.offsetHeight + 6;
      setViewport({ list: list.current?.clientHeight ?? 480, page: (body.current?.clientHeight ?? 640) - above });
    });
    if (list.current !== null) observer.observe(list.current);
    if (body.current !== null) observer.observe(body.current);
    return () => observer.disconnect();
  }, [onList, view]);

  const scrollTo = (index: number) => {
    const top = Math.max(0, index * CARD_ROW - CARD_ROW);
    if (list.current !== null) list.current.scrollTop = top;
    setScrollTop(top);
  };
  // why: once, as the screen opens (the receipt's record scrolled into view; the request is spent)
  useEffect(() => { clearChronicleFocus(); if (focus !== null) scrollTo(indexOf.get(focus.recordId) ?? 0); }, []); // eslint-disable-line react-hooks/exhaustive-deps
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
  const openPerson = (id: string) => { setPersonId(id); setPersonTab("biography"); };
  const openFaction = (id: string) => { setPersonId(null); setTab("factions"); setFactionId(id as FactionId); setReturnFaction(null); };
  /** A faction page's remembered record: the faction's whole ledger (every severity, every kind), with it picked. */
  const openFactionRecord = (recordId: string, tick: number) => {
    const from = factionId;
    setTab("records"); setFactionId(null); setReturnFaction(from);
    setFilter({ ...DEFAULT_CHRONICLE_FILTER, severity: 0, factionId: from });
    setSelected(recordId); setPickedTick(tick); setZoomTick(tick); setDetailView("record");
  };
  /** DEC-CARD-2: a thread line's record — every record shown (so it is in the list), with it picked. */
  const openThreadRecord = (recordId: string, tick: number) => {
    setTab("records"); setFactionId(null); setReturnFaction(null);
    setFilter({ ...DEFAULT_CHRONICLE_FILTER, severity: 0 }); setCompare(false);
    setSelected(recordId); setPickedTick(tick); setZoomTick(tick); setDetailView("record");
  };
  const backToFaction = () => { if (returnFaction === null) return; setTab("factions"); setFactionId(returnFaction); setReturnFaction(null); };
  const chooseTab = (next: "records" | "factions") => { setPersonId(null); setTab(next); setFactionId(null); setReturnFaction(null); };
  // Esc steps back one page first (the global `cancel` intent, before the app shell pops the modal).
  useEffect(() => platformServices().input.subscribe(intent => {
    if (intent.kind !== "cancel" || intent.world !== undefined) return;
    if (personId === null && tab === "factions" && factionId !== null) { setFactionId(null); return "consumed"; }
    if (personId === null && tab === "records" && returnFaction !== null) { backToFaction(); return "consumed"; }
    return undefined;
  // why: backToFaction reads the same state as the deps
  }, INTENT_ORDER.app - 1), [personId, tab, factionId, returnFaction]); // eslint-disable-line react-hooks/exhaustive-deps
  const openRecord = (recordId: string, tick: number) => {
    // A record from a biography: the person's whole ledger (every severity), with it picked.
    const person = personId;
    setPersonId(null);
    setFilter({ ...DEFAULT_CHRONICLE_FILTER, severity: 0, personId: person });
    setSelected(recordId); setPickedTick(tick); setZoomTick(tick);
  };
  // After a biography's or a faction page's record link, scroll to the record once the list is back.
  useEffect(() => {
    if (view !== "records" || selected === null) return;
    const index = indexOf.get(selected);
    if (index !== undefined && list.current !== null && (index * CARD_ROW < list.current.scrollTop || index * CARD_ROW > list.current.scrollTop + viewport.list)) scrollTo(index);
  // why: only on coming back to the list (or a new row order); the selection and scroll are read then
  }, [view, indexOf]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedIndex = selected === null ? (items.length > 0 ? 0 : -1) : indexOf.get(selected) ?? -1;
  const selectedItem = selectedIndex < 0 ? undefined : items[selectedIndex];
  const first = Math.max(0, Math.floor(scrollTop / CARD_ROW) - OVERSCAN);
  const last = Math.min(items.length, Math.ceil((scrollTop + viewport.list) / CARD_ROW) + OVERSCAN);
  const visible = items.slice(first, last);
  const toggleKind = (kind: ChronicleKind) => changeFilter({ ...filter,
    kinds: filter.kinds.includes(kind) ? filter.kinds.filter(entry => entry !== kind) : CHRONICLE_KINDS.filter(entry => entry === kind || filter.kinds.includes(entry)) });
  const yearValue = (value: string) => value === "" ? null : Number(value);
  const pageScale = Math.min(1, Math.max(0.5, (viewport.page - 8) / BIOGRAPHY_PAGE.height));
  const factionScale = Math.min(1, Math.max(0.5, (viewport.page - 8) / FACTION_PAGE.height));

  return (
    <div className="chronicle-screen" role="dialog" aria-modal="true" aria-label={COPY.title} data-chronicle="open" data-records={items.length}
      data-view={view} data-from-year={filter.fromYear ?? undefined} data-to-year={filter.toYear ?? undefined}>
      <header className="chronicle-header">
        <h2>{COPY.title}</h2>
        <Tabs label={COPY.viewsLabel} className="chronicle-tabs" tabClassName="chronicle-tab" selected={personId === null ? tab : "records"}
          tabs={[{ key: "records", label: COPY.recordsTab }, { key: "factions", label: COPY.factionsTab }]} onSelect={key => chooseTab(key)} />
        <span className="chronicle-now">{COPY.now(chronicleDate(state, state.tick))}</span>
        {view === "faction" ? <Button type="button" className="chronicle-back" onPress={() => setFactionId(null)} variant="secondary"><UiIcon sheet="action" cell="log" />{COPY.backToFactions}</Button>
          : view === "factions" ? null
          : view === "records" && returnName !== null ? <Button type="button" className="chronicle-back" aria-label={COPY.backToFactionLabel(returnName)} onPress={() => backToFaction()}
            variant="secondary"><UiIcon sheet="action" cell="log" />{COPY.backToFaction}</Button>
          : personId === null ? (
          <ul className="chronicle-legend" aria-label={COPY.legendLabel}>
            {(Object.keys(COPY.markerLegend) as TimelineMarkerKind[]).map(kind => (
              <li key={kind}><span aria-hidden="true" style={wave19ImageStyle(`timeline_marker_${kind}`, 18)} />{COPY.markerLegend[kind]}</li>
            ))}
          </ul>
        ) : <Button type="button" className="chronicle-back" onPress={() => setPersonId(null)} variant="secondary"><UiIcon sheet="action" cell="log" />{COPY.back}</Button>}
        {onBook === undefined ? null : <Button type="button" className="chronicle-book" onPress={() => onBook()} variant="secondary">
          <UiIcon sheet="action" cell="log" />{LEGACY_SCREEN_COPY.book.open}</Button>}
        {onEnding === undefined || onEnding === null ? null : <Button type="button" className="chronicle-ending" onPress={() => onEnding()} variant="secondary">
          <UiIcon sheet="action" cell="open" />{LEGACY_SCREEN_COPY.openEnding}</Button>}
        <Button type="button" className="chronicle-close" aria-label={COPY.closeLabel} onPress={() => onClose()} variant="icon">{COPY.close}</Button>
      </header>
      {personId !== null ? (
        <div className="chronicle-page-body chronicle-page-body--person" ref={body} data-person-tab={personTab}>
          <Tabs label={FAMILY_TREE_COPY.tabsLabel} className="chronicle-tabs chronicle-person-tabs" tabClassName="chronicle-tab" selected={personTab}
            tabs={[{ key: "biography", label: FAMILY_TREE_COPY.biographyTab }, { key: "tree", label: FAMILY_TREE_COPY.treeTab }]} onSelect={key => setPersonTab(key)} />
          {personTab === "tree" ? <FamilyTree state={state} personId={personId} onPerson={id => openPerson(id)} />
            : biography === null ? <p className="chronicle-empty">{COPY.lifeEmpty}</p>
            : <BiographyPage view={biography} scale={pageScale} onPerson={id => openPerson(id)} onRecord={(recordId, tick) => openRecord(recordId, tick)} />}
        </div>
      ) : view === "factions" ? (
        <div className="chronicle-page-body chronicle-page-body--factions" ref={body}>
          <FactionTab rows={rows} world={world} tug={tug} onOpen={id => openFaction(id)} />
        </div>
      ) : view === "faction" ? (
        <div className="chronicle-page-body" ref={body}>
          {factionPage === null ? <p className="chronicle-empty">{COPY.noFactions}</p>
            : <FactionPage view={factionPage} scale={factionScale} onRecord={(recordId, tick) => openFactionRecord(recordId, tick)} />}
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
              return <Button key={kind} type="button" className="chronicle-kind" data-kind={kind} aria-pressed={on} aria-label={COPY.kindToggle(COPY.kinds[kind], on)}
                onPress={() => toggleKind(kind)} variant="toggle">{COPY.kinds[kind]}</Button>;
            })}
          </div>
          {/* UI-KIT-1: kit selects (no native <select>); a <div>, not a <label>, so a press on the open list is not sent to the button. */}
          <div className="chronicle-select"><span aria-hidden="true">{COPY.severityLabel}</span>
            <Select label={COPY.severityLabel} value={filter.severity} options={COPY.severities.map((name, level) => ({ value: level, label: name }))}
              onChange={level => changeFilter({ ...filter, severity: level as HistorySeverity })} /></div>
          <div className="chronicle-select"><span aria-hidden="true">{COPY.fromLabel}</span>
            <Select label={COPY.fromLabel} value={filter.fromYear ?? ""} options={[{ value: "", label: COPY.firstYear }, ...years.map(year => ({ value: year, label: String(year) }))]}
              onChange={year => changeFilter({ ...filter, fromYear: yearValue(String(year)) })} /></div>
          <div className="chronicle-select"><span aria-hidden="true">{COPY.toLabel}</span>
            <Select label={COPY.toLabel} value={filter.toYear ?? ""} options={[{ value: "", label: COPY.lastYear }, ...years.map(year => ({ value: year, label: String(year) }))]}
              onChange={year => changeFilter({ ...filter, toYear: yearValue(String(year)) })} /></div>
          <div className="chronicle-select chronicle-select--person"><span aria-hidden="true">{COPY.personLabel}</span>
            <Select label={COPY.personLabel} value={filter.personId ?? ""}
              options={[{ value: "", label: COPY.anyPerson }, ...people.map(person => ({ value: person.id, label: COPY.personOption(person.name, person.count) }))]}
              onChange={value => {
                const id = value === "" ? null : String(value);
                // A person's own lines are mostly everyday: choosing one shows every severity.
                changeFilter({ ...filter, personId: id, severity: id === null ? filter.severity : 0 });
              }} /></div>
          {filterFactionName === null ? null : <Button type="button" className="chronicle-kind chronicle-faction-filter" aria-pressed={true}
            aria-label={COPY.factionFilterClear(filterFactionName)} onPress={() => { setReturnFaction(null); changeFilter({ ...filter, factionId: null }); }}
            variant="toggle">{COPY.factionFilter(filterFactionName)}</Button>}
          <span className="chronicle-count" role="status">{COPY.count(items.length)}</span>
        </div>
        <div className="chronicle-body">
          <div className="chronicle-list" ref={list} onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
            {items.length === 0 ? <p className="chronicle-empty">{COPY.empty}</p> : (
              <div className="chronicle-list-space" role="list" aria-label={COPY.count(items.length)} style={{ height: items.length * CARD_ROW + LIST_PAD * 2 }}>
                {visible.map((item, offset) => (
                  <RecordCardView key={item.key} card={chronicleRecordCard(state, item)} selected={first + offset === selectedIndex} position={first + offset + 1} total={items.length}
                    style={{ top: LIST_PAD + (first + offset) * CARD_ROW }}
                    onSelect={id => { setSelected(id); setPickedTick(item.tick); setDetailView("record"); }}
                    onLookAt={tile => onLookAt(tile)}
                    onMap={id => { setSelected(id); setPickedTick(item.tick); setDetailView("map"); }}
                    onPerson={id => openPerson(id)} onFaction={id => openFaction(id)} />
                ))}
              </div>)}
          </div>
          <aside className="chronicle-detail" aria-label={COPY.thenMap} style={{ width: DECISION_FRAME.width * DECISION_SCALE + 24 }}>
            {selectedItem === undefined ? <p className="chronicle-hint">{COPY.pickHint}</p>
              : <ChronicleDetail state={state} item={selectedItem} view={detailView} compare={compare} onView={view => setDetailView(view)}
                onCompare={() => setCompare(value => !value)}
                onLookAt={tile => onLookAt(tile)} onPerson={id => openPerson(id)} onFaction={id => openFaction(id)} onRecord={openThreadRecord} />}
          </aside>
        </div>
      </>}
    </div>
  );
}
