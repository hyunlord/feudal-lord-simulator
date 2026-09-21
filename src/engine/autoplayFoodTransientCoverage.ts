import { BALANCE } from '../content/balanceConfig';
import { remainingPathCanBeTraversed } from '../agents/movement';
import { returnPath } from '../agents/deliveryCommon';
import { BUILDING_CONFIG_BY_KIND } from '../content/buildingConfig';
import { HOUSE_FOOD_INTERVAL, houseFoodRation } from '../content/houseFoodConfig';
import { availableStock } from '../economy/storage';
import { houseIsStarving } from '../population/houseFood';
import { foodPoolSnapshot } from './autoplayFoodBottleneck';
import { recurringDeliveryRoutes } from './autoplayRecurringDeliveryRoutes';
import { buildingHasRequiredRoadAccess } from './roadAccess';
import { deliverCandidate } from '../agents/deliveryBuildingCandidates';
import { createDeliveryInventoryPort, createSimulationRoutePorts } from './simulationPorts';
import type { GameState } from './engine.types';

// Private stock pays only its own home; each shared source is debited once.
export function hasTransientMealCoverage(state: GameState, throughTick: number): boolean {
  const flow = state.autoplayFoodFlow;
  const poolIds = flow?.poolIds ?? [];
  const current = foodPoolSnapshot(state, poolIds);
  const sampled = flow?.completed?.poolEnd;
  if (current === undefined || sampled === undefined || throughTick < state.tick) return false;
  let shared = Math.min(current.usableBread, sampled.usableBread);
  const mealCount = Math.floor(throughTick / HOUSE_FOOD_INTERVAL) - Math.floor(state.tick / HOUSE_FOOD_INTERVAL);
  const routes = recurringDeliveryRoutes(state);
  const granaries = state.buildings.filter(b => b.kind === 'granary'
    && b.workers >= BUILDING_CONFIG_BY_KIND.granary.workersRequired && buildingHasRequiredRoadAccess(state, b));
  const routesPort = createSimulationRoutePorts(state).delivery;
  const inventory = createDeliveryInventoryPort();
  const sources = state.buildings.flatMap(b => {
    if (!poolIds.includes(b.id) || availableStock(b, 'bread') <= 0) return [];
    if (b.kind === 'granary') return [{ id: b.id, remaining: availableStock(b, 'bread'),
      providers: granaries.some(g => g.id === b.id) ? [b.id] : [] }];
    if (BUILDING_CONFIG_BY_KIND[b.kind].production?.output !== 'bread') return [];
    const destination = deliverCandidate(b, 'bread', state.buildings, inventory, routesPort);
    return destination === null || !granaries.some(g => g.id === destination.building.id) ? []
      : [{ id: b.id, remaining: Math.min(availableStock(b, 'bread'), destination.amount), providers: [destination.building.id] }];
  });
  const reserved = new Map(granaries.map(g => [g.id, g.reserved.bread ?? 0]));
  for (const walker of state.walkers) {
    if (walker.kind !== 'carter' || walker.mission !== 'deliver' || walker.phase !== 'outbound'
      || walker.cancellation !== null || walker.cargo?.resource !== 'bread' || !poolIds.includes(walker.homeBuildingId)
      || walker.destination.kind !== 'building' || walker.reservation.destination.kind !== 'building'
      || walker.reservation.destination.buildingId !== walker.destination.buildingId
      || walker.reservation.resource !== 'bread' || walker.reservation.amount !== walker.cargo.amount) continue;
    const id = walker.destination.buildingId;
    const held = reserved.get(id) ?? 0;
    const endpoint = walker.path.at(-1);
    if (held < walker.cargo.amount || endpoint === undefined
      || !remainingPathCanBeTraversed(walker, routesPort.canTraverse)
      || !walker.path.slice(Math.max(0, walker.pathIndex)).every(tile => routesPort.isRoad(tile))
      || routesPort.canAccessDestination?.(endpoint, walker.destination) !== true
      || returnPath(state.buildings, walker, routesPort) === null) continue;
    let position = walker.position;
    let distance = 0;
    for (const next of walker.path.slice(walker.pathIndex + 1)) {
      distance += Math.abs(position.tx - next.tx) + Math.abs(position.ty - next.ty);
      position = next;
    }
    if (Math.max(1, Math.ceil(distance / BALANCE.CARTER_SPEED)) > throughTick - state.tick) continue;
    reserved.set(id, held - walker.cargo.amount);
    sources.push({ id: walker.id, remaining: walker.cargo.amount, providers: [id] });
  }
  const needs = state.houses.filter(h => h.residents > 0).map(h => ({ house: h,
    remaining: Math.max(0, mealCount * houseFoodRation(h) - h.breadStock),
    providers: routes.homes.find(r => r.buildingId === h.buildingId)?.providers
      .filter(p => granaries.some(g => g.id === p.id)).map(p => p.id) ?? [] }));
  if (needs.some(n => n.providers.length === 0 || houseIsStarving(n.house, state.tick))) return false;
  needs.sort((a, b) => a.providers.length - b.providers.length || a.house.buildingId.localeCompare(b.house.buildingId));
  for (const need of needs) {
    for (const source of sources) {
      if (!source.providers.some(id => need.providers.includes(id))) continue;
      const used = Math.min(need.remaining, source.remaining, shared);
      need.remaining -= used;
      source.remaining -= used;
      shared -= used;
    }
    if (need.remaining > 0) return false;
  }
  return true;
}
