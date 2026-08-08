import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import type { PalisadeState } from "../src/engine/engine.types";
import { updateHousing } from "../src/population/housing";
import type { House } from "../src/population/population.types";
import { houseDiagnosisModel } from "../src/ui/houseDiagnosisModel";
import type { PalisadePath } from "../src/world/palisadeGeometry";
import type { GameState } from "../src/engine/engine.types";
import type { Tile } from "../src/world/world.types";

const WALL_PATH: PalisadePath = [
  { x: 0, y: 0 },
  { x: 16, y: 0 },
  { x: 16, y: 16 },
  { x: 0, y: 16 },
  { x: 0, y: 0 },
];

function building(
  id: string,
  kind: Building["kind"],
  tx: number,
  ty: number,
): Building {
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

function house(input: Partial<House> = {}): House {
  return {
    buildingId: "home",
    level: 3,
    residents: 22,
    hasWater: true,
    breadStock: 1,
    lastServicedTick: 10,
    unmetRequirementTicks: 0,
    ...input,
  };
}

function palisade(completed = true): PalisadeState {
  return {
    id: "stone-wall",
    polygon: WALL_PATH,
    gate: { x: 8, y: 0 },
    segments: [
      {
        id: "stone-wall-segment",
        order: 0,
        edgePath: WALL_PATH,
        tileCount: 64,
        completed,
        constructionSiteId: completed ? null : "stone-wall-segment-site",
        material: "stone",
      },
    ],
  };
}

function levelFourBuildings(overrides: {
  readonly home?: Building;
  readonly omit?: readonly ("well" | "granary" | "market" | "church")[];
} = {}): readonly Building[] {
  const home = overrides.home ?? building("home", "house", 4, 4);
  const omitted = new Set(overrides.omit ?? []);
  const candidates = [
    home,
    building("well", "well", 4, 5),
    building("granary", "granary", 4, 6),
    building("market", "market", 8, 4),
    building("church", "church", 2, 14),
  ];
  return candidates.filter((candidate) => !omitted.has(candidate.kind as "well" | "granary" | "market" | "church"));
}

function state(input: {
  readonly buildings?: readonly Building[];
  readonly household?: House;
  readonly palisade?: PalisadeState | null;
} = {}): GameState {
  const width = 24;
  const height = 24;
  const household = input.household ?? house();
  const buildings = input.buildings ?? levelFourBuildings();
  return {
    tick: 10,
    seed: 1,
    width,
    height,
    tiles: Array.from({ length: width * height }, (_unused, index): Tile => ({
      tx: index % width,
      ty: Math.floor(index / width),
      terrain: "grass",
      buildingId: null,
      hasRoad: false,
    })),
    buildings: [...buildings],
    constructionSites: [],
    wallTick: 0,
    era: "stone_town",
    eraProclaimedTick: 0,
    palisade: input.palisade === undefined ? palisade() : input.palisade,
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

test("Given all Stone Town services and completed enclosure When housing updates Then the home reaches level four with capacity thirty-two", () => {
  // Given
  const input = house({ residents: 31 });

  // When
  const result = updateHousing([input], levelFourBuildings(), 50, palisade());

  // Then
  assert.equal(result.houses[0]?.level, 4);
  assert.equal(result.houses[0]?.residents, 32);
  assert.equal(result.population, 32);
});

test("Given each missing level-four gate When housing updates Then the home remains a level-three manor", () => {
  // Given
  const cases = [
    { name: "water", household: house({ hasWater: false }), buildings: levelFourBuildings({ omit: ["well"] }), palisade: palisade() },
    { name: "bread", household: house({ breadStock: 0 }), buildings: levelFourBuildings(), palisade: palisade() },
    { name: "market", household: house(), buildings: levelFourBuildings({ omit: ["market"] }), palisade: palisade() },
    { name: "church", household: house(), buildings: levelFourBuildings({ omit: ["church"] }), palisade: palisade() },
    { name: "completed enclosure", household: house(), buildings: levelFourBuildings(), palisade: palisade(false) },
  ] as const;

  // When / Then
  for (const entry of cases) {
    const result = updateHousing([entry.household], entry.buildings, 10, entry.palisade);
    assert.equal(result.houses[0]?.level, 3, entry.name);
  }
});

test("Given a home on the completed wall edge When all services are present Then on-edge counts protected for level four", () => {
  // Given
  const onEdge = building("home", "house", 0, 4);

  // When
  const result = updateHousing([house()], levelFourBuildings({ home: onEdge }), 10, palisade());

  // Then
  assert.equal(result.houses[0]?.level, 4);
});

test("Given a home outside the completed wall When all services are present Then it cannot reach level four but existing level three survives", () => {
  // Given
  const outside = building("home", "house", 18, 4);

  // When
  const result = updateHousing([house()], levelFourBuildings({ home: outside }), 10, palisade());

  // Then
  assert.equal(result.houses[0]?.level, 3);
});

test("Given Stone Town gates When diagnosing a house Then exact Korean level-four blocker labels are reported without mutating state", () => {
  // Given
  const blocked = state({
    household: house({ hasWater: false, breadStock: 0 }),
    buildings: levelFourBuildings({ omit: ["market", "church"] }),
    palisade: null,
  });
  const ready = state({ household: house({ level: 4 }) });
  const before = structuredClone(blocked);

  // When
  const blockedModel = houseDiagnosisModel(blocked, "home");
  const readyModel = houseDiagnosisModel(ready, "home");

  // Then
  assert.deepEqual(blocked, before);
  assert.deepEqual(blockedModel?.stoneHouse.blockers, [
    "물 공급 필요",
    "신선한 빵 필요",
    "시장 범위 8 안 필요",
    "교회 범위 12 안 필요",
    "완성된 성벽 안 필요",
  ]);
  assert.equal(blockedModel?.stoneHouse.label, "석조 연립가옥 불가 — 물 공급 필요 · 신선한 빵 필요 · 시장 범위 8 안 필요 · 교회 범위 12 안 필요 · 완성된 성벽 안 필요");
  assert.equal(readyModel?.stoneHouse.kind, "ready");
  assert.equal(readyModel?.name, "석조 연립가옥");
});
