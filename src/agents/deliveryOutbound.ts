import {
  deliverSiteResource,
  deposit,
  type DeliveryResourceState,
  findBuilding,
  findSite,
  replaceBuilding,
  replaceSite,
} from "./deliveryCommon";
import {
  beginReturn,
  cancelCarter,
  returnCapacityClaim,
  type CarterResult,
} from "./deliveryReturn";
import type {
  DeliveryInventoryPort,
  DeliveryRoutePort,
  DeliveryStepInput,
} from "./deliveryTypes";
import type { CarterWalker } from "./walker.types";

function completeDelivery(
  state: DeliveryResourceState,
  carter: CarterWalker,
  inventory: DeliveryInventoryPort,
  routes: DeliveryRoutePort,
  tick: number,
): CarterResult {
  if (carter.reservation.destination.kind === "construction_site") {
    const site = findSite(
      state.constructionSites,
      carter.reservation.destination.siteId,
    );
    if (site === null || carter.cargo === null) {
      return cancelCarter(
        tick,
        state,
        carter,
        inventory,
        routes,
        "destination_unavailable",
      );
    }
    const nextState = {
      ...state,
      constructionSites: replaceSite(
        state.constructionSites,
        deliverSiteResource(site, carter.cargo.resource, carter.cargo.amount),
      ),
    };
    return beginReturn(
      nextState,
      { ...carter, reservation: { ...carter.reservation, homeCapacityClaim: null } },
      null,
      inventory,
      routes,
    );
  }
  const destination = findBuilding(
    state.buildings,
    carter.reservation.destination.buildingId,
  );
  if (destination === null || carter.cargo === null) {
    return cancelCarter(
      tick,
      state,
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
  const nextBuildings = replaceBuilding(state.buildings, released);
  const home = findBuilding(nextBuildings, carter.homeBuildingId);
  const claim = home === null ? null : returnCapacityClaim(carter, home);
  const releasedHome = home === null || claim === null
    ? nextBuildings
    : replaceBuilding(
        nextBuildings,
        inventory.releaseSpace(home, claim.resource, claim.amount),
      );
  return beginReturn(
    {
      ...state,
      buildings: releasedHome,
    },
    {
      ...carter,
      reservation: { ...carter.reservation, homeCapacityClaim: null },
    },
    null,
    inventory,
    routes,
  );
}

function completeFetch(
  state: DeliveryResourceState,
  carter: CarterWalker,
  inventory: DeliveryInventoryPort,
  routes: DeliveryRoutePort,
  tick: number,
): CarterResult {
  const claim = carter.reservation.sourceStockClaim;
  if (claim === null) {
    return cancelCarter(
      tick,
      state,
      carter,
      inventory,
      routes,
      "source_unavailable",
    );
  }
  if (claim.kind === "treasury") {
    return beginReturn(
      state,
      carter,
      { resource: "timber", amount: claim.amount },
      inventory,
      routes,
    );
  }
  const source = findBuilding(state.buildings, claim.buildingId);
  if (source === null) {
    return cancelCarter(
      tick,
      state,
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
  const nextState = { ...state, buildings: replaceBuilding(state.buildings, cleared) };
  if (withdrawn.withdrawn === 0) {
    return cancelCarter(
      tick,
      nextState,
      carter,
      inventory,
      routes,
      "source_unavailable",
    );
  }
  return beginReturn(
    nextState,
    carter,
    { resource: claim.resource, amount: withdrawn.withdrawn },
    inventory,
    routes,
  );
}

export function completeOutbound(
  state: DeliveryResourceState,
  carter: CarterWalker,
  input: DeliveryStepInput,
): CarterResult {
  return carter.mission === "deliver"
    ? completeDelivery(
        state,
        carter,
        input.inventory,
        input.routes,
        input.tick,
      )
    : completeFetch(
        state,
        carter,
        input.inventory,
        input.routes,
        input.tick,
      );
}
