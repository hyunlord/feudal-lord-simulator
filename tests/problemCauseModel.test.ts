import assert from "node:assert/strict";
import test from "node:test";

import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { buildingProblemCause } from "../src/ui/problemCauseModel";

function building(id: string, kind: Building["kind"], workers: number): Building {
  return {
    id, kind, tx: 0, ty: 0, workers, inventory: {}, reserved: {}, stockReserved: {},
    productionProgress: 0,
  };
}

function state(target: Building, patch: Partial<GameState> = {}): GameState {
  const definition = BUILDING_CONFIG_BY_KIND[target.kind];
  const access = { tx: target.tx, ty: target.ty + definition.height };
  const width = patch.width ?? Math.max(6, access.tx + 1);
  const height = patch.height ?? Math.max(5, access.ty + 1);
  const tiles = patch.tiles ?? Array.from({ length: width * height }, (_unused, index) => {
    const tx = index % width;
    const ty = Math.floor(index / width);
    return {
      tx,
      ty,
      terrain: "grass" as const,
      buildingId: tx === target.tx && ty === target.ty ? target.id : null,
      hasRoad: tx === access.tx && ty === access.ty,
    };
  });
  const base: GameState = {
    tick: 0, seed: 1, width, height,
    tiles,
    buildings: [target], houses: [], walkers: [], population: 0, idleWorkers: 0,
    treasuryTimber: 0, constructionSites: [], wallTick: 0,
    era: "hamlet", eraProclaimedTick: null, palisade: null, nextConstructionOrdinal: 1,
    roadRevision: 0, pathCache: {}, forestHarvests: [],
    treasuryCoin: 0,
  };
  return {
    ...base,
    ...patch,
    width,
    height,
    tiles,
    treasuryCoin: patch.treasuryCoin ?? base.treasuryCoin,
  };
}

function connectedState(target: Building, storage: Building): GameState {
  const width = 8;
  const height = 4;
  const roadKeys = new Set(["0,1", "1,1", "2,1", "3,1", "0,2", "1,2", "2,2", "3,2", "4,2"]);
  return state(target, {
    width,
    height,
    buildings: [target, storage],
    tiles: Array.from({ length: width * height }, (_unused, index) => {
      const tx = index % width;
      const ty = Math.floor(index / width);
      return {
        tx,
        ty,
        terrain: "grass" as const,
        buildingId: null,
        hasRoad: roadKeys.has(`${tx},${ty}`),
      };
    }),
  });
}

test("labour cause distinguishes no available labour from a disconnected idle pool", () => {
  const mill = building("mill", "mill", 0);
  assert.equal(buildingProblemCause(state(mill), mill.id), "가용 일꾼이 없습니다");
  assert.equal(
    buildingProblemCause(state(mill, { idleWorkers: 3 }), mill.id),
    "유휴 일꾼 3명 — 도로 연결 확인",
  );
});

test("input cause distinguishes empty supply from an unreachable supply", () => {
  const mill = building("mill", "mill", 2);
  assert.equal(buildingProblemCause(state(mill), mill.id), "곡창에 밀 재고가 없습니다");
  const granary = { ...building("granary", "granary", 2), tx: 2, inventory: { wheat: 8 } };
  assert.equal(
    buildingProblemCause(state(mill, { buildings: [mill, granary] }), mill.id),
    "곡창까지 경로가 없습니다 — 밀 공급 불가",
  );
});

test("input cause names a connected supply that is waiting for transport", () => {
  // Given
  const mill = building("mill", "mill", 2);
  const granary = {
    ...building("granary", "granary", 2),
    tx: 4,
    inventory: { wheat: 8 },
  };

  // When / Then
  assert.equal(
    buildingProblemCause(connectedState(mill, granary), mill.id),
    "곡창에서 밀 운반을 기다리는 중",
  );
});

test("completed production names the missing destination store", () => {
  const farm = {
    ...building("farm", "wheat_farm", 4),
    inventory: { wheat: 20 },
    productionProgress: 40,
  };
  assert.equal(buildingProblemCause(state(farm), farm.id), "운반인이 가져갈 곡창이 없습니다");
});

test("completed production distinguishes full disconnected and waiting destinations", () => {
  // Given
  const farm = {
    ...building("farm", "wheat_farm", 4),
    inventory: { wheat: 20 },
    productionProgress: 40,
  };
  const openGranary = { ...building("granary", "granary", 2), tx: 4 };
  const fullGranary = {
    ...openGranary,
    inventory: { wheat: 200 },
  };

  // When / Then
  assert.equal(
    buildingProblemCause(state(farm, { buildings: [farm, fullGranary] }), farm.id),
    "모든 곡창이 가득 찼습니다",
  );
  assert.equal(
    buildingProblemCause(state(farm, { buildings: [farm, openGranary] }), farm.id),
    "곡창까지 경로가 없습니다 — 밀 운반 불가",
  );
  assert.equal(
    buildingProblemCause(connectedState(farm, openGranary), farm.id),
    "운반인이 곡창으로 옮기기를 기다리는 중",
  );
});
