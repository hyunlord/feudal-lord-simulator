import type { AutoplaySearchDiagnostic } from '../src/engine/autoplaySearchBudget';
import type { ServicePlanningDiagnostic } from '../src/engine/autoplayServices';
import { diagnosticAction, initialFoodDiagnostic, type DiagnosticAction, type FoodDiagnostic, type FoodDiagnosticCollector } from '../src/engine/autoplayFoodDiagnostic';
import { decideNextAction, type AutoplayAction, type AutoplayPolicy } from "../src/engine/autoplay";
import { autoplayActionToGameAction } from "../src/engine/autoplayActions";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { gameReducer } from "../src/state/gameStore";
import { AUTOPLAY_TICK_CADENCE, canRunAutoplayAtTick } from "../src/ui/autoplayPresentation";
import { hashEconomyState } from "./economyHarnessSerializer";
import { shouldRetryAutoplayAfterMillReplenishment } from '../src/engine/autoplayMillReplenishment';
import type { BotRecoveryDiagnostic } from '../src/engine/autoplayBotRecovery';

export interface AdvisorDiagnosticReceipt {
  readonly schemaVersion: 1;
  readonly tick: number;
  readonly food: FoodDiagnostic;
  readonly services?: readonly ServicePlanningDiagnostic[];
  readonly recovery?: readonly BotRecoveryDiagnostic[];
  readonly search?: AutoplaySearchDiagnostic;
  readonly advisorAction: DiagnosticAction;
  readonly gameActionType: string | null;
  readonly result: 'gated' | 'no_action' | 'applied' | 'rejected';
  readonly newSiteIds: readonly string[];
}
export class AdvisorDiagnosticError extends Error {
  readonly status = 'partial';
  readonly evidence = 'FAIL';
  constructor(readonly appliedState: GameState, readonly receipt: AdvisorDiagnosticReceipt, cause: unknown) {
    super('Advisor diagnostic observer failed after decision/application bookkeeping', { cause });
    this.name = 'AdvisorDiagnosticError';
  }
}

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
  readonly policy?: AutoplayPolicy;
  readonly onDiagnostic?: (receipt: AdvisorDiagnosticReceipt) => void;
} = { id: "autoplay", source: "direct" }): AutoplayTraceDriver {
  let lastActionTick = -AUTOPLAY_TICK_CADENCE;
  let lastDecisionTick = -AUTOPLAY_TICK_CADENCE;
  let observedState: GameState | null = null;
  let previousAction: AutoplayAction | null = null;
  const appliedActions: AutoplayHarnessAction[] = [];
  const snapshots: AutoplayHarnessSnapshot[] = [];
  return {
    appliedActions,
    snapshots,
    apply(state) {
      const previous = observedState;
      observedState = state;
      if (!canRunAutoplayAtTick({ enabled: true, currentTick: state.tick, lastActionTick })) return state;
      if (state.tick - lastDecisionTick < AUTOPLAY_TICK_CADENCE
        && !(previousAction?.kind === 'none' && previous !== null
          && shouldRetryAutoplayAfterMillReplenishment(previous, state))) return state;
      lastDecisionTick = state.tick;
      const diagnostic: FoodDiagnosticCollector | undefined = input.onDiagnostic === undefined ? undefined : {};
      const advisorAction = decideNextAction(state, input.policy, diagnostic);
      previousAction = advisorAction;
      const report = (next: GameState, result: AdvisorDiagnosticReceipt['result'], gameActionType: string | null): GameState => {
        if (input.onDiagnostic === undefined || diagnostic === undefined) return next;
        const receipt: AdvisorDiagnosticReceipt = { schemaVersion: 1, tick: state.tick,
          ...(diagnostic.search === undefined ? {} : { search: diagnostic.search }),
          ...(diagnostic.recovery === undefined ? {} : { recovery: diagnostic.recovery }),
          food: diagnostic.food ?? initialFoodDiagnostic(state), services: diagnostic.services ?? [], advisorAction: diagnosticAction(advisorAction),
          gameActionType, result, newSiteIds: next.constructionSites.filter(site =>
            !state.constructionSites.some(old => old.id === site.id)).map(site => site.id) };
        try { input.onDiagnostic(structuredClone(receipt)); }
        catch (cause) { throw new AdvisorDiagnosticError(next, receipt, cause); }
        return next;
      };
      if (
        input.proclamationGateTick !== undefined &&
        advisorAction.kind === "proclaim_era" &&
        state.tick < input.proclamationGateTick
      ) {
        return report(state, 'gated', null);
      }
      const gameAction = autoplayActionToGameAction(advisorAction, state);
      if (gameAction === null) return report(state, 'no_action', null);
      appliedActions.push({ tick: state.tick, advisorAction });
      const next = gameReducer(state, gameAction);
      lastActionTick = next.tick;
      return report(next, next === state ? 'rejected' : 'applied', gameAction.type);
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
