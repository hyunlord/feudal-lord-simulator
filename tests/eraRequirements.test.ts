import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import { evaluateEraRequirements, canProclaimPalisadeEra } from "../src/engine/era";
import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";

function building(input: {
  readonly id: string;
  readonly kind: Building["kind"];
  readonly inventory?: Building["inventory"];
  readonly stockReserved?: Building["stockReserved"];
}): Building {
  return {
    id: input.id,
    kind: input.kind,
    tx: 0,
    ty: 0,
    workers: 0,
    inventory: input.inventory ?? {},
    reserved: {},
    stockReserved: input.stockReserved ?? {},
    productionProgress: 0,
  };
}

function state(patch: Partial<GameState> = {}): GameState {
  return {
    ...DEFAULT_GAME_STATE,
    ...patch,
    buildings: [...(patch.buildings ?? DEFAULT_GAME_STATE.buildings)],
    constructionSites: [...(patch.constructionSites ?? DEFAULT_GAME_STATE.constructionSites)],
  };
}

test("evaluateEraRequirements returns four independent gauges at exact thresholds", () => {
  // Given
  const justShort = state({
    population: 59,
    treasuryTimber: 249,
    buildings: [
      ...DEFAULT_GAME_STATE.buildings,
      building({ id: "granary", kind: "granary" }),
      building({ id: "chapel", kind: "chapel" }),
    ],
  });
  const exactlyMet = state({
    population: 60,
    treasuryTimber: 250,
    buildings: [
      ...DEFAULT_GAME_STATE.buildings,
      building({ id: "granary", kind: "granary" }),
      building({ id: "chapel", kind: "chapel" }),
    ],
  });

  // When
  const shortRows = evaluateEraRequirements(justShort);
  const metRows = evaluateEraRequirements(exactlyMet);

  // Then
  assert.deepEqual(shortRows, [
    { key: "population", label: "인구", current: 59, target: 60, met: false },
    { key: "granary", label: "곡창", current: 1, target: 1, met: true },
    { key: "chapel", label: "예배당", current: 1, target: 1, met: true },
    { key: "timber", label: "목재", current: 249, target: 250, met: false },
  ]);
  assert.deepEqual(metRows, [
    { key: "population", label: "인구", current: 60, target: 60, met: true },
    { key: "granary", label: "곡창", current: 1, target: 1, met: true },
    { key: "chapel", label: "예배당", current: 1, target: 1, met: true },
    { key: "timber", label: "목재", current: 250, target: 250, met: true },
  ]);
  assert.equal(canProclaimPalisadeEra(justShort), false);
  assert.equal(canProclaimPalisadeEra(exactlyMet), true);
});

test("evaluateEraRequirements counts finished granaries and chapels but not construction sites", () => {
  // Given
  const unfinishedOnly = state({
    population: 60,
    treasuryTimber: 250,
    constructionSites: [
      {
        id: "construction-site-000001",
        kind: "granary",
        tx: 1,
        ty: 1,
        required: { timber: 40 },
        delivered: {},
        reserved: {},
        builderTicks: 0,
        requiredBuilderTicks: 800,
        assignedBuilders: 0,
        stall: "awaiting_materials",
        startedTick: 0,
      },
      {
        id: "construction-site-000002",
        kind: "chapel",
        tx: 3,
        ty: 1,
        required: { timber: 40 },
        delivered: {},
        reserved: {},
        builderTicks: 0,
        requiredBuilderTicks: 200,
        assignedBuilders: 0,
        stall: "awaiting_materials",
        startedTick: 0,
      },
    ],
  });

  // When
  const rows = evaluateEraRequirements(unfinishedOnly);

  // Then
  assert.equal(rows.find((row) => row.key === "granary")?.current, 0);
  assert.equal(rows.find((row) => row.key === "granary")?.met, false);
  assert.equal(rows.find((row) => row.key === "chapel")?.current, 0);
  assert.equal(rows.find((row) => row.key === "chapel")?.met, false);
  assert.equal(canProclaimPalisadeEra(unfinishedOnly), false);
});

test("evaluateEraRequirements uses named spendable timber minus stock reservations and commitments", () => {
  // Given
  const committedSite = {
    id: "construction-site-000003",
    kind: "well" as const,
    tx: 5,
    ty: 1,
    required: { timber: 40 },
    delivered: { timber: 10 },
    reserved: { timber: 15 },
    builderTicks: 0,
    requiredBuilderTicks: 200,
    assignedBuilders: 0,
    stall: "awaiting_materials" as const,
    startedTick: 0,
  };
  const eligible = state({
    population: 60,
    treasuryTimber: 195,
    buildings: [
      ...DEFAULT_GAME_STATE.buildings,
      building({ id: "granary", kind: "granary" }),
      building({ id: "chapel", kind: "chapel" }),
      building({
        id: "store",
        kind: "storehouse",
        inventory: { timber: 100 },
        stockReserved: { timber: 30 },
      }),
    ],
    constructionSites: [committedSite],
    walkers: [{
      id: "carter:timber",
      kind: "carter",
      homeBuildingId: "store",
      position: { tx: 0, ty: 0 },
      path: [],
      pathIndex: 0,
      previousTile: null,
      cargo: { resource: "timber", amount: 90 },
      spawnedTick: 0,
      mission: "deliver",
      phase: "outbound",
      destination: { kind: "construction_site", siteId: committedSite.id },
      reservation: {
        destination: { kind: "construction_site", siteId: committedSite.id },
        resource: "timber",
        amount: 90,
        sourceStockClaim: null,
        homeCapacityClaim: null,
      },
      cancellation: null,
    }],
  });
  const overReserved = state({
    ...eligible,
    buildings: eligible.buildings.map((candidate) =>
      candidate.id === "store"
        ? { ...candidate, stockReserved: { timber: 120 } }
        : candidate,
    ),
  });

  // When
  const eligibleTimber = evaluateEraRequirements(eligible).find((row) => row.key === "timber");
  const overReservedTimber = evaluateEraRequirements(overReserved).find((row) => row.key === "timber");

  // Then
  assert.deepEqual(eligibleTimber, {
    key: "timber",
    label: "목재",
    current: 250,
    target: 250,
    met: true,
  });
  assert.deepEqual(overReservedTimber, {
    key: "timber",
    label: "목재",
    current: 180,
    target: 250,
    met: false,
  });
});
