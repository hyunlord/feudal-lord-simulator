import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { AutoplayAction } from "../src/engine/autoplay";
import { decideNextAction } from "../src/engine/autoplay";
import { autoplayActionToGameAction as engineAutoplayActionToGameAction } from "../src/engine/autoplayActions";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";
import type { GameAction } from "../src/state/gameStore.types";
import { canPlaceBuilding } from "../src/world/placement";
import {
  AUTOPLAY_TICK_CADENCE,
  autoplayActionToGameAction,
  canRunAutoplayAtTick,
} from "../src/ui/autoplayPresentation";
import { formatEconomyHarnessReport, hashEconomyState, runMainEconomyHarness } from "../scripts/economyHarness";
import { createStage3EconomyHarnessScenario } from "../scripts/economyHarnessStage3Scenario";

type TraceAction = {
  readonly tick: number;
  readonly action: AutoplayAction;
};

type PopulationPoint = {
  readonly tick: number;
  readonly population: number;
  readonly bread: number;
  readonly houses: number;
};

const PRE_FEATURE_NO_AUTOPLAY_12K_HASH = "19689206a4b614bd";

function toGameAction(action: AutoplayAction, state: GameState): GameAction | null {
  return autoplayActionToGameAction(action, state);
}

function totalBread(state: GameState): number {
  const buildingBread = state.buildings.reduce((total, building) => total + (building.inventory.bread ?? 0), 0);
  return state.houses.reduce((total, house) => total + house.breadStock, buildingBread);
}

function traceDefaultAutoplay(ticks: number): {
  readonly actions: readonly TraceAction[];
  readonly finalState: GameState;
  readonly population: readonly PopulationPoint[];
} {
  let state = DEFAULT_GAME_STATE;
  let lastActionTick = -AUTOPLAY_TICK_CADENCE;
  const actions: TraceAction[] = [];
  const population: PopulationPoint[] = [{ tick: state.tick, population: state.population, bread: totalBread(state), houses: state.houses.length }];
  for (let step = 0; step < ticks; step += 1) {
    if (canRunAutoplayAtTick({ enabled: true, currentTick: state.tick, lastActionTick })) {
      const action = decideNextAction(state);
      const gameAction = toGameAction(action, state);
      if (gameAction !== null) {
        if (action.kind === "place_building") {
          assert.equal(canPlaceBuilding(state, action.building, action.tx, action.ty).ok, true);
        }
        actions.push({ tick: state.tick, action });
        state = gameReducer(state, gameAction);
        lastActionTick = state.tick;
      }
    }
    state = advanceTick(state);
    if (state.tick % 1_200 === 0 || step === ticks - 1) {
      population.push({ tick: state.tick, population: state.population, bread: totalBread(state), houses: state.houses.length });
    }
  }
  return { actions, finalState: state, population };
}

function maxPopulation(points: readonly PopulationPoint[]): number {
  return points.reduce((max, point) => Math.max(max, point.population), 0);
}

test("Given autoplay is disabled When default state advances twelve thousand ticks Then the pre-feature hash is unchanged", () => {
  let state = DEFAULT_GAME_STATE;

  for (let step = 0; step < 12_000; step += 1) {
    state = advanceTick(state);
  }

  assert.equal(hashEconomyState(state), PRE_FEATURE_NO_AUTOPLAY_12K_HASH);
});

test("Given the current main harness When formatted Then it emits the fourteen canonical metric rows", () => {
  const report = runMainEconomyHarness([]);
  const output = formatEconomyHarnessReport(report);

  assert.equal(report.metrics.length, 14);
  assert.deepEqual(report.metrics.map((metric) => metric.status), [
    "PASS",
    "PASS",
    "PASS",
    "PASS",
    "PASS",
    "PASS",
    "PASS",
    "PASS",
    "PASS",
    "PASS",
    "PASS",
    "PASS",
    "PASS",
    "PASS",
  ]);
  assert.deepEqual(report.metrics.map((metric) => metric.label), [
    "Determinism hash",
    "Food stability",
    "Cargo thrashing",
    "Labour deadlock",
    "Housing oscillation",
    "Stall duration",
    "Builder starvation",
    "Material deadlock",
    "Completion rate",
    "Legacy Stage 2 hash",
    "Stage 3 determinism hash",
    "Palisade reachability",
    "Palisade wall completion",
    "Palisade labour continuity",
  ]);
  assert.match(output, /Metric\s+Value\s+Status/);
});

test("Given the main harness When report provenance is inspected Then the fourteen rows are advisor-driven without scripted-site wording", () => {
  const report = runMainEconomyHarness([]);
  const output = formatEconomyHarnessReport(report);
  const metricsSource = readFileSync(new URL("../scripts/economyHarnessMetrics.ts", import.meta.url), "utf8");
  const traceSource = readFileSync(new URL("../scripts/economyHarnessStage3Trace.ts", import.meta.url), "utf8");
  const provenance = "advisorProvenance" in report ? report.advisorProvenance : null;
  const sources = "metricTraceSources" in report ? report.metricTraceSources : [];

  assert.equal(report.metrics.length, 14);
  assert.equal(provenance?.kind, "advisor-runs");
  assert.deepEqual(provenance?.traces.map((trace) => trace.id), ["default", "stage3-seeded"]);
  assert.equal(provenance?.traces.every((trace) => trace.cadenceTicks === AUTOPLAY_TICK_CADENCE), true);
  assert.equal(provenance?.traces.every((trace) => trace.actionCount > 0), true);
  assert.equal(provenance?.traces.every((trace) => trace.snapshotCount > 0), true);
  assert.equal(sources?.length, 14);
  assert.equal(sources?.slice(0, 9).every((source) => source.traceId === "default"), true);
  assert.equal(sources?.slice(9).every((source) => source.traceId === "stage3-seeded"), true);
  assert.equal(report.metrics.find((metric) => metric.label === "Palisade wall completion")?.status, "PASS");
  assert.doesNotMatch(output, /scripted sites/);
  assert.doesNotMatch(output, /recovery sites/);
  assert.doesNotMatch(metricsSource, /createConstructionEconomyHarnessScenario|INITIAL_RECOVERY_SITES/);
  assert.doesNotMatch(traceSource, /confirmPalisadeProclamation\(state, STAGE3_PALISADE_PATH\)/);
});

test("Given a palisade proclamation action When adapters resolve it Then they share canonical validation", () => {
  const state = createStage3EconomyHarnessScenario({ seed: 3 });
  const action = decideNextAction(state);
  const uiResolved = autoplayActionToGameAction(action, state);
  const engineResolved = engineAutoplayActionToGameAction(action, state);
  const emptySettlement = {
    ...state,
    buildings: [],
    houses: [],
  };
  const waterBlocked = {
    ...state,
    tiles: state.tiles.map((tile) => ({ ...tile, terrain: "water" as const })),
  };

  assert.deepEqual(action, { kind: "proclaim_era" });
  assert.deepEqual(uiResolved, engineResolved);
  assert.equal(uiResolved?.type, "confirm_palisade_proclamation");
  assert.equal(uiResolved === null ? null : gameReducer(state, uiResolved).era, "palisade");
  assert.equal(engineAutoplayActionToGameAction(action, emptySettlement), null);
  assert.equal(engineAutoplayActionToGameAction(action, waterBlocked), null);
});

test("Given default autoplay When run for twelve thousand ticks Then population growth is sustained by viable advisor actions", () => {
  const trace = traceDefaultAutoplay(12_000);
  const peak = maxPopulation(trace.population);
  const finalPopulation = trace.finalState.population;
  const actionKinds = new Set(trace.actions.map(({ action }) => action.kind));
  const buildingKinds = new Set(trace.actions.flatMap(({ action }) => action.kind === "place_building" ? [action.building] : []));
  const finalBuildingKinds = new Set(trace.finalState.buildings.map(({ kind }) => kind));
  const gaps = trace.actions.slice(1).map(({ tick }, index) => tick - (trace.actions[index]?.tick ?? tick));

  assert.equal(peak >= 100, true, `timeline=${JSON.stringify(trace.population)}`);
  assert.equal(finalPopulation >= 80, true, `timeline=${JSON.stringify(trace.population)}`);
  assert.equal(finalPopulation >= peak * 0.75, true, `timeline=${JSON.stringify(trace.population)}`);
  assert.equal(buildingKinds.has("wheat_farm"), true);
  assert.equal(buildingKinds.has("mill"), true);
  assert.equal(buildingKinds.has("house"), true);
  assert.equal(finalBuildingKinds.has("granary"), true);
  assert.equal(actionKinds.size >= 1, true);
  assert.equal(gaps.every((gap) => gap >= AUTOPLAY_TICK_CADENCE), true, `gaps=${JSON.stringify(gaps)}`);
  assert.equal(trace.finalState.houses.some((house) => house.breadStock > 0), true);
});
