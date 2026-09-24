import { SETTLEMENT_CONFIG as CONFIG } from "../content/settlementConfig";
import { SCENARIO_COPY } from "../content/scenario/scenarioCopy.ko";
import type { Condition, ConditionSet } from "../content/scenario/types";
import type { GameState } from "./engine.types";
import { conditionMet, scenarioOf } from "./scenarioState";
import { settlementMetrics } from "./settlementMetrics";
import { settlementProgress } from "./settlementProgress";
import type { SettlementCriterion, SettlementGoal, SettlementGoalId, SettlementMetrics, SettlementView } from "./settlement.types";

const CRITERION_LABELS = {
  population: "인구",
  supplied: "물과 빵이 있는 입주 가구 (%)",
  occupiedL4Lots: "입주한 L4 주거 (필지)",
  wall: "성벽 전체 완공",
  stoneWall: "석벽 전체 완공",
} as const;

function criterion(id: string, label: string, values: readonly [number, number]): SettlementCriterion {
  return { id, label, current: values[0], target: values[1], met: values[0] >= values[1] };
}

/** Goal-board rows are derived from the scenario's condition data (spec SC-7, SC-8). */
function criterionFor(state: GameState, metrics: SettlementMetrics, condition: Condition): SettlementCriterion | null {
  switch (condition.kind) {
    case "population_at_least": return criterion("population", CRITERION_LABELS.population, [metrics.population, condition.value]);
    case "supplied_percent_at_least": return criterion("supplied", CRITERION_LABELS.supplied, [metrics.suppliedPercent, condition.value]);
    case "occupied_l4_lots_at_least": return criterion("occupiedL4Lots", CRITERION_LABELS.occupiedL4Lots, [metrics.occupiedL4Lots, condition.value]);
    case "stage_at_least": return criterion("era", `${SCENARIO_COPY.stages[condition.stage]} 이상`, [Number(conditionMet(state, condition, { metrics })), 1]);
    case "wall_completed": return criterion("wall", CRITERION_LABELS.wall, [Number(metrics.completedWall), 1]);
    case "stone_wall_completed": return criterion("stoneWall", CRITERION_LABELS.stoneWall, [Number(metrics.completedStoneWall), 1]);
    default: return null;
  }
}

function goal(state: GameState, metrics: SettlementMetrics, id: SettlementGoalId, set: ConditionSet, holdTicks: number): SettlementGoal {
  return {
    id, title: SCENARIO_COPY.objectives[id].title, description: SCENARIO_COPY.objectives[id].description,
    criteria: set.all.flatMap(condition => criterionFor(state, metrics, condition) ?? []),
    holdTicks, requiredHoldTicks: set.holdTicks ?? 0,
  };
}

export function getSettlementView(state: GameState): SettlementView {
  const metrics = settlementMetrics(state);
  const progress = settlementProgress(state);
  const scenario = scenarioOf(state);
  let currentGoal: SettlementGoal | null = null;
  const selfSufficient = scenario.objectives.find(objective => objective.id === "selfSufficient");
  const palisade = scenario.objectives.find(objective => objective.id === "palisade");
  if (selfSufficient !== undefined && progress.milestones.selfSufficient === null) {
    currentGoal = goal(state, metrics, "selfSufficient", selfSufficient.conditions, progress.selfSufficientTicks);
  } else if (palisade !== undefined && progress.milestones.palisade === null) {
    currentGoal = goal(state, metrics, "palisade", palisade.conditions, 0);
  } else if (scenario.victory !== null && progress.milestones.prosperity === null) {
    currentGoal = goal(state, metrics, "prosperity", scenario.victory, progress.prosperityTicks);
  }
  return {
    currentGoal, metrics, progress, outcome: progress.outcome, mode: scenario.mode,
    crisis: progress.emptyTicks > 0 && scenario.failure !== null ? "abandonment_risk" : progress.foodShortageTicks >= CONFIG.foodCrisisTicks ? "food_shortage" : "none",
  };
}
