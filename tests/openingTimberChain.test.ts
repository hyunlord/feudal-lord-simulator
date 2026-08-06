import assert from "node:assert/strict";
import test from "node:test";

import { placeBuilding, placeRoadLine } from "../src/engine/gameActions";
import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { placementSpendableResource } from "../src/world/placement";
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

test("the authored opening can commit timber and food construction before workers collapse", () => {
  let state = openingScenario();
  state = placeRoadLine(state, { tx: 2, ty: 2 }, { tx: 10, ty: 2 });
  state = placeBuilding(state, "logging_camp", { tx: 2, ty: 1 });
  state = placeBuilding(state, "sawmill", { tx: 4, ty: 1 });
  state = placeBuilding(state, "storehouse", { tx: 6, ty: 0 });
  state = placeBuilding(state, "well", { tx: 10, ty: 0 });

  assert.deepEqual(
    state.buildings.map(({ kind }) => kind),
    ["house"],
  );
  assert.deepEqual(
    state.constructionSites.map(({ kind }) => kind),
    ["logging_camp", "sawmill", "storehouse", "well"],
  );

  const foodChainCost = 90;
  assert.equal(placementSpendableResource(state, "timber"), 110);
  assert.ok(placementSpendableResource(state, "timber") >= foodChainCost);

  state = placeBuilding(state, "wheat_farm", { tx: 2, ty: 3 });
  state = placeBuilding(state, "mill", { tx: 4, ty: 3 });
  state = placeBuilding(state, "granary", { tx: 5, ty: 3 });
  assert.deepEqual(
    state.constructionSites.map(({ kind }) => kind),
    ["logging_camp", "sawmill", "storehouse", "well", "wheat_farm", "mill", "granary"],
  );
  assert.equal(placementSpendableResource(state, "timber"), 20);
});

test("the tuned default-map grant commits both economy chains before starvation", () => {
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
    ["house"],
  );
  assert.deepEqual(
    state.constructionSites.map(({ kind }) => kind),
    [
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
  assert.equal(state.treasuryTimber, 205);
  assert.equal(placementSpendableResource(state, "timber"), 0);
});
