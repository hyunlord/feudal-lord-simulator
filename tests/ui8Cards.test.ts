import assert from "node:assert/strict";
import { test } from "node:test";

import { PLAGUE_BALANCE, PLAGUE_PETITION_DEFS, PLAGUE_PETITION_IDS } from "../src/content/plagueConfig";
import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { petitionDecisionView } from "../src/ui/decisionModels";
import { storyBeats } from "../src/ui/eventStory";
import { plagueMarks } from "../src/ui/seasonStrip";
import { SEASON_STRIP_COPY } from "../src/ui/seasonStripCopy.ko";
import { moneyObject } from "../src/ui/money.ko";

// UI-8 (F3-A): the four plague petition cards, nine story beats, and the plague's season-strip marks.
const YEAR = 4_000;
const SEASON = YEAR / 4;
const ERA_TICK = 148_000;

/** Minimal plague state at the onset of the first pestilence. */
function plagueTown(extra: Partial<GameState["plague"]> = {}): GameState {
  return {
    ...DEFAULT_GAME_STATE,
    tick: ERA_TICK,
    plague: {
      eraTick: ERA_TICK,
      rumourTick: ERA_TICK - SEASON,
      first: { arrivalTick: ERA_TICK, dead: 10, endTick: undefined },
      answers: {},
      vacantHouseIds: ["h1", "h2"],
      resettled: 0,
      recovered: 0,
      fled: 0,
      ...extra,
    } as GameState["plague"],
  } as GameState;
}

/** State with a single open plague petition (no response yet). */
function withPetition(defId: (typeof PLAGUE_PETITION_IDS)[number]): GameState {
  const state = plagueTown();
  return {
    ...state,
    politics: {
      merchantGauge: 50,
      petitions: [{ id: `${defId}@${ERA_TICK}`, defId, petitioner: PLAGUE_PETITION_DEFS.find(d => d.id === defId)!.petitioner, arrivedTick: ERA_TICK }],
      rights: [], decisions: [], chapter: { number: 3, startTick: ERA_TICK - YEAR, populationStart: 50, peakPopulation: 50 }, chapterEnds: [],
    },
  } as unknown as GameState;
}

// ─── Decision Cards ───────────────────────────────────────────────────────────

test("UI-8 PL-5: vacant_priest card — Wave 21 art, accept/refuse only, parish faction, treasury forecast", () => {
  const view = petitionDecisionView(withPetition("vacant_priest"))!;
  assert.ok(view !== null, "vacant_priest petition not found");
  assert.deepEqual(view.presentation.art, { sheet: "wave21", id: "ch3_decision_vacant_priest" });
  assert.deepEqual(view.options.map(o => o.choice), ["accept", "refuse"], "exactly two answers: no accept_with_price");
  assert.match(view.presentation.demand, /사제/, "demand mentions priest");
  assert.match(view.options[0]!.line, new RegExp(`봉급 ${moneyObject(PLAGUE_BALANCE.monasteryStipend)} 내고`), "accept line shows stipend");
  assert.match(view.options[0]!.predicted, /금고/, "forecast shows treasury");
});

test("UI-8 PL-6: wages card — Wave 21 art, accept/refuse only, labourers faction, treasury forecast", () => {
  const view = petitionDecisionView(withPetition("wages"))!;
  assert.ok(view !== null, "wages petition not found");
  assert.deepEqual(view.presentation.art, { sheet: "wave21", id: "ch3_decision_wages" });
  assert.deepEqual(view.options.map(o => o.choice), ["accept", "refuse"], "exactly two answers: no accept_with_price");
  assert.equal(PLAGUE_PETITION_DEFS.find(d => d.id === "wages")!.petitioner, "labourers", "petitioner is labourers");
  assert.match(view.options[0]!.predicted, /금고/, "forecast shows treasury");
});

test("UI-8 PL-7: land_redistribution card — Wave 21 art, accept/accept_with_price only, no refuse", () => {
  const view = petitionDecisionView(withPetition("land_redistribution"))!;
  assert.ok(view !== null, "land_redistribution petition not found");
  assert.deepEqual(view.presentation.art, { sheet: "wave21", id: "ch3_decision_land_redistribution" });
  assert.deepEqual(view.options.map(o => o.choice), ["accept", "accept_with_price"], "exactly two answers: no refuse");
  assert.match(view.presentation.demand, /필지/, "demand mentions vacant plots");
  assert.match(view.options[1]!.line, new RegExp(`${PLAGUE_BALANCE.entryFine}`), "accept_with_price shows entry fine");
});

test("UI-8 PL-8: cash_rent card — Wave 21 art, accept/refuse only, treasury forecast", () => {
  const view = petitionDecisionView(withPetition("cash_rent"))!;
  assert.ok(view !== null, "cash_rent petition not found");
  assert.deepEqual(view.presentation.art, { sheet: "wave21", id: "ch3_decision_cash_rent" });
  assert.deepEqual(view.options.map(o => o.choice), ["accept", "refuse"], "exactly two answers: no accept_with_price");
  assert.match(view.options[0]!.predicted, /금고/, "forecast shows treasury");
});

test("UI-8: PLAGUE_PETITION_IDS are the four expected IDs in order", () => {
  assert.deepEqual([...PLAGUE_PETITION_IDS], ["vacant_priest", "wages", "land_redistribution", "cash_rent"]);
});

// ─── Story Beats ──────────────────────────────────────────────────────────────

test("UI-8 PL-1: rumour beat fires while plagueStage === 'rumour' (rumourTick set, no first)", () => {
  const state: GameState = {
    ...DEFAULT_GAME_STATE,
    tick: ERA_TICK,
    plague: { eraTick: ERA_TICK, rumourTick: ERA_TICK - SEASON / 2, answers: {}, vacantHouseIds: [], resettled: 0, recovered: 0, fled: 0 },
  } as unknown as GameState;
  const beats = storyBeats(state);
  const rumour = beats.find(b => b.kind === "plague_rumour");
  assert.ok(rumour !== undefined, "plague_rumour beat expected during rumour stage");
  assert.equal(rumour.illustration, "ch3_event_harbour_fever");
});

test("UI-8 PL-2: arrival beat fires while plague is arriving (first.arrivedTick set, no endTick)", () => {
  const state = plagueTown();
  const beats = storyBeats(state);
  const arrival = beats.find(b => b.kind === "plague_arrival");
  assert.ok(arrival !== undefined, "plague_arrival beat expected during arrival stage");
  assert.equal(arrival.illustration, "ch3_event_priest_death");
});

test("UI-8 PL-2: new_graves beat fires when dead > 0", () => {
  const state = plagueTown();
  const beats = storyBeats(state);
  assert.ok(beats.some(b => b.kind === "plague_new_graves"), "plague_new_graves beat when dead > 0");
});

test("UI-8 PL-3: empty_streets beat fires when vacantHouseIds are present", () => {
  const state = plagueTown({ vacantHouseIds: ["h1", "h2", "h3"] });
  const beats = storyBeats(state);
  assert.ok(beats.some(b => b.kind === "plague_empty_streets"), "plague_empty_streets when vacant houses exist");
});

test("UI-8 PL-3: abandoned_fields beat fires when pestilence recently ended", () => {
  const state: GameState = {
    ...DEFAULT_GAME_STATE,
    tick: ERA_TICK + SEASON,
    plague: {
      eraTick: ERA_TICK,
      rumourTick: ERA_TICK - SEASON,
      first: { arrivedTick: ERA_TICK, dead: 15, endTick: ERA_TICK + SEASON / 2 },
      answers: {},
      vacantHouseIds: ["h1"],
      resettled: 0,
      recovered: 0,
      fled: 0,
    },
  } as unknown as GameState;
  const beats = storyBeats(state);
  assert.ok(beats.some(b => b.kind === "plague_abandoned_fields"), "plague_abandoned_fields after first pestilence ends");
});

test("UI-8 PL-6: priest_death beat fires while curacyVacant is true", () => {
  const state: GameState = {
    ...DEFAULT_GAME_STATE,
    tick: ERA_TICK,
    plague: {
      eraTick: ERA_TICK,
      rumourTick: ERA_TICK - SEASON,
      first: { arrivalTick: ERA_TICK, dead: 5, endTick: undefined },
      curacy: { vacantSince: ERA_TICK },
      answers: {},
      vacantHouseIds: [],
      resettled: 0,
      recovered: 0,
      fled: 0,
    },
  } as unknown as GameState;
  const beats = storyBeats(state);
  assert.ok(beats.some(b => b.kind === "plague_priest_death"), "plague_priest_death beat when curacy is vacant");
});

test("UI-8 PL-9: second beat fires while second pestilence is active", () => {
  const state: GameState = {
    ...DEFAULT_GAME_STATE,
    tick: ERA_TICK + YEAR * 13,
    plague: {
      eraTick: ERA_TICK,
      rumourTick: ERA_TICK - SEASON,
      first: { arrivalTick: ERA_TICK, dead: 20, endTick: ERA_TICK + SEASON },
      second: { arrivalTick: ERA_TICK + YEAR * 13, dead: 5, endTick: undefined },
      answers: {},
      vacantHouseIds: [],
      resettled: 0,
      recovered: 0,
      fled: 0,
    },
  } as unknown as GameState;
  const beats = storyBeats(state);
  assert.ok(beats.some(b => b.kind === "plague_second"), "plague_second beat when second pestilence active");
});

// ─── Season Strip Marks ───────────────────────────────────────────────────────

test("UI-8: plagueMarks returns the ahead steps within a year, soonest first", () => {
  const now = 1_000;
  const steps = [
    { id: "rumour" as const, tick: now + 500, state: "ahead" as const },
    { id: "arrival" as const, tick: now + 2_000, state: "ahead" as const },
    { id: "wage_demand" as const, tick: now + YEAR + 1, state: "ahead" as const }, // beyond a year: excluded
    { id: "end" as const, tick: now - 100, state: "done" as const },               // done: excluded
  ];
  const marks = plagueMarks(steps, now);
  assert.deepEqual(marks.map(m => m.id), ["rumour", "arrival"], "only ahead steps within a year, soonest first");
  assert.ok(marks[0]!.fraction >= 0 && marks[0]!.fraction < 1, "fraction is in-year");
});

test("UI-8: seasonStripCopy.ko.ts has labels for all PlagueStepIds", () => {
  const required = ["rumour", "arrival", "wage_demand", "abandoned_fields", "ordinance", "resettlement", "second", "end"];
  for (const id of required) {
    assert.ok(id in SEASON_STRIP_COPY.plague, `missing label for plague step: ${id}`);
    assert.ok(typeof (SEASON_STRIP_COPY.plague as Record<string, unknown>)[id] === "string", `label for ${id} must be a string`);
  }
});
