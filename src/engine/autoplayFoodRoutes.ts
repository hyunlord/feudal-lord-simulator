import { houseFoodRation } from '../content/houseFoodConfig';
import { availableStock } from '../economy/storage';
import type { Building } from '../content/buildingConfig';
import { roadActionToTargets } from './autoplayConstructionRoads';
import { eligibleRoamingExits, feasibleDistributorDistance } from './distributorAccess';
import { buildingRoadAccessTiles, resolveBuildingRoute } from './routing';
import type { GameState } from './engine.types';
import type { AutoplayAction } from './autoplay.types';

export function foodRouteRepairAction(state: GameState): AutoplayAction {
  const granaries = state.buildings.filter(building => building.kind === 'granary');
  if (granaries.length === 0) return { kind: 'none' };
  const occupied = new Set(state.houses.filter(house => house.residents > 0).map(house => house.buildingId));
  const stranded = strandedFoodSupply(state);
  if (stranded !== null) {
    const sourceAccess = stranded.targets.some(target => target.kind === 'house')
      ? eligibleRoamingExits : buildingRoadAccessTiles;
    return roadActionToTargets(state, stranded.targets.flatMap(b => buildingRoadAccessTiles(state, b)),
      stranded.sources.flatMap(b => sourceAccess(state, b)));
  }
  const disconnected = state.buildings.filter(building => {
    if (building.kind === 'mill' || building.kind === 'wheat_farm') {
      return !granaries.some(granary => resolveBuildingRoute(state, building, granary).path !== null);
    }
    return occupied.has(building.id)
      && !granaries.some(granary => feasibleDistributorDistance(state, granary, building.id) !== null);
  });
  if (disconnected.length === 0) return { kind: 'none' };
  const potential = { ...state, tiles: state.tiles.map(tile => ({ ...tile, hasRoad: true })) };
  const targets = disconnected.flatMap(building => buildingRoadAccessTiles(potential, building));
  const sources = granaries.flatMap(granary => buildingRoadAccessTiles(state, granary));
  return sources.length === 0 ? { kind: 'none' } : roadActionToTargets(state, targets, sources);
}

export function strandedFoodSupply(state: GameState): { readonly sources: readonly Building[]; readonly targets: readonly Building[] } | null {
  const food = state.buildings.filter(b => b.kind === 'granary' || b.kind === 'mill' || b.kind === 'wheat_farm');
  const breadSources = food.filter(b => availableStock(b, 'bread') > 0);
  const occupied = breadSources.length === 0 ? []
    : state.houses.filter(h => h.residents > 0 && h.breadStock < houseFoodRation(h));
  const access = new Map(occupied.map(h => [h.buildingId,
    new Set(food.filter(b => feasibleDistributorDistance(state, b, h.buildingId) !== null).map(b => b.id))]));
  const pending = new Set(occupied.map(h => h.buildingId));
  for (const house of occupied) {
    if (!pending.has(house.buildingId) || breadSources.length === 0) continue;
    const home = state.buildings.find(b => b.id === house.buildingId);
    if (home === undefined) continue;
    const district = [house];
    const providers = new Set(access.get(house.buildingId));
    pending.delete(house.buildingId);
    for (let index = 0; index < district.length; index += 1) {
      for (const candidate of occupied) {
        if (!pending.has(candidate.buildingId)) continue;
        const sources = access.get(candidate.buildingId);
        if (sources === undefined || ![...sources].some(id => providers.has(id))) continue;
        district.push(candidate);
        pending.delete(candidate.buildingId);
        for (const id of sources) providers.add(id);
      }
    }
    const mealNeed = district.reduce((sum, h) => sum + Math.max(0, houseFoodRation(h) - h.breadStock), 0);
    const reachable = breadSources.filter(b => providers.has(b.id));
    const usableBread = reachable.reduce((sum, b) => sum + availableStock(b, 'bread'), 0);
    if (usableBread >= mealNeed) continue;
    const outside = breadSources.filter(b => !providers.has(b.id));
    if (outside.length > 0) return { sources: outside, targets: [home] };
  }
  const rawSources = food.filter(b => availableStock(b, 'wheat') > 0);
  for (const mill of food) {
    if (mill.kind !== 'mill' || (mill.inventory.wheat ?? 0) > 0 || rawSources.length === 0) continue;
    if (rawSources.some(b => resolveBuildingRoute(state, b, mill).path !== null)) continue;
    return { sources: rawSources, targets: [mill] };
  }
  return null;
}
