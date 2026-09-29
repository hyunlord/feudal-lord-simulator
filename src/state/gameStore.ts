import { setFarmsteadCrop } from "../engine/ale";
import { startDrainage } from "../engine/drainage";
import { DEFAULT_SCENARIO_ID } from "../content/scenario/coreScenarios";
import { recordMaterialPlacement, refreshMaterialResult } from '../engine/autoplayMaterialLifecycle';
import {
  createContext,
  createElement,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { granaryCoverageTargetIds } from '../engine/autoplayFoodCoverage';
import { BALANCE } from "../content/balanceConfig";
import { mergeHouses } from "../engine/houseMerge";
import { demolishHouse } from "../engine/houseDemolition";
import { rebuildBurntHouse } from "../engine/fire";
import { famineResponse, respondToPetition } from "../engine/politics";
import { recordDecision } from "../engine/history";
import { cancelConstruction } from "../engine/constructionCancellation";
import { confirmStoneTownProclamation } from "../engine/era";
import { placeBuilding, placeRoadLine, removeRoad } from "../engine/gameActions";
import { confirmPalisadeProclamation, expandPalisade } from "../engine/palisade";
import { setWallConstructionPriority } from "../engine/constructionReserve";
import { eraseZone, paintZone, removeZone, undoZoneStroke } from "../zones/zoneEdits";
import { constructionSiteId } from "../economy/construction";
import type { GameState } from "../engine/engine.types";
import type { GameSpeed } from "../engine/engine.types";
import {
  createDeliveryInventoryPort,
  createSimulationRoutePorts,
} from "../engine/simulationPorts";
import { buildArchetypeWorld } from "../world/archetypeTerrain";
import { archetypeById } from "../content/scenario/registry";
import { RIVERSIDE_ARCHETYPE_ID } from "../content/scenario/archetypes";
import {
  applyOpeningVillageToTile,
  openingVillageBuildings,
  openingVillageHouses,
  withOpeningVillageServices,
} from "./openingVillage";
import type {
  GameAction,
  GameProviderProps,
  GameStoreApi,
  PreviousRenderState,
} from "./gameStore.types";
import { decisionSaveReason, seasonTurned } from "../save/autosavePolicy";
import { newGameState } from "./newGame";
import { SaveSystemContext, useSaveSystem } from "./saveSystem";
import { createUiChannel } from "./uiChannel";
import {
  browserAnimationFrameScheduler,
  createFixedTickLoop,
  type FixedTickLoop,
} from "./fixedTickLoop";

const WORLD_SEED = 1;
// ARCH-1b (MA-9): the riverside town's map is the open field's with its river carved across it.
const INITIAL_LAND = buildArchetypeWorld(archetypeById(RIVERSIDE_ARCHETYPE_ID)!, { width: 64, height: 64, seed: WORLD_SEED });
const INITIAL_WORLD = { width: 64, height: 64, tiles: INITIAL_LAND.terrains.map((terrain, index) => ({ tx: index % 64, ty: Math.floor(index / 64), terrain, buildingId: null, hasRoad: false })) };
const STARTING_BUILDINGS = openingVillageBuildings();
const STARTING_HOUSES = openingVillageHouses();

export const DEFAULT_GAME_STATE: GameState = withOpeningVillageServices({
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
  treasuryCoin: BALANCE.STARTING_COIN,
  wallTick: 0,
  era: "hamlet",
  eraProclaimedTick: null,
  palisade: null,
  forestHarvests: [],
  nextConstructionOrdinal: 1,
  roadRevision: 0,
  pathCache: {},
  scenarioId: DEFAULT_SCENARIO_ID,
  ...(INITIAL_LAND.river === null ? {} : { river: INITIAL_LAND.river }),
  zones: [],
  nextZoneOrdinal: 1,
});

export const GameStoreContext = createContext<GameStoreApi | null>(null);

function assertNever(action: never): never {
  throw new Error(`Unhandled game action: ${JSON.stringify(action)}`);
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  // F0-C2 (HL-2 ①): a command that changed the state is a decision in the history ledger.
  const next = recordDecision(state, reduceGameAction(state, action), action as unknown as { readonly type: string } & Readonly<Record<string, unknown>>);
  if (action.foodTransient === undefined || state.settlement?.outcome === "abandoned") return next;
  const { autoplayFoodTransientConfirmation: _confirmation, ...rest } = next;
  return action.foodTransient === null ? rest : { ...rest, autoplayFoodTransientConfirmation: action.foodTransient };
}

function reduceGameAction(state: GameState, action: GameAction): GameState {
  if (action.type === "load_saved_state") return action.state;
  // A new game is the default opening under the chosen scenario (B2 mode choice), ARCH-1 on the chosen land; unknown
  // ids are ignored.
  if (action.type === "start_new_game") return newGameState({ scenarioId: action.scenarioId,
    ...(action.archetypeId === undefined ? {} : { archetypeId: action.archetypeId }), ...(action.seed === undefined ? {} : { seed: action.seed }) }) ?? state;
  if (state.settlement?.outcome === "abandoned") {
    return action.type === "restart_settlement" ? structuredClone(DEFAULT_GAME_STATE) : state;
  }
  switch (action.type) {
    case "set_building_operation":
      return { ...state, buildings: state.buildings.map(building => building.id === action.buildingId && building.kind !== 'house'
        ? { ...building, operationPaused: action.paused, ...(action.paused ? { workers: 0 } : {}) } : building) };
    case "record_autoplay_food_confirmation": return state;
    case "restart_settlement":
      return state;
    case "commit_simulation_state":
      return state === action.previousState ? action.nextState : state;
    case "place_building": {
      const next = recordMaterialPlacement(state, placeBuilding(state, action.kind, { tx: action.tx, ty: action.ty }), action.materialRecovery);
      if (!action.autoplayFoodObservation || next === state ||
        (action.kind !== "granary" && action.kind !== "mill" && action.kind !== "wheat_farm")) return next;
      const targets = action.kind === "granary" ? granaryCoverageTargetIds(state, action) : [];
      return {
        ...next,
        autoplayFoodObservation: {
          kind: action.kind,
          siteId: constructionSiteId(state.nextConstructionOrdinal),
          placedTick: state.tick,
          ...(targets.length > 0 ? { targetHouseIds: targets } : {}),
        },
      };
    }
    case "place_road_line":
      return placeRoadLine(state, action.start, action.destination);
    case "remove_road":
      return removeRoad(state, { tx: action.tx, ty: action.ty });
    case "merge_houses":
      return mergeHouses(state, action.sourceBuildingId, action.targetBuildingId);
    case "demolish_house":
      return demolishHouse(state, action.buildingId);
    case "rebuild_house":
      return rebuildBurntHouse(state, action.buildingId);
    case "famine_response":
      return famineResponse(state, action.choice);
    case "petition_response":
      return respondToPetition(state, action.petitionId, action.response);
    case "set_farmstead_crop":
      return setFarmsteadCrop(state, action.buildingId, action.crop);
    case "drain_fen":
      return startDrainage(state, action.tx, action.ty);
    case "cancel_construction": {
      const routes = createSimulationRoutePorts(state);
      const result = cancelConstruction({
        state,
        siteId: action.siteId,
        inventory: createDeliveryInventoryPort(),
        routes: routes.delivery,
      }).state;
      const materialResult = refreshMaterialResult(result);
      if (
        state.autoplayFoodObservation?.siteId !== action.siteId ||
        state.autoplayFoodObservation.completedTick !== undefined
      ) return materialResult;
      const { autoplayFoodObservation: _autoplayFoodObservation, ...withoutObservation } = materialResult;
      return withoutObservation;
    }
    case "confirm_palisade_proclamation":
      return confirmPalisadeProclamation(state, action.candidatePath);
    case "confirm_stone_town_proclamation":
      return confirmStoneTownProclamation(state);
    case "expand_palisade":
      return expandPalisade(state, action.candidatePath);
    case "set_wall_construction_priority":
      return setWallConstructionPriority(state, action.priority);
    case "zone_paint":
      return paintZone(state, action.kind, action.stroke);
    case "zone_erase":
      return eraseZone(state, action.stroke);
    case "zone_remove":
      return removeZone(state, action.id);
    case "zone_undo_stroke":
      return undoZoneStroke(state);
    default:
      return assertNever(action);
  }
}

/**
 * CODE-1c: how often the UI channel passes a committed tick on (actions pass at once). At 5x a tick lands about every
 * 77 ms; the UI reads four states a second, the canvas every one (measured: scripts/reactCommitPerf.mjs, pop176 at 5x).
 */
export const UI_REFRESH_MS = 250;

type Listener = () => void;

export function GameProvider({ children }: GameProviderProps) {
  const [sessionKey, setSessionKey] = useState(0);
  // The state the store starts from (scripts/sceneInjection.mjs replaces this call to start a scene).
  const [initialState] = useState(DEFAULT_GAME_STATE);
  const stateRef = useRef(initialState);
  const previousRenderStateRef = useRef<PreviousRenderState>(initialState);
  const loopRef = useRef<FixedTickLoop | null>(null);
  const speedRef = useRef<GameSpeed>(0);
  const listenersRef = useRef(new Set<Listener>());
  const [ui] = useState(() => createUiChannel({ initial: initialState, read: () => stateRef.current, intervalMs: UI_REFRESH_MS,
    now: () => performance.now(), setTimer: (run, delayMs) => setTimeout(run, delayMs), clearTimer: timer => clearTimeout(timer as ReturnType<typeof setTimeout>) }));
  const requestSaveRef = useRef<((reason: import("../save/autosavePolicy").SaveReason) => void) | null>(null);
  const noteSeasonTurnRef = useRef<(() => void) | null>(null);
  const newSessionRef = useRef<(() => void) | null>(null);

  // A committed tick reaches the UI at most every UI_REFRESH_MS (the last one always does); an action at once.
  const notify = useCallback((simulation: boolean) => {
    for (const listener of [...listenersRef.current]) listener();
    if (simulation) ui.publishThrottled(); else ui.publish();
  }, [ui]);
  useEffect(() => () => ui.dispose(), [ui]);

  const setSpeedNow = useCallback((nextSpeed: GameSpeed) => {
    if (speedRef.current === nextSpeed) return;
    speedRef.current = nextSpeed;
    notify(false);
  }, [notify]);

  const dispatch = useCallback((action: GameAction) => {
    const currentState = stateRef.current;
    const nextState = gameReducer(currentState, action);
    previousRenderStateRef.current =
      action.type === "commit_simulation_state" && currentState === action.previousState
        ? action.previousState
        : nextState;
    stateRef.current = nextState;
    if (nextState.settlement?.outcome === "abandoned" || action.type === "restart_settlement") speedRef.current = 0;
    if (action.type === "load_saved_state" || action.type === "start_new_game") {
      previousRenderStateRef.current = nextState;
      speedRef.current = 0;
    }
    if ((action.type === "restart_settlement" || action.type === "load_saved_state" || action.type === "start_new_game") && nextState !== currentState) {
      setSessionKey(key => key + 1);
    }
    notify(action.type === "commit_simulation_state");
    if (action.type === "commit_simulation_state" && seasonTurned(currentState, nextState)) noteSeasonTurnRef.current?.();
    const decision = action.type === "load_saved_state" || action.type === "restart_settlement" || action.type === "start_new_game"
      ? null : decisionSaveReason(currentState, nextState);
    if (action.type === "restart_settlement" && nextState !== currentState) newSessionRef.current?.();
    if (decision !== null) requestSaveRef.current?.(decision);
  }, [notify]);
  const onLoaded = useCallback((loaded: GameState) => dispatch({ type: "load_saved_state", state: loaded }), [dispatch]);
  const saveSystem = useSaveSystem({ stateRef, onLoaded });
  requestSaveRef.current = saveSystem.requestSave;
  noteSeasonTurnRef.current = saveSystem.noteSeasonTurn;
  newSessionRef.current = saveSystem.value.declineContinue;

  const setSpeed = useCallback((nextSpeed: GameSpeed) => {
    if (stateRef.current.settlement?.outcome === "abandoned") return;
    const pausing = nextSpeed === 0 && speedRef.current !== 0;
    if (pausing) requestSaveRef.current?.("pause");
    setSpeedNow(nextSpeed);
  }, [setSpeedNow]);

  useEffect(() => {
    const loop = createFixedTickLoop({
      scheduler: browserAnimationFrameScheduler,
      getSpeed: () => speedRef.current,
      getState: () => stateRef.current,
      commit: (previousState, nextState) => {
        dispatch({ type: "commit_simulation_state", previousState, nextState });
      },
    });
    loopRef.current = loop;
    loop.start();
    return () => {
      loop.stop();
      if (loopRef.current === loop) loopRef.current = null;
    };
  }, [dispatch]);

  const api = useMemo<GameStoreApi>(() => ({
    getState: () => stateRef.current,
    getPreviousRenderState: () => previousRenderStateRef.current,
    getSpeed: () => speedRef.current,
    subscribe: (listener) => { listenersRef.current.add(listener); return () => { listenersRef.current.delete(listener); }; },
    getUiState: ui.getState,
    subscribeUi: ui.subscribe,
    interpolationAlpha: () => loopRef.current?.interpolationAlpha() ?? 1,
    dispatch,
    setSpeed,
  }), [dispatch, setSpeed, ui]);
  return createElement(GameStoreContext.Provider, { value: api },
    createElement(SaveSystemContext.Provider, { value: saveSystem.value }, createElement(Fragment, { key: sessionKey }, children)));
}

export function useGameApi(): GameStoreApi {
  const value = useContext(GameStoreContext);
  if (value === null) throw new Error("GameProvider is missing");
  return value;
}

/**
 * What a component reads of the game on the UI channel: it re-renders only when `select` gives a value `isEqual`
 * calls different. A selector that closes over component state may change on each render; the value is recomputed then.
 */
export function useGameUiSelector<T>(select: (state: GameState) => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
  const api = useGameApi();
  return useSelected(api.subscribeUi, api.getUiState, select, isEqual);
}

/** The same on every change (each tick): only for what must follow each tick in React (the autoplay decision). */
export function useGameSelector<T>(select: (state: GameState) => T, isEqual: (a: T, b: T) => boolean = Object.is): T {
  const api = useGameApi();
  return useSelected(api.subscribe, api.getState, select, isEqual);
}

export function useGameSpeed(): GameSpeed {
  const api = useGameApi();
  return useSyncExternalStore(api.subscribe, api.getSpeed, api.getSpeed);
}

function useSelected<T>(subscribe: (listener: () => void) => () => void, read: () => GameState,
  select: (state: GameState) => T, isEqual: (a: T, b: T) => boolean): T {
  const memo = useRef<{ state: GameState; select: (state: GameState) => T; value: T } | null>(null);
  const snapshot = () => {
    const state = read(); const current = memo.current;
    if (current !== null && current.state === state && current.select === select) return current.value;
    const next = select(state);
    const value = current !== null && isEqual(current.value, next) ? current.value : next;
    memo.current = { state, select, value };
    return value;
  };
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
