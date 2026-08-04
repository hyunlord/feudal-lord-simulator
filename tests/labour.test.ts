import assert from "node:assert/strict";
import test from "node:test";

import type { Building, BuildingKind } from "../src/content/buildingConfig";
import {
  allocateBuildingLabour,
  allocateLabour,
  availableWorkers,
} from "../src/population/labour";

function building(id: string, kind: BuildingKind): Building {
  return {
    id,
    kind,
    tx: 0,
    ty: 0,
    workers: 99,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

test("available workers are half the population rounded down", () => {
  assert.equal(availableWorkers(0), 0);
  assert.equal(availableWorkers(9), 4);
  assert.equal(availableWorkers(10), 5);
});

test("labour fills each request in ascending building-id order", () => {
  const allocation = allocateLabour(
    [
      { buildingId: "work-c", workersRequired: 2 },
      { buildingId: "work-a", workersRequired: 3 },
      { buildingId: "work-b", workersRequired: 4 },
    ],
    5,
  );

  assert.deepEqual(allocation, [
    { buildingId: "work-a", workersAssigned: 3 },
    { buildingId: "work-b", workersAssigned: 2 },
    { buildingId: "work-c", workersAssigned: 0 },
  ]);
});

test("building labour applies exact config requirements and reports idle workers", () => {
  const result = allocateBuildingLabour(
    [
      building("c-sawmill", "sawmill"),
      building("a-house", "house"),
      building("b-logging", "logging_camp"),
    ],
    20,
  );

  assert.deepEqual(
    result.buildings.map(({ id, workers }) => ({ id, workers })),
    [
      { id: "c-sawmill", workers: 2 },
      { id: "a-house", workers: 0 },
      { id: "b-logging", workers: 3 },
    ],
  );
  assert.equal(result.idleWorkers, 5);
});

test("partial staffing is visible but never skips ahead to another building", () => {
  const result = allocateBuildingLabour(
    [
      building("b-sawmill", "sawmill"),
      building("a-farm", "wheat_farm"),
      building("c-logging", "logging_camp"),
    ],
    10,
  );

  assert.deepEqual(
    result.buildings.map(({ id, workers }) => ({ id, workers })),
    [
      { id: "b-sawmill", workers: 1 },
      { id: "a-farm", workers: 4 },
      { id: "c-logging", workers: 0 },
    ],
  );
  assert.equal(result.idleWorkers, 0);
});
