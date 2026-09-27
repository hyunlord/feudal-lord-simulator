/**
 * UI-6 faction tab (CHRON-2 first pass, CHRONICLE_DESIGN 2.3, FACTION-0 FX-6): the chronicle's "세력" view — nine rows,
 * names only through `factionDisplayName` / `GENTRY_NAMES_KO` (FIX-5: no stored proper noun reaches the screen), the
 * relation held to −100…100 on the scale, a faction's page with its records as links into the chronicle, and the new
 * ledger records (war, factions, the lord's houses, the decline's causes) as record cards with a picture and a line.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { factionDisplayName } from "../src/content/factionCopy.ko";
import { KINGS } from "../src/content/factionConfig";
import { EARLDOM_TITLES, GENTRY_SURNAMES, SEE_NAMES } from "../src/content/gentryNames";
import type { GameState } from "../src/engine/engine.types";
import { advanceFactions, factionsList, worldTimeline } from "../src/engine/factions";
import type { ActorRef, HistoryRecord } from "../src/engine/history.types";
import { lordHouseHeraldrySeed, lordshipOf } from "../src/engine/lordshipState";
import { MANOR_HOUSEHOLD } from "../src/engine/persons.types";
import { currentYear } from "../src/engine/persons";
import { initialPolitics } from "../src/engine/politics";
import { decodeSave } from "../src/save/saveCodec";
import { ChronicleScreen } from "../src/ui/chronicle/ChronicleScreen";
import { FactionPage, FACTION_PAGE_SLOTS } from "../src/ui/chronicle/FactionPage";
import { FactionTab } from "../src/ui/chronicle/FactionTab";
import { CHRONICLE_KINDS, chronicleItems, DEFAULT_CHRONICLE_FILTER, recordCard, type ChronicleItem } from "../src/ui/chronicle/chronicleScreenModel";
import { clampRelation, factionLeaderName, factionPageView, factionRows, relationBand, worldLines } from "../src/ui/chronicle/factionTabModel";
import { armsKey, armsRecipe, heraldryArms, heraldryMark, merchantKey, royalArms } from "../src/ui/heraldry/heraldry";
import { emblemKey } from "../src/ui/heraldry/EmblemImage";
import { portraitStyle } from "../src/ui/portraitArt";

const YEAR = 4_000;
const TOWN: ActorRef = { type: "town", id: "town" };

/** The 24-house walled town (v20 fixture) at a year's start, its factions made as a new game makes them. */
function town(): GameState {
  const state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v20/palisade-construction.save.json"))).envelope.state as GameState;
  const tick = Math.ceil(state.tick / YEAR) * YEAR;
  const { factions: _factions, ...rest } = { ...state, tick, politics: initialPolitics(state) };
  return advanceFactions(rest as GameState);
}

let ordinal = 0;
const record = (tick: number, kind: HistoryRecord["kind"], template: string, severity: HistoryRecord["severity"], extra: Partial<HistoryRecord> = {}): HistoryRecord => {
  ordinal += 1;
  return { id: `h-${String(ordinal).padStart(6, "0")}`, tick, kind, template, subject: TOWN, severity, ...extra };
};
const withRecords = (state: GameState, records: readonly HistoryRecord[]): GameState =>
  ({ ...state, history: { records, snapshots: [], nextOrdinal: records.length + 1, seasonDecisions: {}, milestones: [], pendingActuals: [] } });
const item = (entry: HistoryRecord): ChronicleItem => ({ key: entry.id, tick: entry.tick, record: entry, bundle: null });

/** Every proper noun the engine stores for the gentry, clergy and the Crown (FIX-5: none may reach the screen as stored). */
const RAW_NAMES = [...GENTRY_SURNAMES, ...EARLDOM_TITLES, ...SEE_NAMES, ...KINGS.map(king => king.name)];
const leaks = (text: string) => RAW_NAMES.filter(name => text.includes(name));

test("UI-6 faction tab: nine rows in the engine's order, each named by factionDisplayName, with arms, a leader and a pool portrait", () => {
  const state = town();
  const rows = factionRows(state);
  assert.equal(rows.length, 9);
  const factions = factionsList(state);
  assert.deepEqual(rows.map(row => row.id), factions.map(faction => faction.id));
  for (const [index, row] of rows.entries()) {
    assert.equal(row.name, factionDisplayName(factions[index]!.id, factions[index]!.name), row.id);
    // The Crown bears the king's arms of the year (UI-6b); the rest their seed's.
    const expected = factions[index]!.kind === "crown" ? `royal.${royalArms(currentYear(state))}`
      : factions[index]!.kind === "merchant_house" ? merchantKey(heraldryMark(factions[index]!.heraldrySeed)) : armsKey(heraldryArms(factions[index]!.heraldrySeed));
    assert.equal(emblemKey(row.emblem), expected, `${row.id}: the emblem from its heraldry seed`);
  }
  // The outside factions always have their own leader (FX-2); each one's portrait is in the pool.
  for (const id of ["overlord", "crown", "neighbour_1", "neighbour_2", "bishop"]) {
    const row = rows.find(entry => entry.id === id)!;
    assert.ok(row.leader !== null, id);
    assert.notEqual(portraitStyle(row.leader.portraitId, 44), null, `${id}: ${row.leader.portraitId} is a pool portrait`);
  }
  assert.match(rows.find(row => row.id === "crown")!.leader!.name, /^(에드워드|리처드|헨리) \d세$/, "the king by his Korean regnal name");
  assert.equal(armsKey(heraldryArms(7)), armsKey(armsRecipe(7, "heraldry")), "one key for every screen that draws a faction");
});

test("UI-6 faction tab: no stored gentry, see, earldom or king name leaks into the rows, the pages or their markup (FIX-5)", () => {
  const state = town();
  const rows = factionRows(state);
  const pages = rows.map(row => factionPageView(state, row.id)!);
  // The engine does store them: the test would pass for nothing if it did not.
  const stored = JSON.stringify(state.factions);
  assert.ok(leaks(stored).length >= 4, "the engine's factions carry the period's proper nouns");
  assert.deepEqual(leaks(JSON.stringify(rows)), []);
  assert.deepEqual(leaks(JSON.stringify(pages)), []);
  const markup = renderToStaticMarkup(createElement(FactionTab, { rows, world: worldLines(state), onOpen: () => undefined }))
    + pages.map(view => renderToStaticMarkup(createElement(FactionPage, { view, scale: 0.8, onRecord: () => undefined }))).join("");
  assert.deepEqual(leaks(markup), []);
  // A leader of an outside faction: given name and the Korean reading of the invented surname.
  const earl = state.factions!.people.find(person => person.householdId === "faction:overlord")!;
  assert.ok(earl.surname !== undefined && GENTRY_SURNAMES.includes(earl.surname as (typeof GENTRY_SURNAMES)[number]));
  assert.equal(factionLeaderName(earl), `${earl.givenName} ${factionDisplayName("overlord", earl.surname!).replace(/ 백작$/, "")}`);
});

test("UI-6 relation scale: −100…100 held at the ends, the pin at its place, the band's word", () => {
  const state = town();
  const moved: GameState = { ...state, factions: { ...state.factions!, factions: state.factions!.factions.map(faction =>
    faction.id === "overlord" ? { ...faction, relation: 250 } : faction.id === "crown" ? { ...faction, relation: -400 } : faction.id === "bishop" ? { ...faction, relation: 20 } : faction) } };
  const rows = factionRows(moved);
  const row = (id: string) => rows.find(entry => entry.id === id)!;
  assert.deepEqual([row("overlord").relation, row("overlord").relationX], [100, 1]);
  assert.deepEqual([row("crown").relation, row("crown").relationX], [-100, 0]);
  assert.deepEqual([row("bishop").relation, row("bishop").relationX, row("bishop").relationText], [20, 0.6, "호의 +20"]);
  assert.deepEqual([clampRelation(Number.NaN), relationBand(-60), relationBand(0), relationBand(-20), relationBand(55)], [0, "적대", "무심", "냉담", "우호"]);
  const markup = renderToStaticMarkup(createElement(FactionPage, { view: factionPageView(moved, "crown")!, scale: 0.5, onRecord: () => undefined }));
  assert.match(markup, /aria-valuenow="-100"/);
  assert.match(markup, /left:0%/, "the pin at the hostile end");
  assert.match(renderToStaticMarkup(createElement(FactionTab, { rows, world: [], onOpen: () => undefined })), /left:100%/, "the overlord's pin at the friendly end");
});

test("UI-6 faction page: demands, promises, the remembered records as links (newest first) and its own timeline; the list filters to it", () => {
  ordinal = 0;
  const base = town();
  const petitionId = `market_charter@${base.tick}`;
  const faction = { type: "faction" as const, id: "merchant_house_1" };
  const records = [
    record(base.tick - 900, "decision", "decision.petition_response", 1, { params: { decisionKind: "petition_response", defId: "market_charter", chosen: "accept" }, actors: [faction] }),
    record(base.tick - 900, "faction", "faction.relation", 1, { subject: faction, params: { faction: "merchant_house_1", name: base.factions!.factions[5]!.name, delta: 10, reason: "petition:market_charter:accept", relation: 10 } }),
    record(base.tick - 500, "event", "war.raid", 3, { params: { burntHouses: 2, looted: 30, coin: 40 }, actors: [{ type: "faction", id: "town" }] }),
    record(base.tick - 400, "milestone", "milestone.lots", 1, { params: { lots: 12 } }),
  ];
  const state: GameState = { ...withRecords(base, records),
    politics: { ...base.politics!, petitions: [{ id: petitionId, defId: "restore_right", petitioner: "merchants", arrivedTick: base.tick - 100 }],
      rights: [{ id: "market_charter@1", holder: "merchants", grantedTick: base.tick - 900, petitionId: "p", stallFeePermille: 800 }] },
    factions: { ...base.factions!, factions: base.factions!.factions.map(entry => entry.id !== "merchant_house_1" ? entry
      : { ...entry, relation: 10, memory: [{ recordId: "h-000002", tick: base.tick - 900, delta: 10, reason: "petition:market_charter:accept" }],
        timeline: [...entry.timeline, { tick: base.tick - 300, year: 1305, kind: "leader" as const, id: "chosen", personId: entry.leaderId ?? "" }] }) } };
  const view = factionPageView(state, "merchant_house_1")!;
  assert.deepEqual(view.memory.map(entry => entry.recordId), ["h-000002", "h-000001"], "its records (subject or actor), newest first");
  assert.match(view.memory[0]!.line, /마음이 누그러졌다\(\+10, 이제 10\)/);
  assert.deepEqual(view.demands.map(entry => entry.key), [petitionId]);
  assert.match(view.demands[0]!.line, /^권리 복원 청원 · /);
  assert.equal(view.promises.length, 1); assert.match(view.promises[0]!.line, /^시장권 · /);
  assert.match(view.timeline[0]!.line, /^새 수장이 섰다/);
  const pressed: string[] = [];
  const markup = renderToStaticMarkup(createElement(FactionPage, { view, scale: 0.9, onRecord: id => pressed.push(id) }));
  assert.match(markup, /frame_faction_page\.png/);
  assert.match(markup, /relation_scale_track\.png/);
  assert.equal((markup.match(/class="chronicle-faction-record[^"]*"[^>]*data-record="h-00000[12]"/g) ?? []).length, 2, "each remembered record is a button");
  assert.equal(Object.keys(FACTION_PAGE_SLOTS).length, 9);
  // The link's target: the list filtered to the faction (every kind, every severity) holds exactly its records.
  assert.ok((CHRONICLE_KINDS as readonly string[]).includes("faction"), "relation records are a kind of the list");
  const listed = chronicleItems(state, { ...DEFAULT_CHRONICLE_FILTER, severity: 0, factionId: "merchant_house_1" }).map(entry => entry.record.id);
  assert.deepEqual(listed, ["h-000002", "h-000001"]);
  assert.deepEqual(chronicleItems(state, { ...DEFAULT_CHRONICLE_FILTER, severity: 0, factionId: "town" }).map(entry => entry.record.id), ["h-000003"]);
  // The cards name their faction ([세력] opens its page).
  const card = recordCard(state, item(records[2]!));
  assert.deepEqual([card.factionId, card.factionName], ["town", "도시 공동체"]);
  assert.equal(recordCard(state, item(records[3]!)).factionId, null);
});

test("UI-6 the screen: the 세력 tab beside the records, the world strip under the nine rows", () => {
  const state = town();
  const markup = renderToStaticMarkup(createElement(ChronicleScreen, { state, onClose: () => undefined, onLookAt: () => undefined }));
  assert.match(markup, /role="tablist" aria-label="연대기 보기"/);
  assert.match(markup, /role="tab" aria-selected="true"[^>]*>기록</);
  assert.match(markup, /role="tab" aria-selected="false"[^>]*>세력</);
  assert.match(markup, /data-kind="faction"[^>]*>관계</, "the relation records' kind toggle");
  const world = worldLines(state);
  assert.equal(world.length, worldTimeline(state).length);
  const tab = renderToStaticMarkup(createElement(FactionTab, { rows: factionRows(state), world, onOpen: () => undefined }));
  assert.equal((tab.match(/class="chronicle-factions-row[^"]*"/g) ?? []).length, 9);
  assert.equal((tab.match(/data-world="/g) ?? []).length, world.length);
  assert.ok(world.length > 0 && world.every(event => event.line !== ""));
});

test("UI-6 new ledger records are cards: war, faction and house records have their picture and line; decline's new causes read", () => {
  ordinal = 0;
  const base = town();
  const house2 = lordHouseHeraldrySeed(base.seed, 2);
  const cases: readonly [HistoryRecord, string, RegExp][] = [
    [record(100, "event", "war.messenger", 2), "wave17:chronicle_messenger", /국왕의 전령이 왔다/],
    [record(110, "event", "war.beacon", 2), "wave17:chronicle_beacon", /봉화가 올랐다/],
    [record(120, "event", "war.raid", 3, { params: { burntHouses: 3, looted: 20, coin: 50 } }), "wave17:chronicle_raid", /해안 습격이 닥쳤다 — 불탄 집 3/],
    [record(130, "event", "war.conscripts_left", 2, { params: { men: 6 } }), "wave17:chronicle_conscription", /6명이 떠났다/],
    [record(140, "event", "war.conscripts_returned", 2, { params: { men: 6, lost: 1 } }), "wave17:chronicle_conscription", /1명은 돌아오지 못했다/],
    [record(150, "event", "war.licence", 2), "wave17:chronicle_purveyance_licence", /조달 면허/],
    [record(160, "event", "war.favour_lost", 2), "wave17:chronicle_messenger", /신임을 잃었다/],
    [record(170, "event", "war.unanswered", 2, { params: { defId: "wool_payment" } }), "wave17:chronicle_wool_levy", /양모 공납 칙령에 답하지 않았다/],
    [record(175, "event", "war.unanswered", 2, { params: { defId: "war_funding" } }), "wave17:decision_war_funding", /전쟁 보조세 요구에 답하지 않았다/],
    [record(180, "decision", "decision.petition_response", 1, { params: { decisionKind: "petition_response", defId: "levy_response", chosen: "accept" } }), "wave17:chronicle_conscription", /징집 명령에 답했다: 사람을 보낸다/],
    [record(185, "decision", "decision.petition_response", 1, { params: { decisionKind: "petition_response", defId: "wall_or_market", chosen: "refuse" } }), "wave16:chronicle_market_day", /시장을 넓힌다/],
    [record(186, "decision", "decision.petition_response", 1, { params: { decisionKind: "petition_response", defId: "wall_or_market", chosen: "accept" } }), "wave17:stonewall_start", /석벽을 쌓는다/],
    [record(190, "faction", "faction.relation", 1, { subject: { type: "faction", id: "overlord" }, params: { faction: "overlord", name: base.factions!.factions[0]!.name, delta: -20, reason: "decline:depopulated", relation: 0 } }),
      `arms:${armsKey(heraldryArms(base.factions!.factions[0]!.heraldrySeed))}`, /백작의 마음이 돌아섰다\(-20, 이제 0\) — 사람이 떠나 쇠퇴/],
    [record(200, "milestone", "decline.entered", 3, { params: { cause: "depopulated", right: "tolls", by: "overlord" } }), "wave16:chronicle_settlement", /사람이 떠나, 통행세를 상위 영주가 맡았고/],
    [record(210, "milestone", "decline.entered", 3, { params: { cause: "empty", right: "none", by: "overlord" } }), "wave16:chronicle_settlement", /도시가 비어, 잃은 권리 없이/],
    [record(220, "milestone", "house.withdrew", 3, { params: { name: "de Haverel", order: 1 } }), `arms:${armsKey(armsRecipe(base.seed, MANOR_HOUSEHOLD))}`, /드 해버럴 가문이 물러났다/],
    [record(220, "milestone", "house.arrived", 2, { params: { name: "de Coldmere", order: 2 } }), `arms:${armsKey(armsRecipe(house2, MANOR_HOUSEHOLD))}`, /드 콜드미어 가문이 영지를 맡았다/],
    [record(220, "milestone", "milestone.chapter_start", 2, { params: { chapter: 2 } }), "wave16:chapter2_intro", /2장이 시작되었다/],
  ];
  const state = withRecords(base, cases.map(([entry]) => entry));
  for (const [entry, art, line] of cases) {
    const card = recordCard(state, item(entry));
    const got = card.art === null ? "none" : card.art.kind === "emblem" ? `${card.art.emblem.kind}:${emblemKey(card.art.emblem)}`
      : card.art.kind === "portrait" ? `portrait:${card.art.portraitId}` : `${card.art.kind}:${card.art.id}`;
    assert.equal(got, art, entry.template);
    assert.match(card.sentence, line, entry.template);
    assert.ok(card.frame.startsWith("frame_record_"), entry.template);
    assert.deepEqual(leaks(card.sentence), [], entry.template);
  }
  // house.resettled has no order: its house found by name among the lordship's houses (here: the first house's).
  const lord = lordshipOf(state).house.name;
  const resettled = recordCard(state, item(record(230, "milestone", "house.resettled", 3, { params: { name: lord, settlers: 12 } })));
  assert.equal(resettled.art?.kind, "emblem");
  assert.match(resettled.sentence, /이주민 12명을 데려와 빈 도시에 다시 살게 했다/);
  // Every kind the list shows is on: the relation records appear by default when weighty.
  assert.ok(chronicleItems(state, DEFAULT_CHRONICLE_FILTER).some(entry => entry.record.kind === "faction"));
});
