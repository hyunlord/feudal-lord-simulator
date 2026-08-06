import { BALANCE } from "../content/balanceConfig";
import type { Building } from "../content/buildingConfig";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import {
  constructionDeliveryNeed,
  type ConstructionSite,
  type MaterialSource,
} from "../economy/construction";
import {
  amountOf,
  byId,
  findSite,
  replaceBuilding,
  replaceSite,
  reserveSiteResource,
  spawnCarter,
  withStock,
} from "./deliveryCommon";
import type {
  DeliveryInventoryPort,
  DeliveryRoutePort,
  DeliveryStepInput,
  DeliveryStepResult,
} from "./deliveryTypes";
import type { CarterDestination, TilePos } from "./walker.types";

interface SiteCandidate {
  readonly siteId: string;
  readonly destination: CarterDestination;
  readonly source: Building;
  readonly resource: ResourceType;
  readonly path: readonly TilePos[];
  readonly amount: number;
}

interface TreasurySiteCandidate {
  readonly siteId: string;
  readonly destination: CarterDestination;
  readonly home: Building;
  readonly path: readonly TilePos[];
  readonly amount: number;
}

function siteDestination(site: { readonly id: string }): CarterDestination {
  return { kind: "construction_site", siteId: site.id };
}

export function constructionMaterialSources(params: {
  readonly site: ConstructionSite;
  readonly buildings: readonly Building[];
  readonly routes: DeliveryRoutePort;
  readonly inventory: DeliveryInventoryPort;
  readonly treasuryTimber: number;
}): readonly MaterialSource[] {
  const need = constructionDeliveryNeed(params.site);
  const destination = siteDestination(params.site);
  const buildingSources = [...params.buildings].sort(byId).flatMap((building) => {
    const stock = RESOURCE_TYPES.reduce<Partial<Record<ResourceType, number>>>(
      (result, resource) => {
        if (amountOf(need, resource) === 0) return result;
        const available = params.inventory.availableStock(building, resource);
        return available > 0 ? { ...result, [resource]: available } : result;
      },
      {},
    );
    const hasStock = RESOURCE_TYPES.some((resource) => amountOf(stock, resource) > 0);
    if (!hasStock) return [];
    return [{
      id: building.id,
      stock,
      hasRoute: params.routes.fromBuildingToDestination(building.id, destination) !== null,
    }];
  });
  const treasury = amountOf(need, "timber") > 0 && params.treasuryTimber > 0
    ? [{
        id: "treasury",
        stock: { timber: params.treasuryTimber },
        hasRoute: [...params.buildings].sort(byId).some(
          (building) =>
            building.kind === "house" &&
            params.routes.fromBuildingToDestination(building.id, destination) !== null,
        ),
      }]
    : [];
  return [...buildingSources, ...treasury];
}

function siteCandidates(params: {
  readonly sites: NonNullable<DeliveryStepInput["constructionSites"]>;
  readonly buildings: readonly Building[];
  readonly routes: DeliveryRoutePort;
  readonly inventory: DeliveryInventoryPort;
  readonly busyHomeIds: ReadonlySet<string>;
}): readonly SiteCandidate[] {
  return [...params.sites].sort(byId).flatMap((site) => {
    const need = constructionDeliveryNeed(site);
    return RESOURCE_TYPES.flatMap((resource) => {
      const missing = amountOf(need, resource);
      if (missing === 0) return [];
      const destination = siteDestination(site);
      return [...params.buildings].sort(byId).flatMap((source) => {
        if (params.busyHomeIds.has(source.id)) return [];
        const available = params.inventory.availableStock(source, resource);
        if (available === 0) return [];
        const path = params.routes.fromBuildingToDestination(source.id, destination);
        if (path === null || path.length === 0) return [];
        const amount = Math.min(BALANCE.CARTER_CAPACITY, missing, available);
        return amount > 0
          ? [{ siteId: site.id, destination, source, resource, path, amount }]
          : [];
      });
    });
  });
}

function treasuryCandidate(params: {
  readonly sites: NonNullable<DeliveryStepInput["constructionSites"]>;
  readonly buildings: readonly Building[];
  readonly routes: DeliveryRoutePort;
  readonly treasuryTimber: number;
  readonly busyHomeIds: ReadonlySet<string>;
}): TreasurySiteCandidate | null {
  if (params.treasuryTimber <= 0) return null;
  const homes = [...params.buildings]
    .sort(byId)
    .filter(
      (building) => building.kind === "house" && !params.busyHomeIds.has(building.id),
    );
  if (homes.length === 0) return null;
  for (const site of [...params.sites].sort(byId)) {
    const missing = amountOf(constructionDeliveryNeed(site), "timber");
    if (missing === 0) continue;
    const destination = siteDestination(site);
    for (const home of homes) {
      const path = params.routes.fromBuildingToDestination(home.id, destination);
      if (path === null || path.length === 0) continue;
      return {
        siteId: site.id,
        destination,
        home,
        path,
        amount: Math.min(BALANCE.CARTER_CAPACITY, missing, params.treasuryTimber),
      };
    }
  }
  return null;
}

export function spawnSiteDelivery(params: {
  readonly tick: number;
  readonly buildings: readonly Building[];
  readonly constructionSites: NonNullable<DeliveryStepInput["constructionSites"]>;
  readonly treasuryTimber: number;
  readonly inventory: DeliveryInventoryPort;
  readonly routes: DeliveryRoutePort;
  readonly busyHomeIds: ReadonlySet<string>;
}): DeliveryStepResult | null {
  const candidate = siteCandidates({
    sites: params.constructionSites,
    buildings: params.buildings,
    routes: params.routes,
    inventory: params.inventory,
    busyHomeIds: params.busyHomeIds,
  })[0] ?? null;
  if (candidate !== null) {
    const claimedSource = params.inventory.reserveStock(
      candidate.source,
      candidate.resource,
      candidate.amount,
    );
    const claim = amountOf(claimedSource.stockReserved, candidate.resource) -
      amountOf(candidate.source.stockReserved, candidate.resource);
    const site = findSite(params.constructionSites, candidate.siteId);
    if (claim === 0 || site === null) return null;
    const loadedSource = withStock(
      claimedSource,
      candidate.resource,
      amountOf(claimedSource.inventory, candidate.resource) - claim,
    );
    const clearedSource = params.inventory.releaseStock(
      loadedSource,
      candidate.resource,
      claim,
    );
    return {
      buildings: replaceBuilding(params.buildings, clearedSource),
      constructionSites: replaceSite(
        params.constructionSites,
        reserveSiteResource(site, candidate.resource, claim),
      ),
      treasuryTimber: params.treasuryTimber,
      walkers: [
        spawnCarter({
          tick: params.tick,
          home: clearedSource,
          destination: candidate.destination,
          path: candidate.path,
          mission: "deliver",
          cargo: { resource: candidate.resource, amount: claim },
          reservation: {
            destination: candidate.destination,
            resource: candidate.resource,
            amount: claim,
            sourceStockClaim: {
              kind: "building",
              buildingId: clearedSource.id,
              resource: candidate.resource,
              amount: claim,
            },
            homeCapacityClaim: null,
          },
        }),
      ],
    };
  }

  const treasury = treasuryCandidate({
    sites: params.constructionSites,
    buildings: params.buildings,
    routes: params.routes,
    treasuryTimber: params.treasuryTimber,
    busyHomeIds: params.busyHomeIds,
  });
  if (treasury === null) return null;
  const site = findSite(params.constructionSites, treasury.siteId);
  if (site === null) return null;
  return {
    buildings: params.buildings,
    constructionSites: replaceSite(
      params.constructionSites,
      reserveSiteResource(site, "timber", treasury.amount),
    ),
    treasuryTimber: params.treasuryTimber - treasury.amount,
    walkers: [
      spawnCarter({
        tick: params.tick,
        home: treasury.home,
        destination: treasury.destination,
        path: treasury.path,
        mission: "deliver",
        cargo: { resource: "timber", amount: treasury.amount },
        reservation: {
          destination: treasury.destination,
          resource: "timber",
          amount: treasury.amount,
          sourceStockClaim: {
            kind: "treasury",
            resource: "timber",
            amount: treasury.amount,
          },
          homeCapacityClaim: null,
        },
      }),
    ],
  };
}
