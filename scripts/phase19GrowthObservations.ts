import type { GameState } from "../src/engine/engine.types";
import { householdServices } from "../src/engine/householdServices";
import type { HouseholdService } from "../src/population/serviceAllocation";
import { SERVICES, growthSnapshot } from "./phase19GrowthMetrics";

type GrowthSnapshot = ReturnType<typeof growthSnapshot>;
export interface CapacityEpisode {
  readonly service: HouseholdService;
  readonly startedTick: number;
  endedTick: number | null;
  recoveredTick: number | null;
  readonly affectedHouseIds: string[];
  recoveredProviderIds: string[];
  readonly initial: GrowthSnapshot;
  maximumDeniedHouses: number;
  deniedHouseTicks: number;
}
export interface ProviderEvent {
  readonly tick: number;
  readonly id: string;
  readonly service: HouseholdService;
  readonly tx: number;
  readonly ty: number;
  readonly kind: "completed" | "first-serving";
  readonly used: number;
  readonly capacity: number;
}

/** Mutable, run-local counters; no derived observation is written into GameState. */
export function createGrowthObservations() {
  const episodes: CapacityEpisode[] = [];
  const active = new Map<HouseholdService, CapacityEpisode>();
  const completed = new Set<string>();
  const served = new Set<string>();
  const providerEvents: ProviderEvent[] = [];
  const denialTicks = { water: 0, market: 0, church: 0 };
  const denialHouseTicks = { water: 0, market: 0, church: 0 };
  let occupiedBreadZeroTicks = 0;
  let occupiedBreadZeroHouseTicks = 0;
  return {
    observe(state: GameState) {
      const allocation = householdServices(state);
      const empty = state.houses.filter(house => house.residents > 0 && house.breadStock === 0).length;
      if (state.tick > 0) {
        if (empty > 0) occupiedBreadZeroTicks += 1;
        occupiedBreadZeroHouseTicks += empty;
      }
      for (const service of SERVICES) {
        const deniedIds = [...allocation.houses].filter(([, access]) => access[service].kind === "capacity").map(([id]) => id);
        const denied = deniedIds.length;
        let episode = active.get(service);
        if (denied > 0) {
          denialTicks[service] += 1;
          denialHouseTicks[service] += denied;
          if (episode === undefined) {
            episode = { service, startedTick: state.tick, endedTick: null, recoveredTick: null, affectedHouseIds: [], recoveredProviderIds: [], initial: growthSnapshot(state),
              maximumDeniedHouses: denied, deniedHouseTicks: 0 };
            episodes.push(episode);
            active.set(service, episode);
          }
          for (const id of deniedIds) if (!episode.affectedHouseIds.includes(id)) episode.affectedHouseIds.push(id);
          episode.maximumDeniedHouses = Math.max(episode.maximumDeniedHouses, denied);
          episode.deniedHouseTicks += denied;
        } else if (episode !== undefined) {
          episode.endedTick = state.tick;
          active.delete(service);
        }
      }
      for (const episode of episodes) {
        if (episode.recoveredTick === null && episode.endedTick !== null && episode.affectedHouseIds.every(id =>
          allocation.houses.get(id)?.[episode.service].kind === "served")) {
          episode.recoveredTick = state.tick;
          episode.recoveredProviderIds = [...new Set(episode.affectedHouseIds.flatMap(id => {
            const providerId = allocation.houses.get(id)?.[episode.service].providerId;
            return providerId === undefined || providerId === null ? [] : [providerId];
          }))];
        }
      }
      for (const [id, provider] of allocation.providers) {
        const building = state.buildings.find(item => item.id === id);
        if (building === undefined) continue;
        if (!completed.has(id)) {
          completed.add(id);
          providerEvents.push({ tick: state.tick, id, tx: building.tx, ty: building.ty, service: provider.service, kind: "completed", used: provider.used, capacity: provider.capacity });
        }
        if (provider.used > 0 && !served.has(id)) {
          served.add(id);
          providerEvents.push({ tick: state.tick, id, tx: building.tx, ty: building.ty, service: provider.service, kind: "first-serving", used: provider.used, capacity: provider.capacity });
        }
      }
    },
    report: () => ({ episodes, unresolvedCapacityEpisodes: episodes.filter(episode => episode.recoveredTick === null).length, providerEvents, denialTicks, denialHouseTicks, occupiedBreadZeroTicks, occupiedBreadZeroHouseTicks }),
  };
}

export function timingSummary(samples: readonly number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  return { count: sorted.length, p50Ms: sorted[Math.floor(sorted.length * 0.5)] ?? null,
    p95Ms: sorted[Math.floor(sorted.length * 0.95)] ?? null, maxMs: sorted.at(-1) ?? null };
}
