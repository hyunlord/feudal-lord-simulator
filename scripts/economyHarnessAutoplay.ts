import { decideNextAction, type AutoplayAction } from "../src/engine/autoplay";
import { autoplayActionToGameAction } from "../src/engine/autoplayActions";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { AUTOPLAY_TICK_CADENCE, canRunAutoplayAtTick } from "../src/ui/autoplayPresentation";
import { hashEconomyState } from "./economyHarnessSerializer";

export interface AutoplayHarnessAction {
  readonly tick: number;
  readonly advisorAction: AutoplayAction;
}

export interface AutoplayHarnessReport {
  readonly hash: string;
  readonly appliedActions: readonly AutoplayHarnessAction[];
  readonly snapshots: readonly AutoplayHarnessSnapshot[];
  readonly finalState: GameState;
}

export interface AutoplayHarnessSnapshot {
  readonly tick: number;
  readonly population: number;
  readonly bread: number;
  readonly houses: number;
}

export interface AdvisorTraceProvenance {
  readonly id: string;
  readonly source: string;
  readonly cadenceTicks: number;
  readonly actionCount: number;
  readonly snapshotCount: number;
}

export interface AdvisorRunsProvenance {
  readonly kind: "advisor-runs";
  readonly traces: readonly AdvisorTraceProvenance[];
}

export interface AutoplayTraceDriver {
  readonly appliedActions: readonly AutoplayHarnessAction[];
  readonly snapshots: readonly AutoplayHarnessSnapshot[];
  readonly apply: (state: GameState) => GameState;
  readonly recordSnapshot: (state: GameState) => void;
  readonly provenance: () => AdvisorTraceProvenance;
}

function totalBread(state: GameState): number {
  const buildingBread = state.buildings.reduce((total, building) => total + (building.inventory.bread ?? 0), 0);
  return state.houses.reduce((total, house) => total + house.breadStock, buildingBread);
}

export function createAutoplayTraceDriver(input: {
  readonly id: string;
  readonly source: string;
  readonly proclamationGateTick?: number;
} = { id: "autoplay", source: "direct" }): AutoplayTraceDriver {
  let lastActionTick = -AUTOPLAY_TICK_CADENCE;
  const appliedActions: AutoplayHarnessAction[] = [];
  const snapshots: AutoplayHarnessSnapshot[] = [];
  return {
    appliedActions,
    snapshots,
    apply(state) {
      if (!canRunAutoplayAtTick({ enabled: true, currentTick: state.tick, lastActionTick })) return state;
      const advisorAction = decideNextAction(state);
      if (
        input.proclamationGateTick !== undefined &&
        advisorAction.kind === "proclaim_era" &&
        state.tick < input.proclamationGateTick
      ) {
        return state;
      }
      const gameAction = autoplayActionToGameAction(advisorAction, state);
      if (gameAction === null) return state;
      appliedActions.push({ tick: state.tick, advisorAction });
      const next = gameReducer(state, gameAction);
      lastActionTick = next.tick;
      return next;
    },
    recordSnapshot(state) {
      snapshots.push({
        tick: state.tick,
        population: state.population,
        bread: totalBread(state),
        houses: state.houses.length,
      });
    },
    provenance() {
      return {
        id: input.id,
        source: input.source,
        cadenceTicks: AUTOPLAY_TICK_CADENCE,
        actionCount: appliedActions.length,
        snapshotCount: snapshots.length,
      };
    },
  };
}

export function trackAutoplayRun(input: {
  readonly initialState: GameState;
  readonly ticks: number;
}): AutoplayHarnessReport {
  let state = input.initialState;
  const driver = createAutoplayTraceDriver();
  driver.recordSnapshot(state);

  for (let step = 0; step < input.ticks; step += 1) {
    state = driver.apply(state);
    state = advanceTick(state);
    if (state.tick % 1_200 === 0 || step === input.ticks - 1) driver.recordSnapshot(state);
  }

  return {
    hash: hashEconomyState(state),
    appliedActions: driver.appliedActions,
    snapshots: driver.snapshots,
    finalState: state,
  };
}
