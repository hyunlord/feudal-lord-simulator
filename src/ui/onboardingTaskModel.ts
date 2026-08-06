import type { Building, BuildingKind } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";

export type OnboardingTaskId =
  | "task-1"
  | "task-2"
  | "task-3"
  | "task-4"
  | "task-5"
  | "task-6"
  | "task-7"
  | "task-8";

export type OnboardingHighlightTool = BuildingKind | "road";

export type OnboardingTask = {
  readonly id: OnboardingTaskId;
  readonly title: string;
  readonly hint: string;
  readonly highlightTools: readonly OnboardingHighlightTool[];
  readonly isComplete: (state: GameState) => boolean;
};

export type OnboardingFlourish = {
  readonly taskId: OnboardingTaskId;
  readonly label: "완료";
  readonly startedAtMs: number;
};

export type OnboardingPresentationState = {
  readonly completedTaskIds: readonly OnboardingTaskId[];
  readonly flourish: OnboardingFlourish | null;
  readonly openGoalReached: boolean;
};

export type OnboardingTaskViewItem = {
  readonly id: OnboardingTaskId;
  readonly title: string;
  readonly hint: string;
  readonly highlightTools: readonly OnboardingHighlightTool[];
  readonly isComplete: boolean;
  readonly flourishLabel: "완료" | null;
};

export type OnboardingTaskView = {
  readonly current: OnboardingTaskViewItem | null;
  readonly next: OnboardingTaskViewItem | null;
  readonly openGoal: { readonly title: string } | null;
};

const FLOURISH_HOLD_MS = 600;
const PHASE_4F_OPEN_GOAL_TITLE = "목표: 인구 50 이후 번영을 이어가세요";

export const ONBOARDING_TASKS: readonly OnboardingTask[] = [
  {
    id: "task-1",
    title: "길을 놓아 오두막을 이으세요",
    hint: "오두막 바로 옆 칸에 길을 놓으세요.",
    highlightTools: ["road"],
    isComplete: hasRoadAdjacentToStartingHouse,
  },
  {
    id: "task-2",
    title: "숲 옆에 벌목소를 지으세요",
    hint: "벌목소 도장을 고르고 숲 가장자리를 클릭하세요.",
    highlightTools: ["logging_camp"],
    isComplete: hasBuildingKind("logging_camp"),
  },
  {
    id: "task-3",
    title: "제재소를 지어 목재를 만드세요",
    hint: "제재소가 통나무를 목재로 바꿉니다.",
    highlightTools: ["sawmill"],
    isComplete: hasBuildingKind("sawmill"),
  },
  {
    id: "task-4",
    title: "창고를 지어 목재를 모으세요",
    hint: "창고를 더 지으면 목재가 넘치지 않습니다.",
    highlightTools: ["storehouse"],
    isComplete: hasBuildingKind("storehouse"),
  },
  {
    id: "task-5",
    title: "우물을 지어 물을 공급하세요",
    hint: "우물은 집에서 6칸 안에 두세요.",
    highlightTools: ["well"],
    isComplete: hasWellWithinHouseRange,
  },
  {
    id: "task-6",
    title: "밀밭과 방앗간, 곡창을 지으세요",
    hint: "오두막 네 채와 식량 건물을 먼저 완성한 뒤 바로 5배속으로 돌리세요.",
    highlightTools: ["wheat_farm", "mill", "granary"],
    isComplete: hasFoodChain,
  },
  {
    id: "task-7",
    title: "인구를 30명까지 늘리세요",
    hint: "오두막 네 채를 먼저 찍고 바로 5배속으로 돌리세요.",
    highlightTools: ["house"],
    isComplete: hasPopulationAtLeast(30),
  },
  {
    id: "task-8",
    title: "인구를 50명까지 늘리세요",
    hint: "5배속으로 흐름을 보며 집과 식량을 보강하세요.",
    highlightTools: ["house"],
    isComplete: hasPopulationAtLeast(50),
  },
];

export function createOnboardingPresentationState(): OnboardingPresentationState {
  return { completedTaskIds: [], flourish: null, openGoalReached: false };
}

export function updateOnboardingPresentationState(input: {
  readonly gameState: GameState;
  readonly presentation: OnboardingPresentationState;
  readonly nowMs: number;
}): OnboardingPresentationState {
  if (input.presentation.openGoalReached) return input.presentation;
  if (input.presentation.flourish !== null) {
    return updateFlourish(input.presentation, input.nowMs);
  }

  const currentTask = firstIncompleteTask(input.presentation.completedTaskIds);
  if (currentTask === null) return { ...input.presentation, openGoalReached: true };
  if (!currentTask.isComplete(input.gameState)) return input.presentation;

  return {
    ...input.presentation,
    flourish: { taskId: currentTask.id, label: "완료", startedAtMs: input.nowMs },
  };
}

export function getOnboardingTaskView(
  state: GameState,
  presentation: OnboardingPresentationState,
): OnboardingTaskView {
  if (presentation.openGoalReached) {
    return { current: null, next: null, openGoal: { title: PHASE_4F_OPEN_GOAL_TITLE } };
  }

  const currentTask = presentation.flourish?.taskId
    ? taskById(presentation.flourish.taskId)
    : firstIncompleteTask(presentation.completedTaskIds);
  const nextTask = currentTask === null ? null : taskAfter(currentTask.id);

  return {
    current:
      currentTask === null
        ? null
        : taskViewItem(currentTask, state, presentation.flourish?.taskId === currentTask.id),
    next: nextTask === null ? null : taskViewItem(nextTask, state, false),
    openGoal: null,
  };
}

function updateFlourish(
  presentation: OnboardingPresentationState,
  nowMs: number,
): OnboardingPresentationState {
  const flourish = presentation.flourish;
  if (flourish === null) return presentation;
  if (nowMs - flourish.startedAtMs < FLOURISH_HOLD_MS) return presentation;

  const completedTaskIds = presentation.completedTaskIds.includes(flourish.taskId)
    ? presentation.completedTaskIds
    : [...presentation.completedTaskIds, flourish.taskId];

  return {
    completedTaskIds,
    flourish: null,
    openGoalReached: completedTaskIds.length === ONBOARDING_TASKS.length,
  };
}

function taskViewItem(
  task: OnboardingTask,
  state: GameState,
  isFlourishing: boolean,
): OnboardingTaskViewItem {
  return {
    id: task.id,
    title: task.title,
    hint: task.hint,
    highlightTools: task.highlightTools,
    isComplete: task.isComplete(state),
    flourishLabel: isFlourishing ? "완료" : null,
  };
}

function firstIncompleteTask(completedTaskIds: readonly OnboardingTaskId[]): OnboardingTask | null {
  for (const task of ONBOARDING_TASKS) {
    if (!completedTaskIds.includes(task.id)) return task;
  }
  return null;
}

function taskById(taskId: OnboardingTaskId): OnboardingTask | null {
  for (const task of ONBOARDING_TASKS) {
    if (task.id === taskId) return task;
  }
  return null;
}

function taskAfter(taskId: OnboardingTaskId): OnboardingTask | null {
  let returnNext = false;
  for (const task of ONBOARDING_TASKS) {
    if (returnNext) return task;
    returnNext = task.id === taskId;
  }
  return null;
}

function hasBuildingKind(kind: BuildingKind): (state: GameState) => boolean {
  return (state) => state.buildings.some((building) => building.kind === kind);
}

function hasPopulationAtLeast(population: number): (state: GameState) => boolean {
  return (state) => state.population >= population;
}

function hasFoodChain(state: GameState): boolean {
  return (
    state.buildings.some((building) => building.kind === "wheat_farm") &&
    state.buildings.some((building) => building.kind === "mill") &&
    state.buildings.some((building) => building.kind === "granary")
  );
}

function hasWellWithinHouseRange(state: GameState): boolean {
  const houseBuildings = state.houses.flatMap((house) => {
    const building = findBuilding(state.buildings, house.buildingId);
    return building === null ? [] : [building];
  });

  return state.buildings.some(
    (building) =>
      building.kind === "well" &&
      houseBuildings.some((houseBuilding) => manhattanDistance(building, houseBuilding) <= 6),
  );
}

function hasRoadAdjacentToStartingHouse(state: GameState): boolean {
  const startingHouse = startingHouseBuilding(state);
  if (startingHouse === null) return false;
  return state.tiles.some(
    (tile) => tile.hasRoad && Math.abs(tile.tx - startingHouse.tx) + Math.abs(tile.ty - startingHouse.ty) === 1,
  );
}

function startingHouseBuilding(state: GameState): Building | null {
  for (const house of state.houses) {
    const building = findBuilding(state.buildings, house.buildingId);
    if (building !== null && building.kind === "house") return building;
  }
  for (const building of state.buildings) {
    if (building.kind === "house") return building;
  }
  return null;
}

function findBuilding(buildings: readonly Building[], buildingId: string): Building | null {
  for (const building of buildings) {
    if (building.id === buildingId) return building;
  }
  return null;
}

function manhattanDistance(left: Building, right: Building): number {
  return Math.abs(left.tx - right.tx) + Math.abs(left.ty - right.ty);
}
