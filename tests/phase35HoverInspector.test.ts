import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { buildingInspectorModel } from "../src/render/buildingInspectorModel";

function state(building: Building): GameState {
  return {
    tick: 120,
    seed: 3,
    width: 1,
    height: 1,
    tiles: [{ tx: 0, ty: 0, terrain: "grass", buildingId: building.id, hasRoad: false }],
    buildings: [building],
    houses: building.kind === "house" ? [{
      buildingId: building.id,
      level: 2,
      residents: 7,
      hasWater: true,
      breadStock: 0,
      lastServicedTick: 91,
      unmetRequirementTicks: 0,
    }] : [],
    walkers: [],
    population: 7,
    idleWorkers: 0,
    treasuryTimber: 0,
    roadRevision: 0,
    pathCache: {},
  };
}

function building(kind: Building["kind"]): Building {
  return {
    id: `${kind}-a`,
    kind,
    tx: 0,
    ty: 0,
    workers: 2,
    inventory: { wheat: 4, bread: 1 },
    reserved: {},
    stockReserved: {},
    productionProgress: 12,
  };
}

test("house inspector exposes Korean identity and service state", () => {
  const home = building("house");
  const model = buildingInspectorModel(state(home), home.id);

  assert.equal(model?.name, "시민가옥");
  assert.equal(model?.purpose, "주민이 생활하고 성장하는 집");
  assert.deepEqual(model?.rows, [
    "등급 2 · 주민 7명",
    "물 있음",
    "마지막 빵 29틱 전",
  ]);
});

test("production inspector exposes workers stock and progress", () => {
  const mill = building("mill");
  const model = buildingInspectorModel(state(mill), mill.id);

  assert.equal(model?.name, "방앗간");
  assert.equal(model?.purpose, "밀을 빵으로 가공");
  assert.deepEqual(model?.rows, [
    "일꾼 2/2",
    "재고 밀 4 · 빵 1",
    "생산 12/30",
  ]);
});

test("never-served houses do not pretend bread arrived on the current tick", () => {
  const home = building("house");
  const initial = state(home);
  const model = buildingInspectorModel({
    ...initial,
    houses: initial.houses.map((house) => ({ ...house, lastServicedTick: 0 })),
  }, home.id);

  assert.equal(model?.rows.at(-1), "빵 배급 전");
});

test("production inspector appends the exact marked problem cause", () => {
  const mill = { ...building("mill"), workers: 0 };
  const model = buildingInspectorModel(state(mill), mill.id);
  assert.equal(model?.rows.at(-1), "원인: 가용 일꾼이 없습니다");
});
