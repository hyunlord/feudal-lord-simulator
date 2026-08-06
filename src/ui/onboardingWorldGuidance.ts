import { type Building, type BuildingKind } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import { getTile, type TileCoordinate } from "../world/grid";
import { canPlaceBuilding } from "../world/placement";
import { canPlaceRoad } from "../world/roadGraph";
import {
  foodChainTargetsWithHousePrep as buildFoodChainTargetsWithHousePrep,
  isFoodChainTask,
} from "./onboardingFoodChainGuidance";
import {
  manhattanDistance,
  reserveFootprint,
  reservedOverlaps,
  sortedCandidateOrigins as sortCandidateOrigins,
} from "./onboardingGuidanceGeometry";
import {
  needsPopulationHouseGuidance,
  populationHouseGuidanceTargets,
} from "./onboardingHouseGuidance";

export const onboardingRoadTargetLabel = "여기에 길을 놓으세요";
export const onboardingRoadExtensionTargetLabel = "여기에 길을 이어주세요";

const STARTING_HOUSE_ID = "house-0-0-0";
const CARDINAL_OFFSETS = [
  { tx: 0, ty: -1 },
  { tx: 1, ty: 0 },
  { tx: 0, ty: 1 },
  { tx: -1, ty: 0 },
] as const satisfies readonly TileCoordinate[];

const BUILDING_TARGET_LABELS = {
  house: "여기에 오두막을 지으세요",
  well: "여기에 우물을 지으세요",
  storehouse: "여기에 창고를 지으세요",
  granary: "여기에 곡창을 지으세요",
  wheat_farm: "여기에 밀밭을 지으세요",
  mill: "여기에 방앗간을 지으세요",
  logging_camp: "여기에 벌목소를 지으세요",
  sawmill: "여기에 제재소를 지으세요",
} as const satisfies Readonly<Record<BuildingKind, string>>;
type GuidanceWorld = Pick<
  GameState,
  "buildings" | "height" | "houses" | "tiles" | "treasuryTimber" | "width"
>;

export type OnboardingGuidanceTarget = {
  readonly kind: BuildingKind | "road";
  readonly label: string;
  readonly origin: TileCoordinate;
};

export function firstRoadTargetForOnboarding(state: GuidanceWorld): TileCoordinate | null {
  const house = startingHouse(state);
  if (house === null) return null;

  const candidates = adjacentCardinals(house);
  if (candidates.some((candidate) => getTile(state, candidate)?.hasRoad === true)) return null;

  return candidates.find((candidate) => canPlaceRoad(state, candidate)) ?? null;
}

export function onboardingWorldGuidanceTargets(
  state: GuidanceWorld,
): readonly OnboardingGuidanceTarget[] {
  const roadTarget = firstRoadTargetForOnboarding(state);
  if (roadTarget !== null) {
    return [{ kind: "road", label: onboardingRoadTargetLabel, origin: roadTarget }];
  }

  return buildingTargetsForCurrentTask(state);
}

function buildingTargetsForCurrentTask(state: GuidanceWorld): readonly OnboardingGuidanceTarget[] {
  const kinds = missingCurrentBuildingKinds(state);
  const foodChainTargets = foodChainGuidanceTargetsForTask(state, kinds);
  if (foodChainTargets !== null) return foodChainTargets;

  const targets: OnboardingGuidanceTarget[] = [];
  const reserved = new Set<string>();
  const candidateOrigins = sortedCandidateOrigins(state);

  for (const kind of kinds) {
    const origin = firstBuildableOriginForKind(state, kind, reserved, candidateOrigins);
    if (origin === null) continue;
    reserveFootprint(reserved, kind, origin);
    targets.push({ kind, label: BUILDING_TARGET_LABELS[kind], origin });
  }

  if (targets.length > 0) return targets;

  if (kinds.length === 0 && needsPopulationHouseGuidance(state)) {
    const houseTargets = populationHouseGuidanceTargets(state, candidateOrigins, reserved);
    if (houseTargets.length > 0) return houseTargets;

    const roadTarget = roadTargetUnlockingPopulationHouses(state, candidateOrigins);
    return roadTarget === null
      ? []
      : [{ kind: "road", label: onboardingRoadExtensionTargetLabel, origin: roadTarget }];
  }

  if (kinds.length === 0) return targets;

  const roadTarget = roadTargetUnlockingKind(state, kinds[0], candidateOrigins);
  return roadTarget === null
    ? []
    : [{ kind: "road", label: onboardingRoadExtensionTargetLabel, origin: roadTarget }];
}

function foodChainGuidanceTargetsForTask(
  state: GuidanceWorld,
  kinds: readonly BuildingKind[],
): readonly OnboardingGuidanceTarget[] | null {
  if (!isFoodChainTask(kinds)) return null;

  const candidateOrigins = sortedCandidateOrigins(state);
  const result = buildFoodChainTargetsWithHousePrep(state, kinds, candidateOrigins, (inputState, kind, reserved) => {
    const origin = firstBuildableOriginForKind(inputState, kind, reserved, candidateOrigins);
    return origin === null ? null : { kind, label: BUILDING_TARGET_LABELS[kind], origin };
  });
  return result.kind === "road"
    ? [{ kind: "road", label: onboardingRoadExtensionTargetLabel, origin: result.origin }]
    : result.targets;
}

function missingCurrentBuildingKinds(state: GuidanceWorld): readonly BuildingKind[] {
  if (!hasBuildingKind(state, "logging_camp")) return ["logging_camp"];
  if (!hasBuildingKind(state, "sawmill")) return ["sawmill"];
  if (!hasBuildingKind(state, "storehouse")) return ["storehouse"];
  if (!hasWellWithinHouseRange(state)) return ["well"];

  const missingFoodChain = (["wheat_farm", "mill", "granary"] as const).filter(
    (kind) => !hasBuildingKind(state, kind),
  );
  if (missingFoodChain.length > 0) return missingFoodChain;
  return [];
}

function firstBuildableOriginForKind(
  state: GuidanceWorld,
  kind: BuildingKind,
  reserved: ReadonlySet<string>,
  candidateOrigins: readonly TileCoordinate[],
): TileCoordinate | null {
  for (const origin of candidateOrigins) {
    if (reservedOverlaps(kind, origin, reserved)) continue;
    if (kind === "well" && !wellCompletesTask(state, origin)) continue;
    if (canPlaceBuilding(state, kind, origin.tx, origin.ty).ok) return origin;
  }
  return null;
}

function roadTargetUnlockingKind(
  state: GuidanceWorld,
  kind: BuildingKind | undefined,
  candidateOrigins: readonly TileCoordinate[],
): TileCoordinate | null {
  if (kind === undefined) return null;

  for (const origin of candidateOrigins) {
    if (!canPlaceRoad(state, origin)) continue;
    const stateWithRoad = withRoad(state, origin);
    if (firstBuildableOriginForKind(stateWithRoad, kind, new Set(), candidateOrigins) !== null) {
      return origin;
    }
  }

  return null;
}

function roadTargetUnlockingPopulationHouses(
  state: GuidanceWorld,
  candidateOrigins: readonly TileCoordinate[],
): TileCoordinate | null {
  let best: { readonly origin: TileCoordinate; readonly count: number } | null = null;

  for (const origin of candidateOrigins) {
    if (!canPlaceRoad(state, origin)) continue;
    const stateWithRoad = withRoad(state, origin);
    const count = populationHouseGuidanceTargets(stateWithRoad, candidateOrigins, new Set()).length;
    if (count >= 4) return origin;
    if (best === null || count > best.count) best = { origin, count };
  }

  return best?.count === 0 ? null : best?.origin ?? null;
}

function withRoad(state: GuidanceWorld, origin: TileCoordinate): GuidanceWorld {
  return {
    ...state,
    tiles: state.tiles.map((tile) =>
      tile.tx === origin.tx && tile.ty === origin.ty ? { ...tile, hasRoad: true } : tile,
    ),
  };
}

function sortedCandidateOrigins(state: GuidanceWorld): readonly TileCoordinate[] {
  const house = startingHouse(state);
  const center = house === null ? { tx: 0, ty: 0 } : { tx: house.tx, ty: house.ty };
  return sortCandidateOrigins(state, center);
}

function adjacentCardinals(house: Building): readonly TileCoordinate[] {
  return CARDINAL_OFFSETS.map((offset) => ({
    tx: house.tx + offset.tx,
    ty: house.ty + offset.ty,
  }));
}

function startingHouse(state: GuidanceWorld): Building | null {
  const canonical = state.buildings.find(
    (building) => building.id === STARTING_HOUSE_ID && building.kind === "house",
  );
  if (canonical !== undefined) return canonical;

  for (const house of state.houses) {
    const building = state.buildings.find((candidate) => candidate.id === house.buildingId);
    if (building !== undefined && building.kind === "house") return building;
  }

  return state.buildings.find((building) => building.kind === "house") ?? null;
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

function wellCompletesTask(state: GuidanceWorld, origin: TileCoordinate): boolean {
  return state.houses.some((house) => {
    const building = state.buildings.find((candidate) => candidate.id === house.buildingId);
    return building !== undefined && manhattanDistance(origin, building) <= 6;
  });
}
