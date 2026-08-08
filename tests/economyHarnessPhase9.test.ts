import assert from "node:assert/strict";
import test from "node:test";

import {
  createPhase9EconomyHarnessScenario,
  formatEconomyHarnessReport,
  hashEconomyState,
  parsePhase9WorkerCount,
  phase9Metrics,
  runPhase9EconomyHarness,
  trackPhase9Run,
} from "../scripts/economyHarness";
import type { Phase9RunTrace } from "../scripts/economyHarnessPhase9Trace";
import type { Building } from "../src/content/buildingConfig";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { HOUSING_CONFIG } from "../src/content/housingConfig";
import type { GameState, PalisadeState } from "../src/engine/engine.types";

function failedLabels(trace: Phase9RunTrace): readonly string[] {
  return phase9Metrics(trace, trace)
    .filter((metric) => metric.status === "FAIL")
    .map((metric) => metric.label);
}

function mutateBuilding(
  state: GameState,
  buildingId: string,
  mutate: (building: Building) => Building,
): GameState {
  return {
    ...state,
    buildings: state.buildings.map((building) =>
      building.id === buildingId ? mutate(building) : building,
    ),
  };
}

function mutatePalisade(state: GameState, mutate: (palisade: PalisadeState) => PalisadeState): GameState {
  assert.ok(state.palisade !== null);
  return { ...state, palisade: mutate(state.palisade) };
}

test("Phase 9 harness runs a rock-connected Stone Town scenario and exposes exactly five metrics", () => {
  // Given: a deterministic Phase 9 scenario with a quarry connected to rock and roads.
  const scenario = createPhase9EconomyHarnessScenario({ seed: 9 });
  const quarry = scenario.buildings.find((building) => building.id === "phase9-quarry-0");
  assert.ok(quarry !== undefined);
  assert.equal(
    scenario.tiles.some((tile) => tile.terrain === "rock" && tile.hasRoad),
    true,
  );
  assert.equal(
    scenario.tiles.some((tile) => tile.terrain === "rock" && tile.tx === quarry.tx - 1),
    true,
  );

  // When: the Phase 9 harness advances the real simulation twice from the same seed.
  const report = runPhase9EconomyHarness({ workers: 8 });

  // Then: only the five Stone Town metric rows are classified as Phase 9 rows and all pass.
  assert.equal(report.phase9.hashA, report.phase9.hashB);
  assert.deepEqual(
    report.phase9Metrics.map((metric) => metric.label),
    [
      "Stone chain continuity",
      "Market coin by 5000",
      "Stone Town reachability",
      "Stone wall completion",
      "Segment material continuity",
    ],
  );
  assert.deepEqual(report.phase9Metrics.map((metric) => metric.status), ["PASS", "PASS", "PASS", "PASS", "PASS"]);
  assert.equal(report.phase9Metrics.length, 5);
  assert.match(formatEconomyHarnessReport(report), /Stone Town reachability\s+.+\s+PASS/);
});

test("Phase 9 scenario fixture keeps housing and storage within gameplay caps", () => {
  // Given: the deterministic Phase 9 scenario used for balance measurement.
  const scenario = createPhase9EconomyHarnessScenario({ seed: 9 });
  const housingCapacity = new Map<number, number>(HOUSING_CONFIG.map((definition) => [definition.level, definition.capacity]));

  // When: every seeded house and completed storage building is inspected.
  const overCapacityHouses = scenario.houses.filter((house) => house.residents > (housingCapacity.get(house.level) ?? 0));
  const overCapacityStores = scenario.buildings.filter((building) => {
    const capacity = BUILDING_CONFIG_BY_KIND[building.kind].storageCapacity;
    const stock = Object.values(building.inventory).reduce((total, amount) => total + (amount ?? 0), 0);
    return capacity > 0 && stock > capacity;
  });

  // Then: the fixture remains an honest gameplay state rather than a shortcut seed.
  assert.deepEqual(overCapacityHouses, []);
  assert.deepEqual(overCapacityStores, []);
});

test("Phase 9 metrics isolate five deliberate broken traces", () => {
  // Given: a successful real Phase 9 trace.
  const scenario = createPhase9EconomyHarnessScenario({ seed: 9 });
  const good = trackPhase9Run(scenario);

  // When: each deliberate scenario mutation corrupts exactly one acceptance path through the real tick runner.
  const noRockAccess = trackPhase9Run(scenario, { failureMode: "no_rock_access" });
  const noSurplusSale = trackPhase9Run(scenario, { failureMode: "no_market_surplus" });
  const blockedEraCondition = trackPhase9Run(scenario, { failureMode: "blocked_population" });
  const starvedStoneWall = trackPhase9Run(scenario, { failureMode: "starved_stone_wall" });
  const prematureTimberRemoval = trackPhase9Run(scenario, { failureMode: "segment_material_gap" });

  // Then: each mutant fails its intended row and no neighboring Phase 9 row.
  assert.deepEqual(failedLabels(good), []);
  assert.deepEqual(failedLabels(noRockAccess), ["Stone chain continuity"]);
  assert.deepEqual(failedLabels(noSurplusSale), ["Market coin by 5000"]);
  assert.deepEqual(failedLabels(blockedEraCondition), ["Stone Town reachability"]);
  assert.deepEqual(failedLabels(starvedStoneWall), ["Stone wall completion"]);
  assert.deepEqual(failedLabels(prematureTimberRemoval), ["Segment material continuity"]);
});

test("Phase 9 hash includes treasury, era, replacement, resource, and site state", () => {
  // Given: a real Phase 9 final state after Stone Town wall replacement.
  const trace = trackPhase9Run(createPhase9EconomyHarnessScenario({ seed: 9 }));
  const base = trace.finalState;
  const baseline = hashEconomyState(base);
  const replacementSegment = base.palisade?.segments.find((segment) => segment.material === "stone");
  const siteBase = trace.proclaimedState;
  const siteBaseline = hashEconomyState(siteBase);
  const site = siteBase.constructionSites[0];

  assert.ok(replacementSegment !== undefined);
  assert.ok(site !== undefined);

  // When: each Phase 9 gameplay state family is changed independently.
  const variants: readonly GameState[] = [
    { ...base, treasuryCoin: base.treasuryCoin + 1 },
    { ...base, eraProclaimedTick: (base.eraProclaimedTick ?? 0) + 1 },
    mutatePalisade(base, (palisade) => ({
      ...palisade,
      segments: palisade.segments.map((segment) =>
        segment.id === replacementSegment.id
          ? { ...segment, material: "timber", replacementConstructionSiteId: `${segment.id}-mutant` }
          : segment,
      ),
    })),
    mutateBuilding(base, "phase9-storehouse-0", (building) => ({
      ...building,
      inventory: { ...building.inventory, stone: (building.inventory.stone ?? 0) + 1 },
    })),
  ];

  // Then: every mutation changes the deterministic harness hash.
  for (const variant of variants) {
    assert.notEqual(hashEconomyState(variant), baseline);
  }
  assert.notEqual(
    hashEconomyState({
      ...siteBase,
      constructionSites: siteBase.constructionSites.map((candidate) =>
        candidate.id === site.id
          ? { ...candidate, delivered: { ...candidate.delivered, stone: (candidate.delivered.stone ?? 0) + 1 } }
          : candidate,
      ),
    }),
    siteBaseline,
  );
});

test("Phase 9 worker option accepts one through eight and rejects larger requests", () => {
  // Given / When / Then
  assert.equal(parsePhase9WorkerCount(["--phase9"]).workers, 1);
  assert.equal(parsePhase9WorkerCount(["--phase9", "--workers=1"]).workers, 1);
  assert.equal(parsePhase9WorkerCount(["--phase9", "--workers=8"]).workers, 8);
  assert.throws(() => parsePhase9WorkerCount(["--phase9", "--workers=9"]), /safety ceiling is 8/);
});
