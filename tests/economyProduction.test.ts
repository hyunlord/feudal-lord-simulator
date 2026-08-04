import assert from "node:assert/strict";
import test from "node:test";

import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
  type BuildingKind,
} from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import { stepProduction } from "../src/economy/production";

function building(
  kind: BuildingKind,
  input: {
    readonly workers?: number;
    readonly inventory?: Partial<Record<ResourceType, number>>;
    readonly productionProgress?: number;
    readonly reserved?: Partial<Record<ResourceType, number>>;
  } = {},
): Building {
  return {
    id: `${kind}-test`,
    kind,
    tx: 0,
    ty: 0,
    workers: input.workers ?? 0,
    inventory: input.inventory ?? {},
    reserved: input.reserved ?? {},
    stockReserved: {},
    productionProgress: input.productionProgress ?? 0,
  };
}

test("production hard-stops when a building is even one worker short", () => {
  const definition = BUILDING_CONFIG_BY_KIND.wheat_farm;
  const initial = building("wheat_farm", {
    workers: definition.workersRequired - 1,
    productionProgress: 12,
  });

  assert.deepEqual(stepProduction(initial, definition), {
    building: initial,
    produced: null,
  });
});

test("a converter does not progress without its full local input recipe", () => {
  const definition = BUILDING_CONFIG_BY_KIND.mill;
  const initial = building("mill", {
    workers: definition.workersRequired,
    inventory: { wheat: 1 },
    productionProgress: 8,
  });

  assert.deepEqual(stepProduction(initial, definition), {
    building: initial,
    produced: null,
  });
});

test("raw production advances exactly one progress per staffed tick", () => {
  const definition = BUILDING_CONFIG_BY_KIND.logging_camp;
  const initial = building("logging_camp", {
    workers: definition.workersRequired,
    productionProgress: 10,
  });
  const result = stepProduction(initial, definition);

  assert.equal(result.building.productionProgress, 11);
  assert.deepEqual(result.building.inventory, {});
  assert.equal(result.produced, null);
});

test("converter completion consumes two input, creates one output, and resets", () => {
  const definition = BUILDING_CONFIG_BY_KIND.mill;
  const initial = building("mill", {
    workers: definition.workersRequired,
    inventory: { wheat: 3, bread: 2 },
    productionProgress: definition.production!.ticksPerOutput - 1,
  });
  const result = stepProduction(initial, definition);

  assert.equal(result.building.productionProgress, 0);
  assert.deepEqual(result.building.inventory, { wheat: 1, bread: 3 });
  assert.equal(result.produced, "bread");
});

test("a full raw producer holds at full progress until local space exists", () => {
  const definition = BUILDING_CONFIG_BY_KIND.wheat_farm;
  const full = building("wheat_farm", {
    workers: definition.workersRequired,
    inventory: { wheat: definition.storageCapacity },
    productionProgress: definition.production!.ticksPerOutput,
  });
  const blocked = stepProduction(full, definition);

  assert.equal(blocked.building.productionProgress, definition.production!.ticksPerOutput);
  assert.equal(blocked.building.inventory.wheat, definition.storageCapacity);
  assert.equal(blocked.produced, null);

  const freed = {
    ...blocked.building,
    inventory: { wheat: definition.storageCapacity - 1 },
  };
  const resumed = stepProduction(freed, definition);
  assert.equal(resumed.building.productionProgress, 0);
  assert.equal(resumed.building.inventory.wheat, definition.storageCapacity);
  assert.equal(resumed.produced, "wheat");
});

test("converter completion may consume input to make room while total storage is full", () => {
  const definition = BUILDING_CONFIG_BY_KIND.sawmill;
  const initial = building("sawmill", {
    workers: definition.workersRequired,
    inventory: { logs: 2, timber: definition.storageCapacity - 2 },
    productionProgress: definition.production!.ticksPerOutput,
  });
  const result = stepProduction(initial, definition);

  assert.deepEqual(result.building.inventory, {
    logs: 0,
    timber: definition.storageCapacity - 1,
  });
  assert.equal(result.building.productionProgress, 0);
  assert.equal(result.produced, "timber");
});

test("reserved inbound capacity blocks raw output rather than overbooking storage", () => {
  const definition = BUILDING_CONFIG_BY_KIND.logging_camp;
  const initial = building("logging_camp", {
    workers: definition.workersRequired,
    inventory: { logs: definition.storageCapacity - 1 },
    reserved: { logs: 1 },
    productionProgress: definition.production!.ticksPerOutput,
  });
  const result = stepProduction(initial, definition);

  assert.equal(result.building.productionProgress, definition.production!.ticksPerOutput);
  assert.equal(result.building.inventory.logs, definition.storageCapacity - 1);
  assert.equal(result.produced, null);
});

test("non-production buildings are stable", () => {
  const initial = building("house", { workers: 0 });
  assert.deepEqual(stepProduction(initial, BUILDING_CONFIG_BY_KIND.house), {
    building: initial,
    produced: null,
  });
});
