import { BALANCE } from "../content/balanceConfig";
import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
} from "../content/buildingConfig";
import {
  STORAGE_KIND_BY_RESOURCE,
  type ResourceType,
} from "../content/resourceConfig";
import {
  activeCarterHomes,
  amountOf,
  byId,
  replaceBuilding,
  spawnCarter,
  withStock,
} from "./deliveryCommon";
import type {
  DeliveryInventoryPort,
  DeliveryRoutePort,
  DeliveryStepInput,
  DeliveryStepResult,
  RouteCandidate,
} from "./deliveryTypes";
import type { CarterWalker, Walker } from "./walker.types";

function bestCandidate(candidates: readonly RouteCandidate[]): RouteCandidate | null {
  return [...candidates].sort((left, right) => {
    if (left.path.length !== right.path.length) {
      return left.path.length - right.path.length;
    }
    return left.building.id.localeCompare(right.building.id);
  })[0] ?? null;
}

function deliverCandidate(
  producer: Building,
  resource: ResourceType,
  buildings: readonly Building[],
  inventory: DeliveryInventoryPort,
  routes: DeliveryRoutePort,
): RouteCandidate | null {
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

function fetchCandidate(
  converter: Building,
  resource: ResourceType,
  buildings: readonly Building[],
  inventory: DeliveryInventoryPort,
  routes: DeliveryRoutePort,
): RouteCandidate | null {
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

function spawnFetch(params: {
  readonly tick: number;
  readonly building: Building;
  readonly buildings: readonly Building[];
  readonly inputResource: ResourceType;
  readonly inventory: DeliveryInventoryPort;
  readonly routes: DeliveryRoutePort;
}): { readonly buildings: readonly Building[]; readonly walker: CarterWalker | null } {
  const candidate = fetchCandidate(
    params.building,
    params.inputResource,
    params.buildings,
    params.inventory,
    params.routes,
  );
  if (candidate === null) return { buildings: params.buildings, walker: null };
  const reservedHome = params.inventory.reserveSpace(
    params.building,
    params.inputResource,
    candidate.amount,
  );
  const reservedSource = params.inventory.reserveStock(
    candidate.building,
    params.inputResource,
    candidate.amount,
  );
  const claim = amountOf(reservedSource.stockReserved, params.inputResource) -
    amountOf(candidate.building.stockReserved, params.inputResource);
  if (claim === 0) return { buildings: params.buildings, walker: null };
  const buildings = replaceBuilding(
    replaceBuilding(params.buildings, reservedHome),
    reservedSource,
  );
  return {
    buildings,
    walker: spawnCarter({
      tick: params.tick,
      home: reservedHome,
      destination: reservedSource,
      path: candidate.path,
      mission: "fetch",
      cargo: null,
      reservation: {
        destinationBuildingId: reservedHome.id,
        resource: params.inputResource,
        amount: claim,
        sourceStockClaim: {
          buildingId: reservedSource.id,
          resource: params.inputResource,
          amount: claim,
        },
        homeCapacityClaim: null,
      },
    }),
  };
}

function spawnDelivery(params: {
  readonly tick: number;
  readonly building: Building;
  readonly buildings: readonly Building[];
  readonly outputResource: ResourceType;
  readonly inventory: DeliveryInventoryPort;
  readonly routes: DeliveryRoutePort;
}): { readonly buildings: readonly Building[]; readonly walker: CarterWalker | null } {
  const candidate = deliverCandidate(
    params.building,
    params.outputResource,
    params.buildings,
    params.inventory,
    params.routes,
  );
  if (candidate === null) return { buildings: params.buildings, walker: null };
  const loadedHome = withStock(
    params.building,
    params.outputResource,
    amountOf(params.building.inventory, params.outputResource) - candidate.amount,
  );
  const reservedHome = params.inventory.reserveSpace(
    loadedHome,
    params.outputResource,
    candidate.amount,
  );
  const homeClaim =
    amountOf(reservedHome.reserved, params.outputResource) -
    amountOf(loadedHome.reserved, params.outputResource);
  if (homeClaim !== candidate.amount) {
    return { buildings: params.buildings, walker: null };
  }
  const reservedDestination = params.inventory.reserveSpace(
    candidate.building,
    params.outputResource,
    candidate.amount,
  );
  const buildings = replaceBuilding(
    replaceBuilding(params.buildings, reservedHome),
    reservedDestination,
  );
  return {
    buildings,
    walker: spawnCarter({
      tick: params.tick,
      home: reservedHome,
      destination: reservedDestination,
      path: candidate.path,
      mission: "deliver",
      cargo: { resource: params.outputResource, amount: candidate.amount },
      reservation: {
        destinationBuildingId: reservedDestination.id,
        resource: params.outputResource,
        amount: candidate.amount,
        sourceStockClaim: null,
        homeCapacityClaim: {
          buildingId: reservedHome.id,
          resource: params.outputResource,
          amount: homeClaim,
        },
      },
    }),
  };
}

function spawnForBuilding(
  tick: number,
  building: Building,
  buildings: readonly Building[],
  inventory: DeliveryInventoryPort,
  routes: DeliveryRoutePort,
): { readonly buildings: readonly Building[]; readonly walker: CarterWalker | null } {
  const production = BUILDING_CONFIG_BY_KIND[building.kind].production;
  if (production === null) return { buildings, walker: null };
  if (
    production.input !== null &&
    amountOf(building.inventory, production.input) < production.inputPerOutput
  ) {
    const fetch = spawnFetch({
      tick,
      building,
      buildings,
      inputResource: production.input,
      inventory,
      routes,
    });
    if (fetch.walker !== null) return fetch;
  }
  return spawnDelivery({
    tick,
    building,
    buildings,
    outputResource: production.output,
    inventory,
    routes,
  });
}

export function spawnCarters(input: DeliveryStepInput): DeliveryStepResult {
  let buildings = input.buildings;
  const walkers: Walker[] = [...input.walkers];
  const busyHomes = activeCarterHomes(walkers);

  for (const building of [...buildings].sort(byId)) {
    if (busyHomes.has(building.id)) continue;
    const current = buildings.find(({ id }) => id === building.id) ?? building;
    const result = spawnForBuilding(
      input.tick,
      current,
      buildings,
      input.inventory,
      input.routes,
    );
    buildings = result.buildings;
    if (result.walker !== null) {
      walkers.push(result.walker);
      busyHomes.add(building.id);
    }
  }

  return { buildings, walkers: walkers.sort(byId) };
}
