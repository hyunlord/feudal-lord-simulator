import type { ResourceType } from "./resourceConfig";
import type { TerrainType } from "./terrainConfig";

export type BuildingKind =
  | "house"
  | "well"
  | "storehouse"
  | "granary"
  | "wheat_farm"
  | "mill"
  | "logging_camp"
  | "sawmill";

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
  readonly productionProgress: number;
}

export const BUILDING_CONFIG_BY_KIND: Record<BuildingKind, BuildingDefinition> = {
  house: {
    kind: "house",
    name: "Cottar House",
    width: 1,
    height: 1,
    workersRequired: 0,
    buildCost: { timber: 6 },
    requiresAdjacentTerrain: null,
    requiresRoad: false,
    production: null,
    storageCapacity: 0,
    serviceRadius: 0,
  },
  well: {
    kind: "well",
    name: "Village Well",
    width: 1,
    height: 1,
    workersRequired: 0,
    buildCost: { timber: 4 },
    requiresAdjacentTerrain: null,
    requiresRoad: false,
    production: null,
    storageCapacity: 0,
    serviceRadius: 4,
  },
  storehouse: {
    kind: "storehouse",
    name: "Storehouse",
    width: 2,
    height: 1,
    workersRequired: 0,
    buildCost: { timber: 14 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    production: null,
    storageCapacity: 120,
    serviceRadius: 0,
  },
  granary: {
    kind: "granary",
    name: "Granary",
    width: 2,
    height: 1,
    workersRequired: 0,
    buildCost: { timber: 12 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    production: null,
    storageCapacity: 100,
    serviceRadius: 0,
  },
  wheat_farm: {
    kind: "wheat_farm",
    name: "Wheat Farm",
    width: 2,
    height: 2,
    workersRequired: 2,
    buildCost: { timber: 10 },
    requiresAdjacentTerrain: null,
    requiresRoad: false,
    production: {
      output: "wheat",
      input: null,
      inputPerOutput: 0,
      ticksPerOutput: 6,
    },
    storageCapacity: 20,
    serviceRadius: 0,
  },
  mill: {
    kind: "mill",
    name: "Water Mill",
    width: 2,
    height: 2,
    workersRequired: 2,
    buildCost: { timber: 20 },
    requiresAdjacentTerrain: "water",
    requiresRoad: true,
    production: {
      output: "bread",
      input: "wheat",
      inputPerOutput: 2,
      ticksPerOutput: 8,
    },
    storageCapacity: 30,
    serviceRadius: 0,
  },
  logging_camp: {
    kind: "logging_camp",
    name: "Logging Camp",
    width: 1,
    height: 1,
    workersRequired: 2,
    buildCost: { timber: 8 },
    requiresAdjacentTerrain: "forest",
    requiresRoad: false,
    production: {
      output: "logs",
      input: null,
      inputPerOutput: 0,
      ticksPerOutput: 5,
    },
    storageCapacity: 20,
    serviceRadius: 0,
  },
  sawmill: {
    kind: "sawmill",
    name: "Sawmill",
    width: 2,
    height: 2,
    workersRequired: 2,
    buildCost: { timber: 18 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    production: {
      output: "timber",
      input: "logs",
      inputPerOutput: 2,
      ticksPerOutput: 7,
    },
    storageCapacity: 30,
    serviceRadius: 0,
  },
};

export const BUILDING_CONFIG: readonly BuildingDefinition[] = Object.values(
  BUILDING_CONFIG_BY_KIND,
);
