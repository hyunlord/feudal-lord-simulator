import { HOUSE_FOOD_INTERVAL, houseFoodRation } from '../content/houseFoodConfig';
import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { measuredFoodFlow } from './autoplayFoodFlow';
import { fullyFedWindow } from './autoplayFoodTransientMeals';
import { hasTransientMealCoverage } from './autoplayFoodTransientCoverage';
import { AUTOPLAY_TICK_CADENCE } from './autoplay.types';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';

export type AutoplayFoodTransientConfirmation =
  | { readonly status: 'pending'; readonly startedTick: number; readonly deadlineTick: number;
      readonly evaluationTick: number; readonly epoch: string; readonly firstWindowUntilTick: number }
  | { readonly status: 'failed_until_positive_window'; readonly failedTick: number };
export interface FoodTransientMetadata {
  readonly foodTransient?: AutoplayFoodTransientConfirmation | null;
}
export interface FoodTransientDecision extends FoodTransientMetadata { readonly defer: boolean }

function epoch(state: GameState): string {
  const flow = state.autoplayFoodFlow;
  return JSON.stringify([flow?.layout, flow?.routes, state.roadRevision, flow?.poolIds,
    state.houses.filter(h => h.residents > 0).map(h => [h.buildingId, h.residents])]);
}

export function transientFoodDecision(state: GameState, demand: number, eligibleMill: boolean): FoodTransientDecision {
  const previous = state.autoplayFoodTransientConfirmation;
  const flow = state.autoplayFoodFlow;
  const sample = measuredFoodFlow(state);
  const actual = state.houses.reduce((sum, h) => sum + houseFoodRation(h), 0);
  const positive = sample !== undefined && fullyFedWindow(state, sample)
    && sample.wheatProduced - sample.wheatExported >= demand * 2 * (sample.untilTick - sample.startedTick) / HOUSE_FOOD_INTERVAL
    && sample.breadProduced - sample.breadExported >= demand * (sample.untilTick - sample.startedTick) / HOUSE_FOOD_INTERVAL;
  const failure = (): FoodTransientDecision => ({ defer: false,
    foodTransient: { status: 'failed_until_positive_window', failedTick: state.tick } });
  if (previous?.status === 'failed_until_positive_window') {
    return positive && sample !== undefined && sample.untilTick > previous.failedTick
      ? { defer: false, foodTransient: null } : { defer: false };
  }
  const currentMeals = flow?.current.meals;
  const currentFed = currentMeals !== undefined && currentMeals.valid !== false
    && currentMeals.startedTick === flow?.current.startedTick && currentMeals.throughTick === state.tick
    && currentMeals.homes.length === state.houses.filter(h => h.residents > 0).length
    && currentMeals.homes.every(h => !h.starving && h.requested === h.consumed
      && state.houses.some(now => now.buildingId === h.buildingId && now.residents === h.residents));
  if (previous?.status === 'pending') {
    if (state.tick < previous.startedTick || previous.epoch !== epoch(state) || demand > actual || !currentFed) return failure();
    if (state.tick >= previous.deadlineTick) {
      return sample !== undefined && sample.untilTick > previous.firstWindowUntilTick && positive
        ? { defer: false, foodTransient: null } : failure();
    }
    if (!eligibleMill && !positive) return failure();
    return sample !== undefined && fullyFedWindow(state, sample)
      && hasTransientMealCoverage(state, previous.evaluationTick)
      ? { defer: eligibleMill } : failure();
  }
  if (!eligibleMill || flow === undefined || sample === undefined || demand > actual || !currentFed
    || !fullyFedWindow(state, sample) || flow.current.qualified !== true
    || flow.current.startedTick !== sample.untilTick || !Number.isSafeInteger(flow.current.untilTick)
    || flow.current.untilTick <= state.tick) return { defer: false };
  const requiredWheat = demand * (sample.untilTick - sample.startedTick) / HOUSE_FOOD_INTERVAL
    * (BUILDING_CONFIG_BY_KIND.mill.production?.inputPerOutput ?? 0);
  if (sample.wheatProduced - sample.wheatExported < requiredWheat) return { defer: false };
  const evaluationTick = state.tick + Math.ceil((flow.current.untilTick - state.tick) / AUTOPLAY_TICK_CADENCE) * AUTOPLAY_TICK_CADENCE;
  if (!hasTransientMealCoverage(state, evaluationTick)) return { defer: false };
  return { defer: true, foodTransient: { status: 'pending', startedTick: state.tick,
    deadlineTick: flow.current.untilTick, evaluationTick, epoch: epoch(state), firstWindowUntilTick: sample.untilTick } };
}

export function carryFoodTransient(action: AutoplayAction, metadata: FoodTransientMetadata): AutoplayAction {
  return metadata.foodTransient === undefined ? action : { ...action, foodTransient: metadata.foodTransient };
}
