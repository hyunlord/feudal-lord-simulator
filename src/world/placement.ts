import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
  type BuildingDefinition,
  type BuildingKind,
} from "../content/buildingConfig";
import {
  constructionDeliveryNeed,
  isBuildingConstructionSite,
  type ConstructionSite,
} from "../economy/construction";
import type { TerrainType } from "../content/terrainConfig";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import type { Era } from "../content/eraConfig";
import { getTile, isInBounds, type TileCoordinate } from "./grid";
import type { Tile, WorldView } from "./world.types";

export enum PlacementFailure {
  occupied = "occupied",
  wrong_terrain = "wrong_terrain",
  out_of_bounds = "out_of_bounds",
  needs_road = "needs_road",
  needs_adjacent_terrain = "needs_adjacent_terrain",
  insufficient_materials = "insufficient_materials",
  locked_era = "locked_era",
}

export type PlacementResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly reason: Exclude<PlacementFailure, PlacementFailure.insufficient_materials>;
    }
  | {
      readonly ok: false;
      readonly reason: PlacementFailure.insufficient_materials;
      readonly shortfalls: Partial<Record<ResourceType, number>>;
    };

type ResourceWorldView = WorldView & {
  readonly buildings?: readonly Building[];
  readonly constructionSites?: readonly ConstructionSite[];
  readonly era?: Era;
};

const ERA_ORDER = {
  hamlet: 0,
  palisade: 1,
  stone_town: 2,
} as const satisfies Record<Era, number>;

export function isBuildingUnlocked(
  kind: BuildingKind,
  era: Era = "hamlet",
): boolean {
  return ERA_ORDER[era] >= ERA_ORDER[BUILDING_CONFIG_BY_KIND[kind].unlockEra];
}

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

function footprintsIntersect(
  origin: TileCoordinate,
  definition: BuildingDefinition,
  site: ConstructionSite,
): boolean {
  if (!isBuildingConstructionSite(site)) return false;
  const siteDefinition = BUILDING_CONFIG_BY_KIND[site.kind];
  return (
    origin.tx < site.tx + siteDefinition.width &&
    origin.tx + definition.width > site.tx &&
    origin.ty < site.ty + siteDefinition.height &&
    origin.ty + definition.height > site.ty
  );
}

export function canPlaceBuilding(
  world: ResourceWorldView,
  kind: BuildingKind,
  tx: number,
  ty: number,
): PlacementResult {
  const definition = BUILDING_CONFIG_BY_KIND[kind];
  const origin = { tx, ty };
  const footprint = footprintTiles(origin, definition);

  if (!isBuildingUnlocked(kind, world.era ?? "hamlet")) {
    return { ok: false, reason: PlacementFailure.locked_era };
  }

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

  if (
    world.constructionSites?.some((site) =>
      footprintsIntersect(origin, definition, site),
    ) === true
  ) {
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

  const shortfalls = constructionShortfalls(world, definition.buildCost);
  if (RESOURCE_TYPES.some((resource) => (shortfalls[resource] ?? 0) > 0)) {
    return { ok: false, reason: PlacementFailure.insufficient_materials, shortfalls };
  }

  return { ok: true };
}

export function constructionShortfalls(
  world: ResourceWorldView,
  buildCost: Partial<Record<ResourceType, number>>,
): Partial<Record<ResourceType, number>> {
  const shortfalls: Partial<Record<ResourceType, number>> = {};
  for (const resource of RESOURCE_TYPES) {
    const needed = buildCost[resource] ?? 0;
    if (needed <= 0) continue;
    const shortfall = Math.max(0, needed - placementSpendableResource(world, resource));
    if (shortfall > 0) shortfalls[resource] = shortfall;
  }
  return shortfalls;
}

export function placementSpendableResource(world: ResourceWorldView, resource: ResourceType): number {
  const stored = world.buildings?.reduce(
    (total, building) =>
      total +
      Math.max(
        0,
        (building.inventory[resource] ?? 0) - (building.stockReserved[resource] ?? 0),
      ),
    0,
  ) ?? 0;
  const committed = world.constructionSites?.reduce(
    (total, site) => total + (constructionDeliveryNeed(site)[resource] ?? 0),
    0,
  ) ?? 0;
  const available = resource === "timber" ? world.treasuryTimber + stored : stored;
  return Math.max(0, available - committed);
}
