import assert from "node:assert/strict";
import test from "node:test";

import {
  createConstructionEconomyHarnessScenario,
  formatEconomyHarnessReport,
  hashEconomyState,
  runEconomyHarness,
} from "../scripts/economyHarness";
import {
  constructionCommitmentLedger,
  resourceLedger,
} from "../scripts/economyHarnessLedger";
import {
  isBuildingConstructionSite,
  type BuildingConstructionSite,
} from "../src/economy/construction";
import type { GameState } from "../src/engine/engine.types";

function firstSite(state: GameState): BuildingConstructionSite {
  const site = state.constructionSites[0];
  if (site === undefined) throw new Error("Expected at least one construction site");
  if (!isBuildingConstructionSite(site)) {
    throw new Error("Expected a building construction site");
  }
  return site;
}

function withFirstSite(
  state: GameState,
  mutate: (site: BuildingConstructionSite) => BuildingConstructionSite,
): GameState {
  const site = firstSite(state);
  return {
    ...state,
    constructionSites: state.constructionSites.map((candidate) =>
      candidate.id === site.id ? mutate(site) : candidate,
    ),
  };
}

function disconnected(state: GameState): GameState {
  return {
    ...state,
    tiles: state.tiles.map((tile) =>
      (tile.tx === 1 && tile.ty === 2) || (tile.tx === 12 && tile.ty === 2)
        ? { ...tile, hasRoad: false }
        : tile,
    ),
    roadRevision: state.roadRevision + 1,
    pathCache: {},
  };
}

function noConstructionMaterials(state: GameState): GameState {
  const removedIds = new Set(["logging_camp-0", "sawmill-0"]);
  return {
    ...state,
    buildings: state.buildings
      .filter((building) => !removedIds.has(building.id))
      .map((building) => ({
        ...building,
        inventory: { ...building.inventory, timber: 0 },
        reserved: { ...building.reserved, timber: 0 },
        stockReserved: { ...building.stockReserved, timber: 0 },
      })),
    tiles: state.tiles.map((tile) =>
      tile.buildingId !== null && removedIds.has(tile.buildingId)
        ? { ...tile, buildingId: null }
        : tile,
    ),
    walkers: state.walkers.filter((walker) => walker.kind !== "carter"),
    treasuryTimber: 0,
    treasuryCoin: 0,
  };
}

test("economy harness hash changes for every construction field", () => {
  // Given: a deterministic Stage 2 construction scenario with active sites.
  const scenario = createConstructionEconomyHarnessScenario({ seed: 3 });
  const baseline = hashEconomyState(scenario);

  // When: each serialized construction field changes independently.
  const variants = [
    withFirstSite(scenario, (site) => ({ ...site, id: `${site.id}-changed` })),
    withFirstSite(scenario, (site) => ({ ...site, kind: "house" })),
    withFirstSite(scenario, (site) => ({ ...site, tx: site.tx + 1 })),
    withFirstSite(scenario, (site) => ({ ...site, ty: site.ty + 1 })),
    withFirstSite(scenario, (site) => ({ ...site, required: { timber: 11 } })),
    withFirstSite(scenario, (site) => ({ ...site, delivered: { timber: 1 } })),
    withFirstSite(scenario, (site) => ({ ...site, reserved: { timber: 1 } })),
    withFirstSite(scenario, (site) => ({ ...site, builderTicks: site.builderTicks + 1 })),
    withFirstSite(scenario, (site) => ({ ...site, requiredBuilderTicks: site.requiredBuilderTicks + 1 })),
    withFirstSite(scenario, (site) => ({ ...site, assignedBuilders: site.assignedBuilders + 1 })),
    withFirstSite(scenario, (site) => ({ ...site, stall: "no_route" })),
    withFirstSite(scenario, (site) => ({ ...site, startedTick: site.startedTick + 1 })),
    { ...scenario, wallTick: scenario.wallTick + 1 },
    { ...scenario, nextConstructionOrdinal: scenario.nextConstructionOrdinal + 1 },
  ];

  // Then: every variant produces a different determinism hash.
  for (const variant of variants) {
    assert.notEqual(hashEconomyState(variant), baseline);
  }
});

test("economy harness reports construction metrics and completes scripted sites", () => {
  // Given: the Stage 2 construction scenario.
  const scenario = createConstructionEconomyHarnessScenario({ seed: 3 });

  // When: the real harness advances the simulation.
  const report = runEconomyHarness({ scenario, ticks: 4000, warmupTicks: 800 });
  const output = formatEconomyHarnessReport(report);

  // Then: construction acceptance rows are present and assertion-backed.
  assert.match(output, /^Stall duration\s+.+\s+PASS/m);
  assert.match(output, /^Builder starvation\s+.+\s+PASS/m);
  assert.match(output, /^Material deadlock\s+.+\s+PASS/m);
  assert.match(output, /^Completion rate\s+.+\s+PASS/m);
  assert.equal(report.metrics.find((metric) => metric.label === "Completion rate")?.status, "PASS");
  assert.equal(report.determinism.hashA, report.determinism.hashB);
  assert.notEqual(report.determinism.hashA, "4d92c66f9408a603");
});

test("economy harness fails only material deadlock for disconnected construction routes", () => {
  // Given: a Stage 2 construction scenario with only the construction site road island removed.
  const scenario = disconnected(createConstructionEconomyHarnessScenario({ seed: 3 }));

  // When: the real harness advances the simulation.
  const report = runEconomyHarness({ scenario, ticks: 1200, warmupTicks: 200 });

  // Then: the intended route/material deadlock row fails without masking unrelated rows.
  assert.equal(report.metrics.find((metric) => metric.label === "Material deadlock")?.status, "FAIL");
  assert.equal(report.metrics.find((metric) => metric.label === "Builder starvation")?.status, "PASS");
  assert.equal(report.metrics.find((metric) => metric.label === "Food stability")?.status, "PASS");
});

test("economy harness fails only material deadlock when construction materials cannot exist", () => {
  // Given: a Stage 2 construction scenario with every construction timber source removed.
  const scenario = noConstructionMaterials(createConstructionEconomyHarnessScenario({ seed: 3 }));

  // When: the real harness advances the simulation.
  const report = runEconomyHarness({ scenario, ticks: 1200, warmupTicks: 200 });

  // Then: the intended missing-material row fails without causing labour starvation noise.
  assert.equal(report.metrics.find((metric) => metric.label === "Material deadlock")?.status, "FAIL");
  assert.equal(report.metrics.find((metric) => metric.label === "Builder starvation")?.status, "PASS");
  assert.equal(report.metrics.find((metric) => metric.label === "Food stability")?.status, "PASS");
});

test("construction resource ledger includes site commitments without double-counting claims", () => {
  // Given: construction has delivered material, site reservations, source claims, and Carter cargo.
  const scenario = createConstructionEconomyHarnessScenario({ seed: 3 });
  const state = withFirstSite(
    {
      ...scenario,
      buildings: scenario.buildings.map((building) =>
        building.id === "storehouse-0"
          ? {
              ...building,
              inventory: { ...building.inventory, timber: 10 },
              stockReserved: { ...building.stockReserved, timber: 7 },
            }
          : building,
      ),
      walkers: [{
        id: "carter:storehouse-0:1",
        kind: "carter",
        mission: "deliver",
        phase: "outbound",
        homeBuildingId: "storehouse-0",
        destination: { kind: "construction_site", siteId: firstSite(scenario).id },
        reservation: {
          destination: { kind: "construction_site", siteId: firstSite(scenario).id },
          resource: "timber",
          amount: 3,
          sourceStockClaim: {
            kind: "building",
            buildingId: "storehouse-0",
            resource: "timber",
            amount: 7,
          },
          homeCapacityClaim: null,
        },
        position: { tx: 1, ty: 5 },
        path: [{ tx: 1, ty: 5 }],
        pathIndex: 0,
        previousTile: null,
        cargo: { resource: "timber", amount: 5 },
        spawnedTick: 1,
        cancellation: null,
      }],
      treasuryTimber: 20,
    treasuryCoin: 0,
    },
    (site) => ({ ...site, delivered: { timber: 2 }, reserved: { timber: 3 } }),
  );

  // When: the harness ledger summarizes physical resources and site commitments.
  const physical = resourceLedger(state);
  const committed = constructionCommitmentLedger(state);

  // Then: delivered site material and Carter cargo count physically, while claims remain commitments only.
  assert.equal(physical.timber, 37);
  assert.equal(committed.timber, 5);
});
