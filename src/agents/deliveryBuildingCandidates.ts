import { BALANCE } from "../content/balanceConfig";
import { barnHolds, BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import {
  STORAGE_KIND_BY_RESOURCE,
  isStorableResource,
  type ResourceType,
} from "../content/resourceConfig";
import { amountOf } from "./deliveryCommon";
import { storageIntakeSpace } from "../economy/storage";
import type {
  DeliveryInventoryPort,
  DeliveryRoutePort,
  RouteCandidate,
} from "./deliveryTypes";

/** LB-15 (BOT-3): a barn holding this much of its field's output is backed up (a third of a full farmstead's harvest). */
export const BARN_BACKLOG_STOCK = 400;

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

export function deliverCandidate(
  producer: Building,
  resource: ResourceType,
  buildings: readonly Building[],
  inventory: DeliveryInventoryPort,
  routes: DeliveryRoutePort,
): RouteCandidate | null {
  if (!isStorableResource(resource)) return null;
  // C4 (AL-2, decision AL4): barley waits in its barn for the kiln to fetch it; it never fills the granaries' room.
  if (resource === "barley") return null;
  // Stock another carter already claimed (a mill fetching from a barn, AF-9) stays for that carter.
  const stock = Math.min(amountOf(producer.inventory, resource), inventory.availableStock(producer, resource));
  if (stock === 0) return null;
  const storeKind = STORAGE_KIND_BY_RESOURCE[resource];
  const candidates = buildings.flatMap((building) => {
    if (building.kind !== storeKind) return [];
    const path = routes.betweenBuildings(producer.id, building.id);
    if (path === null || path.length === 0) return [];
    const amount = Math.min(
      BUILDING_CONFIG_BY_KIND[producer.kind].carterCapacity ?? BALANCE.CARTER_CAPACITY,
      stock,
      storageIntakeSpace(building, resource, inventory.availableSpace(building)),
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
  // AF-9: a mill also fetches wheat straight from a farmstead's barn. When no store or barn holds the input, a
  // converter fetches it from the producer that makes it (a sawmill from a logging camp), so a store full of other
  // goods cannot stop a chain.
  const from = (accepts: (building: Building) => boolean) => buildings.flatMap((building) => {
    if (!accepts(building)) return [];
    const path = routes.betweenBuildings(converter.id, building.id);
    if (path === null || path.length === 0) return [];
    const amount = Math.min(
      BUILDING_CONFIG_BY_KIND[converter.kind].carterCapacity ?? BALANCE.CARTER_CAPACITY,
      homeSpace,
      inventory.availableStock(building, resource),
    );
    return amount > 0 ? [{ building, path, amount }] : [];
  });
  const stored = from(building => building.kind === storeKind || barnHolds(building, resource));
  // LB-15 (BOT-3): while a barn is piled with the input the other barns drop out; stores keep their place.
  const barn = (building: Building) => barnHolds(building, resource);
  const piled = (building: Building) => barn(building) && amountOf(building.inventory, resource) >= BARN_BACKLOG_STOCK;
  const drawn = stored.some(({ building }) => piled(building)) ? stored.filter(({ building }) => !barn(building) || piled(building)) : stored;
  const candidates = drawn.length > 0 ? drawn
    : from(building => building.id !== converter.id && BUILDING_CONFIG_BY_KIND[building.kind].production?.output === resource);
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
