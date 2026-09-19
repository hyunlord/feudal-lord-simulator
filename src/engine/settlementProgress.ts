import { SETTLEMENT_CONFIG as CONFIG } from "../content/settlementConfig";
import type { GameState } from "./engine.types";
import { settlementMetrics } from "./settlementMetrics";
import type { SettlementProgress } from "./settlement.types";
export function settlementProgress(state: GameState): SettlementProgress {
  return state.settlement ?? {
    lastUpdatedTick: state.tick - 1, selfSufficientTicks: 0, prosperityTicks: 0,
    foodShortageTicks: 0, emptyTicks: 0, hadResidents: false,
    milestones: { selfSufficient: null, palisade: null, prosperity: null }, outcome: "ongoing",
  };
}
export function updateSettlementProgress(state: GameState): GameState {
  const previous = settlementProgress(state);
  if (state.tick <= previous.lastUpdatedTick || previous.outcome === "abandoned") return state;
  const consecutive = state.tick === previous.lastUpdatedTick + 1;
  const metrics = settlementMetrics(state);
  const supplied = metrics.occupiedHouses > 0 && metrics.suppliedPercent >= CONFIG.servicePercent;
  const selfSufficientTicks = supplied && metrics.population >= CONFIG.selfSufficientPopulation
    ? Math.min(CONFIG.selfSufficientHoldTicks, (consecutive ? previous.selfSufficientTicks : 0) + 1) : 0;
  const palisadeReady = metrics.population >= CONFIG.palisadePopulation && state.era !== "hamlet" && metrics.completedWall;
  const prosperityReady = supplied && metrics.population >= CONFIG.prosperityPopulation && state.era === "stone_town" && metrics.completedStoneWall;
  const prosperityTicks = prosperityReady ? Math.min(CONFIG.prosperityHoldTicks, (consecutive ? previous.prosperityTicks : 0) + 1) : 0;
  const selfSufficient = previous.milestones.selfSufficient ?? (selfSufficientTicks >= CONFIG.selfSufficientHoldTicks ? state.tick : null);
  const palisade = previous.milestones.palisade ?? (selfSufficient !== null && palisadeReady ? state.tick : null);
  const prosperity = previous.milestones.prosperity ?? (palisade !== null && prosperityTicks >= CONFIG.prosperityHoldTicks ? state.tick : null);
  const hadResidents = previous.hadResidents || metrics.population > 0;
  const eligibleForAbandonment = hadResidents || state.houses.length > 0;
  const emptyTicks = metrics.population === 0 && eligibleForAbandonment && state.tick > CONFIG.startupGraceTicks
    ? Math.min(CONFIG.abandonmentTicks, (consecutive ? previous.emptyTicks : 0) + 1) : 0;
  const foodShortageTicks = metrics.occupiedHouses > 0 && metrics.foodPercent < CONFIG.servicePercent
    ? Math.min(CONFIG.foodCrisisTicks, (consecutive ? previous.foodShortageTicks : 0) + 1) : 0;
  const outcome = prosperity !== null ? "victory" : emptyTicks >= CONFIG.abandonmentTicks ? "abandoned" : "ongoing";
  return { ...state, settlement: {
    lastUpdatedTick: state.tick, selfSufficientTicks, prosperityTicks, foodShortageTicks,
    emptyTicks, hadResidents, milestones: { selfSufficient, palisade, prosperity }, outcome,
  } };
}
