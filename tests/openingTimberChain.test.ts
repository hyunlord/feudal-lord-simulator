import assert from "node:assert/strict";
import test from "node:test";

import { placeBuilding, placeRoadLine } from "../src/engine/gameActions";
import { advanceTick } from "../src/engine/tick";
import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import type { Tile } from "../src/world/world.types";

function openingScenario(): GameState {
  const width = 12;
  const height = 8;
  const starter = DEFAULT_GAME_STATE.buildings[0];
  if (starter === undefined) throw new Error("default opening house is missing");
  const home = { ...starter, tx: 9, ty: 1 };
  const tiles: Tile[] = Array.from({ length: width * height }, (_unused, index) => {
    const tx = index % width;
    const ty = Math.floor(index / width);
    const forest = tx === 1 && ty >= 1 && ty <= 3;
    return {
      tx,
      ty,
      terrain: forest ? "forest" : "grass",
      buildingId: tx === home.tx && ty === home.ty ? home.id : null,
      hasRoad: false,
    };
  });
  return {
    ...DEFAULT_GAME_STATE,
    width,
    height,
    tiles,
    buildings: [home],
    walkers: [],
    roadRevision: 0,
    pathCache: {},
  };
}

function totalTimber(state: GameState): number {
  return state.buildings.reduce(
    (total, building) => total + (building.inventory.timber ?? 0),
    state.treasuryTimber,
  ) + state.walkers.reduce(
    (total, walker) =>
      total + (walker.cargo?.resource === "timber" ? walker.cargo.amount : 0),
    0,
  );
}

function spendableTimber(state: GameState): number {
  return state.buildings.reduce(
    (total, building) => total + (building.inventory.timber ?? 0),
    state.treasuryTimber,
  );
}

test("the authored opening funds the food chain before its workers collapse", () => {
  let state = openingScenario();
  state = placeRoadLine(state, { tx: 2, ty: 2 }, { tx: 10, ty: 2 });
  state = placeBuilding(state, "logging_camp", { tx: 2, ty: 1 });
  state = placeBuilding(state, "sawmill", { tx: 4, ty: 1 });
  state = placeBuilding(state, "storehouse", { tx: 6, ty: 0 });
  state = placeBuilding(state, "well", { tx: 10, ty: 0 });

  assert.deepEqual(
    state.buildings.map(({ kind }) => kind),
    ["house", "logging_camp", "sawmill", "storehouse", "well"],
  );

  const foodChainCost = 90;
  for (let tick = 0; tick < 4_000 && (tick === 0 || spendableTimber(state) < foodChainCost); tick += 1) {
    state = advanceTick(state);
  }

  const loggingCamp = state.buildings.find(({ kind }) => kind === "logging_camp");
  const sawmill = state.buildings.find(({ kind }) => kind === "sawmill");
  assert.ok(
    totalTimber(state) >= foodChainCost,
    `opening stalled at ${totalTimber(state)} timber with ${state.population} residents`,
  );
  assert.equal(loggingCamp?.workers, 3);
  assert.equal(sawmill?.workers, 2);

  state = placeBuilding(state, "wheat_farm", { tx: 2, ty: 3 });
  state = placeBuilding(state, "mill", { tx: 4, ty: 3 });
  state = placeBuilding(state, "granary", { tx: 5, ty: 3 });
  assert.deepEqual(
    state.buildings.slice(-3).map(({ kind }) => kind),
    ["wheat_farm", "mill", "granary"],
  );
});

test("the tuned default-map grant bootstraps both economy chains before starvation", () => {
  let state = DEFAULT_GAME_STATE;
  state = placeRoadLine(state, { tx: 1, ty: 2 }, { tx: 13, ty: 2 });
  state = placeRoadLine(state, { tx: 0, ty: 1 }, { tx: 0, ty: 2 });
  state = placeBuilding(state, "well", { tx: 6, ty: 0 });
  state = placeBuilding(state, "logging_camp", { tx: 2, ty: 1 });
  state = placeBuilding(state, "sawmill", { tx: 2, ty: 3 });
  state = placeBuilding(state, "storehouse", { tx: 9, ty: 0 });
  state = placeBuilding(state, "wheat_farm", { tx: 9, ty: 3 });
  state = placeBuilding(state, "mill", { tx: 8, ty: 3 });
  state = placeBuilding(state, "granary", { tx: 6, ty: 3 });
  state = placeBuilding(state, "wheat_farm", { tx: 4, ty: 3 });
  state = placeBuilding(state, "house", { tx: 3, ty: 1 });
  state = placeBuilding(state, "house", { tx: 4, ty: 1 });
  state = placeBuilding(state, "house", { tx: 5, ty: 1 });
  state = placeBuilding(state, "house", { tx: 6, ty: 1 });
  state = placeBuilding(state, "house", { tx: 7, ty: 1 });
  state = placeBuilding(state, "house", { tx: 8, ty: 1 });

  assert.deepEqual(
    state.buildings.map(({ kind }) => kind),
    [
      "house",
      "well",
      "logging_camp",
      "sawmill",
      "storehouse",
      "wheat_farm",
      "mill",
      "granary",
      "wheat_farm",
      "house",
      "house",
      "house",
      "house",
      "house",
      "house",
    ],
  );
  assert.equal(spendableTimber(state), 0);

  let latestServiceTick = 0;
  for (let tick = 0; tick < 3_500; tick += 1) {
    state = advanceTick(state);
    latestServiceTick = Math.max(
      latestServiceTick,
      ...state.houses.map(({ lastServicedTick }) => lastServicedTick),
    );
  }

  assert.ok(
    latestServiceTick > 0,
    `food chain never serviced a house: ${JSON.stringify({
      tick: state.tick,
      population: state.population,
      buildings: state.buildings.map(({ kind, workers, inventory, productionProgress }) => ({
        kind,
        workers,
        inventory,
        productionProgress,
      })),
      houses: state.houses,
      walkers: state.walkers,
    })}`,
  );
  assert.ok(
    state.population > 0,
    `default-map settlement collapsed on tick ${state.tick}: ${JSON.stringify({
      latestServiceTick,
      buildings: state.buildings.map(({ kind, workers, inventory, productionProgress }) => ({
        kind,
        workers,
        inventory,
        productionProgress,
      })),
      houses: state.houses,
      walkers: state.walkers,
    })}`,
  );
  assert.ok(state.houses.some(({ level }) => level >= 2), "no house evolved to level 2");
});
