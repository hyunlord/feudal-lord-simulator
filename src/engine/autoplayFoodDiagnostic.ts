import type { SearchDiagnosticCollector } from './autoplaySearchBudget';
import type { MeasuredFoodReason } from './autoplayFoodMeasuredDecision';
import type { ServicePlanningCollector } from './autoplayServices';
import type { AutoplayAction } from './autoplay.types';
import type { AutoplayFoodTransientConfirmation } from './autoplayFoodTransient';
import type { GameState } from './engine.types';
import type { BotRecoveryCollector } from './autoplayBotRecovery';

export type FoodDiagnosticReason = MeasuredFoodReason | 'food_route_repair' | 'transport_storage_selected' | 'transport_capacity_selected' | 'facility_limit' | 'not_reached' | 'no_housing' | 'pending_chain' | 'active_observation'
  | 'coverage_selected' | 'recovery_deferred' | 'recovery_selected' | 'repeat_blocked' | 'staff_blocked'
  | 'build_returned_none' | 'transient_metadata_only' | 'measured_no_recovery' | 'unmeasured_starving_guard'
  | 'bootstrap_selected' | 'bootstrap_exhausted';
export type FoodCheck = 'not_evaluated' | boolean;
/** The food chain slots; `farmstead` is the grain slot (a field block or its farmstead, AF-13). */
export type FoodKind = 'farmstead' | 'mill' | 'granary';
export type FoodTransientSummary = Omit<Extract<AutoplayFoodTransientConfirmation, { status: 'pending' }>, 'epoch'>
  | Extract<AutoplayFoodTransientConfirmation, { status: 'failed_until_positive_window' }> | null | 'not_evaluated';
export interface DiagnosticAction {
  readonly kind: AutoplayAction['kind'];
  readonly building?: string;
  readonly tx?: number;
  readonly ty?: number;
  readonly from?: { readonly tx: number; readonly ty: number };
  readonly to?: { readonly tx: number; readonly ty: number };
  readonly foodTransient: FoodTransientSummary;
}
export interface FoodDiagnostic {
  readonly schemaVersion: 1;
  readonly tick: number;
  readonly reached: boolean;
  readonly reason: FoodDiagnosticReason;
  readonly action: DiagnosticAction | null;
  readonly counts?: { readonly wheat: number; readonly mill: number; readonly granary: number; readonly target: number };
  readonly completeChain?: boolean;
  readonly recovery?: FoodKind | null;
  readonly transition?: { readonly defer: boolean; readonly metadata: FoodTransientSummary };
  readonly observation?: { readonly kind: FoodKind | 'wheat_farm'; readonly siteId: string; readonly placedTick: number; readonly completedTick?: number; readonly observeUntilTick?: number; readonly outcome?: NonNullable<GameState['autoplayFoodObservation']>['outcome'] };
  readonly evaluation: { readonly transitionRepeat: FoodCheck; readonly transitionStaff: FoodCheck; readonly buildRepeat: FoodCheck; readonly buildStaff: FoodCheck };
  readonly checks: readonly { readonly phase: 'transition' | 'build'; readonly kind: FoodKind;
    readonly check: 'repeat' | 'staff'; readonly result: FoodCheck }[];
  readonly details: 'not_captured';
}
// One-call accumulator, owned by the driver; never supplied to its external observer.
export interface FoodDiagnosticCollector extends ServicePlanningCollector, SearchDiagnosticCollector, BotRecoveryCollector { food?: FoodDiagnostic }
export function transientSummary(value: AutoplayFoodTransientConfirmation | null | undefined): FoodTransientSummary {
  if (value === undefined) return 'not_evaluated';
  if (value === null) return null;
  switch (value.status) {
    case 'pending': return { status: value.status, startedTick: value.startedTick, deadlineTick: value.deadlineTick,
      evaluationTick: value.evaluationTick, firstWindowUntilTick: value.firstWindowUntilTick };
    case 'failed_until_positive_window': return { status: value.status, failedTick: value.failedTick };
  }
}
export function diagnosticAction(action: AutoplayAction): DiagnosticAction {
  const foodTransient = transientSummary(action.foodTransient);
  switch (action.kind) {
    case 'place_building': return { kind: action.kind, building: action.building, tx: action.tx, ty: action.ty, foodTransient };
    case 'place_road': return { kind: action.kind, from: { ...action.from }, to: { ...action.to }, foodTransient };
    case 'proclaim_era': return { kind: action.kind, foodTransient };
    case 'set_wall_construction_priority': return { kind: action.kind, foodTransient };
    case 'paint_zone': return { kind: action.kind, building: action.zone, tx: Math.floor(action.stroke.points[0]?.x ?? 0), ty: Math.floor(action.stroke.points[0]?.y ?? 0), foodTransient };
    case 'none': return { kind: action.kind, foodTransient };
  }
}
export function initialFoodDiagnostic(state: GameState): FoodDiagnostic {
  const observation = state.autoplayFoodObservation;
  return { schemaVersion: 1, tick: state.tick, reached: false, reason: 'not_reached', action: null, checks: [],
    details: 'not_captured', evaluation: { transitionRepeat: 'not_evaluated', transitionStaff: 'not_evaluated', buildRepeat: 'not_evaluated', buildStaff: 'not_evaluated' },
    ...(observation === undefined ? {} : { observation: { kind: observation.kind, siteId: observation.siteId, placedTick: observation.placedTick,
      ...(observation.completedTick === undefined ? {} : { completedTick: observation.completedTick }),
      ...(observation.observeUntilTick === undefined ? {} : { observeUntilTick: observation.observeUntilTick }),
      ...(observation.outcome === undefined ? {} : { outcome: { ...observation.outcome } }) } }) };
}
