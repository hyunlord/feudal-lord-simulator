import { spendAutoplaySearch } from './autoplaySearchBudget';
import { autoplayConstructionSources } from './autoplayConstructionSources';
import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { buildingFootprint, houseLotArea } from '../geometry/buildingFootprint';
import { buildingFootprintDistance } from '../geometry/buildingDistance';
import { allocateHouseServices, HOUSEHOLD_SERVICE_CONFIG } from '../population/serviceAllocation';
import { canPlaceBuildingBeforeRoad } from '../world/placement';
import type { GameState } from './engine.types';
import { hasAutoplayBuildingClearance } from './autoplaySetback';
import { marketRoadService } from './marketService';
import { potentialServiceRoads, serviceCandidate, serviceFootprint, serviceSpaceBuildings, serviceSpaceHouses, serviceTileKey, serviceWitnessRoads, serviceRoadConnected } from './autoplayServiceSpaceRoutes';

export type ServiceSpaceWitness = {
  readonly pads: ReadonlySet<string>;
  readonly roads: ReadonlySet<string>;
};
type UrbanService = 'market' | 'church';

function staffed(buildings: readonly Building[]): readonly Building[] {
  return buildings.map(building => building.kind === 'market' || building.kind === 'church'
    ? { ...building, workers: BUILDING_CONFIG_BY_KIND[building.kind].workersRequired } : building);
}
function candidatePads(state: GameState, home: Building, kind: UrbanService, reachable: (candidate: Building) => boolean): readonly Building[] {
  const definition = BUILDING_CONFIG_BY_KIND[kind];
  const homeSize = buildingFootprint(home);
  const candidates: Building[] = [];
  const future = { ...state, era: 'stone_town' as const };
  for (let ty = Math.max(0, home.ty - definition.serviceRadius - definition.height + 1);
    ty <= Math.min(state.height - definition.height, home.ty + homeSize.height - 1 + definition.serviceRadius); ty++) {
    for (let tx = Math.max(0, home.tx - definition.serviceRadius - definition.width + 1);
      tx <= Math.min(state.width - definition.width, home.tx + homeSize.width - 1 + definition.serviceRadius); tx++) {
      const candidate = serviceCandidate(kind, { tx, ty }, `service-space-${kind}`);
      if (buildingFootprintDistance(home, candidate) > definition.serviceRadius || !hasAutoplayBuildingClearance(state, kind, candidate) || !reachable(candidate)) continue;
      const placement = canPlaceBuildingBeforeRoad(future, kind, tx, ty);
      if (placement.ok || placement.reason === 'insufficient_materials') candidates.push(candidate);
    }
  }
  return candidates;
}
function allocationForHome(state: GameState, home: Building, buildings: readonly Building[], potential: GameState) {
  const lots = buildings.filter(building => building.kind === 'house').reduce((sum, building) => sum + houseLotArea(building), 0);
  // Below both capacities, other homes cannot exhaust any provider; only the target's reachability affects its allocation.
  // MARKET-1 (MK-4): the proof keeps the 8-tile radius over the potential roads (a road connection only, no road reach):
  // the reach of 40 steps was calibrated to cover what that radius covers in the towns, and a reach measured on roads
  // not yet built would refuse sites the finished roads serve.
  const connected = marketRoadService(potential);
  const roadService = lots <= Math.min(HOUSEHOLD_SERVICE_CONFIG.market.capacity, HOUSEHOLD_SERVICE_CONFIG.church.capacity)
    ? (candidate: Building, provider: Building) => candidate.id !== home.id || serviceRoadConnected(potential, candidate, provider)
    : (candidate: Building, provider: Building) => connected(candidate, provider);
  return allocateHouseServices({ houses: serviceSpaceHouses(state, buildings), buildings: staffed(buildings), roadService });
}
function jointlyServed(state: GameState, home: Building, buildings: readonly Building[], additions: readonly Building[]): ServiceSpaceWitness | null {
  if (!spendAutoplaySearch()) return null;
  const all = staffed([...buildings, ...additions]);
  const potential = potentialServiceRoads(state, all);
  const allocation = allocationForHome(state, home, all, potential);
  const services = allocation.houses.get(home.id);
  if (services?.market.kind !== 'served' || services.church.kind !== 'served') return null;
  const providers = all.filter(provider => provider.id === services.market.providerId || provider.id === services.church.providerId);
  const roads = serviceWitnessRoads(state, potential, home, providers);
  return roads === null ? null : { roads, pads: new Set(additions.flatMap(provider => serviceFootprint(provider).map(serviceTileKey))) };
}

/** One local coexistent witness, never a permanent reservation or a citywide optimal layout claim. */
export function findAutoplayServiceWitness(state: GameState, home: Building): ServiceSpaceWitness | null {
  const sources = autoplayConstructionSources(state);
  if (sources.length === 0) return null;
  const buildings = serviceSpaceBuildings(state);
  const existing = jointlyServed(state, home, buildings, []);
  if (existing !== null) return existing;
  const potential = potentialServiceRoads(state, buildings);
  const allocation = allocationForHome(state, home, buildings, potential);
  const services = allocation.houses.get(home.id);
  const lots = buildings.filter(building => building.kind === 'house').reduce((sum, building) => sum + houseLotArea(building), 0);
  const spareSlot = (kind: UrbanService): boolean => buildings.filter(building => building.kind === kind).length
    < Math.ceil(lots / HOUSEHOLD_SERVICE_CONFIG[kind].capacity) + 1;
  if ((services?.market.kind !== 'served' && !spareSlot('market'))
    || (services?.church.kind !== 'served' && !spareSlot('church'))) return null;
  // A disconnected pad cannot become reachable by removing land for another provider.
  // Reject it before the Cartesian search; final joint allocation and routes still prove safety.
  const connected = marketRoadService(potential);
  const reachable = (candidate: Building): boolean => connected(home, candidate) && sources.some(source => connected(source, candidate));
  const markets: readonly (Building | null)[] = services?.market.kind === 'served' ? [null] : candidatePads(state, home, 'market', reachable);
  const churches: readonly (Building | null)[] = services?.church.kind === 'served' ? [null] : candidatePads(state, home, 'church', reachable);
  for (const market of markets) for (const church of churches) {
    if (!spendAutoplaySearch()) return null;
    const additions = [market, church].filter((provider): provider is Building => provider !== null);
    if (market !== null && church !== null) {
      const marketTiles = new Set(serviceFootprint(market).map(serviceTileKey));
      if (serviceFootprint(church).some(tile => marketTiles.has(serviceTileKey(tile)))) continue;
    }
    const witness = jointlyServed(state, home, buildings, additions);
    if (witness !== null) return witness;
  }
  return null;
}
