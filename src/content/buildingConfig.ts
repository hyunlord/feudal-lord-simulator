import type { ResourceType } from "./resourceConfig";
import type { TerrainType } from "./terrainConfig";
import type { Era } from "./eraConfig";

export type BuildingKind =
  | "house"
  | "well"
  | "storehouse"
  | "granary"
  | "chapel"
  | "wheat_farm"
  | "mill"
  | "logging_camp"
  | "sawmill"
  | "quarry"
  | "masonry"
  | "market";

export interface ProductionSpec {
  readonly output: ResourceType;
  readonly input: ResourceType | null;
  readonly inputPerOutput: number;
  readonly ticksPerOutput: number;
}

export interface BuildingDefinition {
  readonly kind: BuildingKind;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly workersRequired: number;
  readonly buildCost: Partial<Record<ResourceType, number>>;
  readonly requiresAdjacentTerrain: TerrainType | null;
  readonly requiresRoad: boolean;
  readonly unlockEra: Era;
  readonly production: ProductionSpec | null;
  readonly storageCapacity: number;
  readonly serviceRadius: number;
}

export interface Building {
  readonly id: string;
  readonly kind: BuildingKind;
  readonly tx: number;
  readonly ty: number;
  readonly workers: number;
  readonly inventory: Partial<Record<ResourceType, number>>;
  readonly reserved: Partial<Record<ResourceType, number>>;
  readonly stockReserved: Partial<Record<ResourceType, number>>;
  readonly productionProgress: number;
}

export const BUILDING_CONFIG_BY_KIND: Record<BuildingKind, BuildingDefinition> = {
  house: {
    kind: "house",
    name: "오두막",
    width: 1,
    height: 1,
    workersRequired: 0,
    buildCost: {},
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    unlockEra: "hamlet",
    production: null,
    storageCapacity: 0,
    serviceRadius: 0,
  },
  well: {
    kind: "well",
    name: "우물",
    width: 1,
    height: 1,
    workersRequired: 0,
    buildCost: { timber: 10 },
    requiresAdjacentTerrain: null,
    requiresRoad: false,
    unlockEra: "hamlet",
    production: null,
    storageCapacity: 0,
    serviceRadius: 6,
  },
  storehouse: {
    kind: "storehouse",
    name: "창고",
    width: 2,
    height: 2,
    workersRequired: 2,
    buildCost: { timber: 40 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    unlockEra: "hamlet",
    production: null,
    storageCapacity: 200,
    serviceRadius: 0,
  },
  granary: {
    kind: "granary",
    name: "곡창",
    width: 2,
    height: 2,
    workersRequired: 2,
    buildCost: { timber: 40 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    unlockEra: "hamlet",
    production: null,
    storageCapacity: 200,
    serviceRadius: 0,
  },
  chapel: {
    kind: "chapel",
    name: "예배당",
    width: 1,
    height: 1,
    workersRequired: 0,
    buildCost: { timber: 40 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    unlockEra: "hamlet",
    production: null,
    storageCapacity: 0,
    serviceRadius: 0,
  },
  wheat_farm: {
    kind: "wheat_farm",
    name: "밀밭",
    width: 2,
    height: 2,
    workersRequired: 4,
    buildCost: { timber: 20 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    unlockEra: "hamlet",
    production: {
      output: "wheat",
      input: null,
      inputPerOutput: 0,
      ticksPerOutput: 40,
    },
    storageCapacity: 20,
    serviceRadius: 0,
  },
  mill: {
    kind: "mill",
    name: "방앗간",
    width: 1,
    height: 1,
    workersRequired: 2,
    buildCost: { timber: 30 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    unlockEra: "hamlet",
    production: {
      output: "bread",
      input: "wheat",
      inputPerOutput: 2,
      ticksPerOutput: 30,
    },
    storageCapacity: 20,
    serviceRadius: 0,
  },
  logging_camp: {
    kind: "logging_camp",
    name: "벌목소",
    width: 1,
    height: 1,
    workersRequired: 3,
    buildCost: { timber: 15 },
    requiresAdjacentTerrain: "forest",
    requiresRoad: true,
    unlockEra: "hamlet",
    production: {
      output: "logs",
      input: null,
      inputPerOutput: 0,
      ticksPerOutput: 50,
    },
    storageCapacity: 20,
    serviceRadius: 0,
  },
  sawmill: {
    kind: "sawmill",
    name: "제재소",
    width: 1,
    height: 1,
    workersRequired: 2,
    buildCost: { timber: 30 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    unlockEra: "hamlet",
    production: {
      output: "timber",
      input: "logs",
      inputPerOutput: 2,
      ticksPerOutput: 35,
    },
    storageCapacity: 20,
    serviceRadius: 0,
  },
  quarry: {
    kind: "quarry",
    name: "채석장",
    width: 2,
    height: 2,
    workersRequired: 4,
    buildCost: { timber: 50 },
    requiresAdjacentTerrain: "rock",
    requiresRoad: true,
    unlockEra: "palisade",
    production: {
      output: "stone_raw",
      input: null,
      inputPerOutput: 0,
      ticksPerOutput: 60,
    },
    storageCapacity: 20,
    serviceRadius: 0,
  },
  masonry: {
    kind: "masonry",
    name: "석공소",
    width: 1,
    height: 1,
    workersRequired: 3,
    buildCost: { timber: 45 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    unlockEra: "palisade",
    production: {
      output: "stone",
      input: "stone_raw",
      inputPerOutput: 2,
      ticksPerOutput: 45,
    },
    storageCapacity: 20,
    serviceRadius: 0,
  },
  market: {
    kind: "market",
    name: "시장",
    width: 2,
    height: 2,
    workersRequired: 3,
    buildCost: { timber: 60 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    unlockEra: "palisade",
    production: null,
    storageCapacity: 0,
    serviceRadius: 8,
  },
};

export const BUILDING_CONFIG: readonly BuildingDefinition[] = Object.values(
  BUILDING_CONFIG_BY_KIND,
);
