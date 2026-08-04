import type { Dispatch, ReactNode } from "react";

import type { GameState } from "../engine/engine.types";

export interface GameProviderProps {
  children: ReactNode;
}

export type GameAction = { type: "noop" };

export interface GameStoreContextValue {
  state: GameState;
  dispatch: Dispatch<GameAction>;
}
