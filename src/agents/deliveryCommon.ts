import type { Building } from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
import type { ConstructionSite } from "../economy/construction";
import {
  currentRoadTile,
  lastReachedRoadTile,
} from "./movement";
import type { DeliveryInventoryPort, DeliveryRoutePort } from "./deliveryTypes";
import type { CarterDestination, CarterWalker, TilePos, Walker } from "./walker.types";

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
  readonly destination: CarterDestination;
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
    destination: params.destination,
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

export function findSite(
  sites: readonly ConstructionSite[],
  id: string,
): ConstructionSite | null {
  return sites.find((site) => site.id === id) ?? null;
}

export function replaceSite(
  sites: readonly ConstructionSite[],
  replacement: ConstructionSite,
): readonly ConstructionSite[] {
  return sites.map((site) => (site.id === replacement.id ? replacement : site));
}

function withSiteResource(
  site: ConstructionSite,
  field: "delivered" | "reserved",
  resource: ResourceType,
  amount: number,
): ConstructionSite {
  const nextAmount = Math.max(0, Math.floor(amount));
  const current = site[field];
  if (nextAmount === 0) {
    const { [resource]: _removed, ...remaining } = current;
    return { ...site, [field]: remaining };
  }
  return { ...site, [field]: { ...current, [resource]: nextAmount } };
}

export function reserveSiteResource(
  site: ConstructionSite,
  resource: ResourceType,
  amount: number,
): ConstructionSite {
  return withSiteResource(
    site,
    "reserved",
    resource,
    amountOf(site.reserved, resource) + amount,
  );
}

export function releaseSiteResource(
  site: ConstructionSite,
  resource: ResourceType,
  amount: number,
): ConstructionSite {
  return withSiteResource(
    site,
    "reserved",
    resource,
    amountOf(site.reserved, resource) - amount,
  );
}

export function deliverSiteResource(
  site: ConstructionSite,
  resource: ResourceType,
  amount: number,
): ConstructionSite {
  return withSiteResource(
    releaseSiteResource(site, resource, amount),
    "delivered",
    resource,
    amountOf(site.delivered, resource) + amount,
  );
}

export interface DeliveryResourceState {
  readonly buildings: readonly Building[];
  readonly constructionSites: readonly ConstructionSite[];
  readonly treasuryTimber: number;
}

export function releaseClaims(
  state: DeliveryResourceState,
  carter: CarterWalker,
  inventory: DeliveryInventoryPort,
): DeliveryResourceState {
  let nextState = state;
  switch (carter.reservation.destination.kind) {
    case "building": {
      const destination = findBuilding(
        nextState.buildings,
        carter.reservation.destination.buildingId,
      );
      if (destination !== null) {
        nextState = {
          ...nextState,
          buildings: replaceBuilding(
            nextState.buildings,
            inventory.releaseSpace(
              destination,
              carter.reservation.resource,
              carter.reservation.amount,
            ),
          ),
        };
      }
      break;
    }
    case "construction_site": {
      const destination = findSite(
        nextState.constructionSites,
        carter.reservation.destination.siteId,
      );
      if (destination !== null) {
        nextState = {
          ...nextState,
          constructionSites: replaceSite(
            nextState.constructionSites,
            releaseSiteResource(
              destination,
              carter.reservation.resource,
              carter.reservation.amount,
            ),
          ),
        };
      }
      break;
    }
  }
  const claim = carter.reservation.sourceStockClaim;
  if (claim === null) return nextState;
  switch (claim.kind) {
    case "building": {
      const source = findBuilding(nextState.buildings, claim.buildingId);
      return source === null
        ? nextState
        : {
            ...nextState,
            buildings: replaceBuilding(
              nextState.buildings,
              inventory.releaseStock(source, claim.resource, claim.amount),
            ),
          };
    }
    case "treasury":
      return nextState;
  }
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
  return routes.fromTileToDestination(current, {
    kind: "building",
    buildingId: home.id,
  });
}
