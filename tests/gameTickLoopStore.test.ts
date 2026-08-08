import assert from "node:assert/strict";
import test from "node:test";

import { createEconomyHarnessScenario } from "../scripts/economyHarnessScenario";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import type { GameSpeed } from "../src/engine/engine.types";
import {
  createFixedTickLoop,
  type AnimationFrameScheduler,
} from "../src/state/fixedTickLoop";
import { gameReducer } from "../src/state/gameStore";

class ManualAnimationFrameScheduler implements AnimationFrameScheduler {
  private nextId = 1;
  private readonly callbacks = new Map<number, (timestampMs: number) => void>();

  request(callback: (timestampMs: number) => void): number {
    const id = this.nextId;
    this.nextId += 1;
    this.callbacks.set(id, callback);
    return id;
  }

  cancel(id: number): void {
    this.callbacks.delete(id);
  }

  runNext(timestampMs: number): void {
    const next = this.callbacks.entries().next().value;
    if (next === undefined) throw new Error("fixed tick loop did not request a frame");
    const [id, callback] = next;
    this.callbacks.delete(id);
    callback(timestampMs);
  }
}

test("Given a delayed animation frame When the fixed loop catches up Then it advances at most five ticks", () => {
  const scheduler = new ManualAnimationFrameScheduler();
  let state = createEconomyHarnessScenario({ seed: 3 });
  const loop = createFixedTickLoop({
    scheduler,
    getSpeed: () => 5,
    getState: () => state,
    commit: (previousState, nextState) => {
      state = gameReducer(state, { type: "commit_simulation_state", previousState, nextState });
    },
  });

  loop.start();
  scheduler.runNext(0);
  scheduler.runNext(5_000);

  assert.equal(state.tick, 5);
  assert.equal(state.wallTick, 5);
  assert.equal(loop.interpolationAlpha(), 0);
  loop.stop();
});

test("Given a paused fresh store When animation frames run Then no simulation state is committed", () => {
  const scheduler = new ManualAnimationFrameScheduler();
  let speed: GameSpeed = 0;
  let state = createEconomyHarnessScenario({ seed: 3 });
  let commits = 0;
  const loop = createFixedTickLoop({
    scheduler,
    getSpeed: () => speed,
    getState: () => state,
    commit: (previousState, nextState) => {
      commits += 1;
      state = gameReducer(state, { type: "commit_simulation_state", previousState, nextState });
    },
  });

  loop.start();
  scheduler.runNext(0);
  scheduler.runNext(1_000);
  speed = 1;
  scheduler.runNext(1_050);

  assert.equal(commits, 1);
  assert.equal(state.tick, 1);
  loop.stop();
});

test("Given a paused fixed loop When queried for interpolation Then alpha resolves to current", () => {
  const scheduler = new ManualAnimationFrameScheduler();
  const state = createEconomyHarnessScenario({ seed: 3 });
  const loop = createFixedTickLoop({
    scheduler,
    getSpeed: () => 0,
    getState: () => state,
    commit: () => {
      throw new Error("paused loop should not commit");
    },
  });

  loop.start();
  scheduler.runNext(0);
  scheduler.runNext(1_000);

  assert.equal(loop.interpolationAlpha(), 1);
  loop.stop();
});

test("Given a fresh active store When the real frame loop runs 600 ticks Then time walkers and production advance", () => {
  const scheduler = new ManualAnimationFrameScheduler();
  let state = createEconomyHarnessScenario({ seed: 3 });
  const observedPositions = new Map<string, string>();
  let walkerMoved = false;
  let resourceProduced = false;
  const loop = createFixedTickLoop({
    scheduler,
    getSpeed: () => 1,
    getState: () => state,
    commit: (previousState, nextState) => {
      for (const nextBuilding of nextState.buildings) {
        const output = BUILDING_CONFIG_BY_KIND[nextBuilding.kind].production?.output;
        if (output === undefined) continue;
        const previousBuilding = state.buildings.find(({ id }) => id === nextBuilding.id);
        if (
          previousBuilding !== undefined &&
          (nextBuilding.inventory[output] ?? 0) > (previousBuilding.inventory[output] ?? 0)
        ) {
          resourceProduced = true;
        }
      }
      state = gameReducer(state, { type: "commit_simulation_state", previousState, nextState });
      for (const walker of state.walkers) {
        const position = `${walker.position.tx},${walker.position.ty}`;
        const previous = observedPositions.get(walker.id);
        if (previous !== undefined && previous !== position) walkerMoved = true;
        observedPositions.set(walker.id, position);
      }
    },
  });

  loop.start();
  scheduler.runNext(0);
  for (let frame = 1; frame <= 600; frame += 1) scheduler.runNext(frame * 50);

  assert.equal(state.tick, 600);
  assert.equal(state.wallTick, 600);
  assert.equal(walkerMoved, true);
  assert.equal(resourceProduced, true);
  loop.stop();
});

test("Given a queued domain change When a stale simulation snapshot commits Then the domain change survives", () => {
  const previousState = createEconomyHarnessScenario({ seed: 3 });
  const nextState = { ...previousState, tick: 1, wallTick: 1 };
  const roadedState = gameReducer(previousState, {
    type: "place_road_line",
    start: { tx: 0, ty: 0 },
    destination: { tx: 0, ty: 1 },
  });

  const committed = gameReducer(roadedState, {
    type: "commit_simulation_state",
    previousState,
    nextState,
  });

  assert.notEqual(roadedState, previousState);
  assert.equal(roadedState.roadRevision, previousState.roadRevision + 1);
  assert.equal(committed, roadedState);
  assert.equal(committed.roadRevision, roadedState.roadRevision);
});
