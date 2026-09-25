import { BALANCE } from "../content/balanceConfig";
import {
  BUILDING_CONFIG_BY_KIND,
  operationSuspended,
  type Building,
} from "../content/buildingConfig";
import { LABOUR_BALANCE } from "../content/balanceConfig";
import { pushableMill } from "./millPush";
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
  RouteCandidate,
} from "./deliveryTypes";
import type { CarterWalker, Walker } from "./walker.types";

function spawnFetch(params: {
  readonly tick: number;
  readonly building: Building;
  readonly buildings: readonly Building[];
  readonly inputResource: ResourceType;
  readonly inventory: DeliveryInventoryPort;
  readonly routes: DeliveryRoutePort;
  readonly cart?: CarterWalker["cart"];
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
      ...(params.cart === undefined ? {} : { cart: params.cart }),
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
  readonly candidate?: RouteCandidate | null;
  readonly cart?: CarterWalker["cart"];
}): { readonly buildings: readonly Building[]; readonly walker: CarterWalker | null } {
  const candidate = params.candidate !== undefined ? params.candidate : deliverCandidate(
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
      ...(params.cart === undefined ? {} : { cart: params.cart }),
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
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  const production = definition.production;
  // AF-9: a farmstead's carter hauls the harvest from its barn like production output.
  if (production === null) {
    return definition.fieldOutput === undefined ? { buildings, walker: null }
      : spawnDelivery({ tick, building, buildings, outputResource: definition.fieldOutput, inventory, routes });
  }
  if (building.kind === "mill" && amountOf(building.inventory, production.output) >= BALANCE.CARTER_CAPACITY) {
    const delivery = spawnDelivery({ tick, building, buildings, outputResource: production.output, inventory, routes });
    if (delivery.walker !== null) return delivery;
  }
  // LB-7: a mill's wheat comes by its intake cart and granary pushes; its main cart only takes bread out.
  if (
    production.input !== null && building.kind !== "mill" &&
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

/** LB-7: wheat a mill holds plus wheat already on its way (reserved space). */
function millWheat(mill: Building): number {
  return amountOf(mill.inventory, "wheat") + amountOf(mill.reserved, "wheat");
}

/** LB-7: the mill in a granary's reach that most needs wheat (least held + incoming, then route, then id). */
function pushCandidate(granary: Building, buildings: readonly Building[], inventory: DeliveryInventoryPort, routes: DeliveryRoutePort): RouteCandidate | null {
  const stock = Math.min(amountOf(granary.inventory, "wheat"), inventory.availableStock(granary, "wheat"));
  if (stock === 0) return null;
  const candidates = buildings.flatMap((mill) => {
    if (!pushableMill(granary, mill) || millWheat(mill) >= LABOUR_BALANCE.millPushTarget) return [];
    const space = inventory.availableSpace(mill);
    if (space === 0) return [];
    const path = routes.betweenBuildings(granary.id, mill.id);
    if (path === null || path.length === 0) return [];
    return [{ building: mill, path, amount: Math.min(LABOUR_BALANCE.millCartCapacity, stock, space) }];
  });
  return [...candidates].sort((left, right) => millWheat(left.building) - millWheat(right.building)
    || left.path.length - right.path.length || left.building.id.localeCompare(right.building.id))[0] ?? null;
}

/** LB-7: mills' intake carts, then granary pushes (a granary needs a hauler from the day pool), after the main carts. */
function spawnSecondCarts(input: DeliveryStepInput, start: readonly Building[], walkers: Walker[]): readonly Building[] {
  let buildings = start;
  const intake = activeCarterHomes(walkers, "intake");
  for (const mill of [...start].filter(building => building.kind === "mill").sort(byId)) {
    const current = buildings.find(({ id }) => id === mill.id) ?? mill;
    if (intake.has(mill.id) || operationSuspended(current) || millWheat(current) >= LABOUR_BALANCE.millWheatTarget) continue;
    const fetched = spawnFetch({ tick: input.tick, building: current, buildings, inputResource: "wheat",
      inventory: input.inventory, routes: input.routes, cart: "intake" });
    if (fetched.walker === null) continue;
    buildings = fetched.buildings;
    walkers.push(fetched.walker);
  }
  const pushing = activeCarterHomes(walkers, "push");
  for (const granary of [...start].filter(building => building.kind === "granary" && (building.haulers ?? 0) > 0).sort(byId)) {
    const current = buildings.find(({ id }) => id === granary.id) ?? granary;
    if (pushing.has(granary.id) || operationSuspended(current)) continue;
    const candidate = pushCandidate(current, buildings, input.inventory, input.routes);
    if (candidate === null) continue;
    const pushed = spawnDelivery({ tick: input.tick, building: current, buildings, outputResource: "wheat",
      inventory: input.inventory, routes: input.routes, candidate, cart: "push" });
    if (pushed.walker === null) continue;
    buildings = pushed.buildings;
    walkers.push(pushed.walker);
  }
  return buildings;
}

export function spawnCarters(input: DeliveryStepInput): DeliveryStepResult {
  let constructionSites = input.constructionSites ?? [];
  let treasuryTimber = input.treasuryTimber ?? 0;
  const walkers: Walker[] = [...input.walkers];
  let buildings = input.buildings;
  const busyHomes = activeCarterHomes(walkers);

  if (constructionSites.length > 0) {
    for (const building of [...buildings].sort(byId)) {
      if (busyHomes.has(building.id)) continue;
      const production = BUILDING_CONFIG_BY_KIND[building.kind].production;
      if (production === null || production.input === null || building.kind === "mill" ||
          amountOf(building.inventory, production.input) >= production.inputPerOutput) continue;
      const fetched = spawnFetch({
        tick: input.tick,
        building,
        buildings,
        inputResource: production.input,
        inventory: input.inventory,
        routes: input.routes,
      });
      if (fetched.walker === null) continue;
      buildings = fetched.buildings;
      walkers.push(fetched.walker);
      input.materialActivity?.({ kind: "dispatch", tick: input.tick, walker: fetched.walker });
      busyHomes.add(building.id);
    }
  }

  const siteDispatch = spawnSiteDelivery({
    tick: input.tick,
    buildings,
    constructionSites,
    treasuryTimber,
    inventory: input.inventory,
    routes: input.routes,
    busyHomeIds: busyHomes,
    ...(input.wallConstructionReserve === undefined ? {} : { wallConstructionReserve: input.wallConstructionReserve }),
    ...(input.wallConstructionPriority === undefined ? {} : { wallConstructionPriority: input.wallConstructionPriority }),
  });
  const siteWalker = siteDispatch?.walkers[0] ?? null;
  if (siteDispatch !== null && siteWalker !== null && !busyHomes.has(siteWalker.homeBuildingId)) {
    buildings = siteDispatch.buildings;
    constructionSites = siteDispatch.constructionSites;
    treasuryTimber = siteDispatch.treasuryTimber;
    walkers.push(siteWalker);
    if (siteWalker.kind === "carter") input.materialActivity?.({ kind: "dispatch", tick: input.tick, walker: siteWalker });
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
      input.materialActivity?.({ kind: "dispatch", tick: input.tick, walker: result.walker });
      busyHomes.add(building.id);
    }
  }

  // LB-7: second carts go after every main cart, so producers and barns keep first claim on their own stock.
  buildings = spawnSecondCarts(input, buildings, walkers);
  return { buildings, constructionSites, walkers: walkers.sort(byId), treasuryTimber };
}
