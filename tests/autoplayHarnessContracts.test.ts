import assert from "node:assert/strict";
import test from "node:test";

import type { TilePos } from "../src/agents/walker.types";
import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import { decideNextAction } from "../src/engine/autoplay";
import type { AutoplayAction } from "../src/engine/autoplay.types";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import type { Tile } from "../src/world/world.types";
import { formatEconomyHarnessReport, runMainEconomyHarness } from "../scripts/economyHarness";
import { trackAutoplayRun } from "../scripts/economyHarnessAutoplay";

function building(input: {
  readonly id: string;
  readonly kind: BuildingKind;
  readonly tx: number;
  readonly ty: number;
  readonly inventory?: Partial<Record<ResourceType, number>>;
  readonly workers?: number;
}): Building {
  return {
    id: input.id,
    kind: input.kind,
    tx: input.tx,
    ty: input.ty,
    workers: input.workers ?? 0,
    inventory: input.inventory ?? {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function house(buildingId: string, patch: Partial<House> = {}): House {
  return {
    buildingId,
    level: 0,
    residents: 4,
    hasWater: false,
    breadStock: 0,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
    ...patch,
  };
}

function tiles(buildings: readonly Building[], roads: readonly string[] = ["1,5", "2,5", "3,5"]): Tile[] {
  return Array.from({ length: 12 * 12 }, (_unused, index): Tile => {
    const tx = index % 12;
    const ty = Math.floor(index / 12);
    const owner = buildings.find((candidate) => {
      const definition = BUILDING_CONFIG_BY_KIND[candidate.kind];
      return tx >= candidate.tx &&
        tx < candidate.tx + definition.width &&
        ty >= candidate.ty &&
        ty < candidate.ty + definition.height;
    });
    return {
      tx,
      ty,
      terrain: tx === 0 ? "forest" : "grass",
      buildingId: owner?.id ?? null,
      hasRoad: roads.includes(`${tx},${ty}`),
    };
  });
}

function state(input: {
  readonly buildings: readonly Building[];
  readonly houses?: readonly House[];
  readonly roads?: readonly string[];
  readonly population?: number;
  readonly idleWorkers?: number;
  readonly timber?: number;
}): GameState {
  const houses = input.houses ?? [];
  return {
    tick: 0,
    seed: 1,
    width: 12,
    height: 12,
    tiles: tiles(input.buildings, input.roads),
    buildings: [...input.buildings],
    constructionSites: [],
    houses: [...houses],
    walkers: [],
    population: input.population ?? houses.reduce((total, candidate) => total + candidate.residents, 0),
    idleWorkers: input.idleWorkers ?? 0,
    treasuryTimber: input.timber ?? 500,
    treasuryCoin: 0,
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    forestHarvests: [],
    nextConstructionOrdinal: 1,
    roadRevision: 1,
    pathCache: {},
  };
}

test("Given the main balance harness consumer When it runs Then shared autoplay advice is deterministic without changing fourteen metrics", () => {
  const report = runMainEconomyHarness([]);

  assert.equal(report.metrics.length, 14);
  assert.equal(report.autoplay.hashA, report.autoplay.hashB);
  assert.equal(report.autoplay.actionCount > 0, true);
  assert.match(formatEconomyHarnessReport(report), /Autoplay advisor\s+\d+ actions, \S+ == \S+\s+PASS/);
});

test("autoplay road actions expose canonical tile endpoints", () => {
  type RoadAction = Extract<AutoplayAction, { readonly kind: "place_road" }>;
  const from: RoadAction["from"] = { tx: 1, ty: 2 };
  const to: RoadAction["to"] = { tx: 3, ty: 4 };
  const canonicalEndpoints: readonly TilePos[] = [from, to];

  assert.deepEqual(canonicalEndpoints, [{ tx: 1, ty: 2 }, { tx: 3, ty: 4 }]);
});

test("Given the economy harness When autoplay runs Then it uses the same advisor decisions without duplicate scripted logic", () => {
  const base = state({ buildings: [building({ id: "house-a", kind: "house", tx: 5, ty: 5 })], houses: [house("house-a")] });
  const report = trackAutoplayRun({ initialState: base, ticks: 240 });

  assert.equal(report.appliedActions.length > 0, true);
  assert.deepEqual(report.appliedActions[0]?.advisorAction, decideNextAction(base));
});

test("Given the default opening When autoplay runs for ten minutes Then its food chain completes and the settlement survives", () => {
  const report = trackAutoplayRun({ initialState: DEFAULT_GAME_STATE, ticks: 12_000 });
  const foodKinds = new Set(report.finalState.buildings.map(({ kind }) => kind));
  const pendingFood = report.finalState.constructionSites.filter((site) =>
    "tx" in site && (site.kind === "wheat_farm" || site.kind === "mill"),
  );

  assert.equal(foodKinds.has("wheat_farm"), true);
  assert.equal(foodKinds.has("mill"), true);
  assert.deepEqual(pendingFood, []);
  assert.equal(report.finalState.population > 0, true);
});
