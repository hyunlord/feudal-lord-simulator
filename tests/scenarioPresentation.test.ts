import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CORE_SCENARIOS, DEFAULT_SCENARIO_ID, SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { SCENARIOS } from "../src/content/scenario/registry";
import { SCENARIO_COPY } from "../src/content/scenario/scenarioCopy.ko";
import type { GameState } from "../src/engine/engine.types";
import { createSaveSummary } from "../src/save/saveSummary";
import { DEFAULT_GAME_STATE, GameProvider, gameReducer } from "../src/state/gameStore";
import { App } from "../src/App";
import { buildEraConsoleModel } from "../src/ui/EraConsole";
import { openGoalFitsScenario } from "../src/ui/onboardingTaskModel";
import { ResourceBar } from "../src/ui/ResourceBar";
import { SettlementPanel } from "../src/ui/SettlementPanel";
import { settlementGuidance } from "../src/ui/settlementGuidanceModel";

const panel = (state: GameState) => renderToStaticMarkup(createElement(SettlementPanel, { state, onRestart: () => undefined }));
const stoneCity = (): GameState => JSON.parse(readFileSync("fixtures/determinism/seed1/final-state.json", "utf8")) as GameState;

test("goal board reads the calendar, historical era and milestone count from the scenario", () => {
  const markup = panel(DEFAULT_GAME_STATE);
  assert.match(markup, /1300년 봄 · 시대: 포화/);
  assert.match(markup, /달성 0\/3/);
  // F0-A (F2): the famine waits for the town's readiness; a town that entered it shows it from 1315.
  assert.match(panel({ ...DEFAULT_GAME_STATE, tick: 15 * 4000 + 2000 }), /1315년 가을 · 시대: 포화/);
  assert.match(panel({ ...DEFAULT_GAME_STATE, tick: 15 * 4000 + 2000, historicalEras: [{ id: "saturation", enteredTick: 0, forced: false },
    { id: "famine", enteredTick: 15 * 4000, forced: false }] }), /1315년 가을 · 시대: 기근과 취약/);
});

test("sandbox goal board shows the sandbox note and no milestone count", () => {
  const markup = panel({ ...DEFAULT_GAME_STATE, scenarioId: SANDBOX_SCENARIO_ID });
  assert.ok(markup.includes(SCENARIO_COPY.sandboxGoal));
  assert.doesNotMatch(markup, /달성 \d+\/\d+/);
});

test("a completed stone wall is a victory-screen bonus, not a victory condition", () => {
  const withStone = panel(stoneCity());
  assert.ok(withStone.includes(SCENARIO_COPY.victoryTitle(SCENARIO_COPY.objectives.prosperity.title)));
  assert.ok(withStone.includes(SCENARIO_COPY.stoneWallBonus));
  const city = stoneCity();
  const timber = { ...city, palisade: city.palisade === null ? null : { ...city.palisade, segments: city.palisade.segments.map(segment => ({ ...segment, material: "timber" as const })) } };
  assert.ok(!panel(timber).includes(SCENARIO_COPY.stoneWallBonus));
});

test("the calendar sits beside the speed controls, not in the resource bar (UX-1 HUD)", () => {
  const bar = renderToStaticMarkup(createElement(ResourceBar, { state: { ...DEFAULT_GAME_STATE, tick: 2 * 4000 + 1000 }, populationDrawerOpen: false, onPopulationDrawerToggle: () => undefined }));
  assert.doesNotMatch(bar, /resource-calendar/);
  const app = renderToStaticMarkup(createElement(GameProvider, null, createElement(App)));
  assert.match(app, /class="hud-time-cluster"[^>]*><span class="hud-date" data-testid="hud-calendar">1300년 봄<\/span>/);
});

test("T3 the stone-wall action is disabled with a reason when the scenario turns the project off", () => {
  if (SCENARIOS.get("test:no_stone_wall_ui") === undefined) {
    SCENARIOS.register({ ...CORE_SCENARIOS[0]!, id: "test:no_stone_wall_ui", walls: { palisade: "required", stoneWall: "off" } });
  }
  const market: GameState = { ...stoneCity(), era: "palisade", treasuryCoin: 999 };
  const off = buildEraConsoleModel({ state: { ...market, scenarioId: "test:no_stone_wall_ui" }, draft: null });
  assert.equal(off.action.enabled, false);
  assert.equal(off.action.reason, SCENARIO_COPY.stoneWallClosed);
  assert.deepEqual(off.requirements, []);
  const optional = buildEraConsoleModel({ state: market, draft: null });
  assert.notEqual(optional.action.reason, SCENARIO_COPY.stoneWallClosed);
  assert.equal(optional.requirements.length, 5);
});

test("the standing basic-operations notice only shows for a campaign village with a goal ahead", () => {
  assert.equal(openGoalFitsScenario(DEFAULT_GAME_STATE), true);
  assert.equal(openGoalFitsScenario({ ...DEFAULT_GAME_STATE, scenarioId: SANDBOX_SCENARIO_ID }), false);
  assert.equal(openGoalFitsScenario({ ...DEFAULT_GAME_STATE, era: "palisade" }), false);
});

test("population guidance targets come from the scenario's stage and victory data", () => {
  assert.equal(settlementGuidance(DEFAULT_GAME_STATE).populationGoal, 60);
  assert.equal(settlementGuidance({ ...DEFAULT_GAME_STATE, era: "palisade" }).populationGoal, 140);
});

test("new game mode choice starts the default opening under the chosen scenario", () => {
  const played = { ...DEFAULT_GAME_STATE, tick: 500, population: 99 };
  const sandbox = gameReducer(played, { type: "start_new_game", scenarioId: SANDBOX_SCENARIO_ID });
  assert.deepEqual(sandbox, { ...DEFAULT_GAME_STATE, scenarioId: SANDBOX_SCENARIO_ID });
  assert.equal(gameReducer(played, { type: "start_new_game", scenarioId: "core:missing" }), played);
  assert.equal(gameReducer(played, { type: "start_new_game", scenarioId: DEFAULT_SCENARIO_ID }).scenarioId, DEFAULT_SCENARIO_ID);
});

test("the save summary names the scenario", () => {
  assert.ok(createSaveSummary(DEFAULT_GAME_STATE).line.startsWith(`${SCENARIO_COPY.scenarios.campaign_market_town} · `));
  assert.ok(createSaveSummary({ ...DEFAULT_GAME_STATE, scenarioId: SANDBOX_SCENARIO_ID }).line.startsWith(`${SCENARIO_COPY.scenarios.sandbox} · `));
});
