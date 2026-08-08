import type { BuildingKind } from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
import type { TileCoordinate, TileEdgePath } from "../geometry/tileGeometry";

export type ConstructionStall =
  | "none"
  | "awaiting_materials"
  | "no_material_source"
  | "no_route"
  | "no_builders";

export type ConstructionResourceAmounts = Partial<Record<ResourceType, number>>;

type ConstructionSiteCommon = {
  readonly id: string;
  readonly required: ConstructionResourceAmounts;
  readonly delivered: ConstructionResourceAmounts;
  readonly reserved: ConstructionResourceAmounts;
  readonly builderTicks: number;
  readonly requiredBuilderTicks: number;
  readonly assignedBuilders: number;
  readonly stall: ConstructionStall;
  readonly startedTick: number;
};

export type BuildingConstructionSite = ConstructionSiteCommon & {
  readonly kind: BuildingKind;
  readonly tx: number;
  readonly ty: number;
};

export type PalisadeConstructionSite = ConstructionSiteCommon & {
  readonly kind: "palisade_segment";
  readonly wallId: string;
  readonly segmentIndex: number;
  readonly gateDistance: number;
  readonly order: number;
  readonly path: TileEdgePath;
  readonly anchor: TileCoordinate;
};

export type StoneWallConstructionSite = ConstructionSiteCommon & {
  readonly kind: "stone_wall_segment";
  readonly wallId: string;
  readonly segmentIndex: number;
  readonly gateDistance: number;
  readonly order: number;
  readonly path: TileEdgePath;
  readonly anchor: TileCoordinate;
};

export type WallConstructionSite = PalisadeConstructionSite | StoneWallConstructionSite;

export type ConstructionSite =
  | BuildingConstructionSite
  | PalisadeConstructionSite
  | StoneWallConstructionSite;
