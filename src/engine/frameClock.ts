import type { GameSpeed, GameState } from "./engine.types";
import { completeEligibleConstruction } from "./constructionLifecycle";
import { advanceSimulationSubstep } from "./tick";

export function advanceFrame(state: GameState, speed: GameSpeed): GameState {
  if (speed === 0) return state;

  let nextState = { ...state, wallTick: state.wallTick + 1 };
  for (let substep = 0; substep < speed; substep += 1) {
    nextState = advanceSimulationSubstep(nextState);
  }
  return completeEligibleConstruction(nextState);
}
