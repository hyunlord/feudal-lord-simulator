import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import { BALANCE } from "../src/content/balanceConfig";
import type { GameState, PalisadeState } from "../src/engine/engine.types";
import { advanceSimulationSubstep } from "../src/engine/tick";
import { updateHousing } from "../src/population/housing";
import type { House } from "../src/population/population.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import type { PalisadePath } from "../src/world/palisadeGeometry";

const WALL_PATH: PalisadePath = [
  { x: 5, y: 5 },
  { x: 15, y: 5 },
  { x: 15, y: 15 },
  { x: 5, y: 15 },
  { x: 5, y: 5 },
];

function building(id: string, kind: Building["kind"], tx: number, ty: number): Building {
  return {
    id,
    kind,
    tx,
    ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function house(buildingId: string, input: Partial<House> = {}): House {
  return {
    buildingId,
    level: 2,
    residents: 7,
    hasWater: true,
    breadStock: 3,
    lastServicedTick: 100,
    unmetRequirementTicks: 0,
    ...input,
  };
}

function palisade(completed: boolean): PalisadeState {
  return {
    id: "palisade-a",
    polygon: WALL_PATH,
    gate: { x: 10, y: 5 },
    segments: [
      {
        id: "segment-a",
        order: 0,
        edgePath: WALL_PATH,
        tileCount: 40,
        completed,
        constructionSiteId: completed ? null : "palisade-a-segment-000",
      },
    ],
  };
}

function settlement(extraBuildings: readonly Building[]): readonly Building[] {
  return [
    building("well", "well", 9, 9),
    building("outside-well", "well", 18, 8),
    building("granary", "granary", 9, 9),
    ...extraBuildings,
  ];
}

function byId(houses: readonly House[], buildingId: string): House {
  const found = houses.find((candidate) => candidate.buildingId === buildingId);
  assert.ok(found !== undefined);
  return found;
}

function simulationState(input: {
  readonly houses: readonly House[];
  readonly buildings: readonly Building[];
  readonly palisade: PalisadeState | null;
}): GameState {
  return {
    ...DEFAULT_GAME_STATE,
    tick: 100,
    buildings: [...input.buildings],
    houses: [...input.houses],
    palisade: input.palisade,
    population: input.houses.reduce((total, candidate) => total + candidate.residents, 0),
    walkers: [],
    constructionSites: [],
  };
}

test("Given no wall or an incomplete wall When housing updates Then palisade protection does not alter levels", () => {
  // Given
  const houses = [house("inside"), house("outside")];
  const buildings = settlement([
    building("inside", "house", 8, 8),
    building("outside", "house", 18, 8),
  ]);

  // When
  const beforeWall = updateHousing(houses, buildings, 101, null);
  const duringWall = updateHousing(houses, buildings, 101, palisade(false));

  // Then
  assert.deepEqual(beforeWall.houses.map(({ buildingId, level }) => ({ buildingId, level })), [
    { buildingId: "inside", level: 3 },
    { buildingId: "outside", level: 3 },
  ]);
  assert.deepEqual(duringWall.houses, beforeWall.houses);
});

test("Given a completed wall When houses update Then inside and on-edge homes may reach level three but outside homes below three may not", () => {
  // Given
  const houses = [
    house("inside", { level: 2 }),
    house("on-edge", { level: 2 }),
    house("outside", { level: 2 }),
  ];
  const buildings = settlement([
    building("inside", "house", 8, 8),
    building("on-edge", "house", 5, 8),
    building("outside", "house", 18, 8),
  ]);

  // When
  const result = updateHousing(houses, buildings, 101, palisade(true));

  // Then
  assert.equal(byId(result.houses, "inside").level, 3);
  assert.equal(byId(result.houses, "on-edge").level, 3);
  assert.equal(byId(result.houses, "outside").level, 2);
  assert.equal(result.population, 21);
});

test("Given a completed wall When outside homes are already level three or service-starved Then wall protection never deletes or overrides normal downgrade rules", () => {
  // Given
  const outsideLevelThree = house("outside-l3", { level: 3 });
  const starving = house("starving", {
    level: 3,
    breadStock: 0,
    lastServicedTick: 0,
    unmetRequirementTicks: BALANCE.DEVOLUTION_GRACE - 1,
  });
  const buildings = settlement([
    building("outside-l3", "house", 18, 8),
    building("starving", "house", 8, 8),
  ]);

  // When
  const result = updateHousing([outsideLevelThree, starving], buildings, 501, palisade(true));

  // Then
  assert.equal(result.houses.length, 2);
  assert.equal(byId(result.houses, "outside-l3").level, 3);
  assert.equal(byId(result.houses, "starving").level, 2);
});

test("Given an outside home below level three When the completed wall caps its upgrade Then only level-related fields change", () => {
  // Given
  const outside = house("outside", {
    level: 2,
    residents: 9,
    hasWater: true,
    breadStock: 4,
    lastServicedTick: 100,
    unmetRequirementTicks: 0,
  });
  const buildings = settlement([building("outside", "house", 18, 8)]);

  // When
  const result = updateHousing([outside], buildings, 101, palisade(true));

  // Then
  assert.deepEqual(byId(result.houses, "outside"), outside);
});

test("Given a completed wall in the simulation tick When an outside serviced home updates Then the level-three cap is applied", () => {
  // Given
  const outside = house("outside", { level: 2 });
  const input = simulationState({
    houses: [outside],
    buildings: [...settlement([building("outside", "house", 18, 8)])],
    palisade: palisade(true),
  });

  // When
  const result = advanceSimulationSubstep(input);

  // Then
  assert.equal(byId(result.houses, "outside").level, 2);
});
