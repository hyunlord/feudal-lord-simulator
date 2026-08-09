import type { Building, BuildingKind } from "../src/content/buildingConfig";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import type { Tile } from "../src/world/world.types";
import { createEconomyHarnessScenario } from "./economyHarnessScenario";

export interface Stage3EconomyHarnessScenarioOptions {
  readonly seed: number;
}

export const STAGE3_LEGACY_HASH = "5a393f13af3e61be";
export const STAGE3_PROCLAMATION_TICK = 600;
export const STAGE3_MAX_REQUIREMENT_TICK = 12_000;
export const STAGE3_MAX_WALL_COMPLETION_TICKS = 3_000;
export const STAGE3_MAX_NON_WALL_STALL_TICKS = 120;
const STAGE3_FIXTURE_PADDING_TILES = 3;

const EXTRA_BUILDINGS = [
  { id: "chapel-0", kind: "chapel", tx: 12, ty: 1 },
  { id: "house-3", kind: "house", tx: 2, ty: 4 },
  { id: "house-4", kind: "house", tx: 4, ty: 4 },
  { id: "house-5", kind: "house", tx: 6, ty: 5 },
  { id: "house-6", kind: "house", tx: 8, ty: 5 },
  { id: "house-7", kind: "house", tx: 10, ty: 5 },
  { id: "house-8", kind: "house", tx: 12, ty: 5 },
] as const satisfies readonly {
  readonly id: string;
  readonly kind: BuildingKind;
  readonly tx: number;
  readonly ty: number;
}[];

function building(input: {
  readonly id: string;
  readonly kind: BuildingKind;
  readonly tx: number;
  readonly ty: number;
  readonly inventory?: Partial<Record<ResourceType, number>>;
}): Building {
  return {
    id: input.id,
    kind: input.kind,
    tx: input.tx,
    ty: input.ty,
    workers: 0,
    inventory: input.inventory ?? {},
    reserved: {},
    stockReserved: {},
    productionProgress: 0,
  };
}

function house(buildingId: string): House {
  return {
    buildingId,
    level: 2,
    residents: 8,
    hasWater: true,
    breadStock: 2,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
  };
}

function occupiedTileKeys(buildings: readonly Building[]): ReadonlySet<string> {
  const keys = new Set<string>();
  for (const candidate of buildings) {
    const definition = BUILDING_CONFIG_BY_KIND[candidate.kind];
    for (let dy = 0; dy < definition.height; dy += 1) {
      for (let dx = 0; dx < definition.width; dx += 1) {
        keys.add(`${candidate.tx + dx},${candidate.ty + dy}`);
      }
    }
  }
  return keys;
}

function buildingAt(buildings: readonly Building[], tile: Tile): string | null {
  const owner = buildings.find((candidate) => {
    const definition = BUILDING_CONFIG_BY_KIND[candidate.kind];
    return (
      tile.tx >= candidate.tx &&
      tile.tx < candidate.tx + definition.width &&
      tile.ty >= candidate.ty &&
      tile.ty < candidate.ty + definition.height
    );
  });
  return owner?.id ?? null;
}

function shiftedBuilding(candidate: Building): Building {
  return {
    ...candidate,
    tx: candidate.tx + STAGE3_FIXTURE_PADDING_TILES,
    ty: candidate.ty + STAGE3_FIXTURE_PADDING_TILES,
  };
}

function shiftedTileKey(tile: Tile): string {
  return `${tile.tx + STAGE3_FIXTURE_PADDING_TILES},${tile.ty + STAGE3_FIXTURE_PADDING_TILES}`;
}

function paddedMapSize(size: number): number {
  return size + STAGE3_FIXTURE_PADDING_TILES * 2;
}

function stage3Tiles(base: GameState, buildings: readonly Building[]): readonly Tile[] {
  const occupied = occupiedTileKeys(buildings);
  const shiftedBaseTiles = new Map(base.tiles.map((tile) => [shiftedTileKey(tile), tile]));
  const width = paddedMapSize(base.width);
  return Array.from({ length: width * paddedMapSize(base.height) }, (_unused, index) => {
    const tile: Tile = {
      tx: index % width,
      ty: Math.floor(index / width),
      terrain: shiftedBaseTiles.get(`${index % width},${Math.floor(index / width)}`)?.terrain ?? "grass",
      buildingId: null,
      hasRoad: false,
    };
    const buildingId = buildingAt(buildings, tile);
    return {
      ...tile,
      buildingId,
      hasRoad: !occupied.has(`${tile.tx},${tile.ty}`),
    };
  });
}

export function createStage3EconomyHarnessScenario(
  options: Stage3EconomyHarnessScenarioOptions,
): GameState {
  const base = createEconomyHarnessScenario(options);
  const extraBuildings = EXTRA_BUILDINGS.map(building).map(shiftedBuilding);
  const buildings = [...base.buildings.map(shiftedBuilding), ...extraBuildings];
  const houses = [
    ...base.houses.map((candidate) => ({ ...candidate, residents: 8, breadStock: 2 })),
    ...EXTRA_BUILDINGS.filter((candidate) => candidate.kind === "house").map((candidate) => house(candidate.id)),
  ];
  return {
    ...base,
    width: paddedMapSize(base.width),
    height: paddedMapSize(base.height),
    buildings,
    houses,
    tiles: [...stage3Tiles(base, buildings)],
    population: houses.reduce((total, candidate) => total + candidate.residents, 0),
    treasuryTimber: 1_200,
    treasuryCoin: 0,
    pathCache: {},
  };
}
