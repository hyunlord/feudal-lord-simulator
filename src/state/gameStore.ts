import { createContext, createElement, useContext, useMemo, useReducer } from "react";

import type { GameState } from "../engine/engine.types";
import type {
  GameAction,
  GameProviderProps,
  GameStoreContextValue,
} from "./gameStore.types";

export const DEFAULT_GAME_STATE: GameState = {
  tick: 0,
  seed: 1,
  tiles: [],
  width: 0,
  height: 0,
  buildings: [],
  houses: [],
  walkers: [],
  population: 0,
  idleWorkers: 0,
  treasuryTimber: 0,
};

export const GameStoreContext = createContext<GameStoreContextValue | null>(null);

function gameReducer(state: GameState, _action: GameAction): GameState {
  return state;
}

export function GameProvider({ children }: GameProviderProps) {
  const [state, dispatch] = useReducer(gameReducer, DEFAULT_GAME_STATE);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return createElement(GameStoreContext.Provider, { value }, children);
}

export function useGameStore(): GameStoreContextValue {
  const value = useContext(GameStoreContext);
  if (value === null) throw new Error("GameProvider is missing");
  return value;
}
