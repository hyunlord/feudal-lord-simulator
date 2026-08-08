import { decideNextAction, type AutoplayAction } from "../src/engine/autoplay";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { autoplayActionToGameAction, canRunAutoplayAtTick } from "../src/ui/autoplayPresentation";
import { hashEconomyState } from "./economyHarnessSerializer";

export interface AutoplayHarnessAction {
  readonly tick: number;
  readonly advisorAction: AutoplayAction;
}

export interface AutoplayHarnessReport {
  readonly hash: string;
  readonly appliedActions: readonly AutoplayHarnessAction[];
  readonly finalState: GameState;
}

export function trackAutoplayRun(input: {
  readonly initialState: GameState;
  readonly ticks: number;
}): AutoplayHarnessReport {
  let state = input.initialState;
  let lastActionTick = -120;
  const appliedActions: AutoplayHarnessAction[] = [];

  for (let step = 0; step < input.ticks; step += 1) {
    if (canRunAutoplayAtTick({ enabled: true, currentTick: state.tick, lastActionTick })) {
      const advisorAction = decideNextAction(state);
      const gameAction = autoplayActionToGameAction(advisorAction, state);
      if (gameAction !== null) {
        appliedActions.push({ tick: state.tick, advisorAction });
        state = gameReducer(state, gameAction);
        lastActionTick = state.tick;
      }
    }
    state = advanceTick(state);
  }

  return {
    hash: hashEconomyState(state),
    appliedActions,
    finalState: state,
  };
}
