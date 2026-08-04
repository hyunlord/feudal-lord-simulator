import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
  type BuildingKind,
} from "../content/buildingConfig";
import { PALETTE, type PaletteColor } from "../content/palette";
import type { ResourceType } from "../content/resourceConfig";
import type { House } from "../population/population.types";

export type RoofShape = "none" | "triangle" | "flat" | "shed" | "tower";

export type BodyProfile = {
  readonly width: number;
  readonly height: number;
  readonly roof: number;
  readonly fill: PaletteColor;
  readonly roofColor: PaletteColor;
  readonly roofShape: RoofShape;
};

export type ProductionVisualState =
  | "idle"
  | "working"
  | "no_workers"
  | "no_input"
  | "storage_full";

export type BuildingVisualState = {
  readonly houseLevel: number;
  readonly production: ProductionVisualState;
};

export function buildBuildingVisualState(
  building: Building,
  houses: readonly House[],
): BuildingVisualState {
  return {
    houseLevel: houseLevel(building, houses),
    production: productionVisualState(building),
  };
}

export function isProductionProblem(state: BuildingVisualState): boolean {
  return (
    state.production === "no_workers" ||
    state.production === "no_input" ||
    state.production === "storage_full"
  );
}

export function houseBodyProfile(level: number): BodyProfile {
  if (level >= 3) {
    return towerHouseProfile;
  }
  if (level === 2) {
    return civicHouseProfile;
  }
  if (level === 1) {
    return farmHouseProfile;
  }
  return hutProfile;
}

export function buildingBodyProfile(
  kind: BuildingKind,
  houseLevel: number,
): BodyProfile {
  if (kind === "house") {
    return houseBodyProfile(houseLevel);
  }
  return nonHouseBodyProfile(kind);
}

const hutProfile = {
  width: 30,
  height: 26,
  roof: 12,
  fill: PALETTE.parchmentDark,
  roofColor: PALETTE.earth,
  roofShape: "triangle",
} as const satisfies BodyProfile;

const farmHouseProfile = {
  width: 34,
  height: 32,
  roof: 16,
  fill: PALETTE.parchmentDark,
  roofColor: PALETTE.earthDark,
  roofShape: "triangle",
} as const satisfies BodyProfile;

const civicHouseProfile = {
  width: 42,
  height: 39,
  roof: 14,
  fill: PALETTE.parchment,
  roofColor: PALETTE.goldDark,
  roofShape: "shed",
} as const satisfies BodyProfile;

const towerHouseProfile = {
  width: 48,
  height: 48,
  roof: 22,
  fill: PALETTE.vellum,
  roofColor: PALETTE.goldDark,
  roofShape: "tower",
} as const satisfies BodyProfile;

function houseLevel(building: Building, houses: readonly House[]): number {
  if (building.kind !== "house") return 0;
  return houses.find((house) => house.buildingId === building.id)?.level ?? 0;
}

function productionVisualState(building: Building): ProductionVisualState {
  const definition = BUILDING_CONFIG_BY_KIND[building.kind];
  const production = definition.production;
  if (production === null) return "idle";
  if (building.workers < definition.workersRequired) return "no_workers";
  if (
    production.input !== null &&
    stock(building.inventory, production.input) < production.inputPerOutput
  ) {
    return "no_input";
  }
  if (sumStock(building.inventory) >= definition.storageCapacity) {
    return "storage_full";
  }
  return "working";
}

function sumStock(record: Partial<Record<ResourceType, number>>): number {
  return Object.values(record).reduce(
    (total, amount) => total + Math.max(0, amount ?? 0),
    0,
  );
}

function stock(
  record: Partial<Record<ResourceType, number>>,
  resource: ResourceType,
): number {
  return Math.max(0, record[resource] ?? 0);
}

function nonHouseBodyProfile(kind: Exclude<BuildingKind, "house">): BodyProfile {
  switch (kind) {
    case "well":
      return { width: 24, height: 16, roof: 0, fill: PALETTE.stone, roofColor: PALETTE.stoneDark, roofShape: "none" };
    case "storehouse":
      return { width: 60, height: 34, roof: 8, fill: PALETTE.parchmentDark, roofColor: PALETTE.earthDark, roofShape: "flat" };
    case "granary":
      return { width: 52, height: 40, roof: 14, fill: PALETTE.parchment, roofColor: PALETTE.goldDark, roofShape: "shed" };
    case "wheat_farm":
      return { width: 68, height: 14, roof: 0, fill: PALETTE.sageDark, roofColor: PALETTE.gold, roofShape: "none" };
    case "mill":
      return { width: 54, height: 58, roof: 20, fill: PALETTE.parchmentDark, roofColor: PALETTE.earthDark, roofShape: "tower" };
    case "logging_camp":
      return { width: 34, height: 22, roof: 10, fill: PALETTE.earth, roofColor: PALETTE.forest, roofShape: "shed" };
    case "sawmill":
      return { width: 62, height: 48, roof: 14, fill: PALETTE.parchmentDark, roofColor: PALETTE.earthDark, roofShape: "flat" };
  }
}
