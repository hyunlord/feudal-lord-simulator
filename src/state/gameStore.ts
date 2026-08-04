import { createContext, createElement, useContext, useMemo, useReducer } from "react";

import { BALANCE } from "../content/balanceConfig";
import type { Building } from "../content/buildingConfig";
import { placeBuilding, placeRoadLine } from "../engine/gameActions";
import { advanceTick } from "../engine/tick";
import type { GameState } from "../engine/engine.types";
import type { House } from "../population/population.types";
import { buildWorldGrid } from "../world/terrain";
import type {
  GameAction,
  GameProviderProps,
  GameStoreContextValue,
} from "./gameStore.types";

const WORLD_SEED = 1;
const INITIAL_WORLD = buildWorldGrid({ width: 64, height: 64, seed: WORLD_SEED });
const STARTING_HOUSE_ID = "house-0-0-0";

const STARTING_HOUSE_BUILDING: Building = {
  id: STARTING_HOUSE_ID,
  kind: "house",
  tx: 0,
  ty: 0,
  workers: 0,
  inventory: {},
  reserved: {},
  stockReserved: {},
  productionProgress: 0,
};

const STARTING_HOUSE: House = {
  buildingId: STARTING_HOUSE_ID,
  level: 2,
  residents: 10,
  hasWater: false,
  breadStock: 0,
  lastServicedTick: 0,
  unmetRequirementTicks: 0,
};

export const DEFAULT_GAME_STATE: GameState = {
  tick: 0,
  seed: WORLD_SEED,
  tiles: INITIAL_WORLD.tiles.map((tile) =>
    tile.tx === STARTING_HOUSE_BUILDING.tx && tile.ty === STARTING_HOUSE_BUILDING.ty
      ? { ...tile, buildingId: STARTING_HOUSE_ID }
      : tile,
  ),
  width: INITIAL_WORLD.width,
  height: INITIAL_WORLD.height,
  buildings: [STARTING_HOUSE_BUILDING],
  houses: [STARTING_HOUSE],
  walkers: [],
  population: STARTING_HOUSE.residents,
  idleWorkers: 0,
  treasuryTimber: BALANCE.STARTING_TIMBER,
  roadRevision: 0,
  pathCache: {},
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
