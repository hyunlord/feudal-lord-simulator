import assert from "node:assert/strict";
import test from "node:test";

import type { Building, BuildingKind } from "../src/content/buildingConfig";
import type { ConstructionSite } from "../src/economy/construction";
import {
  canProclaimStoneTownEra,
  confirmStoneTownProclamation,
  evaluateEraRequirements,
} from "../src/engine/era";
import type { GameState } from "../src/engine/engine.types";
import { DEFAULT_GAME_STATE, gameReducer } from "../src/state/gameStore";

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

function site(input: {
  readonly id: string;
  readonly kind: BuildingKind;
  readonly required?: ConstructionSite["required"];
  readonly delivered?: ConstructionSite["delivered"];
  readonly reserved?: ConstructionSite["reserved"];
}): ConstructionSite {
  return {
    id: input.id,
    kind: input.kind,
    tx: 0,
    ty: 0,
    required: input.required ?? {},
    delivered: input.delivered ?? {},
    reserved: input.reserved ?? {},
    builderTicks: 0,
    requiredBuilderTicks: 200,
    assignedBuilders: 0,
    stall: "awaiting_materials",
    startedTick: 0,
  };
}

function state(patch: Partial<GameState> = {}): GameState {
  return {
    ...DEFAULT_GAME_STATE,
    era: "palisade",
    population: 140,
    treasuryTimber: 0,
    treasuryCoin: 200,
    buildings: [
      building({ id: "market", kind: "market" }),
      building({ id: "masonry", kind: "masonry" }),
      building({ id: "store", kind: "storehouse", inventory: { stone: 400 } }),
    ],
    constructionSites: [],
    ...patch,
  };
}

test("Given a palisade settlement When evaluating Stone Town requirements Then five exact gauges are reported", () => {
  // Given
  const exact = state();

  // When
  const rows = evaluateEraRequirements(exact);

  // Then
  assert.deepEqual(rows, [
    { key: "population", label: "인구", current: 140, target: 140, met: true },
    { key: "market", label: "시장", current: 1, target: 1, met: true },
    { key: "masonry", label: "석공소", current: 1, target: 1, met: true },
    { key: "stone", label: "석재", current: 400, target: 400, met: true },
    { key: "coin", label: "금화", current: 200, target: 200, met: true },
  ]);
  assert.equal(canProclaimStoneTownEra(exact), true);
}
);

test("Given each Stone Town gauge is one short When proclaiming Then the era does not change", () => {
  // Given
  const cases: readonly [string, GameState][] = [
    ["population", state({ population: 139 })],
    ["market", state({ buildings: state().buildings.filter((candidate) => candidate.kind !== "market") })],
    ["masonry", state({ buildings: state().buildings.filter((candidate) => candidate.kind !== "masonry") })],
    ["stone", state({ buildings: [building({ id: "store", kind: "storehouse", inventory: { stone: 399 } }), building({ id: "market", kind: "market" }), building({ id: "masonry", kind: "masonry" })] })],
    ["coin", state({ treasuryCoin: 199 })],
  ];

  for (const [label, input] of cases) {
    // When
    const next = confirmStoneTownProclamation(input);

    // Then
    assert.equal(canProclaimStoneTownEra(input), false, label);
    assert.equal(next, input, label);
  }
}
);

test("Given construction sites and committed stone When evaluating Stone Town Then only spendable completed stock counts", () => {
  // Given
  const committed = site({
    id: "construction-site-000001",
    kind: "well",
    required: { stone: 100 },
    delivered: { stone: 10 },
    reserved: { stone: 20 },
  });
  const input = state({
    buildings: [
      building({ id: "market", kind: "market" }),
      building({ id: "masonry", kind: "masonry" }),
      building({ id: "store", kind: "storehouse", inventory: { stone: 500 }, stockReserved: { stone: 30 } }),
    ],
    constructionSites: [
      committed,
      site({ id: "construction-site-000002", kind: "market" }),
      site({ id: "construction-site-000003", kind: "masonry" }),
    ],
  });

  // When
  const rows = evaluateEraRequirements(input);

  // Then
  assert.deepEqual(rows.find((row) => row.key === "market"), {
    key: "market",
    label: "시장",
    current: 1,
    target: 1,
    met: true,
  });
  assert.deepEqual(rows.find((row) => row.key === "masonry"), {
    key: "masonry",
    label: "석공소",
    current: 1,
    target: 1,
    met: true,
  });
  assert.deepEqual(rows.find((row) => row.key === "stone"), {
    key: "stone",
    label: "석재",
    current: 400,
    target: 400,
    met: true,
  });
}
);

test("Given eligible palisade state When proclaiming Stone Town Then era and current transition tick update irreversibly", () => {
  // Given
  const eligible = state({ tick: 123, eraProclaimedTick: 10 });

  // When
  const proclaimed = confirmStoneTownProclamation(eligible);
  const repeated = confirmStoneTownProclamation(proclaimed);
  const wrongEra = confirmStoneTownProclamation(state({ era: "hamlet" }));

  // Then
  assert.notEqual(proclaimed, eligible);
  assert.equal(proclaimed.era, "stone_town");
  assert.equal(proclaimed.eraProclaimedTick, 123);
  assert.equal(repeated, proclaimed);
  assert.equal(wrongEra.era, "hamlet");
}
);

test("Given game reducer action When Stone Town is eligible Then proclamation stores only the era transition", () => {
  // Given
  const eligible = state({ tick: 321, eraProclaimedTick: 12 });

  // When
  const next = gameReducer(eligible, { type: "confirm_stone_town_proclamation" });

  // Then
  assert.equal(next.era, "stone_town");
  assert.equal(next.eraProclaimedTick, 321);
  assert.deepEqual(next.constructionSites, eligible.constructionSites);
  assert.deepEqual(next.palisade, eligible.palisade);
}
);
