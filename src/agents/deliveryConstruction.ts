import { BALANCE } from "../content/balanceConfig";
import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import {
  CHARTER_TIMBER_KINDS,
  withSupplierKeep,
  charterTimberWait,
  wallDeliveryAvailable,
  type CharterTimberWait,
  type WallConstructionPriority,
  type WallConstructionReserve,
} from "../domain/wallReserve";
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
import { carterPathTravelCost } from './carterTravelCost';

interface SiteCandidate {
  readonly siteId: string;
  readonly destination: CarterDestination;
  readonly source: Building;
  readonly resource: ResourceType;
  readonly path: readonly TilePos[];
  readonly amount: number;
  readonly wall: boolean;
}

interface TreasurySiteCandidate {
  readonly siteId: string;
  readonly destination: CarterDestination;
  readonly home: Building;
  readonly path: readonly TilePos[];
  readonly amount: number;
  readonly wall: boolean;
}

function nearestWallCandidate<T extends { readonly wall: boolean; readonly path: readonly TilePos[] }>(
  candidates: readonly T[], routes: DeliveryRoutePort,
): T | null {
  const ordinary = candidates.find(candidate => !candidate.wall);
  if (ordinary !== undefined) return ordinary;
  return [...candidates].sort((left, right) =>
    carterPathTravelCost(left.path, routes.isRoad) - carterPathTravelCost(right.path, routes.isRoad))[0] ?? null;
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
  readonly wallConstructionReserve?: WallConstructionReserve;
  readonly wallConstructionPriority?: WallConstructionPriority;
  readonly charter: { readonly wait: CharterTimberWait; readonly townStock: number; readonly supplierKeep?: number };
}): readonly SiteCandidate[] {
  return [...params.sites].sort(byId).flatMap((site) => {
    const need = constructionDeliveryNeed(site);
    return RESOURCE_TYPES.flatMap((resource) => {
      const missing = amountOf(need, resource);
      if (missing === 0) return [];
      const destination = siteDestination(site);
      return [...params.buildings].sort(byId).flatMap((source) => {
        if (params.busyHomeIds.has(source.id)) return [];
        const sourceAvailable = params.inventory.availableStock(source, resource);
        const available = site.kind === "palisade_segment" || site.kind === "stone_wall_segment"
          ? wallDeliveryAvailable(params.wallConstructionReserve, params.wallConstructionPriority ?? "balanced", source.id, resource, sourceAvailable, params.charter)
          : sourceAvailable;
        if (available === 0) return [];
        const path = params.routes.fromBuildingToDestination(source.id, destination);
        if (path === null || path.length === 0) return [];
        const amount = Math.min(BALANCE.CARTER_CAPACITY, missing, available);
        return amount > 0
          ? [{ siteId: site.id, destination, source, resource, path, amount,
            wall: site.kind === 'palisade_segment' || site.kind === 'stone_wall_segment' }]
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
  readonly wallConstructionReserve?: WallConstructionReserve;
  readonly wallConstructionPriority?: WallConstructionPriority;
  readonly charter: { readonly wait: CharterTimberWait; readonly townStock: number; readonly supplierKeep?: number };
}): TreasurySiteCandidate | null {
  if (params.treasuryTimber <= 0) return null;
  const homes = [...params.buildings]
    .sort(byId)
    .filter(
      (building) => building.kind === "house" && !params.busyHomeIds.has(building.id),
    );
  if (homes.length === 0) return null;
  const candidates: TreasurySiteCandidate[] = [];
  for (const site of [...params.sites].sort(byId)) {
    const missing = amountOf(constructionDeliveryNeed(site), "timber");
    if (missing === 0) continue;
    const available = site.kind === "palisade_segment" || site.kind === "stone_wall_segment"
      ? wallDeliveryAvailable(params.wallConstructionReserve, params.wallConstructionPriority ?? "balanced", "treasury", "timber", params.treasuryTimber, params.charter)
      : params.treasuryTimber;
    if (available <= 0) continue;
    const destination = siteDestination(site);
    for (const home of homes) {
      const path = params.routes.fromBuildingToDestination(home.id, destination);
      if (path === null || path.length === 0) continue;
      candidates.push({
        siteId: site.id,
        destination,
        home,
        path,
        amount: Math.min(BALANCE.CARTER_CAPACITY, missing, available),
        wall: site.kind === 'palisade_segment' || site.kind === 'stone_wall_segment',
      });
    }
  }
  return nearestWallCandidate(candidates, params.routes);
}

/** FIX-16: whether the next charter building waits for timber, and the town's timber (buildings and treasury). */
type Kind = keyof typeof BUILDING_CONFIG_BY_KIND;
const KINDS = Object.keys(BUILDING_CONFIG_BY_KIND) as Kind[];
/** Construction materials: every resource some building's cost names. */
const CONSTRUCTION_MATERIALS: ReadonlySet<string> = new Set(KINDS.flatMap(kind => Object.keys(BUILDING_CONFIG_BY_KIND[kind].buildCost)));
const PRODUCERS = (resource: string): readonly Kind[] => KINDS.filter(kind => BUILDING_CONFIG_BY_KIND[kind].production?.output === resource);
/** A producer's input for one production window (2,400 ticks). */
const WINDOW_INPUT = (kind: Kind): number => {
  const production = BUILDING_CONFIG_BY_KIND[kind].production;
  return production === null || production.input === null ? 0 : Math.round(production.inputPerOutput * 2_400 / production.ticksPerOutput);
};

/**
 * GROW-BLOCK-2a ③⑥ (the user's rule 2026-10-10): "a material's supplier that cannot be built for want of material, when
 * that material is needed, keeps its cost from the wall" — read from the buildings' definitions, so a new building needs
 * no new rule. A supplier is wanted when
 *  - a material is needed (what the next charter building lacks, what a building site waits for with none in stock) and
 *    nothing makes it: the first link of its chain with no building standing or placed (the church's stone: the
 *    masonry, then the quarry for its raw stone) — seed 1's quarry waited for the whole wall, 528 from 1318 to 1329;
 *  - a construction material's producer has a window of its input waiting in the stores and none of its kind placed
 *    (the logs backing up: another sawmill) — seed 5's one sawmill faced 231 logs with 1–4 timber in stock for ten years.
 * The keep is the largest timber cost of the wanted suppliers.
 */
export function supplierKeep(buildings: readonly Building[], sites: readonly ConstructionSite[], held: (resource: ResourceType) => number,
  needed: readonly string[]): number {
  const placed = (kind: Kind) => sites.some(site => "kind" in site && site.kind === kind);
  const present = (kind: Kind) => buildings.some(building => building.kind === kind) || placed(kind);
  const wanted = new Set<Kind>();
  const visit = (resource: string, depth: number) => {
    const producers = PRODUCERS(resource);
    if (producers.length === 0 || depth > 3) return;
    const standing = producers.filter(present);
    if (standing.length === 0) { wanted.add(producers[0]!); return; }
    for (const kind of standing) {
      const input = BUILDING_CONFIG_BY_KIND[kind].production?.input ?? null;
      if (input !== null) visit(input, depth + 1);
    }
  };
  for (const resource of needed) visit(resource, 0);
  for (const kind of KINDS) {
    const production = BUILDING_CONFIG_BY_KIND[kind].production;
    if (production === null || production.input === null || !CONSTRUCTION_MATERIALS.has(production.output)) continue;
    if (buildings.some(building => building.kind === kind) && !placed(kind) && held(production.input) >= WINDOW_INPUT(kind)) wanted.add(kind);
  }
  return Math.max(0, ...[...wanted].map(kind => BUILDING_CONFIG_BY_KIND[kind].buildCost.timber ?? 0));
}

export function charterTimberContext(params: {
  readonly buildings: readonly Building[];
  readonly constructionSites: readonly ConstructionSite[];
  readonly inventory: DeliveryInventoryPort;
  readonly treasuryTimber: number;
}): { readonly wait: CharterTimberWait; readonly townStock: number; readonly supplierKeep: number } {
  const held = (resource: ResourceType) => params.buildings.reduce((sum, building) => sum + params.inventory.availableStock(building, resource), 0);
  const otherMaterialsHeld = (kind: (typeof CHARTER_TIMBER_KINDS)[number]) => Object.entries(BUILDING_CONFIG_BY_KIND[kind].buildCost)
    .every(([resource, amount]) => resource === "timber" || held(resource as ResourceType) >= Number(amount ?? 0));
  const timberCost = (kind: string) => BUILDING_CONFIG_BY_KIND[kind as Kind]?.buildCost.timber ?? 0;
  const charter = charterTimberWait(params.buildings, params.constructionSites, timberCost, otherMaterialsHeld);
  // The materials needed: what the next charter building lacks, what a building site waits for with none in stock.
  const next = CHARTER_TIMBER_KINDS.find(kind => !params.buildings.some(building => building.kind === kind));
  const lacking = next === undefined ? [] : Object.entries(BUILDING_CONFIG_BY_KIND[next].buildCost)
    .filter(([resource, amount]) => resource !== "timber" && held(resource as ResourceType) < Number(amount ?? 0)).map(([resource]) => resource);
  const waiting = params.constructionSites.filter(site => "kind" in site).flatMap(site => Object.entries(constructionDeliveryNeed(site))
    .filter(([resource, amount]) => resource !== "timber" && Number(amount ?? 0) > 0 && held(resource as ResourceType) <= 0).map(([resource]) => resource));
  const keep = supplierKeep(params.buildings, params.constructionSites, held, [...new Set([...lacking, ...waiting])]);
  const wait = withSupplierKeep(charter, keep);
  if (wait.wallSharePermille >= 1_000 && wait.keep <= 0) return { wait, townStock: 0, supplierKeep: 0 };
  const townStock = params.buildings.reduce((sum, building) => sum + params.inventory.availableStock(building, "timber"), 0) + Math.max(0, params.treasuryTimber);
  return { wait, townStock, supplierKeep: keep };
}

export function spawnSiteDelivery(params: {
  readonly tick: number;
  readonly buildings: readonly Building[];
  readonly constructionSites: NonNullable<DeliveryStepInput["constructionSites"]>;
  readonly treasuryTimber: number;
  readonly inventory: DeliveryInventoryPort;
  readonly routes: DeliveryRoutePort;
  readonly busyHomeIds: ReadonlySet<string>;
  readonly wallConstructionReserve?: WallConstructionReserve;
  readonly wallConstructionPriority?: WallConstructionPriority;
}): DeliveryStepResult | null {
  const charter = charterTimberContext(params);
  const candidates = siteCandidates({
    sites: params.constructionSites,
    buildings: params.buildings,
    routes: params.routes,
    inventory: params.inventory,
    busyHomeIds: params.busyHomeIds,
    charter,
    ...(params.wallConstructionReserve === undefined ? {} : { wallConstructionReserve: params.wallConstructionReserve }),
    ...(params.wallConstructionPriority === undefined ? {} : { wallConstructionPriority: params.wallConstructionPriority }),
  });
  const candidate = nearestWallCandidate(candidates, params.routes);
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
    charter,
    ...(params.wallConstructionReserve === undefined ? {} : { wallConstructionReserve: params.wallConstructionReserve }),
    ...(params.wallConstructionPriority === undefined ? {} : { wallConstructionPriority: params.wallConstructionPriority }),
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
