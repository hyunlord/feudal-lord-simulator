import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { GameState } from "../src/engine/engine.types";
import type { ActorRef, HistoryRecord } from "../src/engine/history.types";
import { rasterizeSnapshot } from "../src/engine/historySnapshot";
import { displayName } from "../src/engine/persons";
import { persons } from "../src/engine/personsApi";
import { decodeSave } from "../src/save/saveCodec";
import { ChronicleScreen } from "../src/ui/chronicle/ChronicleScreen";
import { FACTION_PAGE_SLOTS, FactionPage } from "../src/ui/chronicle/FactionPage";
import {
  biographyView, chronicleItems, chroniclePeople, decisionCompare, DEFAULT_CHRONICLE_FILTER, itemIndexAt, recordCard, seasonWindow,
  snapshotFor, SEASON_WINDOW, timelineMarkers, timelineSegments, timelineTickAt, timelineX, type ChronicleFilter,
} from "../src/ui/chronicle/chronicleScreenModel";
import { reduceUi, INITIAL_UI_STATE, timeStopped, topModal } from "../src/ui/stateMachine/uiStateMachine";
import { createMouseKeyboardTranslator } from "../src/input/mouseKeyboardTranslator";
import type { InputIntent } from "../src/input/inputIntent";

// CHRON-1 chronicle screen (CHRONICLE_DESIGN 2.1, 2.2, 2.4): the model the screen renders, on a town of 177 persons
// (fixtures v17 population-176) given a ledger by hand, and the 30,000-record open path.

const SEASON = 1_000;
const TOWN: ActorRef = { type: "town", id: "town" };
const base = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v17/population-176.save.json"))).envelope.state as GameState;
const head = base.persons!.people.find(person => person.id === "p-000001")!;
const spouse = base.persons!.people.find(person => person.id === "p-000002")!;

let ordinal = 0;
function record(tick: number, kind: HistoryRecord["kind"], template: string, severity: HistoryRecord["severity"], extra: Partial<HistoryRecord> = {}): HistoryRecord {
  ordinal += 1;
  return { id: `h-${String(ordinal).padStart(6, "0")}`, tick, kind, template, subject: TOWN, severity, ...extra };
}

function ledgerTown(): GameState {
  ordinal = 0;
  const personActor = { subject: { type: "person" as const, id: head.id }, actors: [{ type: "household" as const, id: head.householdId }] };
  const records: HistoryRecord[] = [
    record(1_000, "ledger", "ledger.rollup", 0, { params: { count: 9, "decision.build": 3, "decision.road": 2, "person.move_in": 4, population: 12, popDelta: 3, net: 40 } }),
    record(3_200, "milestone", "milestone.first_building", 1, { params: { building: "mill" }, place: { tx: 30, ty: 31 } }),
    record(4_000, "decision", "decision.bundle", 0, { params: { decisionKind: "build", count: 4 } }),
    record(4_000, "decision", "decision.bundle", 0, { params: { decisionKind: "road", count: 2 } }),
    record(4_000, "ledger", "ledger.season", 0, { params: { population: 20, popDelta: 4, net: -12, income: 30, expense: 42, season: 3, year: 1300 }, snapshotId: "s-own" }),
    record(6_500, "person", "person.born", 0, { ...personActor, subject: { type: "person", id: spouse.id } }),
    record(7_100, "event", "event.arrived", 2, { params: { defId: "first_fire", eventId: "first_fire@1301" }, place: { tx: 28, ty: 33 } }),
    record(7_150, "person", "person.burnt", 1, { ...personActor, place: { tx: 28, ty: 33 } }),
    record(9_000, "decision", "decision.famine_response", 1, { params: { decisionKind: "famine_response", chosen: "relief" },
      decision: { chosen: "relief", alternatives: ["price_control", "laissez_faire", "speculation"], predicted: { population: 60, treasury: 120 },
        actual: { population: 57, treasury: 150 }, actualDueTick: 11_000 } }),
    record(9_500, "decision", "decision.stone_town", 1, { params: { decisionKind: "stone_town" },
      decision: { chosen: "proclaim", alternatives: ["wait"], predicted: { treasury: 20, lots: 12 }, actualDueTick: 11_500 } }),
    record(10_000, "era", "era.entered", 3, { params: { eraId: "famine", forced: 0 } }),
    record(10_400, "person", "person.died", 1, { subject: { type: "person", id: head.id }, actors: [{ type: "household", id: head.householdId }], params: { cause: "famine", age: 45 } }),
  ];
  const thumbnail = (id: string, tick: number) => ({ ...rasterizeSnapshot(base, id, 128), tick });
  return { ...base, tick: 10_500, historicalEras: [{ id: "saturation", enteredTick: 0, forced: false }, { id: "famine", enteredTick: 10_000, forced: false }],
    history: { records, snapshots: [thumbnail("s-a", 1_000), thumbnail("s-own", 4_000), thumbnail("s-b", 8_000)], nextOrdinal: ordinal + 1, seasonDecisions: {}, milestones: [], pendingActuals: [] } };
}

const all: ChronicleFilter = { ...DEFAULT_CHRONICLE_FILTER, severity: 0 };

test("CHRON-1 rows: newest first, a season's everyday decision lines are one card, and kind, severity, year and person filters narrow them", () => {
  const state = ledgerTown();
  const items = chronicleItems(state, all);
  assert.deepEqual(items.map(item => item.tick), [...items.map(item => item.tick)].sort((a, b) => b - a), "newest first");
  const bundle = items.find(item => item.bundle !== null)!;
  assert.equal(bundle.bundle!.length, 2, "build and road of the season's close join");
  assert.equal(items.length, state.history!.records.length - 1);
  // Default: severity 1 and up (the weighty records).
  assert.ok(chronicleItems(state, DEFAULT_CHRONICLE_FILTER).every(item => item.record.severity >= 1));
  assert.deepEqual(chronicleItems(state, { ...all, kinds: ["event", "era"] }).map(item => item.record.kind), ["era", "event"]);
  assert.deepEqual(chronicleItems(state, { ...all, fromYear: 1302, toYear: 1302 }).map(item => item.record.template),
    ["person.died", "era.entered", "decision.stone_town", "decision.famine_response"]);
  assert.deepEqual(chronicleItems(state, { ...all, personId: head.id }).map(item => item.record.template), ["person.died", "person.burnt"]);
  assert.equal(itemIndexAt(items, 7_120), items.findIndex(item => item.tick === 7_100), "a picked time scrolls to the record at or before it");
  const people = chroniclePeople(state);
  assert.equal(people[0]!.id, head.id); assert.equal(people[0]!.count, 2);
});

test("CHRON-1 timeline: one equal strip segment per era, x and tick invert, one marker per stretch (the weightiest), the season ruler never past now", () => {
  const state = ledgerTown();
  const segments = timelineSegments(state);
  assert.equal(segments.length, 5, "the strip's five coloured segments are the five eras");
  assert.deepEqual(segments.map(segment => segment.fromYear), [1300, 1302, 1337, 1348, 1380]);
  assert.equal(segments[1]!.from, 10_000, "an entered era starts where it entered");
  // UI-KIT-1b: in 1469 with only two eras entered, the overdue ones keep their nominal years (not "now") and read as not yet come.
  const late = timelineSegments({ ...state, tick: 169 * 4_000 + 100 });
  assert.deepEqual(late.map(segment => [segment.fromYear, segment.entered]), [[1300, true], [1302, true], [1337, false], [1348, false], [1380, false]]);
  assert.ok(late[2]!.from > 169 * 4_000, "an overdue era still sits after now on the strip");
  for (const tick of [0, 4_000, 10_000, 10_500, 200_000]) assert.ok(Math.abs(timelineTickAt(segments, timelineX(segments, tick)) - tick) <= 2, `${tick}`);
  assert.equal(timelineX(segments, 10_000), 0.2);
  // Ten stretches: the first era's halves (the mill; the fire outweighing the decisions and the burnt house), the famine's start.
  assert.deepEqual(timelineMarkers(state.history!.records, segments, 10).map(marker => marker.kind), ["milestone", "event", "era"]);
  const cells = seasonWindow(state, chronicleItems(state, all), 7_100);
  assert.ok(cells.length <= SEASON_WINDOW && cells.at(-1)!.index === Math.floor(state.tick / SEASON), "ends at now");
  const fire = cells.find(cell => cell.from <= 7_100 && cell.to >= 7_100)!;
  assert.deepEqual([fire.count, fire.kinds], [2, ["event", "person"]]);
});

test("CHRON-1 그때 지도: the record's own thumbnail, else the season's close after it (within a season), else the last one before", () => {
  const state = ledgerTown();
  assert.equal(snapshotFor(state, 4_000, "s-own")!.id, "s-own");
  assert.equal(snapshotFor(state, 7_100)!.id, "s-b", "the close that shows the fire's aftermath");
  assert.equal(snapshotFor(state, 9_500)!.id, "s-b", "no close within a season after: the last before");
  assert.equal(snapshotFor(state, 500)!.id, "s-a");
});

test("CHRON-1 record cards: the kind's frame, the person named, the picture, the numbers; a folded season shows its counts only", () => {
  const state = ledgerTown();
  const items = chronicleItems(state, all);
  const card = (template: string) => recordCard(state, items.find(item => item.record.template === template)!);
  const fire = card("event.arrived");
  assert.deepEqual([fire.frame, fire.art, fire.place, fire.date], ["frame_record_event", { kind: "wave16", id: "chronicle_first_fire" }, { tx: 28, ty: 33 }, "1301년 겨울"]);
  assert.deepEqual(card("decision.stone_town").art, { kind: "wave17", id: "stonewall_start" });
  assert.deepEqual(recordCard(state, { key: "x", tick: 1, bundle: null, record: { ...state.history!.records[6]!, template: "event.sign", params: { defId: "great_famine" } } }).art,
    { kind: "wave16", id: "event_famine_omen" }, "a sign shows the warning card");
  const burnt = card("person.burnt");
  assert.equal(burnt.frame, "frame_record_person");
  assert.equal(burnt.sentence, `${displayName(head)}의 집 — 가구의 집이 불탔다`);
  assert.equal(burnt.art?.kind, "portrait");
  assert.equal(burnt.personId, head.id);
  const born = card("person.born");
  assert.match(born.sentence, /^.+ — 아이가 태어났다$/);
  assert.equal(card("ledger.season").art, null);
  assert.equal(card("ledger.season").numbers, "수입 30d · 지출 42d");
  const bundle = recordCard(state, items.find(item => item.bundle !== null)!);
  assert.deepEqual([bundle.sentence, bundle.numbers, bundle.art], ["이번 계절의 손길", "공사 4번 · 길 2번", null]);
  const folded = card("ledger.rollup");
  assert.equal(folded.folded, true);
  assert.equal(folded.numbers, "인구 12(+3) · 공사 3 · 길 2 · 사람들의 일 4");
  assert.equal(card("decision.famine_response").numbers, "예측 인구 60 · 금고 120d / 실제 인구 57 · 금고 150d");
});

test("CHRON-1 decision record: chosen, the other ways, each predicted number against what came with its delta, or when it comes", () => {
  const state = ledgerTown();
  const famine = decisionCompare(state, state.history!.records.find(entry => entry.template === "decision.famine_response")!)!;
  assert.equal(famine.heading, "1302년 여름 · 대기근 대응");
  assert.equal(famine.chosen, "구휼");
  assert.deepEqual(famine.alternatives, ["가격 통제", "방관", "투기"]);
  assert.deepEqual(famine.rows.map(row => [row.predicted, row.actual, row.delta, row.deltaLabel]),
    [["인구 60", "57", "down", "예측보다 3 적음"], ["금고 120d", "150d", "up", "예측보다 30d 많음"]]);
  assert.equal(famine.pending, null);
  const stone = decisionCompare(state, state.history!.records.find(entry => entry.template === "decision.stone_town")!)!;
  assert.deepEqual([stone.chosen, stone.alternatives, stone.rows[0]!.actual, stone.pending], ["선포", ["미룸"], null, "실제는 1302년 겨울에 적힙니다"]);
});

test("CHRON-1 biography: the portrait of their age with how it matches, the life in order, the household, the companion and the shared records", () => {
  const state = ledgerTown();
  const view = biographyView(state, head.id)!;
  const portrait = persons.portrait(state, head);
  assert.equal(view.name, displayName(head));
  assert.equal(view.portraitId, portrait.portraitId);
  assert.equal(view.portraitExact, portrait.exact);
  assert.match(view.portraitLine, portrait.exact ? /성별·나이대·계층 일치$/ : /가장 가까운 그림$/);
  assert.deepEqual(view.events.map(event => event.sentence), ["가구의 집이 불탔다", "45살에 굶주림 끝에 죽었다"]);
  assert.equal(view.companion?.id, spouse.id);
  assert.equal(view.companion?.label, "배우자");
  assert.ok(view.relations.some(relation => relation.id === spouse.id && relation.line.startsWith("배우자 ")));
  // A child sees the head as a parent, not the house's roles.
  const child = state.persons!.people.find(member => member.householdId === head.householdId && member.role === "child")!;
  const childView = biographyView(state, child.id)!;
  assert.deepEqual([childView.companion?.id, childView.companion?.label], [head.id, "부모"]);
  assert.deepEqual(childView.relations.filter(relation => relation.id === head.id || relation.id === spouse.id).map(relation => relation.line.split(" ")[0]), ["부모", "부모"]);
  assert.ok(childView.relations.some(relation => relation.line.startsWith("형제자매 ")));
  assert.deepEqual(view.records.map(entry => entry.sentence), ["45살에 굶주림 끝에 죽었다", "가구의 집이 불탔다"]);
  assert.equal(biographyView(state, "p-999999"), null);
});

test("CHRON-1 the screen: a modal over the town (time stops), C opens and closes it, the markup has the strip, the cards and the detail", () => {
  let ui = reduceUi({ ...INITIAL_UI_STATE, mode: "ledger" }, { type: "push_modal", modal: "history" });
  assert.equal(topModal(ui), "history"); assert.ok(timeStopped(ui));
  ui = reduceUi(ui, { type: "escape" });
  assert.deepEqual([topModal(ui), ui.mode, timeStopped(ui)], [null, "ledger", false], "Esc returns to the drawer it opened from");
  const intents: InputIntent[] = [];
  const translator = createMouseKeyboardTranslator({ bounds: () => ({ left: 0, top: 0, width: 800, height: 600 }), camera: () => ({ zoom: 1, panX: 0, panY: 0 }),
    world: () => ({ minX: -1, minY: -1, maxX: 1, maxY: 1 }), armed: () => ({ zone: false, zonePolygon: false, palisade: false, road: false }),
    emit: intent => { intents.push(intent); return true; } });
  translator.keyDown({ code: "KeyC", key: "c", target: null });
  assert.deepEqual(intents, [{ kind: "panel", panel: "chronicle" }]);
  const markup = renderToStaticMarkup(createElement(ChronicleScreen, { state: ledgerTown(), onClose: () => undefined, onLookAt: () => undefined }));
  assert.match(markup, /role="dialog" aria-modal="true" aria-label="연대기"/);
  assert.match(markup, /timeline_strip_base\.png/);
  assert.match(markup, /data-marker="era"/);
  assert.match(markup, /frame_record_era\.png/);
  assert.match(markup, /data-detail="h-000012"/, "the newest weighty record is picked when it opens");
  assert.match(markup, /aria-pressed="true"[^>]*>이정표/);
});

test("CHRON-1 30,000 records: the data the screen opens on (rows, markers, people, the first cards) is built in well under 200 ms", () => {
  const state = ledgerTown();
  const templates = state.history!.records;
  const big: HistoryRecord[] = [];
  for (let index = 0; index < 30_000; index += 1) {
    const { snapshotId: _snapshot, ...source } = templates[index % templates.length]!;
    big.push({ ...source, id: `h-${String(index + 1).padStart(6, "0")}`, tick: Math.floor(index * 4) });
  }
  const heavy: GameState = { ...state, tick: 120_000, history: { ...state.history!, records: big } };
  // CODE-1c: a wall-clock budget by design (the CHRON-1 gate); the best of three runs, as H8 takes the best of five, so
  // a shared machine's one slow run does not fail it.
  let elapsed = Number.POSITIVE_INFINITY;
  for (let run = 0; run < 3; run += 1) {
    const started = performance.now();
    const items = chronicleItems(heavy, DEFAULT_CHRONICLE_FILTER);
    const markers = timelineMarkers(items.map(item => item.record), timelineSegments(heavy));
    const people = chroniclePeople(heavy);
    const cards = items.slice(0, 12).map(item => recordCard(heavy, item));
    elapsed = Math.min(elapsed, performance.now() - started);
    assert.ok(items.length > 10_000 && markers.length > 0 && people.length > 0 && cards.length === 12);
  }
  assert.ok(elapsed < 120, `${elapsed.toFixed(1)} ms`);
});

test("CHRON-1 faction page: the Wave 19 frame registered with its slots (no faction opens it before the E stage)", () => {
  const markup = renderToStaticMarkup(createElement(FactionPage, { scale: 0.5, view: { id: "count", name: "백작", leaderPortraitId: "P05", relation: 20,
    demands: [], promises: [], ourEvents: [], theirEvents: [] } }));
  assert.match(markup, /frame_faction_page\.png/);
  assert.match(markup, /relation_scale_track\.png/);
  assert.match(markup, /left:60%/, "the relation pin at +20 of −100…100");
  assert.equal(Object.keys(FACTION_PAGE_SLOTS).length, 8);
});
