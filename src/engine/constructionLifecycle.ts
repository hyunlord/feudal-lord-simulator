import { constructionMaterialSources } from "../agents/deliveryConstruction";
import type { Walker } from "../agents/walker.types";
import type { Building } from "../content/buildingConfig";
import {
  advanceConstructionWork,
  canCompleteConstruction,
  constructionStall,
  isBuildingConstructionSite,
  type BuildingConstructionSite,
  type ConstructionSite,
} from "../economy/construction";
import type { House } from "../population/population.types";
import type { GameState } from "./engine.types";
import { createDeliveryInventoryPort, createSimulationRoutePorts } from "./simulationPorts";

export type ConstructionCompletionEvent = {
  readonly siteId: string;
  readonly buildingId: string;
  readonly kind: Building["kind"];
  readonly tx: number;
  readonly ty: number;
  readonly completedWallTick: number;
};

function buildingFromSite(site: BuildingConstructionSite): Building {
  return {
    id: site.id,
    kind: site.kind,
    tx: site.tx,
    ty: site.ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function houseFromSite(site: BuildingConstructionSite): House | null {
  return site.kind === "house"
    ? {
        buildingId: site.id,
        level: 0,
        residents: 0,
        hasWater: false,
        breadStock: 0,
        lastServicedTick: 0,
        unmetRequirementTicks: 0,
      }
    : null;
}

export function advanceConstructionSites(state: GameState): ConstructionSite[] {
  return state.constructionSites.map(advanceConstructionWork);
}

export function recomputeConstructionStalls(state: GameState): ConstructionSite[] {
  const inventory = createDeliveryInventoryPort();
  const routes = createSimulationRoutePorts(state).delivery;
  return state.constructionSites.map((site) => ({
    ...site,
    stall: constructionStall(
      site,
      constructionMaterialSources({
        site,
        buildings: state.buildings,
        routes,
        inventory,
        treasuryTimber: state.treasuryTimber,
      }),
    ),
  }));
}

export function completeEligibleConstruction(state: GameState): GameState {
  const completed = state.constructionSites
    .filter(isBuildingConstructionSite)
    .filter((site) => canCompleteConstruction(site, state.wallTick));
  if (completed.length === 0) return state;

  const completedIds = new Set(completed.map((site) => site.id));
  const completedHouses = completed.flatMap((site) => {
    const house = houseFromSite(site);
    return house === null ? [] : [house];
  });
  const activeWalkers = state.walkers.filter((walker): walker is Walker =>
    walker.kind !== "builder" || !completedIds.has(walker.siteId),
  );

  return {
    ...state,
    buildings: [...state.buildings, ...completed.map(buildingFromSite)],
    constructionSites: state.constructionSites.filter((site) => !completedIds.has(site.id)),
    houses: [...state.houses, ...completedHouses],
    walkers: activeWalkers,
  };
}

export function constructionCompletionEvents(
  before: GameState,
  after: GameState,
): readonly ConstructionCompletionEvent[] {
  const afterBuildingIds = new Set(after.buildings.map((building) => building.id));
  return before.constructionSites
    .filter(isBuildingConstructionSite)
    .filter((site) => afterBuildingIds.has(site.id))
    .map((site) => ({
      siteId: site.id,
      buildingId: site.id,
      kind: site.kind,
      tx: site.tx,
      ty: site.ty,
      completedWallTick: after.wallTick,
    }));
}
