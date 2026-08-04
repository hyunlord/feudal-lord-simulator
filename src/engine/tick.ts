import type { GameState } from "./engine.types";

export function advanceTick(state: GameState): GameState {
  return {
    ...state,
    tick: state.tick + 1,
  };
}
