import { BALANCE } from "../content/balanceConfig";
import type { Building } from "../content/buildingConfig";
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

function bestCandidate(candidates: readonly RouteCandidate[]): RouteCandidate | null {
  return [...candidates].sort((left, right) => {
    if (left.path.length !== right.path.length) {
      return left.path.length - right.path.length;
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
      inventory.availableSpace(building),
    );
    return amount > 0 ? [{ building, path, amount }] : [];
  });
  return bestCandidate(candidates);
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
  return bestCandidate(candidates);
}
