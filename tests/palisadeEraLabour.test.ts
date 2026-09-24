import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateBuildingAndConstructionLabour,
} from "../src/population/labour";
import {
  palisadeEraLabourReservation,
} from "../src/population/eraLabour";
import type { Building } from "../src/content/buildingConfig";
import { createStoneWallConstructionSite, type PalisadeConstructionSite, type StoneWallConstructionSite } from "../src/economy/construction";
import { advanceConstructionSites } from "../src/engine/constructionLifecycle";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

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

function stoneWallSite(
  id: string,
  order: number,
  patch: Partial<StoneWallConstructionSite> = {},
): StoneWallConstructionSite {
  return {
    ...createStoneWallConstructionSite({
      id,
      wallId: "wall-a",
      segmentIndex: order,
      gateDistance: order * 4,
      order,
      path: [{ x: order, y: 0 }, { x: order + 1, y: 0 }],
      startedTick: 0,
    }),
    delivered: { stone: 25 },
    assignedBuilders: 99,
    stall: "no_builders",
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
  assert.deepEqual(quotas, [0, 1, 1, 1, 2, 3]);
}
);

test("Given reordered wall sites When palisade quota is active Then the first receives reserved builders and other supplied sites can work", () => {
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
      { id: "wall-a-segment-001", assignedBuilders: 3 },
      { id: "wall-a-segment-000", assignedBuilders: 3 },
    ],
  );
  assert.equal(result.diagnostics.palisadeEraLabour.activeSiteId, first.id);
  assert.equal(result.diagnostics.palisadeEraLabour.reservedWorkers, 4);
  assert.equal(result.diagnostics.palisadeEraLabour.unavailableReservedWorkers, 0);
}
);

test("one isolated first palisade segment cannot block eleven supplied later segments", () => {
  const sites = Array.from({ length: 12 }, (_, order) => wallSite(
    `wall-a-segment-${String(order).padStart(3, '0')}`,
    order,
    order === 0 ? { delivered: {}, stall: 'no_route' } : {},
  ));
  let current: PalisadeConstructionSite[] = sites;
  for (let tick = 0; tick < 40; tick += 1) {
    const assigned = allocateBuildingAndConstructionLabour([], current, 200, {
      era: 'palisade', tick, eraProclaimedTick: 0,
    });
    current = advanceConstructionSites({
      ...DEFAULT_GAME_STATE,
      constructionSites: [...assigned.constructionSites],
    }) as PalisadeConstructionSite[];
  }
  assert.equal(current[0]?.builderTicks, 0);
  assert.deepEqual(current.slice(1).map(site => site.builderTicks), Array(11).fill(120));
});

test("Given an active wall site blocked on materials When quota is reserved Then production keeps all available workers", () => {
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
  assert.equal(result.buildings[0]?.workers, 4);
  assert.equal(result.constructionSites[0]?.assignedBuilders, 0);
  assert.equal(result.constructionSites[0]?.stall, "awaiting_materials");
  assert.equal(result.idleWorkers, 0);
  assert.equal(result.diagnostics.palisadeEraLabour.reservedWorkers, 0);
  assert.equal(result.diagnostics.palisadeEraLabour.unavailableReservedWorkers, 0);
}
);

test("Given proclamation tick boundaries When allocating labour Then offsets 0 and 599 reserve wall labour but 600 releases the ceremony quota while retaining the construction floor", () => {
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
      { farmWorkers: 2, wallBuilders: 3, reserved: 2 },
      { farmWorkers: 2, wallBuilders: 3, reserved: 2 },
      { farmWorkers: 2, wallBuilders: 3, reserved: 0 },
    ],
  );
}
);

test("Given Stone Town ceremony offsets When active construction exists Then half the workers are reserved for nine hundred ticks", () => {
  // Given
  const target = stoneWallSite("stone-target", 0);

  // When
  const quotas = [0, 1, 2, 5, 10].map((availableWorkers) =>
    palisadeEraLabourReservation({
      era: "stone_town",
      constructionSites: [target],
      availableWorkers,
      tick: 100,
      eraProclaimedTick: 100,
    }).reservedWorkers,
  );
  const offset899 = palisadeEraLabourReservation({
    era: "stone_town",
    constructionSites: [target],
    availableWorkers: 10,
    tick: 999,
    eraProclaimedTick: 100,
  });
  const offset900 = palisadeEraLabourReservation({
    era: "stone_town",
    constructionSites: [target],
    availableWorkers: 10,
    tick: 1_000,
    eraProclaimedTick: 100,
  });

  // Then
  assert.deepEqual(quotas, [0, 1, 1, 2, 3]);
  assert.equal(offset899.reservedWorkers, 3);
  assert.equal(offset900.reservedWorkers, 0);
}
);

test("Given Stone Town ceremony has no active target When allocating labour Then workers stay available", () => {
  // Given
  const farm = building("a-farm", "wheat_farm");

  // When
  const result = allocateBuildingAndConstructionLabour([farm], [], 10, {
    era: "stone_town",
    tick: 100,
    eraProclaimedTick: 100,
  });

  // Then
  assert.equal(result.buildings[0]?.workers, 4);
  assert.equal(result.diagnostics.palisadeEraLabour.reservedWorkers, 0);
  assert.equal(result.diagnostics.palisadeEraLabour.activeSiteId, null);
}
);


test("R-T3 material-waiting walls reserve no workers from the ordinary pool", () => {
  const buildings = [building('farm', 'wheat_farm'), building('mill', 'mill'), building('saw', 'sawmill')];
  const result = allocateBuildingAndConstructionLabour(buildings, [wallSite('blocked', 0, { delivered: {}, stall: 'awaiting_materials' })], 16, { era: 'palisade', tick: 0, eraProclaimedTick: 0 });
  assert.equal(result.diagnostics.palisadeEraLabour.reservedWorkers, 0);
  assert.deepEqual(result.buildings.map(b => b.workers), [4, 2, 2]);
});

test("R-T4 two ready wall sites reserve six workers and leave the rest in the ordinary pool", () => {
  const result = allocateBuildingAndConstructionLabour([building('farm', 'wheat_farm')], [wallSite('first', 0), wallSite('second', 1)], 40, { era: 'palisade', tick: 0, eraProclaimedTick: 0 });
  assert.equal(result.diagnostics.palisadeEraLabour.reservedWorkers, 6);
  assert.equal(result.diagnostics.palisadeEraLabour.assignedBuilders, 6);
  assert.equal(result.diagnostics.palisadeEraLabour.unavailableReservedWorkers, 0);
  assert.deepEqual(result.constructionSites.map(s => s.assignedBuilders), [3, 3]);
  assert.equal(result.buildings[0]?.workers, 4);
  assert.equal(result.idleWorkers, 10);
});
