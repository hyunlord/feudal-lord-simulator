import { BALANCE } from "../content/balanceConfig";
import type { Building } from "../content/buildingConfig";
import {
  currentRoadTile,
  hasArrivedAtPathEnd,
  lastReachedRoadTile,
  stepWalkerAlongPath,
} from "./movement";
import {
  amountOf,
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
  CarterCapacityClaim,
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

interface ReturnCapacityResult {
  readonly buildings: readonly Building[];
  readonly carter: CarterWalker;
}

function returnCapacityClaim(
  carter: CarterWalker,
  home: Building,
): CarterCapacityClaim | null {
  const explicit = carter.reservation.homeCapacityClaim;
  if (
    explicit !== null &&
    explicit.buildingId === home.id &&
    (carter.cargo === null || explicit.resource === carter.cargo.resource)
  ) {
    return explicit;
  }
  if (
    carter.mission === "fetch" &&
    carter.reservation.destinationBuildingId === home.id &&
    (carter.cargo === null ||
      carter.reservation.resource === carter.cargo.resource)
  ) {
    return {
      buildingId: home.id,
      resource: carter.reservation.resource,
      amount: carter.reservation.amount,
    };
  }
  return null;
}

function heldReturnCapacity(home: Building, carter: CarterWalker): number {
  const claim = returnCapacityClaim(carter, home);
  return claim === null
    ? 0
    : Math.min(claim.amount, amountOf(home.reserved, claim.resource));
}

function reserveReturnCapacity(
  buildings: readonly Building[],
  carter: CarterWalker,
  inventory: DeliveryInventoryPort,
): ReturnCapacityResult {
  if (carter.cargo === null) return { buildings, carter };
  const home = findBuilding(buildings, carter.homeBuildingId);
  if (home === null) return { buildings, carter };
  const heldCapacity = heldReturnCapacity(home, carter);
  if (heldCapacity >= carter.cargo.amount) return { buildings, carter };
  const before = amountOf(home.reserved, carter.cargo.resource);
  const reservedHome = inventory.reserveSpace(
    home,
    carter.cargo.resource,
    carter.cargo.amount - heldCapacity,
  );
  const reservedAmount = heldCapacity +
    amountOf(reservedHome.reserved, carter.cargo.resource) - before;
  if (reservedAmount === 0) return { buildings, carter };
  return {
    buildings: replaceBuilding(buildings, reservedHome),
    carter: {
      ...carter,
      reservation: {
        ...carter.reservation,
        homeCapacityClaim: {
          buildingId: home.id,
          resource: carter.cargo.resource,
          amount: reservedAmount,
        },
      },
    },
  };
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
  const claim = returnCapacityClaim(carter, home);
  const released = claim === null
    ? stocked
    : inventory.releaseSpace(stocked, claim.resource, claim.amount);
  return replaceBuilding(buildings, released);
}

function canCompleteReturn(
  buildings: readonly Building[],
  carter: CarterWalker,
  inventory: DeliveryInventoryPort,
): boolean {
  if (carter.cargo === null) return true;
  const home = findBuilding(buildings, carter.homeBuildingId);
  if (home === null) return false;
  const claimedSpace = heldReturnCapacity(home, carter);
  return inventory.availableSpace(home) + claimedSpace >= carter.cargo.amount;
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
  const recovery = carter.cancellation === null
    ? reserveReturnCapacity(released, cancelled, inventory)
    : { buildings: released, carter: cancelled };
  const recoveryCarter = recovery.carter;
  const path = returnPath(recovery.buildings, recoveryCarter, routes);
  if (path !== null) {
    return {
      buildings: recovery.buildings,
      walker: returningWalker(recoveryCarter, path, carter.cargo),
    };
  }
  const current =
    lastReachedRoadTile(recoveryCarter) ??
    currentRoadTile(recoveryCarter) ??
    recoveryCarter.position;
  return {
    buildings: recovery.buildings,
    walker: returningWalker(recoveryCarter, [current], carter.cargo),
  };
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
  const home = findBuilding(nextBuildings, carter.homeBuildingId);
  const claim = home === null ? null : returnCapacityClaim(carter, home);
  const releasedHome = home === null || claim === null
    ? nextBuildings
    : replaceBuilding(
        nextBuildings,
        inventory.releaseSpace(home, claim.resource, claim.amount),
      );
  const deliveredCarter: CarterWalker = {
    ...carter,
    reservation: {
      ...carter.reservation,
      homeCapacityClaim: null,
    },
  };
  return beginReturn(releasedHome, deliveredCarter, null, inventory, routes);
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
  buildings: readonly Building[],
  carter: CarterWalker,
  routes: DeliveryRoutePort,
): boolean {
  const remainingPathIsRoad = carter.path
    .slice(Math.max(0, carter.pathIndex))
    .every((tile) => routes.isRoad(tile));
  if (!remainingPathIsRoad || carter.phase !== "outbound") {
    return remainingPathIsRoad;
  }

  return returnPath(buildings, carter, routes) !== null;
}

export function stepCarters(input: DeliveryStepInput): DeliveryStepResult {
  let buildings = input.buildings;
  const walkers: Walker[] = [];

  for (const walker of [...input.walkers].sort((a, b) => a.id.localeCompare(b.id))) {
    if (walker.kind !== "carter") {
      walkers.push(walker);
      continue;
    }
    if (
      walker.phase === "returning" &&
      walker.cancellation !== null &&
      hasArrivedAtPathEnd(walker)
    ) {
      if (!canCompleteReturn(buildings, walker, input.inventory)) {
        walkers.push(walker);
        continue;
      }
      buildings = completeReturn(buildings, walker, input.inventory);
      continue;
    }
    if (!routeIsIntact(buildings, walker, input.routes)) {
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
      if (!canCompleteReturn(buildings, moved, input.inventory)) {
        walkers.push(moved);
        continue;
      }
      buildings = completeReturn(buildings, moved, input.inventory);
      continue;
    }

    const completed = completeOutbound(buildings, moved, input);
    buildings = completed.buildings;
    if (completed.walker !== null) walkers.push(completed.walker);
  }

  return { buildings, walkers };
}
