import { BUILDING_CONFIG_BY_KIND, type Building, type BuildingKind } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { PALISADE_REQUIREMENT_TARGETS } from "../engine/era";
import { buildingRoadAccessTiles } from "../engine/routing";
import type { TileCoordinate } from "../world/grid";
import { existingRoadComponent } from "../world/roadGraph";
import { manhattanDistance } from "./onboardingGuidanceGeometry";

type GuidanceWorld = Pick<
  GameState,
  "buildings" | "height" | "houses" | "tiles" | "treasuryTimber" | "width"
> & Partial<Pick<GameState, "constructionSites" | "era">>;

export function missingCurrentBuildingKinds(state: GuidanceWorld): readonly BuildingKind[] {
  if (!hasCompletedBuildingKind(state, "logging_camp")) return hasPendingSiteKind(state, "logging_camp") ? [] : ["logging_camp"];
  const completedFarms = state.buildings.filter(building => building.kind === "wheat_farm").length;
  const pendingFarms = state.constructionSites?.filter(site => site.kind === "wheat_farm").length ?? 0;
  if (completedFarms < 1 || !hasCompletedBuildingKind(state, "mill")) {
    const missingFarm = completedFarms + pendingFarms < 1 ? ["wheat_farm" as const] : [];
    const missingMill = !hasCompletedBuildingKind(state, "mill") && !hasPendingSiteKind(state, "mill")
      ? ["mill" as const] : [];
    return [...missingFarm, ...missingMill];
  }
  if (!hasCompletedBuildingKind(state, "sawmill")) return hasPendingSiteKind(state, "sawmill") ? [] : ["sawmill"];
  if (completedFarms < 2 || !hasCompletedBuildingKind(state, "granary")) {
    const missingFarm = completedFarms + pendingFarms < 2 ? ["wheat_farm" as const] : [];
    const missingGranary = !hasCompletedBuildingKind(state, "granary") && !hasPendingSiteKind(state, "granary")
      ? ["granary" as const] : [];
    return [...missingFarm, ...missingGranary];
  }
  if (!hasPalisadeTimberStorage(state)) return hasPendingSiteKind(state, "storehouse") ? [] : ["storehouse"];
  if (!hasWellWithinHouseRange(state)) return ["well"];
  if (!hasCompletedBuildingKind(state, "chapel")) return hasPendingSiteKind(state, "chapel") ? [] : ["chapel"];
  return [];
}

export function completedCoreOnboardingBuildings(state: GuidanceWorld): boolean {
  return hasCompletedBuildingKind(state, "logging_camp")
    && state.buildings.filter(building => building.kind === "wheat_farm").length >= 2
    && (["mill", "granary", "sawmill", "chapel"] as const)
      .every(kind => hasCompletedBuildingKind(state, kind))
    && hasPalisadeTimberStorage(state)
    && hasWellWithinHouseRange(state);
}

const roadKey = (road: TileCoordinate): string => `${road.tx},${road.ty}`;

export function timberDeliveryRoads(state: GuidanceWorld): ReadonlySet<string> {
  const sawmillAccess = state.buildings
    .filter((building) => building.kind === "sawmill")
    .flatMap((building) => buildingRoadAccessTiles(state, building));
  return new Set(existingRoadComponent(state, sawmillAccess).map(roadKey));
}

export function storehouseOnTimberDeliveryRoad(
  state: GuidanceWorld,
  origin: TileCoordinate,
  roads: ReadonlySet<string> = timberDeliveryRoads(state),
): boolean {
  const candidate: Building = {
    id: "onboarding-storehouse-candidate",
    kind: "storehouse",
    tx: origin.tx,
    ty: origin.ty,
    workers: 0,
    inventory: {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
  return buildingRoadAccessTiles(state, candidate).some((road) => roads.has(roadKey(road)));
}

export function hasPalisadeTimberStorage(state: GuidanceWorld): boolean {
  const roads = timberDeliveryRoads(state);
  const reachableCapacity = state.buildings
    .filter((building) => building.kind === "storehouse" &&
      storehouseOnTimberDeliveryRoad(state, building, roads))
    .reduce((capacity) => capacity + BUILDING_CONFIG_BY_KIND.storehouse.storageCapacity, 0);
  return reachableCapacity >= PALISADE_REQUIREMENT_TARGETS.timber;
}

export function wellCompletesTask(
  state: GuidanceWorld,
  origin: TileCoordinate,
): boolean {
  return state.houses.some((house) => {
    const building = state.buildings.find((candidate) => candidate.id === house.buildingId);
    return building !== undefined && manhattanDistance(origin, building) <= 6;
  });
}

function hasCompletedBuildingKind(state: GuidanceWorld, kind: BuildingKind): boolean {
  return state.buildings.some((building) => building.kind === kind);
}

function hasPendingSiteKind(state: GuidanceWorld, kind: BuildingKind): boolean {
  return state.constructionSites?.some((site) => site.kind === kind) === true;
}

function hasWellWithinHouseRange(state: GuidanceWorld): boolean {
  return state.buildings.some(
    (building) =>
      building.kind === "well" &&
      state.houses.some((house) => {
        const houseBuilding = state.buildings.find((candidate) => candidate.id === house.buildingId);
        return houseBuilding !== undefined && manhattanDistance(building, houseBuilding) <= 6;
      }),
  );
}
