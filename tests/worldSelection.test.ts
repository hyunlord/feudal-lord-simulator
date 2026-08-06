import assert from "node:assert/strict";
import test from "node:test";

import type { GameState } from "../src/engine/engine.types";
import { selectWorldAtTile } from "../src/render/worldSelection";

const STATE = {
  width: 2,
  height: 1,
  tiles: [
    { tx: 0, ty: 0, terrain: "grass", buildingId: "house", hasRoad: false },
    { tx: 1, ty: 0, terrain: "grass", buildingId: null, hasRoad: true },
  ],
  buildings: [{
    id: "house", kind: "house", tx: 0, ty: 0, workers: 0,
    inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0,
  }],
  walkers: [{
    id: "walker", kind: "distributor", homeBuildingId: "granary",
    position: { tx: 0, ty: 0 }, path: [{ tx: 0, ty: 0 }], pathIndex: 0,
    previousTile: null, cargo: null, spawnedTick: 0, phase: "roaming",
    junctionVisits: 0, tilesTravelled: 0, priorTile: null,
  }],
} as const satisfies Pick<GameState, "width" | "height" | "tiles" | "buildings" | "walkers">;

test("walker hit wins over a building occupying the same tile", () => {
  assert.deepEqual(selectWorldAtTile(STATE, { tx: 0, ty: 0 }), {
    kind: "walker",
    walkerId: "walker",
  });
});

test("building and empty tile clicks select or dismiss deterministically", () => {
  assert.deepEqual(
    selectWorldAtTile({ ...STATE, walkers: [] }, { tx: 0, ty: 0 }),
    { kind: "building", buildingId: "house" },
  );
  assert.equal(selectWorldAtTile(STATE, { tx: 1, ty: 0 }), null);
});
