import {
  BUILDING_CONFIG_BY_KIND,
  type Building,
  type BuildingKind,
} from "../content/buildingConfig";
import { PALETTE, SEMANTIC_PALETTE, type PaletteColor } from "../content/palette";
import type { HouseMaterialEra, HouseMaterialWave } from "./buildingMaterialWave";
import { houseMaterialEraForBuilding } from "./buildingMaterialWave";
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
  readonly houseMaterialEra: HouseMaterialEra;
  readonly houseProblem: "water" | "bread" | null;
  readonly production: ProductionVisualState;
};

export function buildBuildingVisualState(
  building: Building,
  houses: readonly House[],
  input: { readonly era?: HouseMaterialEra; readonly nowMs?: number; readonly wave?: HouseMaterialWave | null } = {},
): BuildingVisualState {
  const house = houses.find((candidate) => candidate.buildingId === building.id);
  return {
    houseLevel: house?.level ?? 0,
    houseMaterialEra: houseMaterialEraForBuilding({
      building,
      wave: input.wave ?? null,
      nowMs: input.nowMs ?? 0,
      era: input.era ?? "hamlet",
    }),
    houseProblem: houseProblem(building, house),
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

export function houseBodyProfile(input: number | { readonly era: HouseMaterialEra; readonly level: number }): BodyProfile {
  const profileInput = typeof input === "number" ? { era: "hamlet" as const, level: input } : input;
  const level = profileInput.level;
  if (profileInput.era === "palisade") {
    if (level >= 3) return palisadeTowerHouseProfile;
    if (level === 2) return palisadeCivicHouseProfile;
    if (level === 1) return palisadeFarmHouseProfile;
  }
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
  houseMaterialEra: HouseMaterialEra = "hamlet",
): BodyProfile {
  if (kind === "house") {
    return houseBodyProfile({ era: houseMaterialEra, level: houseLevel });
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

const palisadeFarmHouseProfile = {
  width: 34,
  height: 32,
  roof: 16,
  fill: SEMANTIC_PALETTE.parchmentDark,
  roofColor: SEMANTIC_PALETTE.earthDark,
  roofShape: "gable",
} as const satisfies BodyProfile;

const palisadeCivicHouseProfile = {
  width: 46,
  height: 44,
  roof: 18,
  fill: SEMANTIC_PALETTE.parchment,
  roofColor: SEMANTIC_PALETTE.stoneDark,
  roofShape: "gable",
} as const satisfies BodyProfile;

const palisadeTowerHouseProfile = {
  width: 56,
  height: 54,
  roof: 20,
  fill: SEMANTIC_PALETTE.vellum,
  roofColor: SEMANTIC_PALETTE.stoneDark,
  roofShape: "tower",
} as const satisfies BodyProfile;

function houseProblem(
  building: Building,
  house: House | undefined,
): "water" | "bread" | null {
  if (building.kind !== "house" || house === undefined) return null;
  if (!house.hasWater) return "water";
  if (house.level >= 1 && house.breadStock <= 0) return "bread";
  return null;
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
    case "chapel":
      return { width: 42, height: 48, roof: 18, fill: SEMANTIC_PALETTE.parchment, roofColor: SEMANTIC_PALETTE.earthDark, roofShape: "cone" };
    case "wheat_farm":
      return { width: 72, height: 10, roof: 0, fill: SEMANTIC_PALETTE.earth, roofColor: PALETTE.gold, roofShape: "none" };
    case "mill":
      return { width: 38, height: 62, roof: 24, fill: SEMANTIC_PALETTE.parchmentDark, roofColor: SEMANTIC_PALETTE.earthDark, roofShape: "cone" };
    case "logging_camp":
      return { width: 38, height: 20, roof: 12, fill: SEMANTIC_PALETTE.earth, roofColor: SEMANTIC_PALETTE.forest, roofShape: "shed" };
    case "sawmill":
      return { width: 66, height: 32, roof: 14, fill: SEMANTIC_PALETTE.parchmentDark, roofColor: SEMANTIC_PALETTE.earthDark, roofShape: "shed" };
    case "quarry":
      return { width: 74, height: 18, roof: 0, fill: SEMANTIC_PALETTE.stoneDark, roofColor: SEMANTIC_PALETTE.stone, roofShape: "none" };
    case "masonry":
      return { width: 44, height: 28, roof: 10, fill: SEMANTIC_PALETTE.stone, roofColor: SEMANTIC_PALETTE.earthDark, roofShape: "shed" };
    case "market":
      return { width: 66, height: 34, roof: 12, fill: SEMANTIC_PALETTE.parchment, roofColor: SEMANTIC_PALETTE.goldDark, roofShape: "flat" };
    case "church":
      return { width: 78, height: 92, roof: 34, fill: SEMANTIC_PALETTE.parchment, roofColor: SEMANTIC_PALETTE.stoneDark, roofShape: "cone" };
    case "keep":
      return { width: 86, height: 116, roof: 44, fill: SEMANTIC_PALETTE.stone, roofColor: SEMANTIC_PALETTE.stoneDark, roofShape: "tower" };
  }
}
