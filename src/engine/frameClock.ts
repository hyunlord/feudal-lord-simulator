import type { GameSpeed, GameState } from "./engine.types";
import { completeEligibleConstruction } from "./constructionLifecycle";
import { advanceSimulationSubstep } from "./tick";
import { updateSettlementProgress } from "./settlementProgress";

export function advanceFrame(state: GameState, speed: GameSpeed): GameState {
  if (speed === 0 || state.settlement?.outcome === "abandoned") return state;

  let nextState = { ...state, wallTick: state.wallTick + 1 };
  for (let substep = 0; substep < speed; substep += 1) {
    nextState = advanceSimulationSubstep(nextState);
    if (substep === speed - 1) nextState = completeEligibleConstruction(nextState);
    nextState = updateSettlementProgress(nextState);
    if (nextState.settlement?.outcome === "abandoned") return nextState;
  }
  return nextState;
}
