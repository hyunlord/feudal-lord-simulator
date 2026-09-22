import type { GameState } from './engine.types';

export const FOOD_EFFICIENCY_WINDOW = 2400;
const CHUNK_SIZE = 120;
export interface FoodEfficiencyTotals {
  readonly wheatProduced: number;
  readonly wheatConsumed: number;
  readonly breadProduced: number;
  readonly wheatExported: number;
  readonly breadExported: number;
  readonly requestedBread: number;
  readonly consumedBread: number;
  readonly rawStarvedTicks: number;
  readonly eligibleMillTicks: number;
}
interface FoodCheckpoint extends FoodEfficiencyTotals { readonly tick: number }
export interface FoodEfficiencyHistory {
  readonly startedTick: number;
  readonly throughTick: number;
  readonly totals: FoodEfficiencyTotals;
  readonly chunks: readonly (readonly FoodCheckpoint[])[];
}
export interface FoodEfficiencyMetrics extends FoodEfficiencyTotals {
  readonly coveredTicks: number;
  readonly fullWindow: boolean;
  readonly known: boolean;
}
const ZERO: FoodEfficiencyTotals = { wheatProduced: 0, wheatConsumed: 0, breadProduced: 0,
  wheatExported: 0, breadExported: 0, requestedBread: 0, consumedBread: 0,
  rawStarvedTicks: 0, eligibleMillTicks: 0 };

export function openFoodEfficiency(state: GameState): FoodEfficiencyHistory {
  const old = state.autoplayFoodFlow?.rolling;
  if (old === undefined || old.throughTick !== state.tick) {
    return { startedTick: state.tick, throughTick: state.tick, totals: ZERO,
      chunks: [[{ ...ZERO, tick: state.tick }]] };
  }
  const last = old.chunks.at(-1);
  if (last?.at(-1)?.tick === state.tick) return old;
  const checkpoint = { ...old.totals, tick: state.tick };
  const chunks = last === undefined || last.length >= CHUNK_SIZE
    ? [...old.chunks, [checkpoint]] : [...old.chunks.slice(0, -1), [...last, checkpoint]];
  while ((chunks[0]?.at(-1)?.tick ?? state.tick) < state.tick - FOOD_EFFICIENCY_WINDOW) chunks.shift();
  return { ...old, chunks };
}

export function recordFoodEfficiency(state: GameState, activity: Partial<FoodEfficiencyTotals>, productionTick = false): GameState {
  const flow = state.autoplayFoodFlow;
  const old = flow?.rolling;
  if (flow === undefined || old === undefined) return state;
  if (productionTick && state.tick !== old.throughTick + 1) {
    return { ...state, autoplayFoodFlow: { ...flow, rolling: { startedTick: state.tick,
      throughTick: state.tick, totals: ZERO, chunks: [[{ ...ZERO, tick: state.tick }]] } } };
  }
  const totals: FoodEfficiencyTotals = {
    wheatProduced: old.totals.wheatProduced + (activity.wheatProduced ?? 0),
    wheatConsumed: old.totals.wheatConsumed + (activity.wheatConsumed ?? 0),
    breadProduced: old.totals.breadProduced + (activity.breadProduced ?? 0),
    wheatExported: old.totals.wheatExported + (activity.wheatExported ?? 0),
    breadExported: old.totals.breadExported + (activity.breadExported ?? 0),
    requestedBread: old.totals.requestedBread + (activity.requestedBread ?? 0),
    consumedBread: old.totals.consumedBread + (activity.consumedBread ?? 0),
    rawStarvedTicks: old.totals.rawStarvedTicks + (activity.rawStarvedTicks ?? 0),
    eligibleMillTicks: old.totals.eligibleMillTicks + (activity.eligibleMillTicks ?? 0),
  };
  return { ...state, autoplayFoodFlow: { ...flow, rolling: { ...old, totals,
    throughTick: productionTick ? state.tick : old.throughTick } } };
}

export function foodEfficiencyMetrics(state: GameState): FoodEfficiencyMetrics {
  const history = state.autoplayFoodFlow?.rolling;
  const coveredTicks = history === undefined ? 0 : Math.min(FOOD_EFFICIENCY_WINDOW, state.tick - history.startedTick);
  const start = state.tick - coveredTicks;
  const baseline = history?.chunks.find(chunk => (chunk.at(-1)?.tick ?? -1) >= start)?.find(point => point.tick === start);
  if (history === undefined || baseline === undefined || history.throughTick !== state.tick) {
    return { ...ZERO, coveredTicks: 0, fullWindow: false, known: false };
  }
  return { coveredTicks, fullWindow: coveredTicks === FOOD_EFFICIENCY_WINDOW, known: true,
    wheatProduced: history.totals.wheatProduced - baseline.wheatProduced,
    wheatConsumed: history.totals.wheatConsumed - baseline.wheatConsumed,
    breadProduced: history.totals.breadProduced - baseline.breadProduced,
    wheatExported: history.totals.wheatExported - baseline.wheatExported,
    breadExported: history.totals.breadExported - baseline.breadExported,
    requestedBread: history.totals.requestedBread - baseline.requestedBread,
    consumedBread: history.totals.consumedBread - baseline.consumedBread,
    rawStarvedTicks: history.totals.rawStarvedTicks - baseline.rawStarvedTicks,
    eligibleMillTicks: history.totals.eligibleMillTicks - baseline.eligibleMillTicks };
}
