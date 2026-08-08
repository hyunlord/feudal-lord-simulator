import {
  BUILDING_CONFIG_BY_KIND,
  type BuildingKind,
} from "../content/buildingConfig";
import { RESOURCE_TYPES, type ResourceType } from "../content/resourceConfig";
import {
  tileEdgePathSteps,
  type TileCoordinate,
  type TileEdgePath,
} from "../geometry/tileGeometry";
import type {
  BuildingConstructionSite,
  PalisadeConstructionSite,
  StoneWallConstructionSite,
} from "../domain/constructionSite";
export type {
  BuildingConstructionSite,
  ConstructionResourceAmounts,
  ConstructionSite,
  ConstructionStall,
  PalisadeConstructionSite,
  StoneWallConstructionSite,
  WallConstructionSite,
} from "../domain/constructionSite";

export type ConstructionSiteFootprint = {
  readonly tx: number;
  readonly ty: number;
  readonly width: number;
  readonly height: number;
};

export type CreateConstructionSiteInput = {
  readonly ordinal: number;
  readonly kind: BuildingKind;
  readonly tx: number;
  readonly ty: number;
  readonly startedTick: number;
};

export type CreatePalisadeConstructionSiteInput = {
  readonly id: string;
  readonly wallId: string;
  readonly segmentIndex: number;
  readonly gateDistance: number;
  readonly order: number;
  readonly path: TileEdgePath;
  readonly startedTick: number;
};

export type CreateStoneWallConstructionSiteInput = CreatePalisadeConstructionSiteInput;

export const CONSTRUCTION = {
  MAX_BUILDERS_PER_SITE: 3,
  MIN_VISIBLE_TICKS: 60,
  REQUIRED_BUILDER_TICKS: {
    house: 240,
    well: 200,
    logging_camp: 400,
    sawmill: 600,
    mill: 600,
    storehouse: 800,
    granary: 800,
    chapel: 600,
    wheat_farm: 500,
    quarry: 700,
    masonry: 600,
    market: 700,
  },
} as const satisfies {
  readonly MAX_BUILDERS_PER_SITE: number;
  readonly MIN_VISIBLE_TICKS: number;
  readonly REQUIRED_BUILDER_TICKS: Record<BuildingKind, number>;
};

const PALISADE_SEGMENT_TIMBER_PER_STEP = 15;
const PALISADE_SEGMENT_MAX_STEPS = 4;
const PALISADE_SEGMENT_REQUIRED_BUILDER_TICKS = 120;
const STONE_WALL_SEGMENT_STONE = 25;
const STONE_WALL_SEGMENT_REQUIRED_BUILDER_TICKS = 200;

function amount(record: Partial<Record<ResourceType, number>>, resource: ResourceType): number {
  return record[resource] ?? 0;
}

function positiveResourceAmounts(
  valueForResource: (resource: ResourceType) => number,
): Partial<Record<ResourceType, number>> {
  const result: Partial<Record<ResourceType, number>> = {};
  for (const resource of RESOURCE_TYPES) {
    const value = valueForResource(resource);
    if (value > 0) result[resource] = value;
  }
  return result;
}

export class InvalidPalisadeConstructionSiteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPalisadeConstructionSiteError";
  }
}

export function requiredConstructionMaterials(
  kind: BuildingKind,
): Partial<Record<ResourceType, number>> {
  return positiveResourceAmounts(
    (resource) => BUILDING_CONFIG_BY_KIND[kind].buildCost[resource] ?? 0,
  );
}

export function constructionSiteId(ordinal: number): string {
  return `construction-site-${String(ordinal).padStart(6, "0")}`;
}

export function createConstructionSite(
  input: CreateConstructionSiteInput,
): BuildingConstructionSite {
  const required = requiredConstructionMaterials(input.kind);
  const hasMaterialNeed = RESOURCE_TYPES.some((resource) => amount(required, resource) > 0);
  return {
    id: constructionSiteId(input.ordinal),
    kind: input.kind,
    tx: input.tx,
    ty: input.ty,
    required,
    delivered: {},
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: CONSTRUCTION.REQUIRED_BUILDER_TICKS[input.kind],
    assignedBuilders: 0,
    stall: hasMaterialNeed ? "awaiting_materials" : "no_builders",
    startedTick: input.startedTick,
  };
}

function pathAnchor(path: TileEdgePath): TileCoordinate {
  const xs = path.map((point) => point.x);
  const ys = path.map((point) => point.y);
  return { tx: Math.min(...xs), ty: Math.min(...ys) };
}

export function createPalisadeConstructionSite(
  input: CreatePalisadeConstructionSiteInput,
): PalisadeConstructionSite {
  const steps = tileEdgePathSteps(input.path);
  if (input.path.length < 2 || steps <= 0) {
    throw new InvalidPalisadeConstructionSiteError("Palisade construction path must contain at least one step");
  }
  if (steps > PALISADE_SEGMENT_MAX_STEPS) {
    throw new InvalidPalisadeConstructionSiteError("Palisade construction path cannot exceed four steps");
  }
  const path = input.path.map((point) => ({ x: point.x, y: point.y }));
  return {
    id: input.id,
    kind: "palisade_segment",
    wallId: input.wallId,
    segmentIndex: input.segmentIndex,
    gateDistance: input.gateDistance,
    order: input.order,
    path,
    anchor: pathAnchor(path),
    required: { timber: steps * PALISADE_SEGMENT_TIMBER_PER_STEP },
    delivered: {},
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: PALISADE_SEGMENT_REQUIRED_BUILDER_TICKS,
    assignedBuilders: 0,
    stall: "awaiting_materials",
    startedTick: input.startedTick,
  };
}

export function createStoneWallConstructionSite(
  input: CreateStoneWallConstructionSiteInput,
): StoneWallConstructionSite {
  const steps = tileEdgePathSteps(input.path);
  if (input.path.length < 2 || steps <= 0) {
    throw new InvalidPalisadeConstructionSiteError("Stone wall construction path must contain at least one step");
  }
  if (steps > PALISADE_SEGMENT_MAX_STEPS) {
    throw new InvalidPalisadeConstructionSiteError("Stone wall construction path cannot exceed four steps");
  }
  const path = input.path.map((point) => ({ x: point.x, y: point.y }));
  return {
    id: input.id,
    kind: "stone_wall_segment",
    wallId: input.wallId,
    segmentIndex: input.segmentIndex,
    gateDistance: input.gateDistance,
    order: input.order,
    path,
    anchor: pathAnchor(path),
    required: { stone: STONE_WALL_SEGMENT_STONE },
    delivered: {},
    reserved: {},
    builderTicks: 0,
    requiredBuilderTicks: STONE_WALL_SEGMENT_REQUIRED_BUILDER_TICKS,
    assignedBuilders: 0,
    stall: "awaiting_materials",
    startedTick: input.startedTick,
  };
}
