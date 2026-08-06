import { amountOf } from "../agents/deliveryCommon";
import type { CarterWalker, Walker } from "../agents/walker.types";
import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
} from "../content/buildingConfig";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import type { ConstructionSite } from "../economy/construction";
import { acceptsResource, availableSpace } from "../economy/storage";
import type { GameState } from "./engine.types";

export type ConstructionCancellationLedger = {
  readonly deliveredRefund: Partial<Record<ResourceType, number>>;
  readonly deliveredLost: Partial<Record<ResourceType, number>>;
  readonly reservedRefund: Partial<Record<ResourceType, number>>;
  readonly treasuryRefund: Partial<Record<ResourceType, number>>;
  readonly dropped: Partial<Record<ResourceType, number>>;
};

type RefundPlan = {
  readonly amount: number;
  readonly ledger: "deliveredRefund" | "deliveredLost" | "reservedRefund";
};

export const EMPTY_CONSTRUCTION_CANCELLATION_LEDGER: ConstructionCancellationLedger = {
  deliveredRefund: {},
  deliveredLost: {},
  reservedRefund: {},
  treasuryRefund: {},
  dropped: {},
};

function withAmount(
  record: Partial<Record<ResourceType, number>>,
  resource: ResourceType,
  amount: number,
): Partial<Record<ResourceType, number>> {
  if (amount <= 0) {
    const { [resource]: _removed, ...remaining } = record;
    return remaining;
  }
  return { ...record, [resource]: amount };
}

function addAmount(
  record: Partial<Record<ResourceType, number>>,
  resource: ResourceType,
  amount: number,
): Partial<Record<ResourceType, number>> {
  return withAmount(record, resource, amountOf(record, resource) + amount);
}

function siteBoundCarter(walker: Walker, siteId: string): walker is CarterWalker {
  return (
    walker.kind === "carter" &&
    walker.reservation.destination.kind === "construction_site" &&
    walker.reservation.destination.siteId === siteId
  );
}

function inFlightReservations(
  walkers: readonly Walker[],
  siteId: string,
): Partial<Record<ResourceType, number>> {
  let reservations: Partial<Record<ResourceType, number>> = {};
  for (const walker of walkers) {
    if (!siteBoundCarter(walker, siteId) || walker.cancellation?.releasedReservation === true) {
      continue;
    }
    reservations = addAmount(
      reservations,
      walker.reservation.resource,
      walker.reservation.amount,
    );
  }
  return reservations;
}

function manhattan(left: ConstructionSite, right: Building): number {
  return Math.abs(left.tx - right.tx) + Math.abs(left.ty - right.ty);
}

function depositToStore(
  buildings: readonly Building[],
  site: ConstructionSite,
  resource: ResourceType,
  amount: number,
): { readonly buildings: readonly Building[]; readonly accepted: number } {
  let remaining = amount;
  let nextBuildings = [...buildings];
  const candidates = [...nextBuildings]
    .filter((building) => acceptsResource(building.kind, resource))
    .sort((left, right) => {
      const distance = manhattan(site, left) - manhattan(site, right);
      return distance === 0 ? left.id.localeCompare(right.id) : distance;
    });

  for (const candidate of candidates) {
    if (remaining === 0) break;
    const space = availableSpace(candidate, BUILDING_CONFIG_BY_KIND[candidate.kind]);
    const accepted = Math.min(space, remaining);
    if (accepted === 0) continue;
    const stocked = {
      ...candidate,
      inventory: addAmount(candidate.inventory, resource, accepted),
    };
    nextBuildings = nextBuildings.map((building) =>
      building.id === candidate.id ? stocked : building,
    );
    remaining -= accepted;
  }
  return { buildings: nextBuildings, accepted: amount - remaining };
}

function refundResource(
  state: GameState,
  ledger: ConstructionCancellationLedger,
  site: ConstructionSite,
  resource: ResourceType,
  plans: readonly RefundPlan[],
): { readonly state: GameState; readonly ledger: ConstructionCancellationLedger } {
  let nextState = state;
  let nextLedger = ledger;
  for (const plan of plans) {
    if (plan.amount === 0) continue;
    if (plan.ledger === "deliveredLost") {
      nextLedger = {
        ...nextLedger,
        deliveredLost: addAmount(nextLedger.deliveredLost, resource, plan.amount),
      };
      continue;
    }
    const deposited = depositToStore(nextState.buildings, site, resource, plan.amount);
    const remainder = plan.amount - deposited.accepted;
    nextState = { ...nextState, buildings: [...deposited.buildings] };
    nextLedger = {
      ...nextLedger,
      [plan.ledger]: addAmount(nextLedger[plan.ledger], resource, plan.amount),
      treasuryRefund: resource === "timber" && remainder > 0
        ? addAmount(nextLedger.treasuryRefund, "timber", remainder)
        : nextLedger.treasuryRefund,
      dropped: resource !== "timber" && remainder > 0
        ? addAmount(nextLedger.dropped, resource, remainder)
        : nextLedger.dropped,
    };
    if (resource === "timber" && remainder > 0) {
      nextState = { ...nextState, treasuryTimber: nextState.treasuryTimber + remainder };
    }
  }
  return { state: nextState, ledger: nextLedger };
}

export function refundSiteMaterials(
  state: GameState,
  site: ConstructionSite,
): { readonly state: GameState; readonly ledger: ConstructionCancellationLedger } {
  const inFlight = inFlightReservations(state.walkers, site.id);
  let result = { state, ledger: EMPTY_CONSTRUCTION_CANCELLATION_LEDGER };
  for (const resource of RESOURCE_TYPES) {
    const delivered = amountOf(site.delivered, resource);
    const deliveredRefund = Math.floor(delivered * 0.6);
    const reservedRefund = Math.max(
      0,
      amountOf(site.reserved, resource) - amountOf(inFlight, resource),
    );
    result = refundResource(result.state, result.ledger, site, resource, [
      { amount: deliveredRefund, ledger: "deliveredRefund" },
      { amount: delivered - deliveredRefund, ledger: "deliveredLost" },
      { amount: reservedRefund, ledger: "reservedRefund" },
    ]);
  }
  return result;
}
