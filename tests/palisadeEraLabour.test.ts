import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateBuildingAndConstructionLabour,
} from "../src/population/labour";
import {
  palisadeEraLabourReservation,
} from "../src/population/eraLabour";
import type { Building } from "../src/content/buildingConfig";
import type { PalisadeConstructionSite } from "../src/economy/construction";

function building(id: string, kind: Building["kind"], patch: Partial<Building> = {}): Building {
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
    ...patch,
  };
}

function wallSite(
  id: string,
  order: number,
  patch: Partial<PalisadeConstructionSite> = {},
): PalisadeConstructionSite {
  return {
    id,
    kind: "palisade_segment",
    wallId: "wall-a",
    segmentIndex: order,
    gateDistance: order * 4,
    order,
    path: [{ x: order, y: 0 }, { x: order + 1, y: 0 }],
    anchor: { tx: order, ty: 0 },
    required: { timber: 15 },
    delivered: { timber: 15 },
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: 120,
    assignedBuilders: 99,
    stall: "no_builders",
    startedTick: 0,
    ...patch,
  };
}

test("Given available worker counts When palisade era is active Then the wall quota is forty percent with a one-worker floor", () => {
  // Given
  const site = wallSite("wall-a-segment-000", 0);

  // When
  const quotas = [0, 1, 2, 4, 5, 10].map((availableWorkers) =>
    palisadeEraLabourReservation({
      constructionSites: [site],
      availableWorkers,
      tick: 199,
      eraProclaimedTick: 100,
    }).reservedWorkers,
  );

  // Then
  assert.deepEqual(quotas, [0, 1, 1, 1, 2, 4]);
}
);

test("Given reordered wall sites When palisade quota is active Then only the earliest incomplete segment receives reserved builders", () => {
  // Given
  const first = wallSite("wall-a-segment-000", 0);
  const second = wallSite("wall-a-segment-001", 1);

  // When
  const result = allocateBuildingAndConstructionLabour([], [second, first], 20, {
    tick: 100,
    eraProclaimedTick: 100,
  });

  // Then
  assert.deepEqual(
    result.constructionSites.map(({ id, assignedBuilders }) => ({ id, assignedBuilders })),
    [
      { id: "wall-a-segment-001", assignedBuilders: 0 },
      { id: "wall-a-segment-000", assignedBuilders: 3 },
    ],
  );
  assert.equal(result.diagnostics.palisadeEraLabour.activeSiteId, first.id);
  assert.equal(result.diagnostics.palisadeEraLabour.reservedWorkers, 4);
  assert.equal(result.diagnostics.palisadeEraLabour.unavailableReservedWorkers, 1);
}
);

test("Given an active wall site blocked on materials When quota is reserved Then production cannot use the idle reservation", () => {
  // Given
  const farm = building("a-farm", "wheat_farm");
  const blockedWall = wallSite("wall-a-segment-000", 0, {
    delivered: {},
    stall: "awaiting_materials",
  });

  // When
  const result = allocateBuildingAndConstructionLabour([farm], [blockedWall], 8, {
    tick: 599,
    eraProclaimedTick: 0,
  });

  // Then
  assert.equal(result.buildings[0]?.workers, 3);
  assert.equal(result.constructionSites[0]?.assignedBuilders, 0);
  assert.equal(result.constructionSites[0]?.stall, "awaiting_materials");
  assert.equal(result.idleWorkers, 0);
  assert.equal(result.diagnostics.palisadeEraLabour.reservedWorkers, 1);
  assert.equal(result.diagnostics.palisadeEraLabour.unavailableReservedWorkers, 1);
}
);

test("Given proclamation tick boundaries When allocating labour Then offsets 0 and 599 reserve wall labour but 600 restores production priority", () => {
  // Given
  const farm = building("a-farm", "wheat_farm");
  const wall = wallSite("wall-a-segment-000", 0);

  // When
  const offset0 = allocateBuildingAndConstructionLabour([farm], [wall], 10, {
    tick: 100,
    eraProclaimedTick: 100,
  });
  const offset599 = allocateBuildingAndConstructionLabour([farm], [wall], 10, {
    tick: 699,
    eraProclaimedTick: 100,
  });
  const offset600 = allocateBuildingAndConstructionLabour([farm], [wall], 10, {
    tick: 700,
    eraProclaimedTick: 100,
  });

  // Then
  assert.deepEqual(
    [offset0, offset599, offset600].map((result) => ({
      farmWorkers: result.buildings[0]?.workers,
      wallBuilders: result.constructionSites[0]?.assignedBuilders,
      reserved: result.diagnostics.palisadeEraLabour.reservedWorkers,
    })),
    [
      { farmWorkers: 3, wallBuilders: 2, reserved: 2 },
      { farmWorkers: 3, wallBuilders: 2, reserved: 2 },
      { farmWorkers: 4, wallBuilders: 1, reserved: 0 },
    ],
  );
}
);
