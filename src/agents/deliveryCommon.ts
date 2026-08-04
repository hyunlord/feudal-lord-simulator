import type { Building } from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
import {
  currentRoadTile,
  lastReachedRoadTile,
} from "./movement";
import type { DeliveryInventoryPort, DeliveryRoutePort } from "./deliveryTypes";
import type { CarterWalker, TilePos, Walker } from "./walker.types";

export const amountOf = (
  record: Partial<Record<ResourceType, number>>,
  resource: ResourceType,
): number => Math.max(0, record[resource] ?? 0);

export function withStock(
  building: Building,
  resource: ResourceType,
  amount: number,
): Building {
  const nextAmount = Math.max(0, Math.floor(amount));
  if (nextAmount === 0) {
    const { [resource]: _removed, ...remaining } = building.inventory;
    return { ...building, inventory: remaining };
  }
  return {
    ...building,
    inventory: { ...building.inventory, [resource]: nextAmount },
  };
}

export function replaceBuilding(
  buildings: readonly Building[],
  replacement: Building,
): readonly Building[] {
  return buildings.map((building) =>
    building.id === replacement.id ? replacement : building,
  );
}

export function byId(
  left: { readonly id: string },
  right: { readonly id: string },
): number {
  return left.id.localeCompare(right.id);
}

export function activeCarterHomes(walkers: readonly Walker[]): Set<string> {
  return new Set(
    walkers
      .filter((walker): walker is CarterWalker => walker.kind === "carter")
      .map((walker) => walker.homeBuildingId),
  );
}

export function spawnCarter(params: {
  readonly tick: number;
  readonly home: Building;
  readonly destination: Building;
  readonly path: readonly TilePos[];
  readonly mission: CarterWalker["mission"];
  readonly cargo: CarterWalker["cargo"];
  readonly reservation: CarterWalker["reservation"];
}): CarterWalker {
  return {
    id: `carter:${params.home.id}:${params.tick}`,
    kind: "carter",
    mission: params.mission,
    phase: "outbound",
    homeBuildingId: params.home.id,
    destinationBuildingId: params.destination.id,
    reservation: params.reservation,
    position: params.path[0] ?? { tx: params.home.tx, ty: params.home.ty },
    path: params.path,
    pathIndex: 0,
    previousTile: null,
    cargo: params.cargo,
    spawnedTick: params.tick,
    cancellation: null,
  };
}

export function findBuilding(
  buildings: readonly Building[],
  id: string,
): Building | null {
  return buildings.find((building) => building.id === id) ?? null;
}

export function releaseClaims(
  buildings: readonly Building[],
  carter: CarterWalker,
  inventory: DeliveryInventoryPort,
): readonly Building[] {
  const destination = findBuilding(
    buildings,
    carter.reservation.destinationBuildingId,
  );
  let nextBuildings = buildings;
  if (destination !== null) {
    nextBuildings = replaceBuilding(
      nextBuildings,
      inventory.releaseSpace(
        destination,
        carter.reservation.resource,
        carter.reservation.amount,
      ),
    );
  }
  const claim = carter.reservation.sourceStockClaim;
  if (claim === null) return nextBuildings;
  const source = findBuilding(nextBuildings, claim.buildingId);
  return source === null
    ? nextBuildings
    : replaceBuilding(
        nextBuildings,
        inventory.releaseStock(source, claim.resource, claim.amount),
      );
}

export function deposit(
  building: Building,
  resource: ResourceType,
  amount: number,
): Building {
  return withStock(building, resource, amountOf(building.inventory, resource) + amount);
}

export function returnPath(
  buildings: readonly Building[],
  carter: CarterWalker,
  routes: DeliveryRoutePort,
): readonly TilePos[] | null {
  const home = findBuilding(buildings, carter.homeBuildingId);
  const current = lastReachedRoadTile(carter) ?? currentRoadTile(carter);
  if (home === null || current === null) return null;
  return routes.fromTileToBuilding(current, home.id);
}
