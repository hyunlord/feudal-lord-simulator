import type { Rng } from "../content/random";
import type { GameState } from "./engine.types";

export function advanceTick(_state: GameState, _rng: Rng): GameState {
  throw new Error("not implemented");
}
