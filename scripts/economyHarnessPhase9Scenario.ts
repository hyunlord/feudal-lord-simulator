import type { Building, BuildingKind } from "../src/content/buildingConfig";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import type { Tile } from "../src/world/world.types";
import { createStage3EconomyHarnessScenario } from "./economyHarnessStage3Scenario";
import { trackStage3Run } from "./economyHarnessStage3Trace";

export interface Phase9EconomyHarnessScenarioOptions {
  readonly seed: number;
}

export const PHASE9_MAX_STONE_CHAIN_STALL_TICKS = 2_000;
export const PHASE9_MAX_COIN_TICK = 5_000;
export const PHASE9_MAX_ERA3_REQUIREMENT_TICK = 30_000;
export const PHASE9_MAX_STONE_WALL_COMPLETION_TICKS = 5_000;
export const PHASE9_RUN_TICKS = 30_000;

const PHASE9_BUILDINGS = [
  {
    id: "phase9-storehouse-0",
    kind: "storehouse",
    tx: 16,
    ty: 2,
    inventory: { stone_raw: 20, stone: 40, timber: 120 },
  },
  {
    id: "phase9-storehouse-1",
    kind: "storehouse",
    tx: 19,
    ty: 2,
    inventory: { stone: 20, timber: 160 },
  },
  {
    id: "phase9-storehouse-2",
    kind: "storehouse",
    tx: 22,
    ty: 2,
    inventory: { timber: 180 },
  },
  {
    id: "phase9-storehouse-3",
    kind: "storehouse",
    tx: 22,
    ty: 5,
    inventory: {},
  },
  {
    id: "phase9-granary-0",
    kind: "granary",
    tx: 3,
    ty: 10,
    inventory: { bread: 200 },
  },
  {
    id: "phase9-granary-1",
    kind: "granary",
    tx: 10,
    ty: 10,
    inventory: { bread: 200 },
  },
  {
    id: "phase9-left-storehouse-0",
    kind: "storehouse",
    tx: 1,
    ty: 14,
    inventory: { stone: 200 },
  },
  {
    id: "phase9-left-storehouse-1",
    kind: "storehouse",
    tx: 5,
    ty: 14,
    inventory: { stone: 200 },
  },
  { id: "phase9-well-0", kind: "well", tx: 7, ty: 11 },
  { id: "phase9-well-1", kind: "well", tx: 13, ty: 11 },
  { id: "phase9-quarry-0", kind: "quarry", tx: 16, ty: 7 },
  { id: "phase9-quarry-1", kind: "quarry", tx: 18, ty: 7 },
  { id: "phase9-masonry-0", kind: "masonry", tx: 21, ty: 7 },
  { id: "phase9-market-0", kind: "market", tx: 20, ty: 9 },
] as const satisfies readonly {
  readonly id: string;
  readonly kind: BuildingKind;
  readonly tx: number;
  readonly ty: number;
  readonly inventory?: Partial<Record<ResourceType, number>>;
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

function house(input: { readonly id: string; readonly level: number; readonly residents: number }): House {
  return {
    buildingId: input.id,
    level: input.level,
    residents: input.residents,
    hasWater: true,
    breadStock: 2,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
  };
}

function phase9HouseBuildings(): readonly Building[] {
  const positions = [
    { tx: 1, ty: 12 },
    { tx: 2, ty: 12 },
    { tx: 5, ty: 12 },
    { tx: 6, ty: 12 },
    { tx: 8, ty: 12 },
    { tx: 9, ty: 12 },
    { tx: 12, ty: 12 },
  ] as const;
  return positions.map((position, index) =>
    building({
      id: `phase9-house-${index}`,
      kind: "house",
      tx: position.tx,
      ty: position.ty,
    }),
  );
}

function ownerAt(buildings: readonly Building[], tx: number, ty: number): string | null {
  const owner = buildings.find((candidate) => {
    const definition = BUILDING_CONFIG_BY_KIND[candidate.kind];
    return (
      tx >= candidate.tx &&
      tx < candidate.tx + definition.width &&
      ty >= candidate.ty &&
      ty < candidate.ty + definition.height
    );
  });
  return owner?.id ?? null;
}

function tileFromBase(base: GameState, tx: number, ty: number): Tile | null {
  return base.tiles.find((tile) => tile.tx === tx && tile.ty === ty) ?? null;
}

function phase9Terrain(base: GameState, tx: number, ty: number): Tile["terrain"] {
  if ((tx === 15 && (ty === 7 || ty === 8)) || (tx === 16 && ty === 6) || (tx === 18 && ty === 6)) return "rock";
  return tileFromBase(base, tx, ty)?.terrain ?? "grass";
}

function phase9Tiles(base: GameState, buildings: readonly Building[]): readonly Tile[] {
  const width = 24;
  const height = 16;
  return Array.from({ length: width * height }, (_unused, index): Tile => {
    const tx = index % width;
    const ty = Math.floor(index / width);
    const buildingId = ownerAt(buildings, tx, ty);
    return {
      tx,
      ty,
      terrain: phase9Terrain(base, tx, ty),
      buildingId,
      hasRoad: buildingId === null,
    };
  });
}

export function createPhase9EconomyHarnessScenario(
  options: Phase9EconomyHarnessScenarioOptions,
): GameState {
  const stage3 = trackStage3Run(createStage3EconomyHarnessScenario(options)).finalState;
  const extraBuildings = [...PHASE9_BUILDINGS.map(building), ...phase9HouseBuildings()];
  const buildings = [...stage3.buildings, ...extraBuildings];
  const phase9Houses = phase9HouseBuildings().map((candidate) => house({ id: candidate.id, level: 3, residents: 22 }));
  const houses = [
    ...stage3.houses.map((candidate) => ({
      ...candidate,
      residents: Math.min(candidate.level >= 2 ? 14 : 4, candidate.residents),
      breadStock: 2,
      lastServicedTick: stage3.tick,
    })),
    ...phase9Houses,
  ].map((candidate) => ({ ...candidate, lastServicedTick: stage3.tick }));
  const fedBuildings = buildings.map((candidate) =>
    candidate.kind === "granary"
      ? {
          ...candidate,
          inventory: {
            ...candidate.inventory,
            bread: Math.max(
              0,
              200 - Object.entries(candidate.inventory)
                .filter(([resource]) => resource !== "bread")
                .reduce((total, [, amount]) => total + amount, 0),
            ),
          },
        }
      : candidate,
  );

  return {
    ...stage3,
    seed: options.seed,
    width: 24,
    height: 16,
    buildings: fedBuildings,
    houses,
    tiles: [...phase9Tiles(stage3, fedBuildings)],
    population: houses.reduce((total, candidate) => total + candidate.residents, 0),
    treasuryTimber: 1_200,
    treasuryCoin: 0,
    roadRevision: stage3.roadRevision + 1,
    pathCache: {},
  };
}
