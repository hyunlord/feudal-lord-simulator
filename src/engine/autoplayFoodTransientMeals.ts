import { HOUSE_FOOD_INTERVAL, houseFoodRation } from '../content/houseFoodConfig';
import { houseIsStarving } from '../population/houseFood';
import type { House } from '../population/population.types';
import type { GameState } from './engine.types';
import type { FoodFlowWindow } from './autoplayFoodFlow';

export interface FoodMealEvidence {
  readonly startedTick: number;
  readonly throughTick: number;
  readonly valid?: boolean;
  readonly homes: readonly {
    readonly buildingId: string;
    readonly residents: number;
    readonly requested: number;
    readonly consumed: number;
    readonly starving: boolean;
  }[];
}

export function recordFoodMeals(state: GameState, served: readonly House[]): GameState {
  const flow = state.autoplayFoodFlow;
  if (flow === undefined) return state;
  const old = flow.current.meals;
  if (old?.throughTick === state.tick) return state;
  const homes = served.filter(h => h.residents > 0).map(h => {
    const previous = old?.homes.find(p => p.buildingId === h.buildingId);
    const requested = state.tick % HOUSE_FOOD_INTERVAL === 0 ? houseFoodRation(h) : 0;
    const after = state.houses.find(p => p.buildingId === h.buildingId);
    return { buildingId: h.buildingId, residents: h.residents,
      requested: (previous?.requested ?? 0) + requested,
      consumed: (previous?.consumed ?? 0) + Math.min(requested, h.breadStock),
      starving: previous?.starving === true || after === undefined || houseIsStarving(after, state.tick) };
  });
  const valid = old === undefined ? state.tick - 1 === flow.current.startedTick
    : old.valid !== false && old.throughTick === state.tick - 1 && old.homes.length === homes.length
      && homes.every(h => old.homes.some(p => p.buildingId === h.buildingId && p.residents === h.residents));
  return { ...state, autoplayFoodFlow: { ...flow, current: { ...flow.current,
    meals: { startedTick: old?.startedTick ?? state.tick - 1, throughTick: state.tick, valid, homes } } } };
}

export function fullyFedWindow(state: GameState, sample: FoodFlowWindow): boolean {
  const evidence = sample.meals;
  const homes = state.houses.filter(h => h.residents > 0);
  return evidence !== undefined && evidence.valid !== false && evidence.startedTick === sample.startedTick
    && evidence.throughTick === sample.untilTick && homes.length > 0 && homes.length === evidence.homes.length
    && homes.every(h => evidence.homes.some(e => e.buildingId === h.buildingId && e.residents === h.residents
      && e.requested > 0 && e.requested === e.consumed && !e.starving));
}
