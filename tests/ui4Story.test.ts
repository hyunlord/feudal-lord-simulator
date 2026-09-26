import assert from "node:assert/strict";
import { test } from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { storyBeats } from "../src/ui/eventStory";
import { famineDecisionView, petitionDecisionView } from "../src/ui/decisionModels";
import { chronicleIllustration } from "../src/ui/chronicleModel";
import { forecastMarks } from "../src/ui/seasonStrip";
import { INITIAL_UI_STATE, reduceUi, timeStopped, topModal } from "../src/ui/uiStateMachine";

// UI-4: the story beats read from the engine's state, the decisions' predictions, the modal round trip.
const house = DEFAULT_GAME_STATE.buildings.find(building => building.kind === "house")!;
const losses = { burntHouses: 0, departures: 0, harvestLost: 0 };
const withEvents = (events: Partial<NonNullable<GameState["events"]>>, extra: Partial<GameState> = {}): GameState =>
  ({ ...DEFAULT_GAME_STATE, tick: 9_400, events: { records: [], burning: [], ...events }, ...extra } as GameState);

test("UI-4: a burning house is a fire beat at that house, with the engine's burning count and dousing", () => {
  const state = withEvents({ records: [{ id: "first_fire@9", defId: "first_fire", kind: "fire", season: 9, arrivalTick: 9_350, losses }],
    burning: [{ buildingId: house.id, eventId: "first_fire@9", ignitedTick: 9_350, outTick: 9_410, doused: true }] });
  const fire = storyBeats(state).find(beat => beat.kind === "fire")!;
  assert.equal(fire.illustration, "event_fire");
  assert.deepEqual(fire.tile, { tx: house.tx, ty: house.ty });
  assert.deepEqual(fire.facts, ["타는 집 1채", "우물 물로 끄는 집 1채"]);
  const out = withEvents({ records: [{ id: "first_fire@9", defId: "first_fire", kind: "fire", season: 9, arrivalTick: 9_350, endTick: 9_410, recoveryUntilTick: 11_000, losses: { ...losses, burntHouses: 1 } }] });
  assert.deepEqual(storyBeats(out).map(beat => beat.kind), ["fire_aftermath"], "once out, the aftermath until its recovery ends");
});

test("UI-4 gate 2: the Great Famine is a decision with the four answers and the engine's own prediction for each", () => {
  const state = withEvents({ records: [{ id: "great_famine@67", defId: "great_famine", kind: "dearth", season: 67, arrivalTick: 9_000, losses }] });
  const beat = storyBeats(state).find(entry => entry.kind === "famine")!;
  assert.equal(beat.decision, "famine");
  const view = famineDecisionView(state)!;
  assert.deepEqual(view.options.map(option => option.choice), ["relief", "price_control", "laissez_faire", "speculation"]);
  for (const option of view.options) assert.match(option.predicted, /^인구 \d+\(지금 \d+\) · 금고 -?\d+d\(지금 -?\d+d\)$/, option.choice);
  assert.equal(famineDecisionView(withEvents({ records: [{ id: "great_famine@67", defId: "great_famine", kind: "dearth", season: 67, arrivalTick: 9_000, losses,
    response: { choice: "relief", tick: 9_100 } }] })), null, "answered: no modal");
});

test("UI-4 gate 2: a decision modal pushed over any state returns to that state when answered (and stops time meanwhile)", () => {
  const placing = reduceUi(reduceUi(INITIAL_UI_STATE, { type: "open_build" }), { type: "pick_tool", line: false });
  const decision = reduceUi(placing, { type: "push_modal", modal: "decision" });
  assert.equal(topModal(decision), "decision"); assert.equal(timeStopped(decision), true);
  assert.equal(reduceUi(decision, { type: "select" }), decision, "nothing under the modal changes");
  const back = reduceUi(decision, { type: "pop_modal" });
  assert.equal(back.mode, "placement"); assert.equal(timeStopped(back), false);
});

test("UI-4: an open petition is a decision beat; its answers carry the engine's predicted treasury and gauge", () => {
  const state = { ...DEFAULT_GAME_STATE, tick: 30_000, politics: { merchantGauge: 50, petitions: [{ id: "market_charter@30000", defId: "market_charter", petitioner: "merchants", arrivedTick: 30_000 }],
    rights: [], decisions: [], chapter: { number: 1, startTick: 0, populationStart: 12, peakPopulation: 12 }, chapterEnds: [] } } as unknown as GameState;
  assert.equal(storyBeats(state).find(beat => beat.kind === "petition")?.decision, "petition");
  const view = petitionDecisionView(state)!;
  assert.deepEqual(view.options.map(option => option.choice), ["accept", "accept_with_price", "refuse"]);
  assert.match(view.options[1]!.predicted, /금고 150d\(지금 0d\)/, "the charter fee");
  assert.match(view.options[2]!.predicted, /상인 게이지 30\(지금 50\)/, "refusing costs the gauge 20");
});

test("UI-4: chronicle illustrations follow the ledger record, and forecast marks keep a year ahead", () => {
  assert.equal(chronicleIllustration({ template: "event.arrived", params: { defId: "great_famine" } }), "chronicle_famine");
  assert.equal(chronicleIllustration({ template: "milestone.first_building", params: { building: "mill" } }), "chronicle_first_mill");
  assert.equal(chronicleIllustration({ template: "decision.famine_response", params: { chosen: "relief" } }), "chronicle_relief");
  const marks = forecastMarks([{ kind: "fire", stage: "sign", arrivalTick: 1_500, defId: "first_fire" }, { kind: "dearth", stage: "rumour", arrivalTick: 9_000, defId: "great_famine" },
    { kind: "dearth", stage: "arrival", arrivalTick: 1_200, defId: "dearth_rehearsal" }], 1_000);
  assert.deepEqual(marks.map(mark => [mark.kind, mark.stage]), [["fire", "sign"]], "arrived events and those beyond a year stay off");
});
