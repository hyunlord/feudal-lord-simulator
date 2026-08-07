import assert from "node:assert/strict";
import test from "node:test";

import type { Building, BuildingKind } from "../src/content/buildingConfig";
import {
  allocateBuildingAndConstructionLabour,
  allocateBuildingLabour,
  allocateLabour,
  availableWorkers,
  builderWalkersForSites,
} from "../src/population/labour";
import type {
  BuildingConstructionSite,
} from "../src/economy/construction";

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

function site(id: string, patch: Partial<BuildingConstructionSite> = {}): BuildingConstructionSite {
  return {
    id,
    kind: "well",
    tx: 0,
    ty: 0,
    required: {},
    delivered: {},
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: 200,
    assignedBuilders: 99,
    stall: "no_builders",
    startedTick: 0,
    ...patch,
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

test("construction labour starts only after production and follows ascending site ids", () => {
  // Given
  const sawmill = building("a-sawmill", "sawmill");
  const farm = building("b-farm", "wheat_farm");
  const laterSite = site("construction-site-000020");
  const firstSite = site("construction-site-000010");

  // When
  const result = allocateBuildingAndConstructionLabour(
    [sawmill, farm],
    [laterSite, firstSite],
    18,
  );

  // Then
  assert.deepEqual(
    result.buildings.map(({ id, workers }) => ({ id, workers })),
    [
      { id: "a-sawmill", workers: 2 },
      { id: "b-farm", workers: 4 },
    ],
  );
  assert.deepEqual(
    result.constructionSites.map(({ id, assignedBuilders }) => ({ id, assignedBuilders })),
    [
      { id: "construction-site-000020", assignedBuilders: 0 },
      { id: "construction-site-000010", assignedBuilders: 3 },
    ],
  );
  assert.equal(result.idleWorkers, 0);
});

test("construction labour caps each site at three and leaves excess workers idle", () => {
  // Given
  const firstSite = site("construction-site-000001");
  const secondSite = site("construction-site-000002");

  // When
  const result = allocateBuildingAndConstructionLabour(
    [],
    [secondSite, firstSite],
    20,
  );

  // Then
  assert.deepEqual(
    result.constructionSites.map(({ id, assignedBuilders }) => ({ id, assignedBuilders })),
    [
      { id: "construction-site-000002", assignedBuilders: 3 },
      { id: "construction-site-000001", assignedBuilders: 3 },
    ],
  );
  assert.equal(result.idleWorkers, 4);
});

test("production exhaustion leaves construction unassigned without changing production workers", () => {
  // Given
  const farm = building("a-farm", "wheat_farm");
  const sawmill = building("b-sawmill", "sawmill");
  const target = site("construction-site-000001", { stall: "none" });

  // When
  const result = allocateBuildingAndConstructionLabour([farm, sawmill], [target], 12);

  // Then
  assert.deepEqual(
    result.buildings.map(({ id, workers }) => ({ id, workers })),
    [
      { id: "a-farm", workers: 4 },
      { id: "b-sawmill", workers: 2 },
    ],
  );
  assert.equal(result.constructionSites[0]?.assignedBuilders, 0);
  assert.equal(result.constructionSites[0]?.stall, "no_builders");
  assert.equal(result.idleWorkers, 0);
});

test("builder walkers are one per assigned slot at deterministic site-relative anchors", () => {
  // Given
  const target = site("construction-site-000007", {
    tx: 4,
    ty: 6,
    assignedBuilders: 3,
  });

  // When
  const first = builderWalkersForSites([target]);
  const second = builderWalkersForSites([target]);

  // Then
  assert.deepEqual(first, second);
  assert.deepEqual(
    first.map(({ id, kind, siteId, slotIndex, position }) => ({
      id,
      kind,
      siteId,
      slotIndex,
      position,
    })),
    [
      {
        id: "builder:construction-site-000007:0",
        kind: "builder",
        siteId: "construction-site-000007",
        slotIndex: 0,
        position: { tx: 4.25, ty: 6.25 },
      },
      {
        id: "builder:construction-site-000007:1",
        kind: "builder",
        siteId: "construction-site-000007",
        slotIndex: 1,
        position: { tx: 4.65, ty: 6.35 },
      },
      {
        id: "builder:construction-site-000007:2",
        kind: "builder",
        siteId: "construction-site-000007",
        slotIndex: 2,
        position: { tx: 4.45, ty: 6.7 },
      },
    ],
  );
});

test("unassigned construction slots disappear from derived builder walkers", () => {
  // Given
  const active = site("construction-site-000001", { assignedBuilders: 2 });
  const inactive = site("construction-site-000002", { assignedBuilders: 0 });

  // When
  const walkers = builderWalkersForSites([active, inactive]);

  // Then
  assert.deepEqual(walkers.map(({ id }) => id), [
    "builder:construction-site-000001:0",
    "builder:construction-site-000001:1",
  ]);
});
