/** LM-E8 (spec docs/design/lord-slice.md LS-1…LS-5): the lord's vertical slice — its scenario, start, end, auto-pause and bot. */
import assert from "node:assert/strict";
import test from "node:test";

import { BALANCE } from "../src/content/balanceConfig";
import { LORD_SLICE_AFTER_SECOND_ESTATE_YEARS, LORD_SLICE_FACTIONS, LORD_SLICE_SCENARIO_ID, LORD_SLICE_YEARS, PAUSE_REASONS } from "../src/content/lordSliceConfig";
import { CORE_SCENARIOS, DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { scenarioById } from "../src/content/scenario/registry";
import { pauseReasons } from "../src/engine/autoPause";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import type { HistoryRecord } from "../src/engine/history.types";
import { ASKED_KINDS, lordBotCommands, lordBotPolicy } from "../src/engine/lordBot";
import { lordSlice, lordSliceEndTick, lordSliceOutcome, lordSliceStart, secondEstateSince } from "../src/engine/lordSlice";
import { MARRIAGE_ESTATE_ID } from "../src/engine/marriage";
import { newGameState } from "../src/state/newGame";

const YEAR = BALANCE.TICKS_PER_YEAR;
const opening = () => newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!;

test("LS-1 the slice: the demesne and its town in lord mode from 1300, three neighbour estates (one an old lord with daughters only, in debt), five factions", () => {
  const state = opening();
  assert.ok(lordSlice(state));
  assert.ok(state.agency !== undefined, "always lord mode");
  assert.equal(scenarioById(LORD_SLICE_SCENARIO_ID).mode, "sandbox", "no chapters' victory");
  assert.ok(!CORE_SCENARIOS.some(entry => entry.id === LORD_SLICE_SCENARIO_ID), "not on the start screen's list (render LM-R3 adds its start)");
  const start = lordSliceStart(state);
  assert.equal(start.startYear, 1300);
  assert.deepEqual(start.goalYears, { min: 12, max: 20 });
  assert.deepEqual(start.end, { years: LORD_SLICE_YEARS, afterSecondEstateYears: LORD_SLICE_AFTER_SECOND_ESTATE_YEARS });
  assert.equal(start.neighbours.length, 3);
  const test = start.neighbours.find(entry => entry.estateId === MARRIAGE_ESTATE_ID)!;
  assert.ok(test.daughtersOnly && test.debt > 0 && test.lordAge === 63, JSON.stringify(test));
  assert.deepEqual(start.factions.map(entry => entry.id), [...LORD_SLICE_FACTIONS]);
  assert.ok(start.home.pieces.every(piece => piece.possessor === LORD));
  // The other scenarios are untouched: the campaign starts in the sandbox's way unless lord mode is asked.
  assert.equal(newGameState({ scenarioId: DEFAULT_SCENARIO_ID, seed: 1 })!.agency, undefined);
  assert.equal(lordSliceOutcome(newGameState({ scenarioId: DEFAULT_SCENARIO_ID, seed: 1 })!), null);
});

test("LS-5 the end: twenty years, or five after a second estate (the sooner); the summary of the lord's years", () => {
  const state = opening();
  assert.equal(lordSliceEndTick(state), LORD_SLICE_YEARS * YEAR);
  assert.equal(secondEstateSince(state), null);
  const estates = estatesOf(state);
  const at = 6 * YEAR + 123;
  const held: GameState = { ...state, estates: { ...estates, estates: estates.estates.map(estate => estate.id !== MARRIAGE_ESTATE_ID ? estate
    : { ...estate, titleHolder: LORD, possessor: LORD, pieces: estate.pieces.map(piece => ({ ...piece, titleHolder: LORD, possessor: LORD, possessedSince: at })) }) } };
  assert.equal(secondEstateSince(held), at);
  assert.equal(lordSliceEndTick(held), at + LORD_SLICE_AFTER_SECOND_ESTATE_YEARS * YEAR);
  assert.equal(lordSliceOutcome({ ...held, tick: at + 5 * YEAR - 1 })!.ended, false);
  const ended = lordSliceOutcome({ ...held, tick: at + 5 * YEAR })!;
  assert.deepEqual([ended.ended, ended.reason, ended.summary.secondEstateYear], [true, "second_estate", 1306]);
  assert.deepEqual([...ended.summary.estatesHeld].sort(), ["estate-home", MARRIAGE_ESTATE_ID].sort());
  const late = lordSliceOutcome({ ...state, tick: LORD_SLICE_YEARS * YEAR })!;
  assert.deepEqual([late.ended, late.reason, late.summary.year], [true, "years", 1320]);
});

const line = (id: number, template: string, params: Record<string, string | number> = {}, tick = 10): HistoryRecord =>
  ({ id: `h-${String(id).padStart(6, "0")}`, tick, kind: "event", template, subject: "town", severity: 2, params }) as unknown as HistoryRecord;
const withLines = (lines: readonly HistoryRecord[], tick = 10) => ({ tick, history: { records: lines } }) as unknown as GameState;

test("LS-2 the auto-pause names its reasons only for the slice's moments: a counter, a great death or inheritance, a judgment, a right at stake, an estate's crisis, an estate gained or lost", () => {
  const before = withLines([line(1, "ledger.season", {}, 9)], 9);
  const stops = (records: readonly HistoryRecord[]) => pauseReasons(before, withLines([line(1, "ledger.season", {}, 9), ...records])).map(event => event.reason);
  assert.deepEqual(stops([line(2, "negotiation.countered")]), ["counter_offer"]);
  assert.deepEqual(stops([line(2, "estate.person_died", { role: "head" }), line(3, "estate.person_died", { role: "kin" }), line(4, "stewardship.steward_died")]), ["major_death", "major_death"]);
  assert.deepEqual(stops([line(2, "marriage.inherited"), line(3, "legacy.succession")]), ["inheritance", "inheritance"]);
  assert.deepEqual(stops([line(2, "estate.suit_judged"), line(3, "estate.suit_stage")]), ["judgment"]);
  assert.deepEqual(stops([line(2, "event.arrived", { defId: "great_famine" }), line(3, "event.arrived", { defId: "fire" }), line(4, "plague.arrived"), line(5, "war.raid")]),
    ["estate_crisis", "estate_crisis", "estate_crisis"]);
  // An estate's title and possession lines in one tick are one stop; a piece alone is none.
  assert.deepEqual(stops([line(2, "estate.title_changed", { estate: MARRIAGE_ESTATE_ID, piece: "", from: "estate:x", to: LORD }),
    line(3, "estate.possession_changed", { estate: MARRIAGE_ESTATE_ID, piece: "", from: "estate:x", to: LORD }),
    line(4, "estate.possession_changed", { estate: "estate-home", piece: "home:market", from: LORD, to: "overlord" })]), ["estate_gained"]);
  assert.deepEqual(stops([line(2, "estate.possession_changed", { estate: "e", piece: "", from: LORD, to: "person:x" })]), ["estate_lost"]);
  assert.deepEqual(stops([line(2, "stewardship.escalated", { rule: "rights" }), line(3, "stewardship.escalated", { rule: "amount" })]), ["rights_petition"]);
  // A house finished, a shop opened, a decision taken: no stop.
  assert.deepEqual(stops([line(2, "agency.project_started"), line(3, "person.move_in"), line(4, "milestone.first_building"), line(5, "decision.estate_policy")]), []);
  // A petition putting a right at stake, arriving in the tick.
  const petitions = { petitions: [{ id: "restore_right@10", defId: "restore_right", arrivedTick: 10 }, { id: "x@10", defId: "market_charter", arrivedTick: 10 }] };
  assert.deepEqual(pauseReasons(before, { ...withLines([line(1, "ledger.season", {}, 9)]), politics: petitions } as unknown as GameState).map(event => [event.reason, event.petitionId]),
    [["rights_petition", "restore_right@10"]]);
  assert.ok(PAUSE_REASONS.length === 8);
});

test("LS-3 the lord bot: the policy by the year, and from the opening week it takes his claim to court and sets the market dues", () => {
  assert.deepEqual([1300, 1307, 1308, 1315, 1317, 1318].map(lordBotPolicy), ["growth", "growth", "revenue", "stability", "stability", "revenue"]);
  const state = { ...opening(), tick: 1 };
  const kinds = lordBotCommands(state).map(entry => entry.kind);
  assert.ok(kinds.includes("suit") && kinds.includes("dues"), `${kinds}`);
  assert.ok(!ASKED_KINDS.has("suit") && ASKED_KINDS.has("petition"));
});
