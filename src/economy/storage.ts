import {
  BUILDING_CONFIG_BY_KIND,
  type BuildingDefinition,
  type BuildingKind,
} from "../content/buildingConfig";
import {
  STORAGE_KIND_BY_RESOURCE,
  STORABLE_RESOURCE_TYPES,
  type ResourceType,
  type StorableResourceType,
} from "../content/resourceConfig";
import type { Building } from "./economy.types";

export interface StockReservation {
  readonly buildingId: string;
  readonly resource: ResourceType;
  readonly amount: number;
}

const amountOf = (
  record: Partial<Record<ResourceType, number>>,
  resource: ResourceType,
): number => Math.max(0, record[resource] ?? 0);

const requestedAmount = (amount: number): number =>
  Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;

const sumStock = (record: Partial<Record<ResourceType, number>>): number =>
  Object.values(record).reduce((total, amount) => total + Math.max(0, amount ?? 0), 0);

export interface StorageUsage {
  readonly used: number;
  readonly incoming: number;
  readonly capacity: number;
  readonly byResource: readonly {
    readonly resource: StorableResourceType;
    readonly stored: number;
    readonly incoming: number;
  }[];
}

export function storageUsage(building: Building): StorageUsage {
  return {
    used: sumStock(building.inventory),
    incoming: sumStock(building.reserved),
    capacity: BUILDING_CONFIG_BY_KIND[building.kind].storageCapacity,
    byResource: STORABLE_RESOURCE_TYPES
      .filter((resource) => acceptsResource(building.kind, resource))
      .map((resource) => ({
        resource,
        stored: amountOf(building.inventory, resource),
        incoming: amountOf(building.reserved, resource),
      })),
  };
}

function rawIntakeUsage(
  building: Building,
  resource: StorableResourceType,
): { readonly used: number; readonly capacity: number } | null {
  const limited: readonly StorableResourceType[] = building.kind === "granary" && resource === "wheat"
    ? ["wheat"]
    : building.kind === "storehouse" && (resource === "logs" || resource === "stone_raw")
      ? ["logs", "stone_raw"] : [];
  if (limited.length === 0) return null;
  return {
    used: limited.reduce((total, kind) => total + amountOf(building.inventory, kind) + amountOf(building.reserved, kind), 0),
    capacity: Math.floor(BUILDING_CONFIG_BY_KIND[building.kind].storageCapacity / 2),
  };
}

export function storageIntakeUsage(
  building: Building,
  resource: StorableResourceType,
): { readonly used: number; readonly capacity: number } {
  const usage = storageUsage(building);
  const physical = { used: usage.used + usage.incoming, capacity: usage.capacity };
  const raw = rawIntakeUsage(building, resource);
  return raw !== null && Math.max(0, raw.capacity - raw.used) < Math.max(0, physical.capacity - physical.used)
    ? { used: Math.min(raw.used, raw.capacity), capacity: raw.capacity }
    : physical;
}

export function storageIntakeSpace(
  building: Building,
  resource: StorableResourceType,
  freeSpace: number,
): number {
  const raw = rawIntakeUsage(building, resource);
  return raw === null ? freeSpace : Math.min(freeSpace, Math.max(0, raw.capacity - raw.used));
}

export function storageCapacityBlock(
  buildings: readonly Building[],
  resource: StorableResourceType,
): { readonly used: number; readonly capacity: number } | null {
  const destinations = buildings.filter((building) => acceptsResource(building.kind, resource));
  if (destinations.length === 0 || destinations.some((building) =>
    storageIntakeSpace(building, resource, availableSpace(building, BUILDING_CONFIG_BY_KIND[building.kind])) > 0)) return null;
  return destinations.reduce((total, building) => {
    const usage = storageIntakeUsage(building, resource);
    return { used: total.used + usage.used, capacity: total.capacity + usage.capacity };
  }, { used: 0, capacity: 0 });
}

function withAmount(
  record: Partial<Record<ResourceType, number>>,
  resource: ResourceType,
  amount: number,
): Partial<Record<ResourceType, number>> {
  if (amount <= 0) {
    const { [resource]: _removed, ...remaining } = record;
    return remaining;
  }
  return { ...record, [resource]: amount };
}

export function acceptsResource(
  kind: BuildingKind,
  resource: ResourceType,
): boolean {
  if (!isStorableResource(resource)) return false;
  return STORAGE_KIND_BY_RESOURCE[resource] === kind;
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

export function availableSpace(
  building: Building,
  definition: BuildingDefinition,
): number {
  const occupied = sumStock(building.inventory) + sumStock(building.reserved);
  return Math.max(0, definition.storageCapacity - occupied);
}

export function reserve(
  building: Building,
  resource: ResourceType,
  amount: number,
): Building {
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  const production = definition.production;
  // AF-9: a farmstead holds its harvest locally like a producer holds its output.
  const heldLocally =
    production?.input === resource || production?.output === resource || definition.fieldOutput === resource;
  if (!acceptsResource(building.kind, resource) && !heldLocally) return building;
  const claim = Math.min(
    requestedAmount(amount),
    availableSpace(
      building,
      BUILDING_CONFIG_BY_KIND[building.kind],
    ),
  );
  if (claim === 0) return building;

  return {
    ...building,
    reserved: withAmount(
      building.reserved,
      resource,
      amountOf(building.reserved, resource) + claim,
    ),
  };
}

export function releaseReservation(
  building: Building,
  resource: ResourceType,
  amount: number,
): Building {
  const current = amountOf(building.reserved, resource);
  const release = Math.min(current, requestedAmount(amount));
  if (release === 0) return building;

  return {
    ...building,
    reserved: withAmount(building.reserved, resource, current - release),
  };
}

export function availableStock(
  building: Building,
  resource: ResourceType,
): number {
  return Math.max(
    0,
    amountOf(building.inventory, resource) -
      amountOf(building.stockReserved, resource),
  );
}

export function reserveStock(
  building: Building,
  reservation: StockReservation,
): Building {
  if (reservation.buildingId !== building.id) return building;
  const claim = Math.min(
    requestedAmount(reservation.amount),
    availableStock(building, reservation.resource),
  );
  if (claim === 0) return building;

  return {
    ...building,
    stockReserved: withAmount(
      building.stockReserved,
      reservation.resource,
      amountOf(building.stockReserved, reservation.resource) + claim,
    ),
  };
}

export function releaseStockReservation(
  building: Building,
  resource: ResourceType,
  amount: number,
): Building {
  const current = amountOf(building.stockReserved, resource);
  const release = Math.min(current, requestedAmount(amount));
  if (release === 0) return building;

  return {
    ...building,
    stockReserved: withAmount(
      building.stockReserved,
      resource,
      current - release,
    ),
  };
}

export function withdrawReservedStock(
  building: Building,
  resource: ResourceType,
  amount: number,
): { readonly building: Building; readonly withdrawn: number } {
  const withdrawn = Math.min(
    requestedAmount(amount),
    amountOf(building.stockReserved, resource),
    amountOf(building.inventory, resource),
  );
  if (withdrawn === 0) return { building, withdrawn: 0 };

  return {
    building: {
      ...building,
      inventory: withAmount(
        building.inventory,
        resource,
        amountOf(building.inventory, resource) - withdrawn,
      ),
      stockReserved: withAmount(
        building.stockReserved,
        resource,
        amountOf(building.stockReserved, resource) - withdrawn,
      ),
    },
    withdrawn,
  };
}
