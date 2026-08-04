import { BALANCE } from "../content/balanceConfig";
import type { Building } from "../content/buildingConfig";
import {
  hasArrivedAtPathEnd,
  stepWalkerAlongPath,
} from "./movement";
import {
  deposit,
  findBuilding,
  releaseClaims,
  replaceBuilding,
  returnPath,
} from "./deliveryCommon";
import type {
  DeliveryInventoryPort,
  DeliveryRoutePort,
  DeliveryStepInput,
  DeliveryStepResult,
} from "./deliveryTypes";
import type {
  CarterCancellationReason,
  CarterWalker,
  TilePos,
  Walker,
  WalkerCargo,
} from "./walker.types";

interface CarterResult {
  readonly buildings: readonly Building[];
  readonly walker: CarterWalker | null;
}

function returningWalker(
  carter: CarterWalker,
  path: readonly TilePos[],
  cargo: WalkerCargo | null,
): CarterWalker {
  return {
    ...carter,
    phase: "returning",
    position: path[0] ?? carter.position,
    path,
    pathIndex: 0,
    previousTile: null,
    cargo,
  };
}

function completeReturn(
  buildings: readonly Building[],
  carter: CarterWalker,
  inventory: DeliveryInventoryPort,
): readonly Building[] {
  const home = findBuilding(buildings, carter.homeBuildingId);
  if (home === null) return buildings;
  const stocked = carter.cargo === null
    ? home
    : deposit(home, carter.cargo.resource, carter.cargo.amount);
  const released = carter.mission === "fetch"
    ? inventory.releaseSpace(
        stocked,
        carter.reservation.resource,
        carter.reservation.amount,
      )
    : stocked;
  return replaceBuilding(buildings, released);
}

function beginReturn(
  buildings: readonly Building[],
  carter: CarterWalker,
  cargo: WalkerCargo | null,
  inventory: DeliveryInventoryPort,
  routes: DeliveryRoutePort,
): CarterResult {
  const prepared = { ...carter, cargo };
  const path = returnPath(buildings, prepared, routes);
  if (path === null) {
    return {
      buildings: completeReturn(buildings, prepared, inventory),
      walker: null,
    };
  }
  return {
    buildings,
    walker: returningWalker(prepared, path, cargo),
  };
}

function cancelCarter(
  tick: number,
  buildings: readonly Building[],
  carter: CarterWalker,
  inventory: DeliveryInventoryPort,
  routes: DeliveryRoutePort,
  reason: CarterCancellationReason,
): CarterResult {
  const released = carter.cancellation?.releasedReservation === true
    ? buildings
    : releaseClaims(buildings, carter, inventory);
  const cancelled: CarterWalker = {
    ...carter,
    cancellation: {
      tick,
      reason,
      releasedReservation: true,
    },
  };
  return beginReturn(released, cancelled, carter.cargo, inventory, routes);
}

function completeDelivery(
  buildings: readonly Building[],
  carter: CarterWalker,
  inventory: DeliveryInventoryPort,
  routes: DeliveryRoutePort,
  tick: number,
): CarterResult {
  const destination = findBuilding(buildings, carter.destinationBuildingId);
  if (destination === null || carter.cargo === null) {
    return cancelCarter(
      tick,
      buildings,
      carter,
      inventory,
      routes,
      "destination_unavailable",
    );
  }
  const deposited = deposit(
    destination,
    carter.cargo.resource,
    carter.cargo.amount,
  );
  const released = inventory.releaseSpace(
    deposited,
    carter.reservation.resource,
    carter.reservation.amount,
  );
  const nextBuildings = replaceBuilding(buildings, released);
  return beginReturn(nextBuildings, carter, null, inventory, routes);
}

function completeFetch(
  buildings: readonly Building[],
  carter: CarterWalker,
  inventory: DeliveryInventoryPort,
  routes: DeliveryRoutePort,
  tick: number,
): CarterResult {
  const claim = carter.reservation.sourceStockClaim;
  const source = claim === null ? null : findBuilding(buildings, claim.buildingId);
  if (claim === null || source === null) {
    return cancelCarter(
      tick,
      buildings,
      carter,
      inventory,
      routes,
      "source_unavailable",
    );
  }

  const withdrawn = inventory.withdrawStock(source, claim.resource, claim.amount);
  const cleared = inventory.releaseStock(
    withdrawn.building,
    claim.resource,
    claim.amount,
  );
  const nextBuildings = replaceBuilding(buildings, cleared);
  if (withdrawn.withdrawn === 0) {
    return cancelCarter(
      tick,
      nextBuildings,
      carter,
      inventory,
      routes,
      "source_unavailable",
    );
  }
  return beginReturn(
    nextBuildings,
    carter,
    { resource: claim.resource, amount: withdrawn.withdrawn },
    inventory,
    routes,
  );
}

function completeOutbound(
  buildings: readonly Building[],
  carter: CarterWalker,
  input: DeliveryStepInput,
): CarterResult {
  return carter.mission === "deliver"
    ? completeDelivery(
        buildings,
        carter,
        input.inventory,
        input.routes,
        input.tick,
      )
    : completeFetch(
        buildings,
        carter,
        input.inventory,
        input.routes,
        input.tick,
      );
}

function routeIsIntact(
  carter: CarterWalker,
  routes: DeliveryRoutePort,
): boolean {
  return carter.path
    .slice(Math.max(0, carter.pathIndex))
    .every((tile) => routes.isRoad(tile));
}

export function stepCarters(input: DeliveryStepInput): DeliveryStepResult {
  let buildings = input.buildings;
  const walkers: Walker[] = [];

  for (const walker of [...input.walkers].sort((a, b) => a.id.localeCompare(b.id))) {
    if (walker.kind !== "carter") {
      walkers.push(walker);
      continue;
    }
    if (!routeIsIntact(walker, input.routes)) {
      const cancelled = cancelCarter(
        input.tick,
        buildings,
        walker,
        input.inventory,
        input.routes,
        "road_removed",
      );
      buildings = cancelled.buildings;
      if (cancelled.walker !== null) walkers.push(cancelled.walker);
      continue;
    }

    const moved = stepWalkerAlongPath(walker, BALANCE.CARTER_SPEED);
    if (!hasArrivedAtPathEnd(moved)) {
      walkers.push(moved);
      continue;
    }
    if (moved.phase === "returning") {
      buildings = completeReturn(buildings, moved, input.inventory);
      continue;
    }

    const completed = completeOutbound(buildings, moved, input);
    buildings = completed.buildings;
    if (completed.walker !== null) walkers.push(completed.walker);
  }

  return { buildings, walkers };
}
