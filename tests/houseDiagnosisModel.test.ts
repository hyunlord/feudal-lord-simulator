import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import { houseDiagnosisModel } from "../src/ui/houseDiagnosisModel";
import type { TileCoordinate } from "../src/world/grid";
import type { Tile } from "../src/world/world.types";

function building(
  id: string,
  kind: Building["kind"],
  tx: number,
  ty: number,
  bread = 0,
): Building {
  return {
    id,
    kind,
    tx,
    ty,
    workers: 0,
    inventory: bread > 0 ? { bread } : {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function house(input: Partial<House> = {}): House {
  return {
    buildingId: "house",
    level: 1,
    residents: 6,
    hasWater: false,
    breadStock: 0,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
    ...input,
  };
}

function state(input: {
  readonly house?: House;
  readonly extraBuildings?: readonly Building[];
  readonly roads?: readonly TileCoordinate[];
} = {}): GameState {
  const roads = input.roads ?? [];
  const tiles: Tile[] = Array.from({ length: 60 }, (_unused, index) => {
    const tx = index % 10;
    const ty = Math.floor(index / 10);
    return {
      tx,
      ty,
      terrain: "grass",
      buildingId: null,
      hasRoad: roads.some((road) => road.tx === tx && road.ty === ty),
    };
  });
  const home = building("house", "house", 1, 2);
  const household = input.house ?? house();
  return {
    tick: 350,
    seed: 1,
    tiles,
    width: 10,
    height: 6,
    buildings: [home, ...(input.extraBuildings ?? [])],
    constructionSites: [],
    wallTick: 0,
    nextConstructionOrdinal: 1,
    houses: [household],
    walkers: [],
    population: household.residents,
    idleWorkers: 0,
    treasuryTimber: 0,
    roadRevision: 0,
    pathCache: {},
  };
}

function diagnose(input: GameState) {
  const before = structuredClone(input);
  const model = houseDiagnosisModel(input, "house");
  assert.deepEqual(input, before);
  assert.ok(model !== null);
  return model;
}

test("house diagnosis reports bread already held by the household", () => {
  // Given
  const input = state({ house: house({ breadStock: 2 }) });

  // When
  const model = diagnose(input);

  // Then
  assert.equal(model.bread.kind, "supplied");
  assert.equal(model.bread.label, "빵이 있습니다");
});

test("house diagnosis reports a missing granary before route causes", () => {
  // Given
  const input = state();

  // When
  const model = diagnose(input);

  // Then
  assert.equal(model.bread.kind, "no_granary");
  assert.equal(model.bread.label, "곡창이 없습니다");
});

test("house diagnosis reports empty granaries before route causes", () => {
  // Given
  const input = state({ extraBuildings: [building("granary", "granary", 5, 1)] });

  // When
  const model = diagnose(input);

  // Then
  assert.equal(model.bread.kind, "granary_empty");
  assert.equal(model.bread.label, "곡창에 빵이 없습니다 — 방앗간 확인");
});

test("house diagnosis reports a disconnected road component", () => {
  // Given
  const input = state({
    extraBuildings: [building("granary", "granary", 5, 1, 8)],
    roads: [{ tx: 2, ty: 2 }, { tx: 4, ty: 1 }],
  });

  // When
  const model = diagnose(input);

  // Then
  assert.equal(model.bread.kind, "road_disconnected");
  assert.equal(model.bread.label, "곡창에서 이 집까지 도로가 이어지지 않음");
});

test("house diagnosis reports an unserviced connected household", () => {
  // Given
  const input = state({
    extraBuildings: [building("granary", "granary", 5, 1, 8)],
    roads: [{ tx: 2, ty: 2 }, { tx: 3, ty: 2 }, { tx: 4, ty: 2 }],
  });

  // When
  const model = diagnose(input);

  // Then
  assert.equal(model.bread.kind, "not_visited");
  assert.equal(
    model.bread.label,
    "배급자가 이 집을 지나가지 않음 — 경로가 멀거나 순회 범위 밖",
  );
});

test("house diagnosis reports active well service", () => {
  // Given
  const input = state({
    house: house({ hasWater: true }),
    extraBuildings: [building("well", "well", 3, 2)],
  });

  // When
  const model = diagnose(input);

  // Then
  assert.equal(model.water.kind, "supplied");
  assert.equal(model.water.distance, 2);
  assert.equal(model.water.label, "우물에서 2칸");
});

test("house diagnosis reports that no well exists", () => {
  // Given
  const input = state();

  // When
  const model = diagnose(input);

  // Then
  assert.equal(model.water.kind, "no_well");
  assert.equal(model.water.label, "우물이 없습니다");
});

test("house diagnosis reports the nearest out-of-range well distance", () => {
  // Given
  const input = state({
    extraBuildings: [
      building("well-near", "well", 9, 2),
      building("well-far", "well", 9, 5),
    ],
  });

  // When
  const model = diagnose(input);

  // Then
  assert.equal(model.water.kind, "well_too_far");
  assert.equal(model.water.distance, 8);
  assert.equal(model.water.label, "우물이 너무 멉니다 — 거리 8 / 범위 6");
});

test("house diagnosis names starvation as the active population decline", () => {
  // Given
  const input = state({ house: house({ hasWater: true, lastServicedTick: 20 }) });

  // When
  const model = diagnose(input);

  // Then
  assert.equal(model.population.kind, "declining");
  assert.equal(model.population.label, "감소 중 — 식량 없음, 330틱 경과");
});

test("house diagnosis distinguishes water-blocked growth from active decline", () => {
  // Given
  const input = state({ house: house({ hasWater: false, lastServicedTick: 300 }) });

  // When
  const model = diagnose(input);

  // Then
  assert.equal(model.population.kind, "growth_blocked");
  assert.equal(model.population.label, "성장 정체 — 물 부족");
});
