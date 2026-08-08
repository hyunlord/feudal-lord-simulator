import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { BALANCE } from "../content/balanceConfig";
import { cancelConstruction } from "../engine/constructionCancellation";
import { confirmStoneTownProclamation } from "../engine/era";
import { placeBuilding, placeRoadLine } from "../engine/gameActions";
import { confirmPalisadeProclamation } from "../engine/palisade";
import type { GameState } from "../engine/engine.types";
import type { GameSpeed } from "../engine/engine.types";
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
import {
  browserAnimationFrameScheduler,
  createFixedTickLoop,
} from "./fixedTickLoop";

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
  treasuryCoin: 0,
  wallTick: 0,
  era: "hamlet",
  eraProclaimedTick: null,
  palisade: null,
  forestHarvests: [],
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
    case "commit_simulation_state":
      return state === action.previousState ? action.nextState : state;
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
    case "confirm_stone_town_proclamation":
      return confirmStoneTownProclamation(state);
    default:
      return assertNever(action);
  }
}

export function GameProvider({ children }: GameProviderProps) {
  const [state, setState] = useState(DEFAULT_GAME_STATE);
  const stateRef = useRef(state);
  const [speed, setSpeedState] = useState<GameSpeed>(0);
  const speedRef = useRef(speed);

  const dispatch = useCallback((action: GameAction) => {
    const nextState = gameReducer(stateRef.current, action);
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const setSpeed = useCallback((nextSpeed: GameSpeed) => {
    speedRef.current = nextSpeed;
    setSpeedState(nextSpeed);
  }, []);

  useEffect(() => {
    const loop = createFixedTickLoop({
      scheduler: browserAnimationFrameScheduler,
      getSpeed: () => speedRef.current,
      getState: () => stateRef.current,
      commit: (previousState, nextState) => {
        dispatch({ type: "commit_simulation_state", previousState, nextState });
      },
    });
    loop.start();
    return loop.stop;
  }, [dispatch]);

  const value = useMemo(
    () => ({ state, dispatch, speed, setSpeed }),
    [dispatch, setSpeed, speed, state],
  );
  return createElement(GameStoreContext.Provider, { value }, children);
}

export function useGameStore(): GameStoreContextValue {
  const value = useContext(GameStoreContext);
  if (value === null) throw new Error("GameProvider is missing");
  return value;
}
