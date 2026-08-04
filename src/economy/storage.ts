import {
  BUILDING_CONFIG_BY_KIND,
  type BuildingDefinition,
  type BuildingKind,
} from "../content/buildingConfig";
import {
  STORAGE_KIND_BY_RESOURCE,
  type ResourceType,
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
  return STORAGE_KIND_BY_RESOURCE[resource] === kind;
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
  const production = BUILDING_CONFIG_BY_KIND[building.kind].production;
  const heldLocally =
    production?.input === resource || production?.output === resource;
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
