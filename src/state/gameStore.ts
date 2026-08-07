import { createContext, createElement, useContext, useMemo, useReducer } from "react";

import { BALANCE } from "../content/balanceConfig";
import { cancelConstruction } from "../engine/constructionCancellation";
import { advanceFrame } from "../engine/frameClock";
import { placeBuilding, placeRoadLine } from "../engine/gameActions";
import { confirmPalisadeProclamation } from "../engine/palisade";
import { advanceTick } from "../engine/tick";
import type { GameState } from "../engine/engine.types";
import {
  createDeliveryInventoryPort,
  createSimulationRoutePorts,
} from "../engine/simulationPorts";
import { buildWorldGrid } from "../world/terrain";
import {
  applyOpeningVillageToTile,
  openingVillageBuildings,
  openingVillageHouses,
} from "./openingVillage";
import type {
  GameAction,
  GameProviderProps,
  GameStoreContextValue,
} from "./gameStore.types";

const WORLD_SEED = 1;
const INITIAL_WORLD = buildWorldGrid({ width: 64, height: 64, seed: WORLD_SEED });
const STARTING_BUILDINGS = openingVillageBuildings();
const STARTING_HOUSES = openingVillageHouses();

export const DEFAULT_GAME_STATE: GameState = {
  tick: 0,
  seed: WORLD_SEED,
  tiles: INITIAL_WORLD.tiles.map(applyOpeningVillageToTile),
  width: INITIAL_WORLD.width,
  height: INITIAL_WORLD.height,
  buildings: [...STARTING_BUILDINGS],
  constructionSites: [],
  houses: [...STARTING_HOUSES],
  walkers: [],
  population: STARTING_HOUSES.reduce((total, house) => total + house.residents, 0),
  idleWorkers: 0,
  treasuryTimber: BALANCE.STARTING_TIMBER,
  wallTick: 0,
  era: "hamlet",
  eraProclaimedTick: null,
  palisade: null,
  nextConstructionOrdinal: 1,
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
    case "advance_frame":
      return advanceFrame(state, action.speed);
    case "place_building":
      return placeBuilding(state, action.kind, { tx: action.tx, ty: action.ty });
    case "place_road_line":
      return placeRoadLine(state, action.start, action.destination);
    case "cancel_construction": {
      const routes = createSimulationRoutePorts(state);
      return cancelConstruction({
        state,
        siteId: action.siteId,
        inventory: createDeliveryInventoryPort(),
        routes: routes.delivery,
      }).state;
    }
    case "confirm_palisade_proclamation":
      return confirmPalisadeProclamation(state, action.candidatePath);
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
