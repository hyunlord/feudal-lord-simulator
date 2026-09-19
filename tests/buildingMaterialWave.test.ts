import assert from "node:assert/strict";
import test from "node:test";

import { SEMANTIC_PALETTE } from "../src/content/palette";
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

test("house body profile retains the historical timber language across eras", () => {
  // Given / When
  const hamletLevelTwo = houseBodyProfile({ era: "hamlet", level: 2 });
  const palisadeLevelTwo = houseBodyProfile({ era: "palisade", level: 2 });
  const palisadeLevelThree = houseBodyProfile({ era: "palisade", level: 3 });

  // Then
  assert.deepEqual(palisadeLevelTwo, hamletLevelTwo);
  assert.equal(palisadeLevelTwo.roofShape, "gable");
  assert.equal(palisadeLevelThree.roofShape, "gable");
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

test("stone town material wave changes houses from palisade to stone over exactly four seconds", () => {
  // Given
  const buildings = [
    house("house-center", 5, 5),
    house("house-edge", 9, 5),
  ];

  // When
  const wave = createHouseMaterialWave({
    buildings,
    center: { x: 5, y: 5 },
    startedAtMs: 10_000,
    targetMaterialEra: "stone",
  });

  // Then
  assert.equal(houseMaterialEraForBuilding({ building: existingBuilding(buildings, 0), wave, nowMs: 10_000 }), "palisade");
  assert.equal(houseMaterialEraForBuilding({ building: existingBuilding(buildings, 0), wave, nowMs: 11_999 }), "palisade");
  assert.equal(houseMaterialEraForBuilding({ building: existingBuilding(buildings, 0), wave, nowMs: 12_000 }), "stone");
  assert.equal(houseMaterialEraForBuilding({ building: existingBuilding(buildings, 1), wave, nowMs: 13_999 }), "palisade");
  assert.equal(houseMaterialEraForBuilding({ building: existingBuilding(buildings, 1), wave, nowMs: 14_000 }), "stone");
});

test("loaded palisade states render final material without replaying a wave", () => {
  // Given
  const building = house("house-a", 1, 1);
  const loaded: HouseMaterialWave | null = null;

  // When / Then
  assert.equal(houseMaterialEraForBuilding({ building, wave: loaded, nowMs: 0, era: "palisade" }), "palisade");
  assert.equal(houseMaterialEraForBuilding({ building, wave: loaded, nowMs: 0, era: "hamlet" }), "hamlet");
});

test("loaded stone town states preserve timber housing while retaining the era wave contract", () => {
  // Given
  const building = house("house-a", 1, 1);
  const loaded: HouseMaterialWave | null = null;

  // When / Then
  assert.equal(houseMaterialEraForBuilding({ building, wave: loaded, nowMs: 0, era: "stone" }), "stone");
  assert.deepEqual(houseBodyProfile({ era: "stone", level: 4 }), {
    width: 58,
    height: 66,
    roof: 20,
    fill: SEMANTIC_PALETTE.parchment,
    roofColor: SEMANTIC_PALETTE.earthDark,
    roofShape: "gable",
  });
});
