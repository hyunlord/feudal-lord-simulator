import {
  BUILDING_CONFIG_BY_KIND,
  type BuildingDefinition,
  type BuildingKind,
} from "../content/buildingConfig";
import type { TerrainType } from "../content/terrainConfig";
import { getTile, isInBounds, type TileCoordinate } from "./grid";
import type { Tile, WorldView } from "./world.types";

export enum PlacementFailure {
  occupied = "occupied",
  wrong_terrain = "wrong_terrain",
  out_of_bounds = "out_of_bounds",
  needs_road = "needs_road",
  needs_adjacent_terrain = "needs_adjacent_terrain",
  insufficient_timber = "insufficient_timber",
}

export type PlacementResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: PlacementFailure };

function isBuildableTerrain(terrain: TerrainType): boolean {
  return terrain !== "water";
}

function footprintTiles(
  origin: TileCoordinate,
  definition: BuildingDefinition,
): readonly TileCoordinate[] {
  const coordinates: TileCoordinate[] = [];
  for (let dy = 0; dy < definition.height; dy += 1) {
    for (let dx = 0; dx < definition.width; dx += 1) {
      coordinates.push({ tx: origin.tx + dx, ty: origin.ty + dy });
    }
  }
  return coordinates;
}

function surroundingRing(
  origin: TileCoordinate,
  definition: BuildingDefinition,
): readonly TileCoordinate[] {
  const coordinates: TileCoordinate[] = [];
  for (let ty = origin.ty - 1; ty <= origin.ty + definition.height; ty += 1) {
    for (let tx = origin.tx - 1; tx <= origin.tx + definition.width; tx += 1) {
      const insideFootprint =
        tx >= origin.tx &&
        tx < origin.tx + definition.width &&
        ty >= origin.ty &&
        ty < origin.ty + definition.height;
      if (!insideFootprint) coordinates.push({ tx, ty });
    }
  }
  return coordinates;
}

function hasOrthogonalRoadAdjacent(
  world: WorldView,
  origin: TileCoordinate,
  definition: BuildingDefinition,
): boolean {
  for (const coordinate of surroundingRing(origin, definition)) {
    const touchesFootprint =
      (coordinate.tx >= origin.tx &&
        coordinate.tx < origin.tx + definition.width &&
        (coordinate.ty === origin.ty - 1 ||
          coordinate.ty === origin.ty + definition.height)) ||
      (coordinate.ty >= origin.ty &&
        coordinate.ty < origin.ty + definition.height &&
        (coordinate.tx === origin.tx - 1 ||
          coordinate.tx === origin.tx + definition.width));
    if (!touchesFootprint) continue;

    const tile = getTile(world, coordinate);
    if (tile?.hasRoad === true) return true;
  }
  return false;
}

function hasAdjacentTerrain(
  world: WorldView,
  origin: TileCoordinate,
  definition: BuildingDefinition,
  terrain: TerrainType,
): boolean {
  return surroundingRing(origin, definition).some((coordinate) => {
    const tile = getTile(world, coordinate);
    return tile?.terrain === terrain;
  });
}

function hasOccupiedFootprint(tiles: readonly Tile[]): boolean {
  return tiles.some((tile) => tile.buildingId !== null || tile.hasRoad);
}

export function canPlaceBuilding(
  world: WorldView,
  kind: BuildingKind,
  tx: number,
  ty: number,
): PlacementResult {
  const definition = BUILDING_CONFIG_BY_KIND[kind];
  const origin = { tx, ty };
  const footprint = footprintTiles(origin, definition);

  if (footprint.some((coordinate) => !isInBounds(world, coordinate))) {
    return { ok: false, reason: PlacementFailure.out_of_bounds };
  }

  const footprintTileValues: Tile[] = [];
  for (const coordinate of footprint) {
    const tile = getTile(world, coordinate);
    if (tile === null) {
      return { ok: false, reason: PlacementFailure.out_of_bounds };
    }
    footprintTileValues.push(tile);
  }

  if (hasOccupiedFootprint(footprintTileValues)) {
    return { ok: false, reason: PlacementFailure.occupied };
  }

  if (footprintTileValues.some((tile) => !isBuildableTerrain(tile.terrain))) {
    return { ok: false, reason: PlacementFailure.wrong_terrain };
  }

  if (definition.requiresRoad && !hasOrthogonalRoadAdjacent(world, origin, definition)) {
    return { ok: false, reason: PlacementFailure.needs_road };
  }

  if (
    definition.requiresAdjacentTerrain !== null &&
    !hasAdjacentTerrain(world, origin, definition, definition.requiresAdjacentTerrain)
  ) {
    return { ok: false, reason: PlacementFailure.needs_adjacent_terrain };
  }

  const timberCost = definition.buildCost.timber ?? 0;
  if (world.treasuryTimber < timberCost) {
    return { ok: false, reason: PlacementFailure.insufficient_timber };
  }

  return { ok: true };
}
