import { foodSupplyPoolIds, foodPoolSnapshot, type FoodPoolSnapshot } from './autoplayFoodBottleneck';
import { BALANCE } from '../content/balanceConfig';
import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { HOUSE_FOOD_INTERVAL } from '../content/houseFoodConfig';
import { buildingHasRequiredRoadAccess } from './roadAccess';
import { resolveBuildingRoute } from './routing';
import type { GameState } from './engine.types';

export interface FoodFlowWindow {
  readonly meals?: import("./autoplayFoodTransientMeals").FoodMealEvidence;
  readonly startedTick: number;
  readonly untilTick: number;
  readonly wheatProduced: number;
  readonly breadProduced: number;
  readonly wheatExported: number;
  readonly breadExported: number;
  readonly qualified?: boolean;
  readonly farmFullTicks?: number;
  readonly farmReadyTicks?: number;
  readonly farmOpeningProgress?: number;
  readonly farmCount?: number;
  readonly farmTicksPerOutput?: number;
  readonly poolStart?: FoodPoolSnapshot;
  readonly poolEnd?: FoodPoolSnapshot;
}

export interface AutoplayFoodFlow {
  readonly poolIds?: readonly string[];
  readonly layout: string;
  readonly routes: string;
  readonly roadRevision: number;
  readonly current: FoodFlowWindow;
  readonly completed?: FoodFlowWindow;
}

type FoodFlowActivity = Partial<Pick<FoodFlowWindow,
  'wheatProduced' | 'breadProduced' | 'wheatExported' | 'breadExported' | 'farmFullTicks' | 'farmReadyTicks'>>;

export function foodFlowLayout(state: GameState): string {
  return state.buildings.filter(b => ['wheat_farm', 'mill', 'granary', 'market', 'house'].includes(b.kind))
    .map(b => `${b.id}:${b.kind}:${b.tx},${b.ty}:${b.workers >= BUILDING_CONFIG_BY_KIND[b.kind].workersRequired}:${buildingHasRequiredRoadAccess(state, b)}`).join('|');
}

export function foodFlowRoutes(state: GameState): string {
  const granaries = state.buildings.filter(b => b.kind === 'granary');
  return state.buildings.filter(b => b.kind === 'wheat_farm' || b.kind === 'mill' || b.kind === 'market' || b.kind === 'house')
    .map(b => `${b.id}:${granaries.filter(g => resolveBuildingRoute(state, b, g).path !== null).map(g => g.id).join(',')}`).join('|');
}

function opportunityTicks(state: GameState): number {
  let batchTicks = 0;
  const foodIds = new Set<string>();
  for (const building of state.buildings) {
    if (building.kind !== 'mill' && building.kind !== 'wheat_farm') continue;
    foodIds.add(building.id);
    const production = BUILDING_CONFIG_BY_KIND[building.kind].production;
    if (production === null) continue;
    const outputs = BALANCE.CARTER_CAPACITY / Math.max(1, production.inputPerOutput);
    batchTicks = Math.max(batchTicks, Math.ceil(outputs) * production.ticksPerOutput);
  }
  let haulingTicks = 0;
  for (const walker of state.walkers) {
    if (walker.kind !== 'carter' || !foodIds.has(walker.homeBuildingId)) continue;
    haulingTicks = Math.max(haulingTicks, 2 * Math.ceil(Math.max(0, walker.path.length - 1) / BALANCE.CARTER_SPEED));
  }
  const deliveryTicks = BALANCE.DISTRIBUTOR_INTERVAL + Math.ceil(2 * BALANCE.DISTRIBUTOR_RANGE / BALANCE.DISTRIBUTOR_SPEED);
  return Math.max(HOUSE_FOOD_INTERVAL, batchTicks + haulingTicks + deliveryTicks);
}

function emptyWindow(state: GameState, poolIds: readonly string[]): FoodFlowWindow {
  const poolStart = foodPoolSnapshot(state, poolIds);
  const farms = state.buildings.filter(b => b.kind === 'wheat_farm');
  const production = BUILDING_CONFIG_BY_KIND.wheat_farm.production;
  const validPhases = production !== null && farms.length > 0 && farms.every(b =>
    Number.isSafeInteger(b.productionProgress) && b.productionProgress >= 0
    && b.productionProgress < production.ticksPerOutput);
  return { startedTick: state.tick, untilTick: state.tick + opportunityTicks(state),
    wheatProduced: 0, breadProduced: 0, wheatExported: 0, breadExported: 0, farmFullTicks: 0, farmReadyTicks: 0,
    farmOpeningProgress: farms.reduce((sum, b) => sum + b.productionProgress, 0),
    ...(validPhases ? { farmCount: farms.length, farmTicksPerOutput: production.ticksPerOutput } : {}),
    ...(poolStart === undefined ? {} : { poolStart }) };
}

// Called at the opening of a substep: a closed window contains (startedTick, untilTick].
export function advanceFoodFlow(state: GameState): GameState {
  const layout = foodFlowLayout(state);
  const flow = state.autoplayFoodFlow;
  const routes = flow?.layout === layout && flow.roadRevision === state.roadRevision
    ? flow.routes : foodFlowRoutes(state);
  const poolIds = flow?.layout === layout && flow.routes === routes && flow.poolIds !== undefined
    ? flow.poolIds : foodSupplyPoolIds(state);
  const epoch = { layout, routes, roadRevision: state.roadRevision, poolIds };
  if (flow === undefined || flow.layout !== layout || flow.routes !== routes
    || flow.current.qualified === false || state.tick < flow.current.startedTick) {
    return { ...state, autoplayFoodFlow: { ...epoch, current: emptyWindow(state, poolIds) } };
  }
  const untilTick = Math.max(flow.current.untilTick, flow.current.startedTick + opportunityTicks(state));
  if (state.tick >= untilTick) {
    const poolEnd = foodPoolSnapshot(state, poolIds);
    return { ...state, autoplayFoodFlow: { ...epoch, current: emptyWindow(state, poolIds),
      completed: { ...flow.current, untilTick: state.tick,
        ...(poolEnd === undefined ? {} : { poolEnd }) } } };
  }
  return untilTick === flow.current.untilTick && flow.roadRevision === state.roadRevision ? state : {
    ...state, autoplayFoodFlow: { ...flow, ...epoch, current: { ...flow.current, untilTick } },
  };
}

export function recordFoodFlow(state: GameState, activity: FoodFlowActivity): GameState {
  const flow = state.autoplayFoodFlow;
  if (flow === undefined) return state;
  const current = flow.current;
  return { ...state, autoplayFoodFlow: { ...flow, current: { ...current,
    qualified: current.qualified !== false && flow.layout === foodFlowLayout(state),
    farmReadyTicks: (current.farmReadyTicks ?? 0) + (activity.farmReadyTicks ?? 0),
    farmFullTicks: (current.farmFullTicks ?? 0) + (activity.farmFullTicks ?? 0),
    wheatProduced: current.wheatProduced + (activity.wheatProduced ?? 0),
    breadProduced: current.breadProduced + (activity.breadProduced ?? 0),
    wheatExported: current.wheatExported + (activity.wheatExported ?? 0),
    breadExported: current.breadExported + (activity.breadExported ?? 0),
  } } };
}

export function measuredFoodFlow(state: GameState): FoodFlowWindow | undefined {
  const flow = state.autoplayFoodFlow;
  const sample = flow?.completed;
  if (flow === undefined || sample === undefined || flow.current.qualified === false || sample.qualified === false
    || flow.layout !== foodFlowLayout(state)
    || flow.roadRevision !== state.roadRevision && flow.routes !== foodFlowRoutes(state)
    || state.tick < sample.untilTick || state.tick - sample.untilTick >= sample.untilTick - sample.startedTick) return undefined;
  return sample;
}
