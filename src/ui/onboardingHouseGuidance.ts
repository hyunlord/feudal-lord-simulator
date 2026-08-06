import { BUILDING_CONFIG_BY_KIND } from "../content/buildingConfig";
import type { GameState } from "../engine/engine.types";
import type { TileCoordinate } from "../world/grid";
import { canPlaceBuilding } from "../world/placement";
import {
  manhattanDistance,
  reserveFootprint,
  reservedOverlaps,
  tileKey,
} from "./onboardingGuidanceGeometry";

export const onboardingPopulationHouseTargetCount = 4;
export const onboardingPopulationHouseTotal = 5;

export type HouseGuidanceWorld = Pick<
  GameState,
  "buildings" | "height" | "houses" | "tiles" | "treasuryTimber" | "width"
>;

export type HouseGuidanceTarget = {
  readonly kind: "house";
  readonly label: string;
  readonly origin: TileCoordinate;
};

export function needsPopulationHouseGuidance(state: HouseGuidanceWorld): boolean {
  return currentPopulation(state) < 30 && state.houses.length < onboardingPopulationHouseTotal;
}

export function populationHouseGuidanceTargets(
  state: HouseGuidanceWorld,
  candidateOrigins: readonly TileCoordinate[],
  reserved: Set<string>,
): readonly HouseGuidanceTarget[] {
  const count = Math.min(
    onboardingPopulationHouseTargetCount,
    onboardingPopulationHouseTotal - state.houses.length,
  );
  if (count <= 0) return [];

  const targets: HouseGuidanceTarget[] = [];
  for (const origin of houseCandidateOrigins(state, candidateOrigins)) {
    if (reservedOverlaps("house", origin, reserved)) continue;
    if (!canPlaceBuilding(state, "house", origin.tx, origin.ty).ok) continue;

    reserveFootprint(reserved, "house", origin);
    targets.push({
      kind: "house",
      label: `오두막 ${targets.length + 1}/${count}`,
      origin,
    });
    if (targets.length === count) return targets;
  }

  return targets;
}

export function currentPopulation(state: HouseGuidanceWorld): number {
  return state.houses.reduce((total, house) => total + house.residents, 0);
}

function houseCandidateOrigins(
  state: HouseGuidanceWorld,
  candidateOrigins: readonly TileCoordinate[],
): readonly TileCoordinate[] {
  const withinWater = candidateOrigins.filter((origin) => withinWellRange(state, origin));
  if (withinWater.length >= onboardingPopulationHouseTotal - state.houses.length) {
    return withinWater;
  }
  const waterKeys = new Set(withinWater.map(tileKey));
  return [
    ...withinWater,
    ...candidateOrigins.filter((origin) => !waterKeys.has(tileKey(origin))),
  ];
}

function withinWellRange(state: HouseGuidanceWorld, origin: TileCoordinate): boolean {
  return state.buildings.some(
    (building) =>
      building.kind === "well" &&
      manhattanDistance(origin, building) <= BUILDING_CONFIG_BY_KIND.well.serviceRadius,
  );
}
