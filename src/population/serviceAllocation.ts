import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { buildingFootprintDistance } from '../geometry/buildingDistance';
import { houseLotArea } from '../geometry/buildingFootprint';
import type { MarketRoadService } from './marketAccess';
import type { House } from './population.types';

export type HouseholdService = 'water' | 'market' | 'church';
export type ServiceAccessKind = 'served' | 'missing' | 'outside' | 'paused' | 'understaffed' | 'unreachable' | 'capacity';
export interface ServiceAccess {
  readonly kind: ServiceAccessKind;
  readonly providerId: string | null;
  readonly demand: number;
  readonly earlierHomesUsingCapacity?: number;
}
export type HouseServices = Readonly<Record<HouseholdService, ServiceAccess>>;
export interface ServiceProviderAllocation {
  readonly service: HouseholdService;
  readonly capacity: number;
  readonly used: number;
  readonly workers: number;
  readonly requiredWorkers: number;
}
export interface ServiceAllocation {
  readonly houses: ReadonlyMap<string, HouseServices>;
  readonly providers: ReadonlyMap<string, ServiceProviderAllocation>;
}
export interface ServiceAllocationInput {
  readonly houses: readonly House[];
  readonly buildings: readonly Building[];
  readonly roadService?: MarketRoadService | undefined;
}

// Capacity reserves residential lots, including vacant homes, so population changes
// do not repeatedly transfer service between neighbours. Community wells are self-service.
export const HOUSEHOLD_SERVICE_CONFIG = {
  water: { kind: 'well', capacity: 12, roadRequired: false },
  market: { kind: 'market', capacity: 24, roadRequired: true },
  church: { kind: 'church', capacity: 32, roadRequired: true },
} as const;
const SERVICES = ['water', 'market', 'church'] as const;

// Opening homes precede numbered construction sites. The persisted construction
// ordinal is the requested completion-priority key; no duplicate save field is needed.
function houseServicePriority(id: string): number {
  const ordinal = /^construction-site-(\d+)$/.exec(id)?.[1];
  return ordinal === undefined ? -1 : Number(ordinal);
}
function compareHomes(a: House, b: House): number {
  return houseServicePriority(a.buildingId) - houseServicePriority(b.buildingId)
    || a.buildingId.localeCompare(b.buildingId);
}

export function allocateHouseServices(input: ServiceAllocationInput): ServiceAllocation {
  const providers = new Map<string, ServiceProviderAllocation>();
  const houses = new Map<string, HouseServices>();
  const buildingsById = new Map(input.buildings.map(b => [b.id, b]));
  const homes = [...input.houses].sort(compareHomes);
  for (const house of homes) {
    const demand = houseLotArea(buildingsById.get(house.buildingId));
    const missing: ServiceAccess = { kind: 'missing', providerId: null, demand };
    houses.set(house.buildingId, { water: missing, market: missing, church: missing });
  }
  for (const service of SERVICES) {
    const config = HOUSEHOLD_SERVICE_CONFIG[service];
    const definition = BUILDING_CONFIG_BY_KIND[config.kind];
    const facilities = input.buildings.filter(b => b.kind === config.kind).sort((a, b) => a.id.localeCompare(b.id));
    for (const provider of facilities) providers.set(provider.id, {
      service, capacity: config.capacity, used: 0, workers: provider.workers, requiredWorkers: definition.workersRequired,
    });
    const candidates = homes.flatMap(house => {
      const home = buildingsById.get(house.buildingId);
      if (home === undefined) return [];
      const demand = houseLotArea(home);
      const nearby = facilities.filter(p => buildingFootprintDistance(home, p) <= definition.serviceRadius);
      const operating = nearby.filter(p => p.operationPaused !== true);
      const staffed = operating.filter(p => p.workers >= definition.workersRequired);
      const reachable = staffed.filter(p => !config.roadRequired || input.roadService?.(home, p) === true)
        .sort((a, b) => buildingFootprintDistance(home, a) - buildingFootprintDistance(home, b) || a.id.localeCompare(b.id));
      return [{ house, demand, nearby, operating, staffed, reachable }];
    });
    const assigned = new Map<string, string>();
    const candidatesById = new Map(candidates.map(candidate => [candidate.house.buildingId, candidate]));
    for (const { house, demand, nearby, operating, staffed, reachable } of candidates) {
      const current = houses.get(house.buildingId);
      if (current === undefined) continue;
      const available = reachable.filter(p => (providers.get(p.id)?.used ?? 0) + demand <= config.capacity);
      let provider = available[0];
      // A newer home may move an older neighbour to an available alternative, but
      // never remove its service. One-hop moves are bounded by homes × providers.
      // Commit a move only when all of the newer home's indivisible demand fits.
      if (provider === undefined) for (const target of reachable) {
        let space = config.capacity - (providers.get(target.id)?.used ?? 0);
        const moves: { readonly homeId: string; readonly targetId: string; readonly demand: number }[] = [];
        const extraUse = new Map<string, number>();
        for (const [homeId, providerId] of assigned) {
          if (providerId !== target.id || space >= demand) continue;
          const older = candidatesById.get(homeId);
          if (older === undefined) continue;
          const alternative = older.reachable.find(p => p.id !== target.id
            && (providers.get(p.id)?.used ?? 0) + (extraUse.get(p.id) ?? 0) + older.demand <= config.capacity);
          if (alternative === undefined) continue;
          moves.push({ homeId, targetId: alternative.id, demand: older.demand });
          extraUse.set(alternative.id, (extraUse.get(alternative.id) ?? 0) + older.demand);
          space += older.demand;
        }
        if (space < demand) continue;
        for (const move of moves) {
          const olderServices = houses.get(move.homeId);
          const source = providers.get(target.id);
          const destination = providers.get(move.targetId);
          if (olderServices === undefined || source === undefined || destination === undefined) continue;
          houses.set(move.homeId, { ...olderServices, [service]: { ...olderServices[service], providerId: move.targetId } });
          providers.set(target.id, { ...source, used: source.used - move.demand });
          providers.set(move.targetId, { ...destination, used: destination.used + move.demand });
          assigned.set(move.homeId, move.targetId);
        }
        provider = target;
        break;
      }
      const kind: ServiceAccessKind = provider !== undefined ? 'served'
        : facilities.length === 0 ? 'missing' : nearby.length === 0 ? 'outside'
        : operating.length === 0 ? 'paused' : staffed.length === 0 ? 'understaffed' : reachable.length === 0 ? 'unreachable' : 'capacity';
      const reachableIds = new Set(reachable.map(p => p.id));
      const earlierHomesUsingCapacity = kind === 'capacity'
        ? [...assigned.values()].filter(id => reachableIds.has(id)).length : undefined;
      houses.set(house.buildingId, { ...current, [service]: { kind, providerId: provider?.id ?? null, demand,
        ...(earlierHomesUsingCapacity === undefined ? {} : { earlierHomesUsingCapacity }) } });
      if (provider !== undefined) {
        assigned.set(house.buildingId, provider.id);
        const allocation = providers.get(provider.id);
        if (allocation !== undefined) providers.set(provider.id, { ...allocation, used: allocation.used + demand });
      }
    }
  }
  return { houses, providers };
}
