import { scenarioOf, stageOf } from "../engine/scenarioState";
import { getSettlementView } from "../engine/settlementView";
import type { Building, BuildingKind } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { arableCellCount, hasPalisadeTimberStorage, ONBOARDING_ARABLE_CELLS } from "./onboardingBuildingTaskProgress";
import { ONBOARDING_TASK_COPY } from "./onboardingTaskCopy.ko";

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
  readonly label: typeof ONBOARDING_TASK_COPY.done;
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
  readonly flourishLabel: typeof ONBOARDING_TASK_COPY.done | null;
};

export type OnboardingTaskView = {
  readonly current: OnboardingTaskViewItem | null;
  readonly next: OnboardingTaskViewItem | null;
  readonly openGoal: { readonly title: string } | null;
};

const FLOURISH_HOLD_MS = 600;
const PHASE_4F_OPEN_GOAL_TITLE = ONBOARDING_TASK_COPY.openGoalTitle;

export const ONBOARDING_TASKS: readonly OnboardingTask[] = [
  {
    id: "task-1",
    title: ONBOARDING_TASK_COPY.tasks["task-1"].title,
    hint: ONBOARDING_TASK_COPY.tasks["task-1"].hint,
    highlightTools: ["road"],
    isComplete: hasRoadAdjacentToStartingHouse,
  },
  {
    id: "task-2",
    title: ONBOARDING_TASK_COPY.tasks["task-2"].title,
    hint: ONBOARDING_TASK_COPY.tasks["task-2"].hint,
    highlightTools: ["logging_camp"],
    isComplete: hasBuildingKind("logging_camp"),
  },
  {
    id: "task-3",
    title: ONBOARDING_TASK_COPY.tasks["task-3"].title,
    hint: ONBOARDING_TASK_COPY.tasks["task-3"].hint,
    highlightTools: ["farmstead", "mill"],
    isComplete: hasFirstFoodChain,
  },
  {
    id: "task-4",
    title: ONBOARDING_TASK_COPY.tasks["task-4"].title,
    hint: ONBOARDING_TASK_COPY.tasks["task-4"].hint,
    highlightTools: ["sawmill"],
    isComplete: hasBuildingKind("sawmill"),
  },
  {
    id: "task-5",
    title: ONBOARDING_TASK_COPY.tasks["task-5"].title,
    hint: ONBOARDING_TASK_COPY.tasks["task-5"].hint,
    highlightTools: ["farmstead", "granary", "storehouse"],
    isComplete: hasExpandedFoodAndStorage,
  },
  {
    id: "task-6",
    title: ONBOARDING_TASK_COPY.tasks["task-6"].title,
    hint: ONBOARDING_TASK_COPY.tasks["task-6"].hint,
    highlightTools: ["well", "chapel"],
    isComplete: hasWellAndChapel,
  },
  {
    id: "task-7",
    title: ONBOARDING_TASK_COPY.tasks["task-7"].title,
    hint: ONBOARDING_TASK_COPY.tasks["task-7"].hint,
    highlightTools: ["house"],
    isComplete: hasPopulationAtLeast(30),
  },
  {
    id: "task-8",
    title: ONBOARDING_TASK_COPY.tasks["task-8"].title,
    hint: ONBOARDING_TASK_COPY.tasks["task-8"].hint,
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
    flourish: { taskId: currentTask.id, label: ONBOARDING_TASK_COPY.done, startedAtMs: input.nowMs },
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
    flourishLabel: isFlourishing ? ONBOARDING_TASK_COPY.done : null,
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

function hasFirstFoodChain(state: GameState): boolean {
  return state.buildings.some((building) => building.kind === "farmstead")
    && state.buildings.some((building) => building.kind === "mill");
}

function hasExpandedFoodAndStorage(state: GameState): boolean {
  return (
    state.buildings.some((building) => building.kind === "farmstead") &&
    arableCellCount(state) >= ONBOARDING_ARABLE_CELLS &&
    state.buildings.some((building) => building.kind === "granary") &&
    hasPalisadeTimberStorage(state)
  );
}

function hasWellAndChapel(state: GameState): boolean {
  return hasWellWithinHouseRange(state)
    && state.buildings.some(building => building.kind === "chapel");
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

/**
 * The standing "basic operations done" notice only fits a campaign town that is still a village with a goal
 * ahead (B2 §6). It hides in the sandbox and once the settlement has moved on to a later stage.
 */
export function openGoalFitsScenario(state: GameState): boolean {
  return scenarioOf(state).mode === "campaign" && stageOf(state) === "village" && getSettlementView(state).currentGoal !== null;
}
