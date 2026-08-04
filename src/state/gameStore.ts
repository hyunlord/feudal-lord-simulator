import { createContext, createElement, useContext, useMemo, useReducer } from "react";

import { placeBuilding, placeRoadLine } from "../engine/gameActions";
import { advanceTick } from "../engine/tick";
import type { GameState } from "../engine/engine.types";
import { buildWorldGrid } from "../world/terrain";
import type {
  GameAction,
  GameProviderProps,
  GameStoreContextValue,
} from "./gameStore.types";

const WORLD_SEED = 1;
const INITIAL_WORLD = buildWorldGrid({ width: 64, height: 64, seed: WORLD_SEED });

export const DEFAULT_GAME_STATE: GameState = {
  tick: 0,
  seed: WORLD_SEED,
  tiles: [...INITIAL_WORLD.tiles],
  width: INITIAL_WORLD.width,
  height: INITIAL_WORLD.height,
  buildings: [],
  houses: [],
  walkers: [],
  population: 0,
  idleWorkers: 0,
  treasuryTimber: 160,
};

export const GameStoreContext = createContext<GameStoreContextValue | null>(null);

function assertNever(action: never): never {
  throw new Error(`Unhandled game action: ${JSON.stringify(action)}`);
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "advance_tick":
      return advanceTick(state);
    case "place_building":
      return placeBuilding(state, action.kind, { tx: action.tx, ty: action.ty });
    case "place_road_line":
      return placeRoadLine(state, action.start, action.destination);
    default:
      return assertNever(action);
  }
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
