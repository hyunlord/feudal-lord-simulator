import assert from "node:assert/strict";
import test from "node:test";

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
  return {
    tick: 0, seed: 1, width: 1, height: 1,
    tiles: [{ tx: 0, ty: 0, terrain: "grass", buildingId: target.id, hasRoad: false }],
    buildings: [target], houses: [], walkers: [], population: 0, idleWorkers: 0,
    treasuryTimber: 0, roadRevision: 0, pathCache: {}, ...patch,
  };
}

test("labour cause distinguishes no available labour from a disconnected idle pool", () => {
  const mill = building("mill", "mill", 0);
  assert.equal(buildingProblemCause(state(mill), mill.id), "가용 일꾼이 없습니다");
  assert.equal(
    buildingProblemCause(state(mill, { idleWorkers: 3 }), mill.id),
    "일꾼이 있지만 이 건물까지 도로가 이어지지 않음",
  );
});

test("input cause distinguishes empty supply from an unreachable supply", () => {
  const mill = building("mill", "mill", 2);
  assert.equal(buildingProblemCause(state(mill), mill.id), "필요한 밀 재고가 없습니다");
  const granary = { ...building("granary", "granary", 2), tx: 2, inventory: { wheat: 8 } };
  assert.equal(
    buildingProblemCause(state(mill, { buildings: [mill, granary] }), mill.id),
    "밀 보관소와 도로가 이어지지 않음",
  );
});

test("completed production reports its exact full local output storage", () => {
  const farm = {
    ...building("farm", "wheat_farm", 4),
    inventory: { wheat: 20 },
    productionProgress: 40,
  };
  assert.equal(buildingProblemCause(state(farm), farm.id), "생산품 저장 공간이 가득 찼습니다");
});
