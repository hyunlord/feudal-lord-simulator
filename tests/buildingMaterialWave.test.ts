import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/economy/economy.types";
import { houseBodyProfile } from "../src/render/buildingVisualState";
import {
  createHouseMaterialWave,
  houseMaterialEraForBuilding,
  type HouseMaterialWave,
} from "../src/render/buildingMaterialWave";

function house(id: string, tx: number, ty: number): Building {
  return {
    id,
    kind: "house",
    tx,
    ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function existingBuilding(buildings: readonly Building[], index: number): Building {
  const building = buildings[index];
  if (building === undefined) {
    throw new Error(`Missing test building at index ${index}`);
  }
  return building;
}

test("house body profile is a pure era and level material function", () => {
  // Given / When
  const hamletLevelTwo = houseBodyProfile({ era: "hamlet", level: 2 });
  const palisadeLevelTwo = houseBodyProfile({ era: "palisade", level: 2 });
  const palisadeLevelThree = houseBodyProfile({ era: "palisade", level: 3 });

  // Then
  assert.notDeepEqual(palisadeLevelTwo, hamletLevelTwo);
  assert.equal(palisadeLevelTwo.roofShape, "gable");
  assert.equal(palisadeLevelThree.roofShape, "tower");
  assert.deepEqual(houseBodyProfile({ era: "palisade", level: 2 }), palisadeLevelTwo);
});

test("house material wave orders houses by centre distance and id tie break across four seconds", () => {
  // Given
  const buildings = [
    house("house-z", 6, 5),
    house("house-b", 5, 5),
    house("house-a", 5, 5),
    house("house-far", 11, 5),
  ];

  // When
  const wave = createHouseMaterialWave({
    buildings,
    center: { x: 5, y: 5 },
    startedAtMs: 1_000,
  });

  // Then
  assert.deepEqual(wave.orderedHouseIds, ["house-a", "house-b", "house-z", "house-far"]);
  assert.equal(houseMaterialEraForBuilding({ building: existingBuilding(buildings, 0), wave, nowMs: 1_999 }), "hamlet");
  assert.equal(houseMaterialEraForBuilding({ building: existingBuilding(buildings, 2), wave, nowMs: 2_000 }), "palisade");
  assert.equal(houseMaterialEraForBuilding({ building: existingBuilding(buildings, 1), wave, nowMs: 3_000 }), "palisade");
  assert.equal(houseMaterialEraForBuilding({ building: existingBuilding(buildings, 3), wave, nowMs: 4_999 }), "hamlet");
  assert.equal(houseMaterialEraForBuilding({ building: existingBuilding(buildings, 3), wave, nowMs: 5_000 }), "palisade");
});

test("loaded palisade states render final material without replaying a wave", () => {
  // Given
  const building = house("house-a", 1, 1);
  const loaded: HouseMaterialWave | null = null;

  // When / Then
  assert.equal(houseMaterialEraForBuilding({ building, wave: loaded, nowMs: 0, era: "palisade" }), "palisade");
  assert.equal(houseMaterialEraForBuilding({ building, wave: loaded, nowMs: 0, era: "hamlet" }), "hamlet");
});
