import assert from "node:assert/strict";
import test from "node:test";

import type { CarterWalker, Walker } from "../src/agents/walker.types";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../src/content/buildingConfig";
import { gameReducer } from "../src/state/gameStore";
import type { GameState, RoadPathCache } from "../src/engine/engine.types";
import { placeBuilding, placeRoadLine, removeRoad } from "../src/engine/gameActions";
import { advanceTick } from "../src/engine/tick";
import { buildingInspectorModel } from "../src/render/buildingInspectorModel";
import { resolveRoadRemovalAttempt } from "../src/render/interactions";
import { onboardingWorldGuidanceTargets } from "../src/ui/onboardingWorldGuidance";
import { canPlaceBuilding } from "../src/world/placement";
import type { Tile } from "../src/world/world.types";
import type { House } from "../src/population/population.types";

function building(input: {
  readonly id: string;
  readonly kind: Building["kind"];
  readonly tx: number;
  readonly ty: number;
  readonly workers?: number;
  readonly inventory?: Building["inventory"];
  readonly reserved?: Building["reserved"];
  readonly productionProgress?: number;
}): Building {
  return {
    id: input.id,
    kind: input.kind,
    tx: input.tx,
    ty: input.ty,
    workers: input.workers ?? 0,
    inventory: input.inventory ?? {},
    reserved: input.reserved ?? {},
    stockReserved: {},
    productionProgress: input.productionProgress ?? 0,
  };
}

function state(input: {
  readonly buildings: readonly Building[];
  readonly roads?: readonly [number, number][];
  readonly walkers?: readonly Walker[];
  readonly houses?: readonly House[];
  readonly width?: number;
  readonly height?: number;
  readonly pathCache?: RoadPathCache;
  readonly terrain?: (tx: number, ty: number) => Tile["terrain"];
}): GameState {
  const width = input.width ?? 8;
  const height = input.height ?? 5;
  const roadKeys = new Set(input.roads?.map(([tx, ty]) => `${tx},${ty}`) ?? []);
  return {
    tick: 0,
    seed: 10,
    width,
    height,
    tiles: Array.from({ length: width * height }, (_unused, index): Tile => {
      const tx = index % width;
      const ty = Math.floor(index / width);
      const owner = input.buildings.find((candidate) => candidate.tx === tx && candidate.ty === ty);
      return {
        tx,
        ty,
        terrain: input.terrain?.(tx, ty) ?? "grass",
        buildingId: owner?.id ?? null,
        hasRoad: roadKeys.has(`${tx},${ty}`),
      };
    }),
    buildings: [...input.buildings],
    constructionSites: [],
    wallTick: 0,
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: null,
    nextConstructionOrdinal: 1,
    houses: [...(input.houses ?? [])],
    walkers: [...(input.walkers ?? [])],
    population: input.houses?.reduce((total, house) => total + house.residents, 0) ?? 0,
    idleWorkers: 0,
    treasuryTimber: 200,
    treasuryCoin: 0,
    roadRevision: 4,
    pathCache: input.pathCache ?? {},
    forestHarvests: [],
  };
}

function house(buildingId: string, residents: number): House {
  return {
    buildingId,
    level: 1,
    residents,
    hasWater: true,
    breadStock: 8,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
  };
}

function getBuilding(current: GameState, id: string): Building {
  const found = current.buildings.find((candidate) => candidate.id === id);
  if (found === undefined) throw new RangeError(`Missing building ${id}`);
  return found;
}

function activeCarter(homeBuildingId: string): CarterWalker {
  return {
    id: "carter:camp:9",
    kind: "carter",
    mission: "deliver",
    phase: "outbound",
    homeBuildingId,
    destination: { kind: "building", buildingId: "store" },
    reservation: {
      destination: { kind: "building", buildingId: "store" },
      resource: "logs",
      amount: 8,
      sourceStockClaim: null,
      homeCapacityClaim: { buildingId: homeBuildingId, resource: "logs", amount: 8 },
    },
    position: { tx: 1, ty: 1 },
    path: [{ tx: 1, ty: 1 }, { tx: 2, ty: 1 }],
    pathIndex: 0,
    previousTile: null,
    cargo: { resource: "logs", amount: 8 },
    spawnedTick: 9,
    cancellation: null,
  };
}

test("Given valid terrain without adjacent road When placing a road-required building Then placement succeeds", () => {
  // Given
  const initial = state({
    buildings: [],
    terrain: (tx, ty) => (tx === 3 && ty === 3 ? "forest" : "grass"),
  });

  // When
  const checked = canPlaceBuilding(initial, "logging_camp", 2, 2);
  const placed = placeBuilding(initial, "logging_camp", { tx: 2, ty: 2 });

  // Then
  assert.deepEqual(checked, { ok: true });
  assert.notEqual(placed, initial);
  assert.equal(placed.constructionSites[0]?.kind, "logging_camp");
});

test("Given invalid physical terrain When placing without a road Then hard terrain constraints still fail", () => {
  // Given
  const water = state({ buildings: [], terrain: (tx, ty) => (tx === 2 && ty === 2 ? "water" : "grass") });
  const noForest = state({ buildings: [] });

  // When / Then
  assert.equal(canPlaceBuilding(water, "logging_camp", 2, 2).ok, false);
  assert.equal(canPlaceBuilding(noForest, "logging_camp", 2, 2).ok, false);
  assert.equal(placeBuilding(water, "logging_camp", { tx: 2, ty: 2 }), water);
});

test("Given a roadless completed producer When ticking Then production stays zero and no carter serves it", () => {
  // Given
  const camp = building({
    id: "camp",
    kind: "logging_camp",
    tx: 2,
    ty: 2,
    workers: BUILDING_CONFIG_BY_KIND.logging_camp.workersRequired,
    productionProgress: BUILDING_CONFIG_BY_KIND.logging_camp.production!.ticksPerOutput - 1,
  });
  const store = building({ id: "store", kind: "storehouse", tx: 5, ty: 1, workers: 2 });

  // When
  const next = advanceTick(state({ buildings: [camp, store], roads: [[4, 1], [5, 2]] }));

  // Then
  assert.equal(getBuilding(next, "camp").inventory.logs ?? 0, 0);
  assert.equal(getBuilding(next, "camp").productionProgress, camp.productionProgress);
  assert.equal(next.walkers.some((walker) => walker.kind === "carter" && walker.homeBuildingId === "camp"), false);
  assert.equal(buildingInspectorModel(next, "camp")?.rows.at(-1), "원인: 🚧 길이 필요합니다");
});

test("Given a roadless producer When a serving road is restored Then production and carter dispatch resume", () => {
  // Given
  const camp = building({
    id: "camp",
    kind: "logging_camp",
    tx: 0,
    ty: 1,
    workers: BUILDING_CONFIG_BY_KIND.logging_camp.workersRequired,
    productionProgress: BUILDING_CONFIG_BY_KIND.logging_camp.production!.ticksPerOutput - 1,
  });
  const store = building({ id: "store", kind: "storehouse", tx: 3, ty: 0, workers: 2 });
  const home = building({ id: "home", kind: "house", tx: 6, ty: 0 });
  const idle = advanceTick(state({
    buildings: [camp, store, home],
    houses: [house(home.id, 12)],
    roads: [[2, 1]],
  }));

  // When
  const restored = advanceTick(placeRoadLine(idle, { tx: 1, ty: 1 }, { tx: 1, ty: 1 }));

  // Then
  assert.equal(getBuilding(restored, "camp").inventory.logs ?? 0, 0);
  assert.equal(restored.walkers.some((walker) => walker.kind === "carter" && walker.homeBuildingId === "camp"), true);
});

test("Given an active route When its serving road is removed Then the building stays and the route cancels safely", () => {
  // Given
  const camp = building({
    id: "camp",
    kind: "logging_camp",
    tx: 0,
    ty: 1,
    workers: BUILDING_CONFIG_BY_KIND.logging_camp.workersRequired,
    inventory: { logs: 12 },
    reserved: { logs: 8 },
  });
  const store = building({ id: "store", kind: "storehouse", tx: 3, ty: 0, workers: 2, reserved: { logs: 8 } });
  const initial = state({
    buildings: [camp, store],
    roads: [[1, 1], [2, 1]],
    walkers: [activeCarter(camp.id)],
    pathCache: { "road:4:camp->store": [{ tx: 1, ty: 1 }, { tx: 2, ty: 1 }] },
  });

  // When
  const removed = removeRoad(initial, { tx: 1, ty: 1 });
  const advanced = advanceTick(removed);

  // Then
  assert.notEqual(removed, initial);
  assert.equal(removed.roadRevision, 5);
  assert.deepEqual(removed.pathCache, {});
  assert.equal(getBuilding(advanced, "camp").id, "camp");
  assert.equal(advanced.tiles.some((tile) => tile.buildingId === "camp"), true);
  assert.equal(getBuilding(advanced, "camp").productionProgress, camp.productionProgress);
  assert.equal(advanced.walkers.some((walker) => walker.kind === "carter" && walker.cancellation?.reason === "road_removed"), true);
});

test("Given malformed road removal input When removing absent or non-road tiles Then state identity is preserved", () => {
  // Given
  const initial = state({ buildings: [], roads: [[1, 1]], pathCache: { stale: [{ tx: 1, ty: 1 }] } });

  // When / Then
  assert.equal(removeRoad(initial, { tx: 9, ty: 9 }), initial);
  assert.equal(removeRoad(initial, { tx: 0, ty: 0 }), initial);
});

test("Given the road tool over an existing road When resolving removal Then it dispatches a bounded road removal", () => {
  // Given
  const initial = state({ buildings: [], roads: [[1, 1]] });

  // When
  const attempt = resolveRoadRemovalAttempt({ state: initial, tile: { tx: 1, ty: 1 }, nowMs: 77 });
  const absent = resolveRoadRemovalAttempt({ state: initial, tile: { tx: 0, ty: 0 }, nowMs: 78 });

  // Then
  assert.deepEqual(attempt.action, { type: "remove_road", tx: 1, ty: 1 });
  assert.equal(attempt.feedback.message, "길을 걷어냈습니다");
  assert.equal(absent.action, null);
  assert.equal(absent.feedback.kind, "failure");
});

test("Given onboarding needs logging camp When forest-adjacent candidates exist Then guidance exposes a region not one fixed point", () => {
  // Given
  const home = building({ id: "house-0-0-0", kind: "house", tx: 0, ty: 0 });
  const initial = state({
    buildings: [home],
    roads: [[1, 0]],
    width: 5,
    height: 5,
    terrain: (tx, ty) => (tx === 3 && ty === 3 ? "forest" : "grass"),
  });

  // When
  const targets = onboardingWorldGuidanceTargets(initial);
  const target = targets[0];

  // Then
  assert.equal(target?.kind, "logging_camp");
  assert.ok(target?.region);
  assert.ok(target.region.length > 1);
  assert.equal(target.region.some((origin) => origin.tx !== target.origin.tx || origin.ty !== target.origin.ty), true);
  assert.equal(target.region.every((origin) => canPlaceBuilding(initial, "logging_camp", origin.tx, origin.ty).ok), true);
});

test("Given reducer receives road removal When the tile is road Then graph state changes without touching buildings", () => {
  // Given
  const camp = building({ id: "camp", kind: "logging_camp", tx: 0, ty: 1, workers: 3 });
  const initial = state({ buildings: [camp], roads: [[1, 1]], pathCache: { stale: [{ tx: 1, ty: 1 }] } });

  // When
  const next = gameReducer(initial, { type: "remove_road", tx: 1, ty: 1 });

  // Then
  assert.equal(next.buildings.length, 1);
  assert.equal(next.tiles.find((tile) => tile.tx === 1 && tile.ty === 1)?.hasRoad, false);
  assert.equal(next.roadRevision, initial.roadRevision + 1);
  assert.deepEqual(next.pathCache, {});
});
