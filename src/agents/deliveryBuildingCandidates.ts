import { BALANCE } from "../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import {
  STORAGE_KIND_BY_RESOURCE,
  type ResourceType,
  type StorableResourceType,
} from "../content/resourceConfig";
import { amountOf } from "./deliveryCommon";
import type {
  DeliveryInventoryPort,
  DeliveryRoutePort,
  RouteCandidate,
} from "./deliveryTypes";

function bestCandidate(candidates: readonly RouteCandidate[], replenishBread = false): RouteCandidate | null {
  return [...candidates].sort((left, right) => {
    if (left.path.length !== right.path.length) {
      return left.path.length - right.path.length;
    }

    if (replenishBread) {
      const committedBread = (candidate: RouteCandidate): number => amountOf(candidate.building.inventory, "bread")
        + amountOf(candidate.building.reserved, "bread");
      const difference = committedBread(left) - committedBread(right);
      if (difference !== 0) return difference;
    }
    return left.building.id.localeCompare(right.building.id);
  })[0] ?? null;
}

function isStorableResource(resource: ResourceType): resource is StorableResourceType {
  switch (resource) {
    case "wheat":
    case "bread":
    case "logs":
    case "timber":
    case "stone_raw":
    case "stone":
      return true;
    case "coin":
      return false;
  }
}

function deliveryIntakeSpace(
  building: Building,
  resource: ResourceType,
  inventory: DeliveryInventoryPort,
): number {
  const free = inventory.availableSpace(building);
  const limitedResources: readonly ResourceType[] = building.kind === "granary" && resource === "wheat"
    ? ["wheat"]
    : building.kind === "storehouse" && (resource === "logs" || resource === "stone_raw")
      ? ["logs", "stone_raw"] : [];
  if (limitedResources.length === 0) return free;
  const rawLimit = Math.floor(BUILDING_CONFIG_BY_KIND[building.kind].storageCapacity / 2);
  const committed = limitedResources.reduce((total, input) => total
    + amountOf(building.inventory, input) + amountOf(building.reserved, input), 0);
  return Math.min(free, Math.max(0, rawLimit - committed));
}

export function deliverCandidate(
  producer: Building,
  resource: ResourceType,
  buildings: readonly Building[],
  inventory: DeliveryInventoryPort,
  routes: DeliveryRoutePort,
): RouteCandidate | null {
  if (!isStorableResource(resource)) return null;
  const stock = amountOf(producer.inventory, resource);
  if (stock === 0) return null;
  const storeKind = STORAGE_KIND_BY_RESOURCE[resource];
  const candidates = buildings.flatMap((building) => {
    if (building.kind !== storeKind) return [];
    const path = routes.betweenBuildings(producer.id, building.id);
    if (path === null || path.length === 0) return [];
    const amount = Math.min(
      BALANCE.CARTER_CAPACITY,
      stock,
      deliveryIntakeSpace(building, resource, inventory),
    );
    return amount > 0 ? [{ building, path, amount }] : [];
  });
  return bestCandidate(candidates, resource === "bread");
}

export function fetchCandidate(
  converter: Building,
  resource: ResourceType,
  buildings: readonly Building[],
  inventory: DeliveryInventoryPort,
  routes: DeliveryRoutePort,
): RouteCandidate | null {
  if (!isStorableResource(resource)) return null;
  const homeSpace = inventory.availableSpace(converter);
  if (homeSpace === 0) return null;
  const storeKind = STORAGE_KIND_BY_RESOURCE[resource];
  const candidates = buildings.flatMap((building) => {
    if (building.kind !== storeKind) return [];
    const path = routes.betweenBuildings(converter.id, building.id);
    if (path === null || path.length === 0) return [];
    const amount = Math.min(
      BALANCE.CARTER_CAPACITY,
      homeSpace,
      inventory.availableStock(building, resource),
    );
    return amount > 0 ? [{ building, path, amount }] : [];
  });
  const production = BUILDING_CONFIG_BY_KIND[converter.kind].production;
  const physical = amountOf(converter.inventory, resource);
  const usable = inventory.availableStock(converter, resource);
  if (production?.input === resource && Number.isFinite(production.inputPerOutput)
    && production.inputPerOutput > 0 && Number.isFinite(physical) && physical >= 0
    && Number.isFinite(usable) && usable === physical) {
    const deficit = production.inputPerOutput - physical;
    if (deficit > 0) {
      const sufficient = candidates.filter(({ amount }) => amount >= deficit);
      if (sufficient.length > 0) return bestCandidate(sufficient);
    }
  }
  return bestCandidate(candidates);
}
