import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
  type BuildingKind,
} from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import type {
  DeliveryInventoryPort,
  DeliveryRoutePort,
} from "../src/agents/delivery";
import type { TilePos } from "../src/agents/walker.types";
import {
  availableSpace,
  availableStock,
  releaseReservation,
  releaseStockReservation,
  reserve,
  reserveStock,
  withdrawReservedStock,
} from "../src/economy/storage";

export function building(
  id: string,
  kind: BuildingKind,
  input: {
    readonly tx?: number;
    readonly ty?: number;
    readonly inventory?: Partial<Record<ResourceType, number>>;
    readonly reserved?: Partial<Record<ResourceType, number>>;
    readonly stockReserved?: Partial<Record<ResourceType, number>>;
  } = {},
): Building {
  return {
    id,
    kind,
    tx: input.tx ?? 0,
    ty: input.ty ?? 0,
    workers: 0,
    inventory: input.inventory ?? {},
    reserved: input.reserved ?? {},
    stockReserved: input.stockReserved ?? {},
    productionProgress: 0,
  };
}

export const DELIVERY_INVENTORY: DeliveryInventoryPort = {
  availableSpace: (candidate) =>
    availableSpace(candidate, BUILDING_CONFIG_BY_KIND[candidate.kind]),
  reserveSpace: reserve,
  releaseSpace: releaseReservation,
  availableStock,
  reserveStock: (candidate, resource, amount) =>
    reserveStock(candidate, {
      buildingId: candidate.id,
      resource,
      amount,
    }),
  releaseStock: releaseStockReservation,
  withdrawStock: withdrawReservedStock,
};

const tileKey = (tile: TilePos): string => `${tile.tx},${tile.ty}`;

export function routePort(
  paths: Readonly<Record<string, readonly TilePos[]>>,
  roadTiles: readonly TilePos[] = Object.values(paths).flat(),
): DeliveryRoutePort {
  const roads = new Set(roadTiles.map(tileKey));
  const destinationId = (
    destination: Parameters<DeliveryRoutePort["fromBuildingToDestination"]>[1],
  ): string => {
    switch (destination.kind) {
      case "building":
        return destination.buildingId;
      case "construction_site":
        return destination.siteId;
    }
  };
  return {
    betweenBuildings: (fromBuildingId, toBuildingId) =>
      paths[`${fromBuildingId}->${toBuildingId}`] ?? null,
    fromBuildingToDestination: (fromBuildingId, destination) =>
      paths[`${fromBuildingId}->${destinationId(destination)}`] ?? null,
    fromTileToBuilding: (start, toBuildingId) =>
      paths[`${tileKey(start)}->${toBuildingId}`] ?? null,
    fromTileToDestination: (start, destination) =>
      paths[`${tileKey(start)}->${destinationId(destination)}`] ?? null,
    isRoad: (tile) => roads.has(tileKey(tile)),
  };
}

export const line = (...coordinates: readonly [number, number][]): readonly TilePos[] =>
  coordinates.map(([tx, ty]) => ({ tx, ty }));
