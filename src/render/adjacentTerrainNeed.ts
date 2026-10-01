import { BUILDING_CONFIG_BY_KIND, type BuildingKind } from "../content/buildingConfig";

/**
 * MA-10 (LAND-UI): what a building's `needs_adjacent_terrain` refusal asks for, for its copy and tile mark — the fulling
 * mill flowing water (the river or brook, `requiresFlowingWater`), the dyehouse any water, the quarry rock, the rest
 * the forest. The engine gives one reason for all of them (placement.ts); the render tells them apart by kind.
 */
export type AdjacentTerrainNeed = "forest" | "water" | "flowing_water" | "rock";

export function adjacentTerrainNeed(kind: BuildingKind): AdjacentTerrainNeed {
  const definition = BUILDING_CONFIG_BY_KIND[kind];
  if (definition.requiresAdjacentTerrain === "water") return definition.requiresFlowingWater === true ? "flowing_water" : "water";
  return definition.requiresAdjacentTerrain === "rock" ? "rock" : "forest";
}
