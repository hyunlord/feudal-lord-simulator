import { SETTLEMENT_CONFIG as CONFIG } from "../content/settlementConfig";
import type { GameState } from "./engine.types";
import { conditionsMet, scenarioOf } from "./scenarioState";
import { settlementMetrics } from "./settlementMetrics";
import type { SettlementProgress } from "./settlement.types";
export function settlementProgress(state: GameState): SettlementProgress {
  return state.settlement ?? {
    lastUpdatedTick: state.tick - 1, selfSufficientTicks: 0, prosperityTicks: 0,
    foodShortageTicks: 0, emptyTicks: 0, hadResidents: false,
    milestones: { selfSufficient: null, palisade: null, prosperity: null }, outcome: "ongoing",
  };
}
/**
 * Objectives, victory and failure come from the state's scenario (spec SC-7..SC-10). The saved counters
 * keep their pre-B2 roles: `selfSufficientTicks` holds the first objective, `prosperityTicks` the victory.
 */
export function updateSettlementProgress(state: GameState): GameState {
  const previous = settlementProgress(state);
  if (state.tick <= previous.lastUpdatedTick || previous.outcome === "abandoned") return state;
  const scenario = scenarioOf(state);
  const consecutive = state.tick === previous.lastUpdatedTick + 1;
  const metrics = settlementMetrics(state);
  const context = { metrics };
  const hold = (met: boolean, counter: number, required: number) => met ? Math.min(required, (consecutive ? counter : 0) + 1) : 0;
  const selfSufficientObjective = scenario.objectives.find(objective => objective.id === "selfSufficient");
  const palisadeObjective = scenario.objectives.find(objective => objective.id === "palisade");
  const selfSufficientHold = selfSufficientObjective?.conditions.holdTicks ?? 0;
  const selfSufficientTicks = selfSufficientObjective === undefined ? 0
    : hold(conditionsMet(state, selfSufficientObjective.conditions, context), previous.selfSufficientTicks, selfSufficientHold);
  const victoryHold = scenario.victory?.holdTicks ?? 0;
  const prosperityTicks = scenario.victory === null ? 0
    : hold(conditionsMet(state, scenario.victory, context), previous.prosperityTicks, victoryHold);
  const selfSufficient = previous.milestones.selfSufficient ?? (selfSufficientObjective !== undefined
    && selfSufficientTicks >= selfSufficientHold ? state.tick : null);
  const palisade = previous.milestones.palisade ?? (palisadeObjective !== undefined && selfSufficient !== null
    && conditionsMet(state, palisadeObjective.conditions, context) ? state.tick : null);
  const objectivesDone = (selfSufficientObjective === undefined || selfSufficient !== null)
    && (palisadeObjective === undefined || palisade !== null);
  const prosperity = previous.milestones.prosperity ?? (scenario.victory !== null && objectivesDone
    && prosperityTicks >= victoryHold ? state.tick : null);
  const hadResidents = previous.hadResidents || metrics.population > 0;
  const eligibleForAbandonment = hadResidents || state.houses.length > 0;
  const emptyTicks = metrics.population === 0 && eligibleForAbandonment && state.tick > CONFIG.startupGraceTicks
    ? Math.min(CONFIG.abandonmentTicks, (consecutive ? previous.emptyTicks : 0) + 1) : 0;
  const foodShortageTicks = metrics.occupiedHouses > 0 && metrics.foodPercent < CONFIG.servicePercent
    ? Math.min(CONFIG.foodCrisisTicks, (consecutive ? previous.foodShortageTicks : 0) + 1) : 0;
  const failed = scenario.failure !== null && conditionsMet(state, scenario.failure, { ...context, emptyTicks });
  const outcome = prosperity !== null ? "victory" : failed ? "abandoned" : "ongoing";
  return { ...state, settlement: {
    lastUpdatedTick: state.tick, selfSufficientTicks, prosperityTicks, foodShortageTicks,
    emptyTicks, hadResidents, milestones: { selfSufficient, palisade, prosperity }, outcome,
  } };
}
