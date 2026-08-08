import { BUILDING_CONFIG_BY_KIND, type Building } from "../content/buildingConfig";
import type { GameState } from "./engine.types";
import { buildingRoadAccessTiles } from "./routing";

export const ROAD_ACCESS_MARKER = "🚧 길이 필요합니다";

export function buildingHasRequiredRoadAccess(
  state: GameState,
  building: Building,
): boolean {
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  return !definition.requiresRoad || buildingRoadAccessTiles(state, building).length > 0;
}
