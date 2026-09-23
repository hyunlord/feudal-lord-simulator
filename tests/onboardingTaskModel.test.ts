import assert from "node:assert/strict";
import test from "node:test";

import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import type { Tile } from "../src/world/world.types";
import {
  createOnboardingPresentationState,
  getOnboardingTaskView,
  ONBOARDING_TASKS,
  updateOnboardingPresentationState,
} from "../src/ui/onboardingTaskModel";

const REQUIRED_TITLES = [
  "길을 놓아 오두막을 이으세요",
  "숲 옆에 벌목소를 지으세요",
  "인구 60명을 위해 밀밭 2곳과 방앗간, 곡창을 지으세요",
  "제재소를 지어 목재를 만드세요",
  "길에 연결된 창고를 한 채 더 지으세요",
  "우물과 예배당을 갖추세요",
  "인구를 30명까지 늘리세요",
  "인구를 50명까지 늘리세요",
];

function building(kind: Building["kind"], tx: number, ty: number): Building {
  return {
    id: `${kind}-${tx}-${ty}`,
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

function house(buildingId: string, residents: number): House {
  return {
    buildingId,
    level: 1,
    residents,
    hasWater: false,
    breadStock: 0,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
  };
}

function tile(tx: number, ty: number, hasRoad: boolean): Tile {
  return { tx, ty, terrain: "grass", buildingId: null, hasRoad };
}

function withSettlement(input: {
  readonly buildings?: readonly Building[];
  readonly houses?: readonly House[];
  readonly tiles?: readonly Tile[];
  readonly population?: number;
  readonly width?: number;
  readonly height?: number;
}): GameState {
  return {
    ...DEFAULT_GAME_STATE,
    width: input.width ?? DEFAULT_GAME_STATE.width,
    height: input.height ?? DEFAULT_GAME_STATE.height,
    buildings: [...(input.buildings ?? DEFAULT_GAME_STATE.buildings)],
    houses: [...(input.houses ?? DEFAULT_GAME_STATE.houses)],
    tiles: [...(input.tiles ?? DEFAULT_GAME_STATE.tiles)],
    population: input.population ?? DEFAULT_GAME_STATE.population,
  };
}

test("onboarding tasks expose the exact ordered Phase 5 titles and highlights", () => {
  // Given / When
  const titles = ONBOARDING_TASKS.map((task) => task.title);
  const highlightedTools = ONBOARDING_TASKS.map((task) => task.highlightTools);
  const foodChainHint = ONBOARDING_TASKS[2]?.hint;
  const populationThirtyHint = ONBOARDING_TASKS[6]?.hint;

  // Then
  assert.deepEqual(titles, REQUIRED_TITLES);
  assert.deepEqual(highlightedTools, [
    ["road"],
    ["logging_camp"],
    ["wheat_farm", "mill", "granary"],
    ["sawmill"],
    ["storehouse"],
    ["well", "chapel"],
    ["house"],
    ["house"],
  ]);
  assert.match(foodChainHint ?? "", /밀밭 2곳|밀밭 두 곳/);
  assert.match(populationThirtyHint ?? "", /물과 빵/);
  assert.doesNotMatch(`${foodChainHint} ${populationThirtyHint}`, /5배속|네 채/);
});

test("onboarding task predicates match the ordered first-five-minute settlement milestones", () => {
  // Given
  const startHouse = building("house", 4, 4);
  const baseHouse = house(startHouse.id, 10);
  const base = withSettlement({
    buildings: [startHouse],
    houses: [baseHouse],
    tiles: [tile(4, 4, false)],
  });

  // When / Then
  assert.equal(ONBOARDING_TASKS[0]?.isComplete(base), false);
  assert.equal(
    ONBOARDING_TASKS[0]?.isComplete(
      withSettlement({ buildings: [startHouse], houses: [baseHouse], tiles: [tile(5, 4, true)] }),
    ),
    true,
  );
  assert.equal(
    ONBOARDING_TASKS[0]?.isComplete(
      withSettlement({ buildings: [startHouse], houses: [baseHouse], tiles: [tile(6, 4, true)] }),
    ),
    false,
  );
  assert.equal(
    ONBOARDING_TASKS[1]?.isComplete(
      withSettlement({ buildings: [startHouse, building("logging_camp", 5, 4)] }),
    ),
    true,
  );
  assert.equal(
    ONBOARDING_TASKS[2]?.isComplete(
      withSettlement({ buildings: [startHouse, building("wheat_farm", 6, 4), building("mill", 7, 4), building("granary", 8, 4)] }),
    ),
    false,
  );
  assert.equal(
    ONBOARDING_TASKS[2]?.isComplete(
      withSettlement({ buildings: [startHouse, building("wheat_farm", 6, 4), building("wheat_farm", 9, 4), building("mill", 7, 4), building("granary", 8, 4)] }),
    ),
    true,
  );
  assert.equal(
    ONBOARDING_TASKS[3]?.isComplete(
      withSettlement({ buildings: [startHouse, building("sawmill", 5, 4)] }),
    ),
    true,
  );
  assert.equal(
    ONBOARDING_TASKS[4]?.isComplete(
      withSettlement({ buildings: [startHouse, building("storehouse", 5, 4)] }),
    ),
    false,
  );
  assert.equal(
    ONBOARDING_TASKS[5]?.isComplete(
      withSettlement({ buildings: [startHouse, building("well", 10, 4), building("chapel", 12, 4)], houses: [baseHouse] }),
    ),
    true,
  );
  assert.equal(
    ONBOARDING_TASKS[5]?.isComplete(
      withSettlement({ buildings: [startHouse, building("well", 10, 4)], houses: [baseHouse] }),
    ),
    false,
  );
  assert.equal(
    ONBOARDING_TASKS[5]?.isComplete(
      withSettlement({ buildings: [startHouse, building("well", 11, 4)], houses: [baseHouse] }),
    ),
    false,
  );
  assert.equal(ONBOARDING_TASKS[6]?.isComplete(withSettlement({ population: 30 })), true);
  assert.equal(ONBOARDING_TASKS[7]?.isComplete(withSettlement({ population: 50 })), true);
});

test("storage guidance stays open until a second storehouse joins the timber road network", () => {
  const width = 12;
  const height = 4;
  const buildings = [building("sawmill", 0, 1), building("storehouse", 3, 0)];
  const tiles = Array.from({ length: width * height }, (_, index) => {
    const tx = index % width;
    const ty = Math.floor(index / width);
    return tile(tx, ty, ty === 2 && tx <= 4);
  });
  const firstStore = withSettlement({ buildings, tiles, width, height });
  const islandStore = withSettlement({
    buildings: [...buildings, building("storehouse", 7, 0)],
    tiles: tiles.map((current) => current.tx === 7 && current.ty === 2 ? { ...current, hasRoad: true } : current),
    width,
    height,
  });
  const connectedStore = withSettlement({
    buildings: [...buildings, building("storehouse", 7, 0)],
    tiles: tiles.map((current) => current.ty === 2 && current.tx <= 8 ? { ...current, hasRoad: true } : current),
    width,
    height,
  });

  assert.equal(ONBOARDING_TASKS[4]?.isComplete(DEFAULT_GAME_STATE), false);
  assert.equal(ONBOARDING_TASKS[4]?.isComplete(firstStore), false);
  assert.equal(ONBOARDING_TASKS[4]?.isComplete(islandStore), false);
  assert.equal(ONBOARDING_TASKS[4]?.isComplete(connectedStore), true);
});

test("presentation state holds completion flourish for 600ms and advances only one task at a time", () => {
  // Given
  const startHouse = building("house", 0, 0);
  const stateWithManySatisfied = withSettlement({
    buildings: [
      startHouse,
      building("logging_camp", 1, 0),
      building("sawmill", 2, 0),
      building("storehouse", 3, 0),
      building("well", 0, 6),
      building("wheat_farm", 4, 0),
      building("mill", 5, 0),
      building("granary", 6, 0),
    ],
    houses: [house(startHouse.id, 30)],
    tiles: [tile(1, 0, true)],
    population: 30,
  });
  const initial = createOnboardingPresentationState();

  // When
  const flourishing = updateOnboardingPresentationState({
    gameState: stateWithManySatisfied,
    presentation: initial,
    nowMs: 1_000,
  });
  const beforeBoundary = updateOnboardingPresentationState({
    gameState: stateWithManySatisfied,
    presentation: flourishing,
    nowMs: 1_599,
  });
  const atBoundary = updateOnboardingPresentationState({
    gameState: stateWithManySatisfied,
    presentation: beforeBoundary,
    nowMs: 1_600,
  });
  const nextFlourish = updateOnboardingPresentationState({
    gameState: stateWithManySatisfied,
    presentation: atBoundary,
    nowMs: 1_601,
  });

  // Then
  assert.equal(getOnboardingTaskView(stateWithManySatisfied, flourishing).current?.flourishLabel, "완료");
  assert.deepEqual(beforeBoundary.completedTaskIds, []);
  assert.deepEqual(atBoundary.completedTaskIds, ["task-1"]);
  assert.equal(getOnboardingTaskView(stateWithManySatisfied, atBoundary).current?.title, "숲 옆에 벌목소를 지으세요");
  assert.deepEqual(nextFlourish.completedTaskIds, ["task-1"]);
  assert.equal(nextFlourish.flourish?.taskId, "task-2");
});

test("presentation state reaches the Phase 4F open goal only after task eight completes", () => {
  // Given
  const startHouse = building("house", 0, 0);
  const completeState = withSettlement({
    buildings: [
      startHouse,
      building("logging_camp", 1, 0),
      building("sawmill", 2, 0),
      building("storehouse", 3, 0),
      building("storehouse", 7, 0),
      building("well", 0, 6),
      building("wheat_farm", 4, 3),
      building("wheat_farm", 4, 5),
      building("mill", 6, 3),
      building("granary", 8, 3),
      building("chapel", 9, 5),
    ],
    houses: [house(startHouse.id, 50)],
    width: 12,
    height: 8,
    tiles: Array.from({ length: 12 * 8 }, (_, index) => {
      const tx = index % 12;
      const ty = Math.floor(index / 12);
      return tile(tx, ty, (ty === 1 && tx <= 2) || (ty === 2 && tx >= 2 && tx <= 8));
    }),
    population: 50,
  });
  let presentation = createOnboardingPresentationState();

  // When
  for (const nowMs of [
    0, 600, 601, 1_201, 1_202, 1_802, 1_803, 2_403, 2_404, 3_004, 3_005, 3_605, 3_606, 4_206, 4_207,
    4_807,
  ]) {
    presentation = updateOnboardingPresentationState({ gameState: completeState, presentation, nowMs });
  }

  // Then
  const view = getOnboardingTaskView(completeState, presentation);
  assert.notEqual(view.openGoal, null);
  if (view.openGoal === null) return;
  assert.equal(view.openGoal.title, "기초 운영 완료 · 도시 목표와 공급 상태를 확인하세요");
  assert.equal(view.current, null);
  assert.equal(view.next, null);
  assert.deepEqual(presentation.completedTaskIds, [
    "task-1",
    "task-2",
    "task-3",
    "task-4",
    "task-5",
    "task-6",
    "task-7",
    "task-8",
  ]);
});
