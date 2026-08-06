import type { Walker } from "../src/agents/walker.types";
import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
  type BuildingKind,
} from "../src/content/buildingConfig";
import { BALANCE } from "../src/content/balanceConfig";
import type { ResourceType } from "../src/content/resourceConfig";
import type { GameState } from "../src/engine/engine.types";
import type { House } from "../src/population/population.types";
import type { Tile } from "../src/world/world.types";

export interface EconomyHarnessScenarioOptions {
  readonly seed: number;
}

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
    residents: 14,
    hasWater: true,
    breadStock: 1,
    lastServicedTick: 0,
    unmetRequirementTicks: 0,
  };
}

function roadKeys(): ReadonlySet<string> {
  const roads = new Set<string>();
  for (let tx = 1; tx <= 12; tx += 1) roads.add(`${tx},2`);
  return roads;
}

function buildings(): readonly Building[] {
  return [
    building({ id: "house-0", kind: "house", tx: 8, ty: 1 }),
    building({ id: "house-1", kind: "house", tx: 9, ty: 1 }),
    building({ id: "house-2", kind: "house", tx: 8, ty: 3 }),
    building({ id: "well-0", kind: "well", tx: 11, ty: 0 }),
    building({ id: "logging_camp-0", kind: "logging_camp", tx: 1, ty: 1 }),
    building({ id: "sawmill-0", kind: "sawmill", tx: 3, ty: 1 }),
    building({
      id: "storehouse-0",
      kind: "storehouse",
      tx: 5,
      ty: 0,
    }),
    building({ id: "wheat_farm-0", kind: "wheat_farm", tx: 3, ty: 3 }),
    building({ id: "wheat_farm-1", kind: "wheat_farm", tx: 5, ty: 3 }),
    building({ id: "mill-0", kind: "mill", tx: 7, ty: 3 }),
    building({
      id: "granary-0",
      kind: "granary",
      tx: 9,
      ty: 3,
      inventory: { bread: 36 },
    }),
    building({
      id: "granary-1",
      kind: "granary",
      tx: 11,
      ty: 3,
      inventory: { bread: 36 },
    }),
  ];
}

function terrainAt(tx: number, ty: number): Tile["terrain"] {
  if (tx === 0 && (ty === 1 || ty === 2 || ty === 3)) return "forest";
  return "grass";
}

function ownerAt(buildingList: readonly Building[], tx: number, ty: number): string | null {
  const owner = buildingList.find((candidate) => {
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

function tiles(buildingList: readonly Building[]): readonly Tile[] {
  const width = 14;
  const height = 10;
  const roads = roadKeys();
  return Array.from({ length: width * height }, (_unused, index): Tile => {
    const tx = index % width;
    const ty = Math.floor(index / width);
    return {
      tx,
      ty,
      terrain: terrainAt(tx, ty),
      buildingId: ownerAt(buildingList, tx, ty),
      hasRoad: roads.has(`${tx},${ty}`),
    };
  });
}

export function createEconomyHarnessScenario(
  options: EconomyHarnessScenarioOptions,
): GameState {
  const buildingList = buildings();
  const houses = [house("house-0"), house("house-1"), house("house-2")];
  const walkers: readonly Walker[] = [];
  return {
    tick: 0,
    seed: options.seed,
    tiles: [...tiles(buildingList)],
    width: 14,
    height: 10,
    buildings: [...buildingList],
    constructionSites: [],
    wallTick: 0,
    nextConstructionOrdinal: 1,
    houses: [...houses],
    walkers: [...walkers],
    population: houses.reduce((total, candidate) => total + candidate.residents, 0),
    idleWorkers: 0,
    treasuryTimber: BALANCE.STARTING_TIMBER,
    roadRevision: 1,
    pathCache: {},
  };
}
