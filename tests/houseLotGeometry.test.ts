import assert from "node:assert/strict";
import test from "node:test";
import type { Building } from "../src/content/buildingConfig";
import { buildingFootprint, houseLotArea } from "../src/geometry/buildingFootprint";
import { buildingFootprintDistance } from "../src/geometry/buildingDistance";
import { palisadeProtectionForBuilding } from "../src/geometry/palisadeProtection";
import { buildingRoadAccessTiles } from "../src/engine/routing";
import { palisadeFootprintsForState } from "../src/ui/eraConsoleModel";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

const home: Building = { id: "lot", kind: "house", tx: 2, ty: 2, workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };

test("instance footprints preserve defaults and describe both paired orientations", () => {
  assert.deepEqual(buildingFootprint(home), { width: 1, height: 1 });
  assert.deepEqual(buildingFootprint({ ...home, houseLot: "horizontal" }), { width: 2, height: 1 });
  assert.deepEqual(buildingFootprint({ ...home, houseLot: "vertical" }), { width: 1, height: 2 });
  assert.equal(houseLotArea(home), 1);
  assert.equal(houseLotArea({ ...home, houseLot: "vertical" }), 2);
  assert.deepEqual(buildingFootprint({ ...home, kind: "well", houseLot: "horizontal" }), { width: 1, height: 1 });
});

for (const houseLot of ["horizontal", "vertical"] as const) {
  test(`${houseLot} lot services and roads reach the second half`, () => {
    const lot = { ...home, houseLot };
    const far = houseLot === "horizontal" ? { tx: 4, ty: 2 } : { tx: 2, ty: 4 };
    assert.equal(buildingFootprintDistance(lot, { ...home, ...far, id: "well", kind: "well" }), 1);
    const state = { ...DEFAULT_GAME_STATE, width: 6, height: 6, buildings: [lot],
      tiles: Array.from({ length: 36 }, (_, index) => ({ tx: index % 6, ty: Math.floor(index / 6), terrain: "grass" as const, buildingId: null, hasRoad: index % 6 === far.tx && Math.floor(index / 6) === far.ty })) };
    assert.deepEqual(buildingRoadAccessTiles(state, lot), [far]);
    assert.deepEqual(palisadeFootprintsForState(state), [{ id: "lot", tx: 2, ty: 2, ...buildingFootprint(lot) }]);
  });
}

test("a wall enclosing only the first half does not protect a merged lot", () => {
  const polygon = [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 3, y: 4 }, { x: 1, y: 4 }, { x: 1, y: 1 }];
  const wall = { polygon, segments: [{ completed: true }] };
  assert.equal(palisadeProtectionForBuilding(home, wall), "inside");
  assert.equal(palisadeProtectionForBuilding({ ...home, houseLot: "horizontal" }, wall), "outside");
});
