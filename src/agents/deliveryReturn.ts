import type { Building } from "../content/buildingConfig";
import {
  amountOf,
  deposit,
  type DeliveryResourceState,
  findBuilding,
  releaseClaims,
  replaceBuilding,
  returnPath,
} from "./deliveryCommon";
import type { DeliveryInventoryPort, DeliveryRoutePort } from "./deliveryTypes";
import {
  currentRoadTile,
  lastReachedRoadTile,
} from "./movement";
import type {
  CarterCapacityClaim,
  CarterCancellationReason,
  CarterWalker,
  TilePos,
  WalkerCargo,
} from "./walker.types";

export interface CarterResult {
  readonly buildings: readonly Building[];
  readonly constructionSites: DeliveryResourceState["constructionSites"];
  readonly treasuryTimber: number;
  readonly walker: CarterWalker | null;
}

interface ReturnCapacityResult {
  readonly buildings: readonly Building[];
  readonly carter: CarterWalker;
}

export function returnCapacityClaim(
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
    carter.reservation.destination.kind === "building" &&
    carter.reservation.destination.buildingId === home.id &&
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

export function completeReturn(
  state: DeliveryResourceState,
  carter: CarterWalker,
  inventory: DeliveryInventoryPort,
): DeliveryResourceState {
  const claim = carter.reservation.sourceStockClaim;
  if (claim?.kind === "treasury" && carter.cargo !== null) {
    return {
      ...state,
      treasuryTimber: state.treasuryTimber + carter.cargo.amount,
    };
  }
  const home = findBuilding(state.buildings, carter.homeBuildingId);
  if (home === null) return state;
  const stocked = carter.cargo === null
    ? home
    : deposit(home, carter.cargo.resource, carter.cargo.amount);
  const capacityClaim = returnCapacityClaim(carter, home);
  const released = capacityClaim === null
    ? stocked
    : inventory.releaseSpace(stocked, capacityClaim.resource, capacityClaim.amount);
  return { ...state, buildings: replaceBuilding(state.buildings, released) };
}

export function canCompleteReturn(
  buildings: readonly Building[],
  carter: CarterWalker,
  inventory: DeliveryInventoryPort,
): boolean {
  if (carter.cargo === null) return true;
  if (carter.reservation.sourceStockClaim?.kind === "treasury") return true;
  const home = findBuilding(buildings, carter.homeBuildingId);
  if (home === null) return false;
  const claimedSpace = heldReturnCapacity(home, carter);
  return inventory.availableSpace(home) + claimedSpace >= carter.cargo.amount;
}

export function beginReturn(
  state: DeliveryResourceState,
  carter: CarterWalker,
  cargo: WalkerCargo | null,
  inventory: DeliveryInventoryPort,
  routes: DeliveryRoutePort,
): CarterResult {
  const prepared = { ...carter, cargo };
  const path = returnPath(state.buildings, prepared, routes);
  if (path === null) {
    return { ...completeReturn(state, prepared, inventory), walker: null };
  }
  return {
    ...state,
    walker: returningWalker(prepared, path, cargo),
  };
}

export function cancelCarter(
  tick: number,
  state: DeliveryResourceState,
  carter: CarterWalker,
  inventory: DeliveryInventoryPort,
  routes: DeliveryRoutePort,
  reason: CarterCancellationReason,
): CarterResult {
  const released = carter.cancellation?.releasedReservation === true
    ? state
    : releaseClaims(state, carter, inventory);
  const cancelled: CarterWalker = {
    ...carter,
    cancellation: { tick, reason, releasedReservation: true },
  };
  const recovery = carter.cancellation === null
    ? reserveReturnCapacity(released.buildings, cancelled, inventory)
    : { buildings: released.buildings, carter: cancelled };
  const recoveryState = { ...released, buildings: recovery.buildings };
  const recoveryCarter = recovery.carter;
  const path = returnPath(recoveryState.buildings, recoveryCarter, routes);
  if (path !== null) {
    return {
      ...recoveryState,
      walker: returningWalker(recoveryCarter, path, carter.cargo),
    };
  }
  const current =
    lastReachedRoadTile(recoveryCarter) ??
    currentRoadTile(recoveryCarter) ??
    recoveryCarter.position;
  return {
    ...recoveryState,
    walker: returningWalker(recoveryCarter, [current], carter.cargo),
  };
}
