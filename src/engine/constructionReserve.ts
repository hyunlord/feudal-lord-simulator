import type { DeliveryRoutePort } from "../agents/deliveryTypes";
import type { Building } from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
import { wallDeliveryAvailable, type WallConstructionPriority, type WallConstructionReserve, type WallReserveSource } from "../domain/wallReserve";
import { constructionDeliveryNeed, type ConstructionSite } from "../economy/construction";
import type { GameState } from "./engine.types";
import { createDeliveryInventoryPort, createSimulationRoutePorts } from "./simulationPorts";

export { wallDeliveryAvailable, type WallConstructionPriority, type WallConstructionReserve, type WallReserveSource } from "../domain/wallReserve";

export function reserveFloorsForReachableStocks(
  stocks: readonly { readonly id: string; readonly amount: number }[],
): readonly WallReserveSource[] {
  let cumulative = 0;
  let allocated = 0;
  return stocks.map(({ id, amount }) => {
    cumulative += amount;
    const nextAllocated = Math.floor(cumulative / 4);
    const floor = nextAllocated - allocated;
    allocated = nextAllocated;
    return { id, floor };
  }).filter((source) => source.floor > 0);
}

const TREASURY_SOURCE_ID = "treasury";

export function wallConstructionPriority(state: Pick<GameState, "wallConstructionPriority">): WallConstructionPriority {
  return state.wallConstructionPriority ?? "balanced";
}

export function setWallConstructionPriority(state: GameState, priority: WallConstructionPriority): GameState {
  if (wallConstructionPriority(state) === priority) return state;
  return { ...state, wallConstructionPriority: priority };
}

function hasWallRoute(
  routes: DeliveryRoutePort,
  sourceId: string,
  sites: readonly ConstructionSite[],
): boolean {
  return sites.some((site) =>
    routes.fromBuildingToDestination(sourceId, { kind: "construction_site", siteId: site.id }) !== null,
  );
}

export function snapshotWallConstructionReserve(
  state: GameState,
  sites: readonly ConstructionSite[],
  resource: "timber" | "stone",
): WallConstructionReserve {
  const routes = createSimulationRoutePorts({
    ...state,
    constructionSites: [...state.constructionSites, ...sites],
  }).delivery;
  const inventory = createDeliveryInventoryPort();
  const reachable = [...state.buildings].sort((left, right) => left.id.localeCompare(right.id)).flatMap((building) => {
    const amount = inventory.availableStock(building, resource);
    return amount > 0 && hasWallRoute(routes, building.id, sites) ? [{ id: building.id, amount }] : [];
  });
  if (resource === "timber" && state.treasuryTimber > 0 && state.buildings.some((building) =>
    building.kind === "house" && hasWallRoute(routes, building.id, sites))) {
    reachable.push({ id: TREASURY_SOURCE_ID, amount: state.treasuryTimber });
  }
  const sources = reserveFloorsForReachableStocks(reachable);
  return { resource, sources, proclaimedTick: state.tick };
}

export function constructionReservedMaterial(
  state: Pick<GameState, "constructionSites">,
  resource: ResourceType,
): number {
  return state.constructionSites.reduce((total, site) => total + (site.reserved[resource] ?? 0), 0);
}

export function wallReserveHeld(
  state: Pick<GameState, "wallConstructionReserve" | "wallConstructionPriority" | "buildings" | "treasuryTimber">,
  site: ConstructionSite,
  routes: DeliveryRoutePort,
): boolean {
  if (site.kind !== "palisade_segment" && site.kind !== "stone_wall_segment") return false;
  if (wallConstructionPriority(state) === "priority") return false;
  const resource = site.kind === "palisade_segment" ? "timber" : "stone";
  if ((constructionDeliveryNeed(site)[resource] ?? 0) <= 0) return false;
  const destination = { kind: "construction_site" as const, siteId: site.id };
  const inventory = createDeliveryInventoryPort();
  const sourceStocks = state.buildings.flatMap((building: Building) => {
    if (routes.fromBuildingToDestination(building.id, destination) === null) return [];
    const available = inventory.availableStock(building, resource);
    return available > 0 ? [{ id: building.id, available }] : [];
  });
  if (resource === "timber" && state.treasuryTimber > 0 && state.buildings.some((building) =>
    building.kind === "house" && routes.fromBuildingToDestination(building.id, destination) !== null)) {
    sourceStocks.push({ id: TREASURY_SOURCE_ID, available: state.treasuryTimber });
  }
  return sourceStocks.length > 0 && sourceStocks.every(({ id, available }) =>
    wallDeliveryAvailable(state.wallConstructionReserve, "balanced", id, resource, available) === 0);
}
