import { BUILDING_COPY } from "./buildingCatalog.ko";
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
  | "malt_kiln"
  // C5 the cloth chain (spec docs/design/cloth-chain.md CL-*).
  | "pastoral_farm"
  | "weaver_house"
  | "fulling_mill"
  | "dyehouse"
  | "tenter_yard";

export interface ProductionSpec {
  readonly output: ResourceType;
  readonly input: ResourceType | null;
  readonly inputPerOutput: number;
  readonly ticksPerOutput: number;
  /** LB-7: production waits (`output_full`) while this much output is still in the building, keeping room for input. */
  readonly outputHoldLimit?: number;
  /** C5 (CL-6): a second good each output also uses up, from the building's own stock (the dyehouse's dyes). */
  readonly alsoConsumes?: { readonly resource: ResourceType; readonly amount: number };
}

export interface BuildingDefinition {
  readonly kind: BuildingKind;
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly workersRequired: number;
  readonly buildCost: Partial<Record<ResourceType, number>>;
  readonly requiresAdjacentTerrain: TerrainType | null;
  /** ARCH-1b (MA-10): the adjacent water must flow (the map's river or brook; an older save without one: any water). */
  readonly requiresFlowingWater?: true;
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
  /**
   * C5 (CL-2): a building that neither produces nor tends strips but gathers a good in its yard (the pastoral farm's
   * shorn fleece) and carts it out like production output.
   */
  readonly yardOutput?: ResourceType;
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
  /** F3-A (PL-6, save v26): a church or chapel whose priest died — it serves nobody until the seat is filled. */
  readonly curacyVacant?: true;
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
export function operationSuspended(building: Pick<Building, "operationPaused" | "upkeepUnpaid"> & { readonly curacyVacant?: true }): boolean {
  return building.operationPaused === true || building.upkeepUnpaid === true || building.curacyVacant === true;
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
    // New names come from the building catalog's copy (CODE-1b: Korean text lives in *.ko.ts).
    name: BUILDING_COPY.malt_kiln.name,
    width: 2,
    height: 2,
    workersRequired: 2,
    buildCost: { timber: 40 },
    requiresAdjacentTerrain: null,
    requiresRoad: true,
    production: { output: "malt", input: "barley", inputPerOutput: 1, ticksPerOutput: 20, outputHoldLimit: 20 },
    storageCapacity: 40,
    serviceRadius: 0,
    // C4 (decision AL12): the kiln's barley carts carry as the mill's wheat carts do (8 left it starving 79–89 % of the time).
    carterCapacity: LABOUR_BALANCE.millCartCapacity,
  },
  // C5 (CL-2): the pastoral farm — the shepherds' fold and wool store beside the pasture; it shears the flocks it tends
  // in early summer (`cloth.ts`) and carts the fleece to the storehouses.
  pastoral_farm: {
    kind: "pastoral_farm", name: BUILDING_COPY.pastoral_farm.name, width: 2, height: 1, workersRequired: 1, buildCost: { timber: 30 },
    requiresAdjacentTerrain: null, requiresRoad: true, production: null, storageCapacity: 400, serviceRadius: 0, yardOutput: "fleece", carterCapacity: 40,
  },
  // C5 (CL-4): the weaver's house and its broad loom — four skeins of yarn a cloth.
  weaver_house: {
    kind: "weaver_house", name: BUILDING_COPY.weaver_house.name, width: 1, height: 1, workersRequired: 2, buildCost: { timber: 30 },
    requiresAdjacentTerrain: null, requiresRoad: true,
    production: { output: "raw_cloth", input: "yarn", inputPerOutput: 4, ticksPerOutput: 80, outputHoldLimit: 10 }, storageCapacity: 40, serviceRadius: 0,
  },
  // C5 (CL-5): the fulling mill — a water wheel's hammers (14th-century English fulling was water-driven; the corn mill
  // stays a windmill, the forbidden watermill is the grain one).
  fulling_mill: {
    kind: "fulling_mill", name: BUILDING_COPY.fulling_mill.name, width: 2, height: 2, workersRequired: 2, buildCost: { timber: 60 },
    // ARCH-1b (MA-10): its wheel turns on running water — the river or brook, not a mere or the sea.
    requiresAdjacentTerrain: "water", requiresFlowingWater: true, requiresRoad: true,
    production: { output: "fulled_cloth", input: "raw_cloth", inputPerOutput: 1, ticksPerOutput: 60, outputHoldLimit: 10 }, storageCapacity: 30, serviceRadius: 0,
  },
  // C5 (CL-6): the dyehouse by the water — a vat of woad, madder or weld a cloth.
  dyehouse: {
    kind: "dyehouse", name: BUILDING_COPY.dyehouse.name, width: 2, height: 1, workersRequired: 2, buildCost: { timber: 40 },
    requiresAdjacentTerrain: "water", requiresRoad: true,
    production: { output: "dyed_cloth", input: "fulled_cloth", inputPerOutput: 1, ticksPerOutput: 60, outputHoldLimit: 10, alsoConsumes: { resource: "dyes", amount: 1 } },
    storageCapacity: 40, serviceRadius: 0,
  },
  // C5 (CL-7): the tenter field — cloth stretched on its frames to dry true and be finished.
  tenter_yard: {
    kind: "tenter_yard", name: BUILDING_COPY.tenter_yard.name, width: 3, height: 2, workersRequired: 1, buildCost: { timber: 20 },
    requiresAdjacentTerrain: null, requiresRoad: true,
    production: { output: "finished_cloth", input: "dyed_cloth", inputPerOutput: 1, ticksPerOutput: 80, outputHoldLimit: 10 }, storageCapacity: 30, serviceRadius: 0,
  },
};

export const BUILDING_CONFIG: readonly BuildingDefinition[] = Object.values(
  BUILDING_CONFIG_BY_KIND,
);
