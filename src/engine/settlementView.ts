import { SETTLEMENT_CONFIG as CONFIG } from "../content/settlementConfig";
import type { GameState } from "./engine.types";
import { settlementMetrics } from "./settlementMetrics";
import { settlementProgress } from "./settlementProgress";
import type { SettlementCriterion, SettlementGoal, SettlementView } from "./settlement.types";
function criterion(id: string, label: string, values: readonly [number, number]): SettlementCriterion {
  return { id, label, current: values[0], target: values[1], met: values[0] >= values[1] };
}
export function getSettlementView(state: GameState): SettlementView {
  const metrics = settlementMetrics(state);
  const progress = settlementProgress(state);
  const supplied = criterion("supplied", "물과 빵이 있는 입주 가구 (%)", [metrics.suppliedPercent, CONFIG.servicePercent]);
  let currentGoal: SettlementGoal | null = null;
  if (progress.milestones.selfSufficient === null) {
    currentGoal = {
      id: "selfSufficient", title: "자립 마을", description: "인구 20명과 입주 가구 90%의 물·빵 공급을 600틱 연속 유지하세요.",
      criteria: [criterion("population", "인구", [metrics.population, CONFIG.selfSufficientPopulation]), supplied],
      holdTicks: progress.selfSufficientTicks, requiredHoldTicks: CONFIG.selfSufficientHoldTicks,
    };
  } else if (progress.milestones.palisade === null) {
    currentGoal = {
      id: "palisade", title: "목책 마을", description: "인구 60명, 목책 시대 선포와 성벽 전체 완공이 필요합니다.",
      criteria: [criterion("population", "인구", [metrics.population, CONFIG.palisadePopulation]), criterion("era", "목책 시대 이상", [Number(state.era !== "hamlet"), 1]), criterion("wall", "성벽 전체 완공", [Number(metrics.completedWall), 1])],
      holdTicks: 0, requiredHoldTicks: 0,
    };
  } else if (progress.milestones.prosperity === null) {
    currentGoal = {
      id: "prosperity", title: "번영하는 성곽 도시", description: "석벽 시대에 전체 석벽을 완공하고 인구 140명과 90% 물·빵 공급을 1,200틱 유지하세요.",
      criteria: [criterion("population", "인구", [metrics.population, CONFIG.prosperityPopulation]), supplied, criterion("era", "석벽 시대", [Number(state.era === "stone_town"), 1]), criterion("stoneWall", "석벽 전체 완공", [Number(metrics.completedStoneWall), 1])],
      holdTicks: progress.prosperityTicks, requiredHoldTicks: CONFIG.prosperityHoldTicks,
    };
  }
  return {
    currentGoal, metrics, progress, outcome: progress.outcome,
    crisis: progress.emptyTicks > 0 ? "abandonment_risk" : progress.foodShortageTicks >= CONFIG.foodCrisisTicks ? "food_shortage" : "none",
  };
}
