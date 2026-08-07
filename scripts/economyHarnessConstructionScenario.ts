import {
  BUILDING_CONFIG_BY_KIND,
  type BuildingDefinition,
  type BuildingKind,
} from "../src/content/buildingConfig";
import { createConstructionSite } from "../src/economy/construction";
import type { BuildingConstructionSite } from "../src/economy/construction";
import type { GameState } from "../src/engine/engine.types";
import type { TileCoordinate } from "../src/world/grid";
import type { Tile } from "../src/world/world.types";
import { createEconomyHarnessScenario } from "./economyHarnessScenario";

export interface ConstructionEconomyHarnessScenarioOptions {
  readonly seed: number;
}

const SCRIPTED_SITES = [
  { kind: "well", tx: 0, ty: 2 },
  { kind: "well", tx: 12, ty: 1 },
] as const satisfies readonly {
  readonly kind: BuildingKind;
  readonly tx: number;
  readonly ty: number;
}[];

function tileIsInFootprint(
  tile: Tile,
  origin: TileCoordinate,
  definition: BuildingDefinition,
): boolean {
  return (
    tile.tx >= origin.tx &&
    tile.tx < origin.tx + definition.width &&
    tile.ty >= origin.ty &&
    tile.ty < origin.ty + definition.height
  );
}

function occupySiteTiles(
  tiles: readonly Tile[],
  site: BuildingConstructionSite,
): readonly Tile[] {
  const definition = BUILDING_CONFIG_BY_KIND[site.kind];
  return tiles.map((tile) =>
    tileIsInFootprint(tile, site, definition)
      ? { ...tile, buildingId: site.id, hasRoad: false }
      : tile,
  );
}

export function createConstructionEconomyHarnessScenario(
  options: ConstructionEconomyHarnessScenarioOptions,
): GameState {
  const base = createEconomyHarnessScenario(options);
  const sites = SCRIPTED_SITES.map((input, index) =>
    createConstructionSite({
      ordinal: base.nextConstructionOrdinal + index,
      kind: input.kind,
      tx: input.tx,
      ty: input.ty,
      startedTick: base.wallTick,
    }),
  );
  const tiles = sites.reduce<readonly Tile[]>(
    (nextTiles, site) => occupySiteTiles(nextTiles, site),
    base.tiles,
  );
  return {
    ...base,
    tiles: [...tiles],
    constructionSites: [...sites],
    nextConstructionOrdinal: base.nextConstructionOrdinal + sites.length,
    roadRevision: base.roadRevision,
    pathCache: {},
  };
}
