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
  type PalisadeConstructionSite,
} from "../economy/construction";
import {
  isPalisadeConstructionSite,
  palisadeConstructionSchedule,
} from "../economy/palisadeConstruction";
import type { House } from "../population/population.types";
import type { GameState, PalisadeState } from "./engine.types";
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
  return state.constructionSites.map((site) =>
    palisadeConstructionSchedule(site, state.constructionSites).kind === "queued"
      ? site
      : advanceConstructionWork(site),
  );
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
  const completedBuildings = state.constructionSites
    .filter(isBuildingConstructionSite)
    .filter((site) => canCompleteConstruction(site, state.wallTick));
  const completedPalisadeSites = state.palisade === null
    ? []
    : state.constructionSites
        .filter(isPalisadeConstructionSite)
        .filter((site) => canCompleteConstruction(site, state.wallTick));
  if (completedBuildings.length === 0 && completedPalisadeSites.length === 0) return state;

  const completedIds = new Set([
    ...completedBuildings.map((site) => site.id),
    ...completedPalisadeSites.map((site) => site.id),
  ]);
  const completedHouses = completedBuildings.flatMap((site) => {
    const house = houseFromSite(site);
    return house === null ? [] : [house];
  });
  const activeWalkers = state.walkers.filter((walker): walker is Walker =>
    walker.kind !== "builder" || !completedIds.has(walker.siteId),
  );

  return {
    ...state,
    buildings: [...state.buildings, ...completedBuildings.map(buildingFromSite)],
    constructionSites: state.constructionSites.filter((site) => !completedIds.has(site.id)),
    houses: [...state.houses, ...completedHouses],
    walkers: activeWalkers,
    palisade: completePalisadeSegments(state.palisade, completedPalisadeSites),
  };
}

function completePalisadeSegments(
  palisade: PalisadeState | null,
  completedSites: readonly PalisadeConstructionSite[],
): PalisadeState | null {
  if (palisade === null || completedSites.length === 0) return palisade;
  const completedIds = new Set(completedSites.map((site) => site.id));
  return {
    ...palisade,
    segments: palisade.segments.map((segment) =>
      segment.constructionSiteId !== null && completedIds.has(segment.constructionSiteId)
        ? { ...segment, completed: true, constructionSiteId: null }
        : segment,
    ),
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
