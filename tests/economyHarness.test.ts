import assert from "node:assert/strict";
import test from "node:test";

import {
  createEconomyHarnessScenario,
  formatEconomyHarnessReport,
  hashEconomyState,
  runEconomyHarness,
} from "../scripts/economyHarness";
import type { CarterWalker } from "../src/agents/walker.types";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import { advanceTick } from "../src/engine/tick";
import type { GameState } from "../src/engine/engine.types";
import { canPlaceBuilding } from "../src/world/placement";

function footprint(building: Building): readonly string[] {
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  const keys: string[] = [];
  for (let dy = 0; dy < definition.height; dy += 1) {
    for (let dx = 0; dx < definition.width; dx += 1) {
      keys.push(`${building.tx + dx},${building.ty + dy}`);
    }
  }
  return keys;
}

function withoutFoodProduction(state: GameState): GameState {
  const disabledIds = new Set(["wheat_farm-0", "wheat_farm-1", "mill-0"]);
  const buildings = state.buildings.filter((building) => !disabledIds.has(building.id));
  return {
    ...state,
    buildings,
    tiles: state.tiles.map((tile) =>
      tile.buildingId !== null && disabledIds.has(tile.buildingId)
        ? { ...tile, buildingId: null }
        : tile,
    ),
  };
}

test("economy harness fixed scenario is deterministic and passes every metric", () => {
  // Given: the fixed Phase 3 economy scenario and two same-seed runs.
  const scenario = createEconomyHarnessScenario({ seed: 3 });

  // When: the harness runs through the real advanceTick pipeline.
  const report = runEconomyHarness({ scenario, ticks: 4000, warmupTicks: 800 });

  // Then: the same-seed hashes match and every acceptance metric passes.
  assert.equal(report.determinism.hashA, report.determinism.hashB);
  assert.deepEqual(
    report.metrics.map((metric) => metric.status),
    ["PASS", "PASS", "PASS", "PASS", "PASS"],
  );
});

test("economy harness fixed scenario has legal building footprints", () => {
  // Given: the fixed Phase 3 economy scenario.
  const scenario = createEconomyHarnessScenario({ seed: 3 });
  const owners = new Map<string, string>();

  // When: every building footprint is expanded from the canonical config.
  for (const building of scenario.buildings) {
    for (const key of footprint(building)) {
      assert.equal(owners.has(key), false, `${building.id} overlaps ${owners.get(key)} at ${key}`);
      owners.set(key, building.id);
    }
  }

  // Then: each footprint tile belongs to that building, contains no road, and remains canPlace-legal.
  for (const building of scenario.buildings) {
    const clearedSelf = {
      ...scenario,
      tiles: scenario.tiles.map((tile) =>
        tile.buildingId === building.id ? { ...tile, buildingId: null } : tile,
      ),
      treasuryTimber: 1_000,
    };
    assert.deepEqual(canPlaceBuilding(clearedSelf, building.kind, building.tx, building.ty), { ok: true });

    for (const key of footprint(building)) {
      const tile = scenario.tiles.find((candidate) => `${candidate.tx},${candidate.ty}` === key);
      assert.equal(tile?.buildingId, building.id, `${building.id} missing footprint owner at ${key}`);
      assert.equal(tile?.hasRoad, false, `${building.id} footprint has road at ${key}`);
    }
  }
});

test("economy harness never exceeds a building storage capacity", () => {
  let state = createEconomyHarnessScenario({ seed: 3 });
  const resources: readonly ResourceType[] = ["wheat", "bread", "logs", "timber"];

  for (let step = 0; step <= 4000; step += 1) {
    for (const building of state.buildings) {
      const occupied = resources.reduce(
        (total, resource) =>
          total +
          (building.inventory[resource] ?? 0) +
          (building.reserved[resource] ?? 0),
        0,
      );
      assert.ok(
        occupied <= BUILDING_CONFIG_BY_KIND[building.kind].storageCapacity,
        `${building.id} exceeds capacity at tick ${state.tick}: ${occupied}`,
      );
    }
    if (step < 4000) state = advanceTick(state);
  }
});

test("economy harness food stability fails when no bread is ever produced", () => {
  // Given: a deliberately broken scenario with farms and mill removed.
  const scenario = withoutFoodProduction(createEconomyHarnessScenario({ seed: 3 }));

  // When: the harness runs through the real advanceTick pipeline.
  const report = runEconomyHarness({ scenario, ticks: 4000, warmupTicks: 800 });

  // Then: cached starting bread cannot mask the missing production chain.
  assert.equal(report.metrics.find((metric) => metric.label === "Food stability")?.status, "FAIL");
});

test("economy harness prints the required five-row metric table", () => {
  // Given: a completed deterministic harness report.
  const report = runEconomyHarness({
    scenario: createEconomyHarnessScenario({ seed: 3 }),
    ticks: 4000,
    warmupTicks: 800,
  });

  // When: the report is formatted for CLI output.
  const output = formatEconomyHarnessReport(report);

  // Then: the shape names the exact five Phase 3 harness rows.
  assert.match(output, /^Metric\s+Value\s+Status/m);
  assert.match(output, /^Determinism hash\s+\S+ == \S+\s+PASS/m);
  assert.match(output, /^Food stability\s+.+\s+PASS/m);
  assert.match(output, /^Cargo thrashing\s+.+\s+PASS/m);
  assert.match(output, /^Labour deadlock\s+.+\s+PASS/m);
  assert.match(output, /^Housing oscillation\s+.+\s+PASS/m);
});

test("economy harness hash includes carter lifecycle and reservation state", () => {
  const scenario = createEconomyHarnessScenario({ seed: 3 });
  const carter: CarterWalker = {
    id: "carter:logging_camp-0:1",
    kind: "carter",
    mission: "deliver",
    phase: "returning",
    homeBuildingId: "logging_camp-0",
    destinationBuildingId: "storehouse-0",
    reservation: {
      destinationBuildingId: "logging_camp-0",
      resource: "logs",
      amount: 8,
      sourceStockClaim: null,
      homeCapacityClaim: null,
    },
    position: { tx: 1, ty: 2 },
    path: [{ tx: 1, ty: 2 }],
    pathIndex: 0,
    previousTile: null,
    cargo: { resource: "logs", amount: 8 },
    spawnedTick: 1,
    cancellation: null,
  };
  const cancelled: CarterWalker = {
    ...carter,
    cancellation: {
      tick: 2,
      reason: "road_removed",
      releasedReservation: true,
    },
  };
  const withHomeClaim: CarterWalker = {
    ...carter,
    reservation: {
      ...carter.reservation,
      homeCapacityClaim: {
        buildingId: carter.homeBuildingId,
        resource: "logs",
        amount: 8,
      },
    },
  };

  assert.notEqual(
    hashEconomyState({ ...scenario, walkers: [carter] }),
    hashEconomyState({ ...scenario, walkers: [cancelled] }),
  );
  assert.notEqual(
    hashEconomyState({ ...scenario, walkers: [carter] }),
    hashEconomyState({ ...scenario, walkers: [withHomeClaim] }),
  );
});
