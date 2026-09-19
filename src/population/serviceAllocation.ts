import { BUILDING_CONFIG_BY_KIND, type Building } from '../content/buildingConfig';
import { buildingFootprintDistance } from '../geometry/buildingDistance';
import { houseLotArea } from '../geometry/buildingFootprint';
import type { MarketRoadService } from './marketAccess';
import type { House } from './population.types';

export type HouseholdService = 'water' | 'market' | 'church';
export type ServiceAccessKind = 'served' | 'missing' | 'outside' | 'understaffed' | 'unreachable' | 'capacity';
export interface ServiceAccess {
  readonly kind: ServiceAccessKind;
  readonly providerId: string | null;
  readonly demand: number;
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

export function allocateHouseServices(input: ServiceAllocationInput): ServiceAllocation {
  const providers = new Map<string, ServiceProviderAllocation>();
  const houses = new Map<string, HouseServices>();
  const buildingsById = new Map(input.buildings.map(b => [b.id, b]));
  const homes = [...input.houses].sort((a, b) => a.buildingId.localeCompare(b.buildingId));
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
      const staffed = nearby.filter(p => p.workers >= definition.workersRequired);
      const reachable = staffed.filter(p => !config.roadRequired || input.roadService?.(home, p) === true)
        .sort((a, b) => buildingFootprintDistance(home, a) - buildingFootprintDistance(home, b) || a.id.localeCompare(b.id));
      return [{ house, demand, nearby, staffed, reachable }];
    });
    // Reserve constrained homes first; flexible neighbours can use the next provider.
    // Two-lot homes stay indivisible and precede singles with equal alternatives.
    candidates.sort((a, b) => a.reachable.length - b.reachable.length || b.demand - a.demand
      || a.house.buildingId.localeCompare(b.house.buildingId));
    for (const { house, demand, nearby, staffed, reachable } of candidates) {
      const current = houses.get(house.buildingId);
      if (current === undefined) continue;
      const available = reachable.filter(p => (providers.get(p.id)?.used ?? 0) + demand <= config.capacity);
      const provider = available[0];
      const kind: ServiceAccessKind = provider !== undefined ? 'served'
        : facilities.length === 0 ? 'missing' : nearby.length === 0 ? 'outside'
        : staffed.length === 0 ? 'understaffed' : reachable.length === 0 ? 'unreachable' : 'capacity';
      houses.set(house.buildingId, { ...current, [service]: { kind, providerId: provider?.id ?? null, demand } });
      if (provider !== undefined) {
        const allocation = providers.get(provider.id);
        if (allocation !== undefined) providers.set(provider.id, { ...allocation, used: allocation.used + demand });
      }
    }
  }
  return { houses, providers };
}
