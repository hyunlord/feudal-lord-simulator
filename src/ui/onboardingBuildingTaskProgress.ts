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
> & Partial<Pick<GameState, "era">>;

export function missingCurrentBuildingKinds(state: GuidanceWorld): readonly BuildingKind[] {
  if (!hasBuildingKind(state, "logging_camp")) return ["logging_camp"];
  const missingFoodChain = (["wheat_farm", "mill", "granary"] as const).filter(
    (kind) => !hasBuildingKind(state, kind),
  );
  if (missingFoodChain.length > 0) return missingFoodChain;
  if (!hasBuildingKind(state, "sawmill")) return ["sawmill"];
  if (!hasPalisadeTimberStorage(state)) return ["storehouse"];
  if (!hasWellWithinHouseRange(state)) return ["well"];
  return [];
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

function hasBuildingKind(state: GuidanceWorld, kind: BuildingKind): boolean {
  return state.buildings.some((building) => building.kind === kind);
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
