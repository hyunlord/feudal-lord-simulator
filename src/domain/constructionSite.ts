import type { BuildingKind } from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
import type { TileCoordinate, TileEdgePath } from "../geometry/tileGeometry";

export type ConstructionStall =
  | "none"
  | "awaiting_materials"
  | "no_material_source"
  | "no_route"
  | "reserve_held"
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
  /**
   * F0-B EV-6 (save v13): the burnt house this site rebuilds. The house keeps its building, tiles and household; the
   * site starts at stage 2 (foundation) and, when complete, clears the house's `burntTick` instead of adding a building.
   */
  readonly rebuildOf?: string;
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
