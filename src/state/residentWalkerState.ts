import type { GameState } from "../engine/engine.types";
import { residentWalkers } from "../ui/residentTrips";

/**
 * MOVE-1 (RM-5): the state the screen draws: the simulation's walkers plus the presentation walkers of that tick.
 * The simulation, saves and autosaves keep the plain state (`stateRef`); only the store's published `state` and
 * `previousRenderState` carry this copy, so the canvas draws and interpolates residents like any walker.
 */
export function withResidentWalkers(state: GameState): GameState {
  const residents = residentWalkers(state);
  return residents.length === 0 ? state : { ...state, walkers: [...state.walkers, ...residents] };
}

/** The previous frame's walkers for interpolation: the same world's residents at the previous state's tick. */
export function withPreviousResidentWalkers(
  previous: Pick<GameState, "constructionSites" | "walkers">,
  current: GameState,
): Pick<GameState, "constructionSites" | "walkers"> {
  const tick = "tick" in previous && typeof previous.tick === "number" ? previous.tick : current.tick;
  const residents = residentWalkers(tick === current.tick ? current : { ...current, tick });
  return residents.length === 0 ? previous : { constructionSites: previous.constructionSites, walkers: [...previous.walkers, ...residents] };
}
