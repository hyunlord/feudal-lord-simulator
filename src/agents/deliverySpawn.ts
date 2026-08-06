import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
} from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
import {
  activeCarterHomes,
  amountOf,
  byId,
  replaceBuilding,
  spawnCarter,
  withStock,
} from "./deliveryCommon";
import { deliverCandidate, fetchCandidate } from "./deliveryBuildingCandidates";
import { spawnSiteDelivery } from "./deliveryConstruction";
import type {
  DeliveryInventoryPort,
  DeliveryRoutePort,
  DeliveryStepInput,
  DeliveryStepResult,
} from "./deliveryTypes";
import type { CarterWalker, Walker } from "./walker.types";

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
      destination: { kind: "building", buildingId: reservedSource.id },
      path: candidate.path,
      mission: "fetch",
      cargo: null,
      reservation: {
        destination: { kind: "building", buildingId: reservedHome.id },
        resource: params.inputResource,
        amount: claim,
        sourceStockClaim: {
          kind: "building",
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
      destination: { kind: "building", buildingId: reservedDestination.id },
      path: candidate.path,
      mission: "deliver",
      cargo: { resource: params.outputResource, amount: candidate.amount },
      reservation: {
        destination: { kind: "building", buildingId: reservedDestination.id },
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
  let constructionSites = input.constructionSites ?? [];
  let treasuryTimber = input.treasuryTimber ?? 0;
  const walkers: Walker[] = [...input.walkers];
  const busyHomes = activeCarterHomes(walkers);

  const siteDispatch = spawnSiteDelivery({
    tick: input.tick,
    buildings,
    constructionSites,
    treasuryTimber,
    inventory: input.inventory,
    routes: input.routes,
    busyHomeIds: busyHomes,
  });
  const siteWalker = siteDispatch?.walkers[0] ?? null;
  if (siteDispatch !== null && siteWalker !== null && !busyHomes.has(siteWalker.homeBuildingId)) {
    buildings = siteDispatch.buildings;
    constructionSites = siteDispatch.constructionSites;
    treasuryTimber = siteDispatch.treasuryTimber;
    walkers.push(siteWalker);
    busyHomes.add(siteWalker.homeBuildingId);
  }

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

  return { buildings, constructionSites, walkers: walkers.sort(byId), treasuryTimber };
}
