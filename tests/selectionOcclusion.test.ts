import assert from "node:assert/strict";
import test from "node:test";
import type { Building } from "../src/content/buildingConfig";
import { hoverOcclusionActive, outlinesOccludingBuilding } from "../src/render/selectionOcclusion";
const building: Building = { id: "front", kind: "house", tx: 4, ty: 4, houseLot: "horizontal", workers: 0, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 };
const input = { building, houseLevel: 4, hoveredTile: { tx: 3, ty: 3 }, selectionMode: true };
test("front compound reveals a rear tile only in selection mode", () => {
  assert.equal(outlinesOccludingBuilding(input), true);
  assert.equal(outlinesOccludingBuilding({ ...input, selectionMode: false }), false);
});
test("own footprint including the second merged tile never disappears", () => {
  for (const hoveredTile of [{ tx: 4, ty: 4 }, { tx: 5, ty: 4 }]) {
    assert.equal(outlinesOccludingBuilding({ ...input, hoveredTile }), false);
  }
});
test("rear and distant buildings remain solid", () => {
  for (const hoveredTile of [{ tx: 6, ty: 6 }, { tx: 0, ty: 7 }]) {
    assert.equal(outlinesOccludingBuilding({ ...input, hoveredTile }), false);
  }
});
test("a bare hover with no tool armed and nothing selected never outlines the front building", () => {
  const idle = hoverOcclusionActive({ toolArmed: false, selectedBuildingId: null });
  assert.equal(idle, false);
  assert.equal(outlinesOccludingBuilding({ ...input, selectionMode: idle }), false);
});
test("an armed placement tool or a selected building keeps the hover reveal", () => {
  for (const active of [
    hoverOcclusionActive({ toolArmed: true, selectedBuildingId: null }),
    hoverOcclusionActive({ toolArmed: false, selectedBuildingId: "front" }),
  ]) {
    assert.equal(active, true);
    assert.equal(outlinesOccludingBuilding({ ...input, selectionMode: active }), true);
  }
});
