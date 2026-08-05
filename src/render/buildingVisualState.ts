import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
  type BuildingKind,
} from "../content/buildingConfig";
import { PALETTE, SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";
import type { ResourceType } from "../content/resourceConfig";
import type { House } from "../population/population.types";

export type RoofShape =
  | "none"
  | "triangle"
  | "gable"
  | "flat"
  | "shed"
  | "dome"
  | "cone"
  | "tower";

export type RenderDetailLevel = "full" | "simplified" | "blocks";

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

export function renderDetailLevel(zoom: number): RenderDetailLevel {
  if (zoom <= 0.5) return "blocks";
  return zoom <= 0.7 ? "simplified" : "full";
}

export function buildingLodColor(kind: BuildingKind): PaletteColor {
  if (kind === "house") return SEMANTIC_PALETTE.parchmentDark;
  if (kind === "storehouse" || kind === "granary" || kind === "well") {
    return SEMANTIC_PALETTE.stone;
  }
  return SEMANTIC_PALETTE.earth;
}

const hutProfile = {
  width: 28,
  height: 20,
  roof: 16,
  fill: SEMANTIC_PALETTE.earth,
  roofColor: SEMANTIC_PALETTE.earthDark,
  roofShape: "triangle",
} as const satisfies BodyProfile;

const farmHouseProfile = {
  width: 32,
  height: 30,
  roof: 18,
  fill: SEMANTIC_PALETTE.parchmentDark,
  roofColor: SEMANTIC_PALETTE.earth,
  roofShape: "triangle",
} as const satisfies BodyProfile;

const civicHouseProfile = {
  width: 44,
  height: 42,
  roof: 16,
  fill: SEMANTIC_PALETTE.parchmentDark,
  roofColor: SEMANTIC_PALETTE.stone,
  roofShape: "gable",
} as const satisfies BodyProfile;

const towerHouseProfile = {
  width: 54,
  height: 52,
  roof: 20,
  fill: SEMANTIC_PALETTE.parchment,
  roofColor: SEMANTIC_PALETTE.stoneDark,
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
  const occupied = sumStock(building.inventory) + sumStock(building.reserved);
  const available = Math.max(0, definition.storageCapacity - occupied);
  const inputReleased = production.input === null ? 0 : production.inputPerOutput;
  if (
    available + inputReleased < 1 &&
    building.productionProgress >= production.ticksPerOutput
  ) {
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
      return { width: 26, height: 12, roof: 0, fill: SEMANTIC_PALETTE.stoneDark, roofColor: SEMANTIC_PALETTE.stone, roofShape: "none" };
    case "storehouse":
      return { width: 64, height: 30, roof: 6, fill: SEMANTIC_PALETTE.parchmentDark, roofColor: SEMANTIC_PALETTE.earthDark, roofShape: "flat" };
    case "granary":
      return { width: 58, height: 32, roof: 16, fill: SEMANTIC_PALETTE.parchment, roofColor: SEMANTIC_PALETTE.goldDark, roofShape: "dome" };
    case "wheat_farm":
      return { width: 72, height: 10, roof: 0, fill: SEMANTIC_PALETTE.earth, roofColor: PALETTE.gold, roofShape: "none" };
    case "mill":
      return { width: 38, height: 62, roof: 24, fill: SEMANTIC_PALETTE.parchmentDark, roofColor: SEMANTIC_PALETTE.earthDark, roofShape: "cone" };
    case "logging_camp":
      return { width: 38, height: 20, roof: 12, fill: SEMANTIC_PALETTE.earth, roofColor: SEMANTIC_PALETTE.forest, roofShape: "shed" };
    case "sawmill":
      return { width: 66, height: 32, roof: 14, fill: SEMANTIC_PALETTE.parchmentDark, roofColor: SEMANTIC_PALETTE.earthDark, roofShape: "shed" };
  }
}
