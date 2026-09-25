import { scenarioById } from "../content/scenario/registry";
import { STAGE_ORDER, type StageId } from "../content/scenario/types";
import {
  BUILDING_CONFIG_BY_KIND,
  isRetiredBuildingKind,
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
import { palisadePathHasBuildingClearance, type PalisadeFootprint } from "./palisadeGeometry";
import type { WallBoundary } from "./wallTraversal";

export enum PlacementFailure {
  occupied = "occupied",
  wall_clearance = "wall_clearance",
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
  readonly scenarioId?: string;
  readonly palisade?: Pick<WallBoundary, "segments"> | null;
};

const ERA_STAGE_INDEX = {
  hamlet: 0,
  palisade: 1,
  stone_town: 2,
} as const satisfies Record<Era, number>;

/** The settlement stage whose `unlocks` list contains `kind` (spec SC-5: the only unlock source). */
export function buildingUnlockStage(kind: BuildingKind, scenarioId?: string): StageId {
  const stage = scenarioById(scenarioId).stages.find(candidate => candidate.unlocks.includes(kind));
  if (stage === undefined) throw new RangeError(`${kind} is never unlocked`);
  return stage.id;
}

export function isBuildingUnlocked(
  kind: BuildingKind,
  era: Era = "hamlet",
  scenarioId?: string,
): boolean {
  if (isRetiredBuildingKind(kind)) return false;
  return ERA_STAGE_INDEX[era] >= STAGE_ORDER.indexOf(buildingUnlockStage(kind, scenarioId));
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

export function hasBuildingWallClearance(world: ResourceWorldView, footprint: PalisadeFootprint): boolean {
  if (world.palisade?.segments.some(segment => !palisadePathHasBuildingClearance(segment.edgePath, [footprint]))) return false;
  return !world.constructionSites?.some(site =>
    (site.kind === "palisade_segment" || site.kind === "stone_wall_segment") && !palisadePathHasBuildingClearance(site.path, [footprint]),
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

  if (!isBuildingUnlocked(kind, world.era ?? "hamlet", world.scenarioId)) {
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

  if (!hasBuildingWallClearance(world, { id: "placement", tx, ty, width: definition.width, height: definition.height })) {
    return { ok: false, reason: PlacementFailure.wall_clearance };
  }

  if (footprintTileValues.some((tile) => !isBuildableTerrain(tile.terrain))) {
    return { ok: false, reason: PlacementFailure.wrong_terrain };
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
    (total, site) => total + (isBuildingConstructionSite(site) ? (constructionDeliveryNeed(site)[resource] ?? 0) : 0),
    0,
  ) ?? 0;
  const available = resource === "timber" ? world.treasuryTimber + stored : stored;
  return Math.max(0, available - committed);
}
