import assert from "node:assert/strict";
import test from "node:test";

import type {
  BuilderWalker,
  CarterCancellationReason,
  CarterWalker,
  DistributorWalker,
} from "../src/agents/walker.types";
import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import {
  carterCancellationLabel,
  walkerDiagnosisModel,
} from "../src/ui/walkerDiagnosisModel";
import type { Tile } from "../src/world/world.types";

function building(id: string, kind: Building["kind"], tx: number, ty: number): Building {
  return {
    id,
    kind,
    tx,
    ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function carter(reason: CarterCancellationReason | null = null): CarterWalker {
  return {
    id: "carter",
    kind: "carter",
    homeBuildingId: "camp",
    destination: { kind: "building", buildingId: "store" },
    mission: "deliver",
    phase: "outbound",
    position: { tx: 0.5, ty: 0 },
    path: [
      { tx: 0, ty: 0 },
      { tx: 1, ty: 0 },
      { tx: 2, ty: 0 },
      { tx: 2, ty: 1 },
    ],
    pathIndex: 0,
    previousTile: null,
    cargo: { resource: "logs", amount: 4 },
    spawnedTick: 20,
    reservation: {
      destination: { kind: "building", buildingId: "store" },
      resource: "logs",
      amount: 4,
      sourceStockClaim: null,
      homeCapacityClaim: null,
    },
    cancellation: reason === null
      ? null
      : { tick: 40, reason, releasedReservation: true },
  };
}

function distributor(): DistributorWalker {
  return {
    id: "distributor",
    kind: "distributor",
    homeBuildingId: "granary",
    phase: "returning",
    position: { tx: 3, ty: 2.5 },
    path: [{ tx: 3, ty: 3 }, { tx: 3, ty: 2 }, { tx: 2, ty: 2 }],
    pathIndex: 0,
    previousTile: { tx: 3, ty: 3 },
    cargo: { resource: "bread", amount: 2 },
    spawnedTick: 30,
    junctionVisits: 7,
    tilesTravelled: 18,
    priorTile: { tx: 3, ty: 3 },
  };
}

function builder(): BuilderWalker {
  return {
    id: "builder:construction-site-000001:0",
    kind: "builder",
    homeBuildingId: "construction-site-000001",
    siteId: "construction-site-000001",
    slotIndex: 0,
    position: { tx: 2.25, ty: 2.25 },
    path: [],
    pathIndex: 0,
    previousTile: null,
    cargo: null,
    spawnedTick: 0,
  };
}

function gameState(walkers: GameState["walkers"]): GameState {
  const tiles: Tile[] = Array.from({ length: 36 }, (_unused, index) => ({
    tx: index % 6,
    ty: Math.floor(index / 6),
    terrain: "grass",
    buildingId: null,
    hasRoad: true,
  }));
  return {
    tick: 50,
    seed: 1,
    tiles,
    width: 6,
    height: 6,
    buildings: [
      building("camp", "logging_camp", 0, 1),
      building("store", "storehouse", 2, 2),
      building("granary", "granary", 2, 3),
      building("house-near", "house", 1, 1),
      building("house-far", "house", 5, 5),
    ],
    constructionSites: [],
    wallTick: 0,
    nextConstructionOrdinal: 1,
    houses: [
      {
        buildingId: "house-near",
        level: 0,
        residents: 1,
        hasWater: false,
        breadStock: 0,
        lastServicedTick: 0,
        unmetRequirementTicks: 0,
      },
      {
        buildingId: "house-far",
        level: 0,
        residents: 1,
        hasWater: false,
        breadStock: 0,
        lastServicedTick: 0,
        unmetRequirementTicks: 0,
      },
    ],
    walkers,
    population: 2,
    idleWorkers: 0,
    treasuryTimber: 0,
    roadRevision: 0,
    pathCache: {},
  };
}

test("Carter diagnosis reports its real mission route cargo and ETA", () => {
  // Given
  const input = gameState([carter()]);

  // When
  const model = walkerDiagnosisModel(input, "carter");

  // Then
  assert.ok(model !== null);
  assert.equal(model.roleLabel, "운반인");
  assert.equal(model.cargoLabel, "통나무 4");
  assert.equal(model.sourceLabel, "벌목소");
  assert.equal(model.destinationLabel, "창고");
  assert.equal(model.statusLabel, "배송 중");
  assert.equal(model.remainingDistance, 2.5);
  assert.equal(model.etaTicks, 32);
  assert.equal(model.housesPassed, 1);
});

test("Distributor diagnosis reports roaming facts without inventing a fixed destination", () => {
  // Given
  const input = gameState([distributor()]);

  // When
  const model = walkerDiagnosisModel(input, "distributor");

  // Then
  assert.ok(model !== null);
  assert.equal(model.roleLabel, "배급자");
  assert.equal(model.cargoLabel, "빵 2");
  assert.equal(model.sourceLabel, "곡창");
  assert.equal(model.destinationLabel, "홈 곡창");
  assert.equal(model.statusLabel, "곡창으로 귀환 중");
  assert.equal(model.tilesTravelled, 18);
});

test("Carter cancellation reasons have exact distinct Korean labels", () => {
  // Given
  const reasons = [
    "destination_unavailable",
    "manual",
    "road_removed",
    "source_unavailable",
  ] as const satisfies readonly CarterCancellationReason[];

  // When
  const labels = reasons.map(carterCancellationLabel);

  // Then
  assert.deepEqual(labels, [
    "목적지를 이용할 수 없음",
    "수동 취소",
    "도로가 끊김",
    "출발지 재고를 이용할 수 없음",
  ]);
  assert.equal(new Set(labels).size, reasons.length);
});

test("Carter diagnosis exposes its existing cancellation instead of a generic status", () => {
  // Given
  const input = gameState([carter("road_removed")]);

  // When
  const model = walkerDiagnosisModel(input, "carter");

  // Then
  assert.ok(model !== null);
  assert.equal(model.cancellationLabel, "도로가 끊김");
  assert.equal(model.statusLabel, "배송 취소");
});

test("Builder walkers are excluded from walker diagnosis cards", () => {
  // Given
  const input = gameState([builder()]);

  // When / Then
  assert.equal(walkerDiagnosisModel(input, "builder:construction-site-000001:0"), null);
});
