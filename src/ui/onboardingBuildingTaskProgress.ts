import type { BuildingKind } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import { manhattanDistance } from "./onboardingGuidanceGeometry";

type GuidanceWorld = Pick<
  GameState,
  "buildings" | "height" | "houses" | "tiles" | "treasuryTimber" | "width"
> & Partial<Pick<GameState, "era">>;

export function missingCurrentBuildingKinds(state: GuidanceWorld): readonly BuildingKind[] {
  if (!hasBuildingKind(state, "logging_camp")) return ["logging_camp"];
  if (!hasBuildingKind(state, "sawmill")) return ["sawmill"];
  if (!hasBuildingKind(state, "storehouse")) return ["storehouse"];
  if (!hasWellWithinHouseRange(state)) return ["well"];

  const missingFoodChain = (["wheat_farm", "mill", "granary"] as const).filter(
    (kind) => !hasBuildingKind(state, kind),
  );
  return missingFoodChain.length > 0 ? missingFoodChain : [];
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
