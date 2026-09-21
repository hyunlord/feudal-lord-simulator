import { BALANCE } from '../content/balanceConfig';
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from '../content/houseFoodConfig';
import { availableStock } from '../economy/storage';
import { buildingFootprint } from '../geometry/buildingFootprint';
import { houseIsStarving } from '../population/houseFood';
import type { RoamingHouse } from '../agents/roamingTypes';
import type { GameState } from './engine.types';
import { createSimulationRoutePorts } from './simulationPorts';

export function overloadedDeliveryHomes(state: GameState): readonly RoamingHouse[] {
  if (!state.houses.some(house => houseIsStarving(house, state.tick))) return [];
  const routes = createSimulationRoutePorts(state).roaming;
  const providers = state.buildings.filter(building => building.kind === 'granary').flatMap(building => {
    const start = routes.homePath(building.id)?.[0];
    return start === undefined ? [] : [{ id: building.id, start, stocked: availableStock(building, 'bread') > 0 }];
  });
  const homes = state.houses.flatMap(house => {
    const building = state.buildings.find(candidate => candidate.id === house.buildingId);
    if (building === undefined) return [];
    const home = { ...house, tx: building.tx, ty: building.ty, ...buildingFootprint(building) };
    const reachable = providers.filter(provider => {
      const path = routes.servicePath?.(provider.start, home);
      return path != null && path.length - 1 <= BALANCE.DISTRIBUTOR_RANGE;
    });
    return [{ home, reachable }];
  });
  const seen = new Set<string>();
  const targets: RoamingHouse[] = [];
  for (const entry of homes) {
    if (seen.has(entry.home.buildingId) || entry.reachable.length === 0) continue;
    const pool = new Set(entry.reachable.map(provider => provider.id));
    const component = [entry];
    seen.add(entry.home.buildingId);
    for (let index = 0; index < component.length; index += 1) {
      for (const candidate of homes) {
        if (seen.has(candidate.home.buildingId) || !candidate.reachable.some(provider => pool.has(provider.id))) continue;
        component.push(candidate);
        seen.add(candidate.home.buildingId);
        for (const provider of candidate.reachable) pool.add(provider.id);
      }
    }
    const demand = component.reduce((sum, candidate) => sum + houseFoodRation(candidate.home), 0);
    const capacity = pool.size * BALANCE.DISTRIBUTOR_CAPACITY * HOUSE_FOOD_INTERVAL / BALANCE.DISTRIBUTOR_INTERVAL;
    if (demand <= capacity || !component.some(candidate => houseIsStarving(candidate.home, state.tick))) continue;
    targets.push(...component.filter(candidate => candidate.home.breadStock === 0
      && candidate.reachable.some(provider => provider.stocked)).map(candidate => candidate.home));
  }
  return targets;
}

export function observeEmptyDeliveryHomes(state: GameState): GameState {
  const previous = state.autoplayEmptyHomes ?? [];
  const byId = new Map(previous.map(entry => [entry.buildingId, entry]));
  const observation = state.autoplayFoodObservation;
  const terminal = observation?.kind === 'granary' && observation.completedTick !== undefined
    && observation.observeUntilTick !== undefined && state.tick >= observation.observeUntilTick;
  const entries = state.houses.flatMap(house => {
    if (house.breadStock > 0) return [];
    const prior = byId.get(house.buildingId);
    const entry = prior !== undefined && prior.lastServicedTick === house.lastServicedTick ? prior
      : { buildingId: house.buildingId, sinceTick: state.tick, lastServicedTick: house.lastServicedTick };
    const failed = terminal && observation.targetHouseIds?.includes(house.buildingId)
      && !observation.deliveredTargetHouseIds?.includes(house.buildingId) && entry.sinceTick <= observation.placedTick;
    return [failed && !entry.failedRecovery ? { ...entry, failedRecovery: true } : entry];
  });
  if (entries.length === previous.length && entries.every((entry, index) => entry === previous[index])) return state;
  return { ...state, autoplayEmptyHomes: entries };
}

export function persistentEmptyDeliveryHomes(state: GameState): readonly RoamingHouse[] {
  if ((state.autoplayEmptyHomes?.length ?? 0) === 0) return [];
  const routes = createSimulationRoutePorts(state).roaming;
  const starts = state.buildings.filter(building => building.kind === 'granary' && availableStock(building, 'bread') > 0)
    .flatMap(building => routes.homePath(building.id)?.slice(0, 1) ?? []);
  const edgeTicks = Math.ceil(1 / BALANCE.DISTRIBUTOR_SPEED);
  return state.houses.flatMap(house => {
    const observation = state.autoplayEmptyHomes?.find(entry => entry.buildingId === house.buildingId);
    if (house.breadStock > 0 || observation === undefined || observation.lastServicedTick !== house.lastServicedTick) return [];
    const building = state.buildings.find(candidate => candidate.id === house.buildingId);
    if (building === undefined) return [];
    const home = { ...house, tx: building.tx, ty: building.ty, ...buildingFootprint(building) };
    const distances = starts.flatMap(start => {
      const path = routes.servicePath?.(start, home);
      return path != null && path.length - 1 <= BALANCE.DISTRIBUTOR_RANGE ? [path.length - 1] : [];
    });
    if (distances.length === 0) return [];
    // Allow busy distributors a full roaming/return cycle before the next dispatch and meal.
    const opportunity = HOUSE_FOOD_INTERVAL + BALANCE.DISTRIBUTOR_INTERVAL
      + (2 * BALANCE.DISTRIBUTOR_RANGE + Math.min(...distances)) * edgeTicks;
    return state.tick - observation.sinceTick >= opportunity ? [home] : [];
  });
}
