import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from '../content/buildingConfig';
import { availableStock } from '../economy/storage';
import { isBuildingConstructionSite } from '../economy/construction';
import { availableWorkers } from '../population/labour';
import { resolveBuildingRoute } from './routing';
import type { GameState } from './engine.types';
import type { FoodFlowWindow } from './autoplayFoodFlow';

export interface FoodPoolSnapshot {
  readonly wheat: number;
  readonly bread: number;
  readonly usableWheat: number;
  readonly usableBread: number;
}

// A global flow can qualify a buffer only when every food facility shares its supply pool.
export function foodSupplyPoolIds(state: GameState): readonly string[] {
  const food = state.buildings.filter(b => ['wheat_farm', 'mill', 'granary', 'house'].includes(b.kind));
  const anchor = food.find(b => b.kind === 'granary');
  if (anchor === undefined || food.some(b => b.id !== anchor.id && resolveBuildingRoute(state, b, anchor).path === null)) return [];
  return food.map(b => b.id);
}

export function foodPoolSnapshot(state: GameState, ids: readonly string[]): FoodPoolSnapshot | undefined {
  if (ids.length === 0) return undefined;
  const pool = new Set(ids);
  let wheat = 0;
  let bread = 0;
  let usableWheat = 0;
  let usableBread = 0;
  for (const building of state.buildings) {
    if (!pool.has(building.id)) continue;
    wheat += building.inventory.wheat ?? 0;
    bread += building.inventory.bread ?? 0;
    usableWheat += availableStock(building, 'wheat');
    usableBread += availableStock(building, 'bread');
  }
  bread += state.houses.filter(house => pool.has(house.buildingId)).reduce((sum, house) => sum + house.breadStock, 0);
  for (const walker of state.walkers) {
    if (!pool.has(walker.homeBuildingId) || walker.cargo === null) continue;
    const { resource, amount } = walker.cargo;
    if (resource === 'wheat') wheat += amount;
    if (resource === 'bread') bread += amount;
    const deliverable = walker.kind === 'distributor' && walker.phase === 'roaming'
      || walker.kind === 'carter' && walker.cancellation === null
        && (walker.mission === 'fetch' && walker.phase === 'returning'
          || walker.mission === 'deliver' && walker.phase === 'outbound'
            && walker.destination.kind === 'building' && pool.has(walker.destination.buildingId));
    if (!deliverable) continue;
    if (resource === 'wheat') usableWheat += amount;
    if (resource === 'bread') usableBread += amount;
  }
  return { wheat, bread, usableWheat, usableBread };
}

export function backpressuredFoodRecovery(
  state: GameState, sample: FoodFlowWindow, breadDemand: number,
): 'mill' | 'wait' | undefined {
  const start = sample.poolStart;
  const end = sample.poolEnd;
  const current = foodPoolSnapshot(state, state.autoplayFoodFlow?.poolIds ?? []);
  if (start === undefined || end === undefined || current === undefined || (sample.farmFullTicks ?? 0) === 0
    || end.usableWheat <= 0 || current.usableWheat <= 0) return undefined;
  const potential = unblockedWheatUpperBound(sample);
  const inputPerBread = BUILDING_CONFIG_BY_KIND.mill.production?.inputPerOutput ?? 0;
  if (potential === undefined || potential - sample.wheatExported < breadDemand * inputPerBread) return undefined;
  if (end.wheat < start.wheat) {
    const lowerBound = unblockedWheatLowerBound(sample);
    const requiredWheat = breadDemand * inputPerBread;
    const rawDeficit = requiredWheat - (sample.wheatProduced - sample.wheatExported);
    if (sample.farmCount !== state.buildings.filter(b => b.kind === 'wheat_farm').length
      || lowerBound === undefined || lowerBound - sample.wheatExported < requiredWheat
      || !(Math.min(end.usableWheat, current.usableWheat) >= rawDeficit)) return undefined;
  }
  return breadBufferCoversDeficit(state, sample, breadDemand) ? 'wait' : 'mill';
}

// sum floor(work_i/T) >= floor(sum work_i/T) - (n-1). This is counterfactual
// unblocked work, never realised production or inventory credited to the simulation.
export function unblockedWheatLowerBound(sample: FoodFlowWindow): number | undefined {
  const { farmCount: count, farmTicksPerOutput: period, farmOpeningProgress: opening,
    farmReadyTicks: ready, farmFullTicks: full } = sample;
  const duration = sample.untilTick - sample.startedTick;
  if (sample.qualified !== true || count === undefined || period === undefined || opening === undefined
    || ready === undefined || full === undefined || period !== BUILDING_CONFIG_BY_KIND.wheat_farm.production?.ticksPerOutput
    || ![count, period, opening, ready, full, duration, sample.wheatProduced, sample.wheatExported].every(Number.isSafeInteger)
    || count <= 0 || period <= 0 || duration <= 0 || opening < 0 || opening >= count * period
    || ready < 0 || ready > count * duration || full <= 0 || full > ready
    || sample.wheatProduced < 0 || sample.wheatExported < 0) return undefined;
  return Math.max(0, Math.floor((opening + ready) / period) - (count - 1));
}

// Pooling opening partial batches only loosens this bound; it is never recorded as production.
export function unblockedWheatUpperBound(sample: FoodFlowWindow): number | undefined {
  const production = BUILDING_CONFIG_BY_KIND.wheat_farm.production;
  return sample.farmOpeningProgress === undefined || sample.farmReadyTicks === undefined || production === null
    ? undefined : Math.floor((sample.farmOpeningProgress + sample.farmReadyTicks) / production.ticksPerOutput);
}

export function breadBufferCoversDeficit(state: GameState, sample: FoodFlowWindow, breadDemand: number): boolean {
  const start = sample.poolStart;
  const end = sample.poolEnd;
  const current = foodPoolSnapshot(state, state.autoplayFoodFlow?.poolIds ?? []);
  return start !== undefined && end !== undefined && current !== undefined && end.bread >= start.bread
    && Math.min(end.usableBread, current.usableBread) >= breadDemand - (sample.breadProduced - sample.breadExported);
}

export function canStaffFoodExpansion(state: GameState, kind: BuildingKind): boolean {
  if (kind !== 'wheat_farm' && kind !== 'mill') return true;
  const required = BUILDING_CONFIG_BY_KIND[kind].workersRequired;
  const existing = state.buildings.reduce((sum, b) => sum + BUILDING_CONFIG_BY_KIND[b.kind].workersRequired, 0);
  const planned = state.constructionSites.filter(isBuildingConstructionSite)
    .reduce((sum, site) => sum + BUILDING_CONFIG_BY_KIND[site.kind].workersRequired, 0);
  return state.idleWorkers >= required && availableWorkers(state.population) - existing - planned >= required;
}
