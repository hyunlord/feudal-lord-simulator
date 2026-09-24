import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { STORABLE_RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import { constructionDeliveryNeed, type ConstructionSite } from "../economy/construction";
import { productionOperation } from "../economy/production";
import { availableSpace, storageCapacityBlock, storageIntakeSpace, storageUsage } from "../economy/storage";
import { buildingHasRequiredRoadAccess } from "./roadAccess";
import type { GameState } from "./engine.types";

const RESERVE_DEADLOCK_TICKS = 2400;
const WOOD_STORAGE_RESOURCES = ["logs", "timber"] as const satisfies readonly ResourceType[];
function isWoodProducer(building: Building): boolean {
  return building.kind === "logging_camp" || building.kind === "sawmill";
}

export type ReserveDeadlock = {
  readonly kind: "reserve_deadlock";
  readonly siteIds: readonly string[];
  readonly blockedResource: ResourceType;
  readonly used: number;
  readonly capacity: number;
  readonly window: {
    readonly startTick: number;
    readonly throughTick: number;
    readonly lastAvailableIncreaseTick: number;
    readonly stalledTicks: number;
  };
};

function timberReserveHeldWallSites(state: GameState): readonly ConstructionSite[] {
  return state.constructionSites.filter((site) => {
    if (site.stall !== "reserve_held") return false;
    if (site.kind !== "palisade_segment" && site.kind !== "stone_wall_segment") return false;
    return (constructionDeliveryNeed(site).timber ?? 0) > 0;
  });
}

function timberAvailabilityStall(state: GameState): ReserveDeadlock["window"] | null {
  const observation = state.timberProductionWindow;
  if (
    observation === undefined ||
    observation.availableTimber === undefined ||
    observation.lastAvailableIncreaseTick === undefined
  ) return null;
  const observedTicks = observation.throughTick - observation.startTick + 1;
  const stalledTicks = observation.throughTick - observation.lastAvailableIncreaseTick;
  if (observedTicks < RESERVE_DEADLOCK_TICKS || stalledTicks < RESERVE_DEADLOCK_TICKS) return null;
  return {
    startTick: observation.startTick,
    throughTick: observation.throughTick,
    lastAvailableIncreaseTick: observation.lastAvailableIncreaseTick,
    stalledTicks,
  };
}

function woodProductionBlocked(state: GameState): boolean {
  return state.buildings.some((building) => {
    if (!isWoodProducer(building)) return false;
    return productionOperation(
      building,
      BUILDING_CONFIG_BY_KIND[building.kind],
      buildingHasRequiredRoadAccess(state, building),
    ) === "output_full";
  });
}

type WoodStorageBlock = {
  readonly used: number;
  readonly capacity: number;
  readonly buildings: readonly Building[];
};

function timberBlockedStorehouses(state: GameState): readonly Building[] {
  return state.buildings.filter((building) =>
    building.kind === "storehouse" &&
    storageIntakeSpace(
      building,
      "timber",
      availableSpace(building, BUILDING_CONFIG_BY_KIND[building.kind]),
    ) === 0,
  );
}

function fullWoodStorage(state: GameState): WoodStorageBlock | null {
  for (const resource of WOOD_STORAGE_RESOURCES) {
    const block = storageCapacityBlock(state.buildings, resource);
    if (block !== null) return { ...block, buildings: timberBlockedStorehouses(state) };
  }
  return null;
}

function dominantStoredResource(buildings: readonly Building[]): ResourceType {
  if (buildings.length === 0) return "timber";
  const totals = STORABLE_RESOURCE_TYPES.map((resource) => ({
    resource,
    amount: buildings.reduce((total, building) => {
      const usage = storageUsage(building);
      if (usage.capacity <= 0) return total;
      return total + (building.inventory[resource] ?? 0) + (building.reserved[resource] ?? 0);
    }, 0),
  }));
  return totals.reduce((best, candidate) =>
    candidate.amount > best.amount ? candidate : best,
  ).resource;
}

// Detects the reserve deadlock only when all inputs point to the same timber bottleneck:
// a timber-needing wall site is reserve-held under balanced policy, available timber has
// not increased for 2400 ticks, and the wood chain is blocked by output-full producers
// plus full log/timber storehouse intake. Stone-only wall stalls are excluded because
// timber availability cannot explain them.
export function reserveDeadlock(state: GameState): ReserveDeadlock | null {
  if (state.wallConstructionPriority === "priority") return null;
  const siteIds = timberReserveHeldWallSites(state).map((site) => site.id);
  if (siteIds.length === 0) return null;
  const observation = timberAvailabilityStall(state);
  if (observation === null) return null;
  const storage = fullWoodStorage(state);
  if (storage === null || !woodProductionBlocked(state)) return null;
  return {
    kind: "reserve_deadlock",
    siteIds,
    blockedResource: dominantStoredResource(storage.buildings),
    used: storage.used,
    capacity: storage.capacity,
    window: observation,
  };
}
