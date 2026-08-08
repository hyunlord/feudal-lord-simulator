import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import type { GameState, PalisadeState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import type { DistributorRouteHistory } from "../src/ui/distributorRouteHistory";
import { houseDiagnosisModel } from "../src/ui/houseDiagnosisModel";
import type { TileCoordinate } from "../src/world/grid";
import type { PalisadePath } from "../src/world/palisadeGeometry";
import type { Tile } from "../src/world/world.types";

const WALL_PATH: PalisadePath = [
  { x: 0, y: 0 },
  { x: 4, y: 0 },
  { x: 4, y: 4 },
  { x: 0, y: 4 },
  { x: 0, y: 0 },
];

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

function palisade(completed: boolean): PalisadeState {
  return {
    id: "palisade-a",
    polygon: WALL_PATH,
    gate: { x: 2, y: 0 },
    segments: [
      {
        id: "segment-a",
        order: 0,
        edgePath: WALL_PATH,
        tileCount: 16,
        completed,
        constructionSiteId: completed ? null : "palisade-a-segment-000",
      },
    ],
  };
}

function state(input: {
  readonly house?: House;
  readonly home?: Building;
  readonly extraBuildings?: readonly Building[];
  readonly roads?: readonly TileCoordinate[];
  readonly palisade?: PalisadeState | null;
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
  const home = input.home ?? building("house", "house", 1, 2);
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
    era: "hamlet",
    eraProclaimedTick: null,
    palisade: input.palisade ?? null,
    nextConstructionOrdinal: 1,
    houses: [household],
    walkers: [],
    population: household.residents,
    idleWorkers: 0,
    treasuryTimber: 0,
    treasuryCoin: 0,
    roadRevision: 0,
    pathCache: {},
    forestHarvests: [],
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
    "배급자 순회 기록 없음 — 다음 배급 후 다시 확인",
  );
});

test("house diagnosis explains the recent distributor branch and road distance when a connected house is missed", () => {
  // Given
  const input = state({
    extraBuildings: [building("granary", "granary", 5, 1, 8)],
    roads: [{ tx: 2, ty: 2 }, { tx: 3, ty: 2 }, { tx: 4, ty: 2 }],
  });
  const history: DistributorRouteHistory = {
    activeByWalkerId: {},
    routesByGranaryId: {
      granary: [{
        granaryId: "granary",
        startedTick: 120,
        completedTick: 180,
        branchLabel: "동쪽 가지",
        coordinates: [{ tx: 4, ty: 2 }],
        distance: 1,
      }],
    },
  };

  // When
  const model = houseDiagnosisModel(input, "house", history);

  // Then
  assert.ok(model !== null);
  assert.equal(model.bread.kind, "not_visited");
  assert.ok(model.bread.route !== null);
  const route = model.bread.route;
  assert.equal(route.granaryId, "granary");
  assert.equal(route.commonBranchLabel, "동쪽 가지");
  assert.equal(route.houseRoadDistance, 2);
  assert.equal(route.serviceRadius, 40);
  assert.equal(
    model.bread.label,
    "최근 배급 1회 모두 동쪽 가지 선택 — 이 집 도로거리 2 / 순회범위 40",
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

test("house diagnosis reports completed-wall inside protection with exact amenity label", () => {
  // Given
  const input = state({ palisade: palisade(true) });

  // When
  const model = diagnose(input);

  // Then
  assert.equal(model.protection.kind, "inside");
  assert.equal(model.protection.label, "성벽 안 ✅ 편의 +2");
  assert.equal(model.protection.amenityBonus, 2);
});

test("house diagnosis reports completed-wall outside protection with exact cap label", () => {
  // Given
  const input = state({
    home: building("house", "house", 5, 2),
    palisade: palisade(true),
  });

  // When
  const model = diagnose(input);

  // Then
  assert.equal(model.protection.kind, "outside");
  assert.equal(model.protection.label, "성벽 밖 — 3등급 불가");
  assert.equal(model.protection.amenityBonus, 0);
});

test("house diagnosis does not report protection before the wall is complete", () => {
  // Given
  const beforeWall = state();
  const duringWall = state({ palisade: palisade(false) });

  // When
  const beforeModel = diagnose(beforeWall);
  const duringModel = diagnose(duringWall);

  // Then
  assert.equal(beforeModel.protection.kind, "inactive");
  assert.equal(beforeModel.protection.label, "성벽 미완성");
  assert.equal(duringModel.protection.kind, "inactive");
  assert.equal(duringModel.protection.label, "성벽 미완성");
});
