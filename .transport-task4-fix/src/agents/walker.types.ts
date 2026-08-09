import type { ResourceType } from "../content/resourceConfig";

export type WalkerKind = "carter" | "distributor";

export interface TilePos {
  tx: number;
  ty: number;
}

export interface Walker {
  id: string;
  kind: WalkerKind;
  homeBuildingId: string;
  tx: number;
  ty: number;
  destinationBuildingId: string | null;
  path: TilePos[] | null;
  carrying: { resource: ResourceType; amount: number } | null;
  roamDirection: number;
  roamTilesRemaining: number;
}
