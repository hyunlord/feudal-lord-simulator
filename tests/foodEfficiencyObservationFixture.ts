import { advanceFoodFlow, recordFoodFlow } from '../src/engine/autoplayFoodFlow';
import { FOOD_EFFICIENCY_WINDOW, recordFoodEfficiency } from '../src/engine/autoplayFoodEfficiency';
import { recordFoodMeals } from '../src/engine/autoplayFoodTransientMeals';
import type { GameState } from '../src/engine/engine.types';
import { stressedTown } from './helpers/autoplayFoodFixtures';

// Synthetic chronological event replay for policy units, not a natural-growth proof.
export function replayFoodObservation(input: GameState, events = { wheat: 1000, bread: 40, exports: 0 }, rawStarvedTicks = 0): GameState {
  let state = { ...input, tick: input.tick - FOOD_EFFICIENCY_WINDOW };
  const units = (total: number, index: number): number => Math.floor(total * index / FOOD_EFFICIENCY_WINDOW)
    - Math.floor(total * (index - 1) / FOOD_EFFICIENCY_WINDOW);
  for (let index = 1; index <= FOOD_EFFICIENCY_WINDOW; index += 1) {
    state = advanceFoodFlow(state);
    state = { ...state, tick: state.tick + 1 };
    const breadProduced = units(events.bread, index);
    state = recordFoodFlow(state, { wheatProduced: units(events.wheat, index), breadProduced,
      wheatExported: units(events.exports, index) });
    state = recordFoodEfficiency(state, { wheatConsumed: breadProduced * 2,
      rawStarvedTicks: units(rawStarvedTicks, index),
      eligibleMillTicks: state.buildings.filter(b => b.kind === 'mill').length }, true);
    state = recordFoodMeals(state, state.houses);
  }
  return state;
}

export function observedFoodTown(wheat = 1000, bread = 40): GameState {
  const base = stressedTown();
  const state = { ...base,
    tiles: base.tiles.map(t => ({ ...t, hasRoad: t.hasRoad || t.ty === 1 || t.tx === 0 })),
    houses: base.houses.map(h => ({ ...h, breadStock: 0 })),
    buildings: base.buildings.map(b => b.kind === 'mill' ? { ...b, inventory: { wheat: 2 } } : b) };
  return replayFoodObservation(state, { wheat, bread, exports: 0 });
}
