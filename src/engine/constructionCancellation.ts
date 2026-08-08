import { cancelCarter } from "../agents/deliveryReturn";
import type { DeliveryInventoryPort, DeliveryRoutePort } from "../agents/deliveryTypes";
import type { DeliveryResourceState } from "../agents/deliveryCommon";
import type { CarterWalker, Walker } from "../agents/walker.types";
import {
  EMPTY_CONSTRUCTION_CANCELLATION_LEDGER,
  refundSiteMaterials,
  type ConstructionCancellationLedger,
} from "./constructionCancellationRefunds";
import { isWallConstructionSite } from "../economy/palisadeConstruction";
import type { GameState } from "./engine.types";

export type ConstructionCancellationResult = {
  readonly state: GameState;
  readonly ledger: ConstructionCancellationLedger;
};

function siteBoundCarter(walker: Walker, siteId: string): walker is CarterWalker {
  return (
    walker.kind === "carter" &&
    walker.reservation.destination.kind === "construction_site" &&
    walker.reservation.destination.siteId === siteId
  );
}

function cancelSiteCarters(
  state: GameState,
  siteId: string,
  inventory: DeliveryInventoryPort,
  routes: DeliveryRoutePort,
): GameState {
  let resourceState: DeliveryResourceState = {
    buildings: state.buildings,
    constructionSites: state.constructionSites,
    treasuryTimber: state.treasuryTimber,
  };
  const walkers: Walker[] = [];
  for (const walker of state.walkers) {
    if (!siteBoundCarter(walker, siteId)) {
      walkers.push(walker);
      continue;
    }
    const cancelled = cancelCarter(
      state.tick,
      resourceState,
      walker,
      inventory,
      routes,
      "manual",
    );
    resourceState = {
      buildings: cancelled.buildings,
      constructionSites: cancelled.constructionSites,
      treasuryTimber: cancelled.treasuryTimber,
    };
    if (cancelled.walker !== null) walkers.push(cancelled.walker);
  }
  return {
    ...state,
    buildings: [...resourceState.buildings],
    constructionSites: [...resourceState.constructionSites],
    treasuryTimber: resourceState.treasuryTimber,
    walkers,
  };
}

export function cancelConstruction(input: {
  readonly state: GameState;
  readonly siteId: string;
  readonly inventory: DeliveryInventoryPort;
  readonly routes: DeliveryRoutePort;
}): ConstructionCancellationResult {
  const site = input.state.constructionSites.find(({ id }) => id === input.siteId) ?? null;
  if (site === null) {
    return { state: input.state, ledger: EMPTY_CONSTRUCTION_CANCELLATION_LEDGER };
  }
  if (isWallConstructionSite(site) && input.state.palisade !== null) {
    return { state: input.state, ledger: EMPTY_CONSTRUCTION_CANCELLATION_LEDGER };
  }

  const refunded = refundSiteMaterials(input.state, site);
  const cancelled = cancelSiteCarters(
    refunded.state,
    input.siteId,
    input.inventory,
    input.routes,
  );
  return {
    state: {
      ...cancelled,
      idleWorkers: cancelled.idleWorkers + site.assignedBuilders,
      constructionSites: cancelled.constructionSites.filter(({ id }) => id !== input.siteId),
      walkers: cancelled.walkers.filter(
        (walker) => walker.kind !== "builder" || walker.siteId !== input.siteId,
      ),
      tiles: cancelled.tiles.map((tile) =>
        tile.buildingId === input.siteId ? { ...tile, buildingId: null } : tile,
      ),
    },
    ledger: refunded.ledger,
  };
}
