import { foodTransportGranaryAction } from './autoplayFoodTransport';
import { foodRouteRepairAction } from './autoplayFoodRoutes';
import { diagnosticAction, initialFoodDiagnostic, type FoodDiagnosticCollector, type FoodDiagnosticReason, type FoodKind } from './autoplayFoodDiagnostic';
import { canStaffFoodExpansion } from './autoplayFoodBottleneck';
import { foodCoverageAction } from './autoplayFoodCoverage';
import { blocksRepeatedFoodExpansion, hasActiveFoodObservation } from './autoplayFoodThroughput';
import { foodFacilityCount, foodFacilityWithinLimit } from './autoplayFoodLimits';
import { measuredFoodDecision } from './autoplayFoodMeasuredDecision';
import { housingLotCount } from '../population/housing';
import type { BuildingKind } from '../content/buildingConfig';
import { isBuildingConstructionSite } from '../economy/construction';
import type { AutoplayAction } from './autoplay.types';
import type { GameState } from './engine.types';

type BuildAction = (state: GameState, kind: BuildingKind) => AutoplayAction;

export function hasPendingFoodChain(state: GameState): boolean {
  return state.constructionSites.some((site) =>
    isBuildingConstructionSite(site) &&
    (site.kind === "wheat_farm" || site.kind === "mill" || site.kind === "granary")
  );
}

export function foodAction(state: GameState, buildAction: BuildAction, collector?: FoodDiagnosticCollector): AutoplayAction {
  let diagnostic = collector === undefined ? undefined : initialFoodDiagnostic(state);
  const finish = (action: AutoplayAction, reason: FoodDiagnosticReason): AutoplayAction => {
    if (collector !== undefined && diagnostic !== undefined) collector.food = { ...diagnostic, reached: true, reason, action: diagnosticAction(action) };
    return action;
  };
  const check = (phase: 'transition' | 'build', kind: FoodKind, name: 'repeat' | 'staff', result: boolean): boolean => {
    if (diagnostic !== undefined) diagnostic = { ...diagnostic, checks: [...diagnostic.checks, { phase, kind, check: name, result }],
      evaluation: { ...diagnostic.evaluation, [phase + (name === 'repeat' ? 'Repeat' : 'Staff')]: result } };
    return result;
  };
  if (housingLotCount(state) === 0) return finish({ kind: "none" }, 'no_housing');
  const wheatCount = foodFacilityCount(state, "wheat_farm");
  const millCount = foodFacilityCount(state, "mill");
  const granaryCount = foodFacilityCount(state, "granary");
  const availableBread = state.buildings.reduce((sum, b) => sum + (b.inventory.bread ?? 0), 0)
    + state.houses.reduce((sum, h) => sum + h.breadStock, 0);
  const target = wheatCount + millCount + granaryCount === 0 && availableBread >= 20 ? 0 : 1;
  if (diagnostic !== undefined) diagnostic = { ...diagnostic, counts: { wheat: wheatCount, mill: millCount, granary: granaryCount, target } };
  const repair = foodRouteRepairAction(state);
  if (repair.kind !== 'none') return finish(repair, 'food_route_repair');
  if (hasPendingFoodChain(state)) return finish({ kind: "none" }, 'pending_chain');
  if (hasActiveFoodObservation(state)) return finish({ kind: "none" }, 'active_observation');
  const completeChain = wheatCount > 0 && millCount > 0 && granaryCount > 0;
  const decision = completeChain ? measuredFoodDecision(state) : null;
  if (decision?.reason === 'observation_warmup') return finish({ kind: 'none' }, decision.reason);
  if (decision?.kind === null || decision === null) {
    const coverage = foodCoverageAction(state);
    if (coverage.kind !== 'none') return finish(coverage, 'coverage_selected');
  }
  if (decision?.reason === 'wheat_transport_blocked') {
    const storage = foodTransportGranaryAction(state);
    if (storage.kind !== 'none') return finish(storage, 'transport_storage_selected');
  }
  const recovery = decision?.kind ?? null;
  if (diagnostic !== undefined) diagnostic = { ...diagnostic, completeChain, recovery };
  let buildReason: FoodDiagnosticReason = 'bootstrap_selected';
  const foodBuildAction = (kind: FoodKind): AutoplayAction => {
    if (!foodFacilityWithinLimit(state, kind)) {
      buildReason = 'facility_limit'; return { kind: 'none' };
    }
    if (check('build', kind, 'repeat', blocksRepeatedFoodExpansion(state, kind))) {
      buildReason = 'repeat_blocked'; return { kind: 'none' };
    }
    if (completeChain && !check('build', kind, 'staff', canStaffFoodExpansion(state, kind))) {
      buildReason = 'staff_blocked'; return { kind: 'none' };
    }
    const action = buildAction(state, kind);
    if (action.kind === 'none') buildReason = 'build_returned_none';
    return action;
  };
  if (recovery !== null) {
    buildReason = 'recovery_selected';
    return finish(foodBuildAction(recovery), buildReason);
  }
  if (completeChain) return finish({ kind: 'none' }, decision?.reason ?? 'observation_warmup');
  if (wheatCount < target && wheatCount <= millCount) return finish(foodBuildAction("wheat_farm"), buildReason);
  if (millCount < target && millCount <= granaryCount) return finish(foodBuildAction("mill"), buildReason);
  if (wheatCount < target) return finish(foodBuildAction("wheat_farm"), buildReason);
  if (granaryCount < target) return finish(foodBuildAction("granary"), buildReason);
  if (millCount < target) return finish(foodBuildAction("mill"), buildReason);
  return finish({ kind: 'none' }, 'bootstrap_exhausted');
}
