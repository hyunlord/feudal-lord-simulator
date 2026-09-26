import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import { GREAT_FAMINE_EVENT_ID } from "../src/content/eventConfig";
import type { GameState } from "../src/engine/engine.types";
import { advanceEvents, fireIgnitionFrom } from "../src/engine/events";
import { eventInstanceId, scheduledSeason } from "../src/engine/eventSchedule";
import { EVENT_DEF_BY_ID, FIRST_FIRE_EVENT_ID } from "../src/content/eventConfig";
import {
  ACTUAL_AFTER_TICKS,
  BIG_DECISION_KINDS,
  DECISION_KINDS,
  advanceHistory,
  chapterPageRecords,
  history,
  historyQuery,
  historySnapshot,
  historySummary,
  recordDecision,
} from "../src/engine/history";
import type { HistoryRecord, HistoryState } from "../src/engine/history.types";
import { chronicleEntry, initialPolitics } from "../src/engine/politics";
import { advanceSeasons } from "../src/engine/seasonPressure";
import { advanceTick } from "../src/engine/tick";
import type { House } from "../src/population/population.types";
import { decodeSave, encodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import type { GameAction } from "../src/state/gameStore.types";
import { canPlaceBuildingWithZones } from "../src/zones/zonePlacement";
import { palisadeFootprintsForState } from "../src/engine/palisadeFootprints";
import { computePalisadeProposal } from "../src/world/palisadeGeometry";

// F0-C2 history ledger scenarios (spec docs/design/history-ledger.md HL-1…HL-9), work order H1–H8.

const SEASON = 1000;

function fixture(name: string): GameState {
  return decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v15/${name}.save.json`))).envelope.state as GameState;
}

/** One tick's season, event and history steps (the ledger reads the tick's before and after). */
function step(state: GameState): GameState {
  return advanceHistory(state, advanceEvents(advanceSeasons(state)));
}

const records = (state: GameState) => state.history?.records ?? [];
const run = (state: GameState, action: GameAction) => gameReducer(state, action);

/** A town whose season closes at the next multiple of 1,000: the everyday decisions are written then. */
function closeSeason(state: GameState): GameState {
  const end = (Math.floor(state.tick / SEASON) + 1) * SEASON;
  let current: GameState = state.seasons === undefined ? advanceSeasons(state) : state;
  for (let tick = current.tick + 50 - current.tick % 50; tick <= end; tick += 50) current = step({ ...current, tick });
  return current;
}

test("H1 each of the twelve decision kinds is recorded: seven as the season's lines, five as their own records", () => {
  let state = fixture("population-176");
  const before = state;
  // build: a well; cancel: its site; road: one tile beside a road; zone: an arable stroke; house: an opening house pulled down.
  const wellTile = state.tiles.find(tile => canPlaceBuildingWithZones(state, "well", tile.tx, tile.ty).ok)!;
  state = run(state, { type: "place_building", kind: "well", tx: wellTile.tx, ty: wellTile.ty });
  const site = state.constructionSites.at(-1)!;
  state = run(state, { type: "cancel_construction", siteId: site.id });
  const roads = new Set(state.tiles.filter(tile => tile.hasRoad).map(tile => `${tile.tx},${tile.ty}`));
  const road = state.tiles.filter(tile => !tile.hasRoad && !tile.buildingId
    && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => roads.has(`${tile.tx + dx!},${tile.ty + dy!}`)))
    .find(tile => run(state, { type: "place_road_line", start: tile, destination: tile }) !== state)!;
  state = run(state, { type: "place_road_line", start: road, destination: road });
  state = run(state, { type: "zone_paint", kind: "arable", stroke: { tool: "polygon", points: [{ x: 2, y: 60 }, { x: 5, y: 60 }, { x: 5, y: 62 }, { x: 2, y: 62 }] } });
  const mill = state.buildings.find(building => building.kind === "mill")!;
  state = run(state, { type: "set_building_operation", buildingId: mill.id, paused: true });
  state = run(state, { type: "demolish_house", buildingId: state.houses[0]!.buildingId });
  // rebuild: a burnt house.
  const burnt = state.houses[1]!;
  state = { ...state, houses: state.houses.map(house => house === burnt ? { ...house, burntTick: state.tick, burntByEventId: "fire@test" } : house) };
  state = run(state, { type: "rebuild_house", buildingId: burnt.buildingId });
  // market town: the palisade the proclamation panel proposes, with the timber there.
  const stocked: GameState = { ...state, treasuryTimber: 2_000 };
  const proposal = computePalisadeProposal(stocked, palisadeFootprintsForState(stocked));
  assert.ok(proposal.ok);
  state = run(stocked, { type: "confirm_palisade_proclamation", candidatePath: proposal.path });
  assert.equal(state.era, "palisade");
  // petition answer and famine answer: a petition waiting, a famine arriving.
  state = { ...state, politics: { ...(state.politics ?? initialPolitics(state)), petitions: [{ id: "market_charter@1", defId: "market_charter", petitioner: "merchants", arrivedTick: state.tick }] } };
  state = run(state, { type: "petition_response", petitionId: "market_charter@1", response: "accept_with_price" });
  const famineId = `${GREAT_FAMINE_EVENT_ID}@61`;
  state = { ...state, events: { records: [...(state.events?.records ?? []), { id: famineId, defId: GREAT_FAMINE_EVENT_ID, kind: "dearth", season: Math.floor(state.tick / SEASON),
    arrivalTick: state.tick, losses: { burntHouses: 0, departures: 0, harvestLost: 0 }, harvestFromYear: Math.floor(state.tick / 4000) + 1, harvestYears: 2,
    populationAtArrival: state.population }], burning: [] } };
  state = run(state, { type: "famine_response", choice: "relief" });
  // wall priority: in a town whose palisade is being built.
  const walled = fixture("palisade-construction");
  const prioritised = run(walled, { type: "set_wall_construction_priority", priority: "priority" });
  assert.notEqual(prioritised, walled);
  assert.equal(prioritised.history?.seasonDecisions.wall_priority, 1);
  // stone town: its proclamation needs a stone wall's worth of stone; the ledger's side of it is the same call.
  state = recordDecision(state, { ...state, era: "stone_town" }, { type: "confirm_stone_town_proclamation" });

  const big = records(state).filter(record => record.kind === "decision").map(record => String(record.params?.decisionKind));
  assert.deepEqual([...big].sort(), [...BIG_DECISION_KINDS].sort(), "the big five, one record each");
  // Two seasons on, each big decision has its actual on its prediction's keys.
  const later = advanceHistory(state, { ...state, tick: state.tick + ACTUAL_AFTER_TICKS });
  for (const record of records(later).filter(entry => entry.kind === "decision")) {
    assert.ok(record.decision!.alternatives.length >= 1, String(record.params?.decisionKind));
    assert.deepEqual(Object.keys(record.decision!.actual!).sort(), Object.keys(record.decision!.predicted).sort(), String(record.params?.decisionKind));
  }
  assert.deepEqual(Object.keys(state.history!.seasonDecisions).sort(), ["build", "cancel", "house", "operation", "road", "zone"]);
  const closed = closeSeason(state);
  const bundles = records(closed).filter(record => record.template === "decision.bundle").map(record => String(record.params?.decisionKind));
  assert.deepEqual(bundles.sort(), ["build", "cancel", "house", "operation", "road", "zone"]);
  assert.deepEqual(records(closeSeason(prioritised)).filter(record => record.template === "decision.bundle").map(record => record.params?.decisionKind), ["wall_priority"]);
  assert.equal(DECISION_KINDS.length, 12);
  assert.equal(before.history, undefined, "the fixture had no ledger");
  assert.equal(historySummary(records(closed).find(record => record.template === "decision.bundle" && record.params?.decisionKind === "build")!), "이번 계절 건물 1곳의 공사를 놓았다");
});

test("H2 the famine answer keeps its alternatives and prediction, and two seasons later its actual on the same keys", () => {
  const town = fixture("population-176");
  const famineId = `${GREAT_FAMINE_EVENT_ID}@61`;
  const arriving: GameState = { ...town, events: { records: [{ id: famineId, defId: GREAT_FAMINE_EVENT_ID, kind: "dearth", season: Math.floor(town.tick / SEASON),
    arrivalTick: town.tick, losses: { burntHouses: 0, departures: 0, harvestLost: 0 }, harvestFromYear: Math.floor(town.tick / 4000) + 1, harvestYears: 2,
    populationAtArrival: town.population }], burning: [] } };
  const answered = run(arriving, { type: "famine_response", choice: "laissez_faire" });
  const record = records(answered).find(entry => entry.template === "decision.famine_response")!;
  assert.deepEqual(record.decision!.alternatives, ["relief", "price_control", "speculation"]);
  assert.deepEqual(Object.keys(record.decision!.predicted).sort(), ["population", "treasury"]);
  assert.equal(record.decision!.actual, undefined);
  assert.equal(record.decision!.actualDueTick, town.tick + ACTUAL_AFTER_TICKS);
  const before: GameState = { ...answered, tick: town.tick + ACTUAL_AFTER_TICKS - 1 };
  const due = advanceHistory(before, { ...before, tick: town.tick + ACTUAL_AFTER_TICKS, population: 150, treasuryCoin: 777 });
  const filled = records(due).find(entry => entry.id === record.id)!;
  assert.deepEqual(filled.decision!.actual, { population: 150, treasury: 777 });
  assert.deepEqual(due.history!.pendingActuals, []);
  assert.equal(records(due).length, records(answered).length, "filling an actual adds no record");
});

test("H3 the first fire is an event, and the household it burnt has a record whose cause is that fire", () => {
  const houses = [10, 11, 12].map(x => ({ id: `house-${x}-20`, kind: "house", tx: x, ty: 20, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 }) as Building);
  const homes: House[] = houses.map(building => ({ buildingId: building.id, level: 2, builtLevel: 2, residents: 4, hasWater: false, breadStock: 3, lastServicedTick: 0, unmetRequirementTicks: 0 }));
  const town: GameState = { ...DEFAULT_GAME_STATE, buildings: [...DEFAULT_GAME_STATE.buildings, ...houses], houses: [...DEFAULT_GAME_STATE.houses, ...homes] };
  const def = EVENT_DEF_BY_ID.get(FIRST_FIRE_EVENT_ID)!;
  const season = scheduledSeason(town, def)!;
  const id = eventInstanceId(def, season);
  let state: GameState = advanceSeasons({ ...town, tick: fireIgnitionFrom(town, id, season) - 1 });
  const until = state.tick + 400;
  for (let tick = state.tick + 1; tick <= until; tick += 1) state = step({ ...state, tick });
  const arrived = records(state).find(record => record.template === "event.arrived" && record.params?.defId === FIRST_FIRE_EVENT_ID)!;
  assert.ok(arrived !== undefined && arrived.severity === 2);
  assert.deepEqual(arrived.cause, { type: "event", id, detail: FIRST_FIRE_EVENT_ID });
  const burnt = records(state).filter(record => record.template === "person.burnt");
  assert.ok(burnt.length >= 1);
  assert.ok(burnt.every(record => record.cause?.type === "event" && record.cause.id === id && record.subject.type === "household"));
  assert.equal(historySummary(arrived), "첫 화재가 닥쳤다");
});

test("H4 every season's end leaves a 128² thumbnail, an era a 256² one; both decode to the town", () => {
  const town = fixture("population-176");
  const closed = closeSeason({ ...town, seasons: undefined as never, history: undefined as never });
  const season = records(closed).find(record => record.template === "ledger.season")!;
  assert.ok(season.snapshotId !== undefined);
  const picture = historySnapshot(closed, season.snapshotId!)!;
  assert.equal(picture.size, 128);
  assert.equal(picture.pixels.length, 128 * 128);
  const stored = closed.history!.snapshots.find(snapshot => snapshot.id === season.snapshotId)!;
  assert.ok(stored.data.length < 16_000, `${stored.data.length} characters`);
  const houseTile = town.buildings.find(building => building.kind === "house")!;
  assert.equal(picture.pixels[(houseTile.ty * 2) * 128 + houseTile.tx * 2], 5, "a house pixel is a house");
  const era = advanceHistory(closed, { ...closed, historicalEras: [...(closed.historicalEras ?? []), { id: "war", enteredTick: closed.tick, forced: false }] });
  const eraRecord = records(era).find(record => record.kind === "era")!;
  assert.equal(eraRecord.severity, 3);
  assert.equal(historySnapshot(era, eraRecord.snapshotId!)!.size, 256);
});

/** A ledger of `count` synthetic records, severities 0–3 in turn, households and the town in turn. */
function syntheticHistory(count: number): HistoryState {
  const kinds = ["person", "decision", "event", "era"] as const;
  const records: HistoryRecord[] = Array.from({ length: count }, (_, index) => ({ id: `h-${String(index + 1).padStart(6, "0")}`, tick: index * 10,
    kind: kinds[index % 4]!, template: "ledger.season", severity: (index % 4) as 0 | 1 | 2 | 3,
    subject: index % 2 === 0 ? { type: "household", id: `house-${index % 24}` } : { type: "town", id: "town" } }));
  return { records, snapshots: [], nextOrdinal: count + 1, seasonDecisions: {}, milestones: [], pendingActuals: [] };
}

test("H5 the severity filter keeps records at or above it; kinds, actors and ranges narrow it further", () => {
  const state = { history: syntheticHistory(400) };
  assert.equal(historyQuery(state, { severity: 2 }).length, 200);
  assert.ok(historyQuery(state, { severity: 3 }).every(record => record.severity === 3));
  assert.equal(historyQuery(state, { kinds: ["era"] }).length, 100);
  assert.equal(historyQuery(state, { actors: [{ type: "household", id: "house-0" }] }).length, 17, "indices 0, 24, … 384");
  assert.deepEqual(historyQuery(state, { range: { from: 100, to: 130 } }).map(record => record.tick), [100, 110, 120, 130]);
  assert.equal(history.query(state, { severity: 1, kinds: ["decision"] }).length, 100);
});

test("H6 a town with a ledger round-trips through save v15 and runs on identically", () => {
  let state = fixture("population-176");
  for (let tick = 0; tick < 1_200; tick += 1) state = advanceTick(state);
  assert.ok(records(state).length > 0 && (state.history?.snapshots.length ?? 0) > 0);
  const loaded = decodeSave(encodeSave({ state, createdAt: "2026-09-26T00:00:00.000Z", savedAt: "2026-09-26T00:00:00.000Z" }).bytes);
  assert.equal(loaded.envelope.schemaVersion, SAVE_SCHEMA_VERSION);
  assert.equal(SAVE_SCHEMA_VERSION, 15);
  assert.deepEqual(loaded.envelope.state, state);
  let a = state;
  let b = loaded.envelope.state as GameState;
  for (let tick = 0; tick < 600; tick += 1) { a = advanceTick(a); b = advanceTick(b); }
  assert.deepEqual(b.history, a.history);
  const promoted = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v14/population-176.save.json")));
  assert.equal(promoted.migratedFrom, 14);
  assert.equal((promoted.envelope.state as GameState).history, undefined, "a v14 town's ledger starts on its first tick");
});

test("H7 the chapter page is the ledger's top events and eras and its weightiest big decisions", () => {
  const base = fixture("population-176");
  const synthetic = syntheticHistory(60);
  const decisions: HistoryRecord[] = [
    { id: "h-000901", tick: 30, kind: "decision", template: "decision.petition_response", params: { decisionKind: "petition_response", chosen: "accept" }, subject: { type: "town", id: "town" }, severity: 1,
      decision: { chosen: "accept", alternatives: ["refuse", "accept_with_price"], predicted: { treasury: 10 } } },
    { id: "h-000902", tick: 40, kind: "decision", template: "decision.famine_response", params: { decisionKind: "famine_response", chosen: "relief" }, subject: { type: "town", id: "town" }, severity: 1,
      decision: { chosen: "relief", alternatives: ["price_control", "laissez_faire", "speculation"], predicted: { treasury: 5 } } },
  ];
  const state: GameState = { ...base, tick: 1_000, history: { ...synthetic, records: [...synthetic.records, ...decisions] },
    politics: { ...initialPolitics(base), chapter: { number: 1, startTick: 0, populationStart: 12, peakPopulation: 200 } } };
  const page = chronicleEntry(state);
  const top = chapterPageRecords(state, 0, 1_000);
  assert.deepEqual(page.events.map(event => event.recordId), top.events.map(record => record.id));
  assert.equal(page.events.length, 8);
  assert.ok(top.events.every(record => record.severity >= 2));
  assert.deepEqual(page.decisions.map(quote => quote.kind), ["famine_response", "petition_response"]);
  assert.deepEqual(page.decisions.map(quote => quote.recordId), ["h-000902", "h-000901"]);
});

test("H8 a query over 10,000 records takes under 5 ms", () => {
  const state = { history: syntheticHistory(10_000) };
  let best = Infinity;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const started = performance.now();
    historyQuery(state, { severity: 2, kinds: ["event", "era"], actors: [{ type: "town", id: "town" }], range: { from: 5_000, to: 90_000 } });
    best = Math.min(best, performance.now() - started);
  }
  assert.ok(best < 5, `${best.toFixed(2)} ms`);
});
