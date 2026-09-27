import { LABOUR_BALANCE } from "./balanceConfig";
import type { ResourceType } from "./resourceConfig";
import type { TerrainType } from "./terrainConfig";

export type BuildingKind =
  | "house"
  | "well"
  | "storehouse"
  | "granary"
  | "chapel"
  | "wheat_farm"
  | "farmstead"
  | "mill"
  | "logging_camp"
  | "sawmill"
  | "quarry"
  | "masonry"
  | "market"
  | "church"
  | "keep"
  | "malt_kiln";

export interface ProductionSpec {
  readonly output: ResourceType;
  readonly input: ResourceType | null;
  readonly inputPerOutput: number;
  readonly ticksPerOutput: number;
  /** LB-7: production waits (`output_full`) while this much output is still in the building, keeping room for input. */
  readonly outputHoldLimit?: number;
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
  /**
   * Arable spec AF-9: the building stores this resource harvested from the arable strips it tends (its barn)
   * and its carter hauls it like production output. It is not produced by `stepProduction`.
   */
  readonly fieldOutput?: ResourceType;
  /** AF-9: load of this building's carter when it hauls out (default `BALANCE.CARTER_CAPACITY`). The farmstead's ox cart. */
  readonly carterCapacity?: number;
}

export interface Building {
  readonly id: string;
  readonly kind: BuildingKind;
  readonly tx: number;
  readonly ty: number;
  readonly houseLot?: "horizontal" | "vertical";
  readonly workers: number;
  /** LB-5 (save v11): a farmstead's seasonal field hands from the day pool, on top of its workers. Absent = 0. */
  readonly fieldHands?: number;
  /** LB-7 (save v11): a granary's day labourers pushing wheat to mills in reach. Absent = 0. */
  readonly haulers?: number;
  readonly operationPaused?: boolean;
  /** Save v8: its upkeep is in arrears (money rule M-6); it stands idle exactly like a paused building. */
  readonly upkeepUnpaid?: true;
  /** C4 (AL-2, save v23): a farmstead's crop for the strips it sows next (absent = wheat). */
  readonly crop?: FieldCrop;
  readonly inventory: Partial<Record<ResourceType, number>>;
  readonly reserved: Partial<Record<ResourceType, number>>;
  readonly stockReserved: Partial<Record<ResourceType, number>>;
  readonly productionProgress: number;
}

/** C4 (AL-2): the crops a farmstead's strips can grow. */
export type FieldCrop = "wheat" | "barley";
export const FIELD_CROPS: readonly FieldCrop[] = ["wheat", "barley"];

/**
 * C4 (AL-2): the field good a building's barn holds and hauls — its crop, but the other crop first while any of it is
 * still in the barn (a farmstead switched to barley still carts out its last wheat).
 */
export function fieldOutputResource(building: Pick<Building, "kind" | "crop" | "inventory">): FieldCrop | undefined {
  if (BUILDING_CONFIG_BY_KIND[building.kind].fieldOutput === undefined) return undefined;
  const crop = building.crop ?? "wheat";
  const other: FieldCrop = crop === "barley" ? "wheat" : "barley";
  return (building.inventory[other] ?? 0) > 0 ? other : crop;
}

/** C4 (AL-2): the building is a barn that holds `resource` (its crop, or the other crop left from before). */
export function barnHolds(building: Pick<Building, "kind" | "crop" | "inventory">, resource: ResourceType): boolean {
  if (BUILDING_CONFIG_BY_KIND[building.kind].fieldOutput === undefined) return false;
  return (building.crop ?? "wheat") === resource || (FIELD_CROPS as readonly string[]).includes(resource) && (building.inventory[resource] ?? 0) > 0;
}

/**
 * Arable spec AF-12: kinds that can no longer be placed (menu, reducer, autoplay). The wheat farm gave way to
 * arable zone strips tended from a farmstead; saves convert old farms (v9→v10). The definition stays so
 * pre-migration states and the render session's sprites keep compiling until the render cleanup.
 */
export const RETIRED_BUILDING_KINDS: readonly BuildingKind[] = ["wheat_farm"];

export function isRetiredBuildingKind(kind: BuildingKind): boolean {
  return RETIRED_BUILDING_KINDS.includes(kind);
}

/**
 * Paused by the player or idle for unpaid upkeep (M-6). Both reuse the one pause rule: no workers, no
 * service, no production, so homes lose the service through the existing decline rules.
 */
export function operationSuspended(building: Pick<Building, "operationPaused" | "upkeepUnpaid">): boolean {
  return building.operationPaused === true || building.upkeepUnpaid === true;
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
    production: {
      output: "wheat",
      input: null,
      inputPerOutput: 0,
      ticksPerOutput: 40,
    },
    storageCapacity: 20,
    serviceRadius: 0,
  },
  farmstead: {
    kind: "farmstead",
    name: "헛간",
    width: 1,
    height: 1,
    workersRequired: 4,
    buildCost: { timber: 20 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    production: null,
    storageCapacity: 1000,
    serviceRadius: 0,
    fieldOutput: "wheat",
    carterCapacity: 60,
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
    production: {
      output: "bread",
      input: "wheat",
      inputPerOutput: 2,
      ticksPerOutput: 30,
      outputHoldLimit: 16,
    },
    /** LB-7: half for wheat (two 12-loads on their way), half for bread waiting to go out (was 20 with one 8-load cart). */
    storageCapacity: 32,
    serviceRadius: 0,
    /** LB-7: both mill carts (bread out, wheat in) load 12. */
    carterCapacity: LABOUR_BALANCE.millCartCapacity,
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
    production: null,
    storageCapacity: 0,
    serviceRadius: 8,
  },
  church: {
    kind: "church",
    name: "교회",
    width: 2,
    height: 2,
    workersRequired: 0,
    buildCost: { timber: 100, stone: 60 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    production: null,
    storageCapacity: 0,
    serviceRadius: 12,
  },
  keep: {
    kind: "keep",
    name: "성채",
    width: 2,
    height: 2,
    workersRequired: 0,
    buildCost: { stone: 150 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    production: null,
    storageCapacity: 0,
    serviceRadius: 0,
  },
  // C4 (AL-3): the malt kiln — barley steeped, sprouted and dried over the kiln floor into malt, by labour (no fuel good).
  malt_kiln: {
    kind: "malt_kiln",
    name: "엿기름 가마",
    width: 2,
    height: 2,
    workersRequired: 2,
    buildCost: { timber: 40 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    production: { output: "malt", input: "barley", inputPerOutput: 1, ticksPerOutput: 20, outputHoldLimit: 20 },
    storageCapacity: 40,
    serviceRadius: 0,
  },
};

export const BUILDING_CONFIG: readonly BuildingDefinition[] = Object.values(
  BUILDING_CONFIG_BY_KIND,
);
