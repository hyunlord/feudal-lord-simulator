import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import type { GameState } from "../src/engine/engine.types";
import { parseGrowthOptions } from "../scripts/phase19GrowthMetrics";
import { createGrowthInitialState, createGrowthStability } from "../scripts/phase19GrowthRunControl";
import { createGrowthObservations } from "../scripts/phase19GrowthObservations";

test("seed selection regenerates terrain deterministically and seed one preserves the opening state", () => {
  const original = structuredClone(DEFAULT_GAME_STATE);
  assert.deepEqual(createGrowthInitialState(1), original);
  assert.deepEqual(createGrowthInitialState(1), createGrowthInitialState(1));
  assert.deepEqual(DEFAULT_GAME_STATE, original);
});

test("CLI preserves positional arguments and accepts a bounded optional seed and extended budget", () => {
  assert.deepEqual(parseGrowthOptions(["24"]), { targetLots: 24, maxTicks: 600000, seed: 1 });
  assert.deepEqual(parseGrowthOptions(["24", "1200000", "output", "5"]), { targetLots: 24, maxTicks: 1200000, seed: 5 });
  for (const args of [["24", "1200001"], ["24", "20", "output", "6"], ["24", "20", "output", "1.5"]]) {
    assert.throws(() => parseGrowthOptions(args), RangeError);
  }
});

test("stable victory at a smaller city cannot consume the target city's stability window", () => {
  const stability = createGrowthStability(24);
  for (let tick = 1; tick <= 25000; tick++) stability.observe({ tick, lots: 8, victory: true, fullService: true });
  assert.equal(stability.report().sustainedTicks, 0);
  for (let tick = 25001; tick <= 49000; tick++) stability.observe({ tick, lots: 24, victory: true, fullService: true });
  assert.equal(stability.report().complete, true);
  stability.observe({ tick: 49001, lots: 24, victory: true, fullService: false });
  assert.equal(stability.report().sustainedTicks, 0);
});

function overloadedWell() {
  const state = structuredClone(DEFAULT_GAME_STATE);
  const house = state.houses[0];
  const home = state.buildings.find(building => building.kind === "house");
  const well = state.buildings.find(building => building.kind === "well");
  assert.ok(house && home && well);
  state.houses = Array.from({ length: 13 }, (_, index) => ({ ...house, buildingId: `home-${index}` }));
  state.buildings = [well, ...state.houses.map(item => ({ ...home, id: item.buildingId }))];
  return { state, well };
}

test("capacity denial changing to missing remains unresolved until the affected home is served", () => {
  const { state, well } = overloadedWell();
  const observer = createGrowthObservations();
  observer.observe(state);
  observer.observe({ ...state, tick: 1, buildings: state.buildings.filter(building => building.id !== well.id) });
  assert.equal(observer.report().episodes[0]?.endedTick, 1);
  assert.equal(observer.report().episodes[0]?.recoveredTick, null);
  assert.equal(observer.report().unresolvedCapacityEpisodes, 1);
  observer.observe({ ...state, tick: 2, buildings: [...state.buildings, { ...well, id: "second-well" }] });
  assert.equal(observer.report().episodes[0]?.recoveredTick, 2);
  assert.equal(observer.report().unresolvedCapacityEpisodes, 0);
});

test("removing a denied house cannot be reported as service recovery", () => {
  const { state } = overloadedWell();
  const observer = createGrowthObservations();
  observer.observe(state);
  const deniedId = observer.report().episodes[0]?.affectedHouseIds[0];
  assert.ok(deniedId);
  observer.observe({ ...state, tick: 1, houses: state.houses.filter(house => house.buildingId !== deniedId),
    buildings: state.buildings.filter(building => building.id !== deniedId) });
  assert.equal(observer.report().episodes[0]?.endedTick, 1);
  assert.equal(observer.report().unresolvedCapacityEpisodes, 1);
});

test("capacity recovery summary reports unobserved, unrecovered, and recovered episodes outside acceptance", async () => {
  const { summarizeCapacityRecovery } = await import("../scripts/phase19NaturalGrowth");
  const unobserved = createGrowthObservations();
  unobserved.observe(DEFAULT_GAME_STATE);
  assert.deepEqual(summarizeCapacityRecovery(unobserved.report()), {
    capacityEpisodeObserved: false,
    capacityRecovered: false,
  });

  const { state, well } = overloadedWell();
  const unrecovered = createGrowthObservations();
  unrecovered.observe(state);
  assert.deepEqual(summarizeCapacityRecovery(unrecovered.report()), {
    capacityEpisodeObserved: true,
    capacityRecovered: false,
  });

  const recovered = createGrowthObservations();
  recovered.observe(state);
  recovered.observe({ ...state, tick: 1, buildings: state.buildings.filter(building => building.id !== well.id) });
  recovered.observe({ ...state, tick: 2, buildings: [...state.buildings, { ...well, id: "second-well" }] });
  assert.deepEqual(summarizeCapacityRecovery(recovered.report()), {
    capacityEpisodeObserved: true,
    capacityRecovered: true,
  });
});

test("approved translated seed two is explicitly labeled as a verification fixture", async () => {
  const { runPhase19NaturalGrowth } = await import("../scripts/phase19NaturalGrowth");
  const report = runPhase19NaturalGrowth({ targetLots: 24, maxTicks: 1, seed: 2 });
  assert.equal(report.seed, 2);
  assert.equal(report.opening.mode, "translated-verification-fixture");
  assert.equal(report.opening.productSeedFeature, false);
  assert.deepEqual(report.opening.offset, { tx: 0, ty: -3 });
  assert.equal(report.acceptance.targetReached, false);
});

test("stage zero preflight blocks a state with no legal quarryable rock source", async () => {
  const { terrainResourcePreflight } = await import("../scripts/phase19NaturalGrowth");
  const noRockState: GameState = {
    ...structuredClone(DEFAULT_GAME_STATE),
    seed: 2,
    tiles: DEFAULT_GAME_STATE.tiles.map((tile) => ({
      ...tile,
      terrain: tile.terrain === "water" ? "water" : "grass",
    })),
  };
  const report = terrainResourcePreflight(noRockState);

  assert.deepEqual(report, {
    rockTiles: 0,
    legalQuarryFootprints: 0,
    legalQuarryFootprintsInterpretation: "diagnostic-only current placement count; zero can be caused by occupied or blocked footprints and does not by itself prove stone is impossible",
    quarryEra: "palisade",
    stoneSource: "quarry requires adjacent rock; market does not import stone",
    failures: ["seed 2 has no rock terrain; stone-town victory cannot be claimed because quarry is the only raw stone source"],
  });
});

test("stage zero preflight treats zero legal quarry footprints as diagnostic when rock exists", async () => {
  const { terrainResourcePreflight } = await import("../scripts/phase19NaturalGrowth");
  const occupiedRockState: GameState = {
    ...structuredClone(DEFAULT_GAME_STATE),
    seed: 99,
    tiles: DEFAULT_GAME_STATE.tiles.map((tile, index) => ({
      ...tile,
      terrain: index === 0 ? "rock" : "grass",
      hasRoad: true,
    })),
  };
  const report = terrainResourcePreflight(occupiedRockState);
  assert.equal(report.rockTiles, 1);
  assert.equal(report.legalQuarryFootprints, 0);
  assert.match(report.legalQuarryFootprintsInterpretation, /diagnostic-only/);
  assert.deepEqual(report.failures, []);
});

test("stage zero acceptance excludes optional capacity episodes from required gates", async () => {
  const { runPhase19NaturalGrowth } = await import("../scripts/phase19NaturalGrowth");
  const report = runPhase19NaturalGrowth({ targetLots: 24, maxTicks: 1, seed: 1 });
  assert.equal(Object.hasOwn(report.acceptance, "capacityObserved"), false);
  assert.equal(Object.hasOwn(report.acceptance, "capacityRecovered"), false);
  assert.equal(report.capacityEpisodeObserved, false);
  assert.equal(report.capacityRecovered, false);
});

test("CLI exits nonzero when the stage zero acceptance gates are unmet", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join, resolve } = await import("node:path");
  const { spawnSync } = await import("node:child_process");
  const out = mkdtempSync(join(tmpdir(), "growth-unmet-"));
  try {
    const run = spawnSync(process.execPath, ["--import", "tsx", resolve("scripts/phase19NaturalGrowth.ts"), "24", "1", out, "1"], { encoding: "utf8" });
    assert.equal(run.status, 1);
    assert.match(run.stdout, /"status": "acceptance-unmet"/);
  } finally {
    rmSync(out, { recursive: true });
  }
});
