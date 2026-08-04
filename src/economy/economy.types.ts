import type { ResourceType } from "../content/resourceConfig";
import type { TerrainType } from "../content/terrainConfig";

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
  output: ResourceType;
  input: ResourceType | null;
  inputPerOutput: number;
  ticksPerOutput: number;
}

export interface BuildingDefinition {
  kind: BuildingKind;
  name: string;
  width: number;
  height: number;
  workersRequired: number;
  buildCost: Partial<Record<ResourceType, number>>;
  requiresAdjacentTerrain: TerrainType | null;
  requiresRoad: boolean;
  production: ProductionSpec | null;
  storageCapacity: number;
  serviceRadius: number;
}

export interface Building {
  id: string;
  kind: BuildingKind;
  tx: number;
  ty: number;
  workers: number;
  inventory: Partial<Record<ResourceType, number>>;
  productionProgress: number;
}
