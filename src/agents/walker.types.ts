import type { ResourceType } from "../content/resourceConfig";

export type WalkerKind = "carter" | "distributor";

export interface TilePos {
  readonly tx: number;
  readonly ty: number;
}

export interface WalkerCargo {
  readonly resource: ResourceType;
  readonly amount: number;
}

interface WalkerBase {
  readonly id: string;
  readonly kind: WalkerKind;
  readonly homeBuildingId: string;
  readonly position: TilePos;
  readonly path: readonly TilePos[];
  readonly pathIndex: number;
  readonly previousTile: TilePos | null;
  readonly cargo: WalkerCargo | null;
  readonly spawnedTick: number;
}

export type CarterMission = "deliver" | "fetch";
export type CarterPhase = "outbound" | "returning";
export type CarterCancellationReason =
  | "destination_unavailable"
  | "manual"
  | "road_removed"
  | "source_unavailable";

export interface CarterSourceStockClaim {
  readonly buildingId: string;
  readonly resource: ResourceType;
  readonly amount: number;
}

export interface CarterReservation {
  readonly destinationBuildingId: string;
  readonly resource: ResourceType;
  readonly amount: number;
  readonly sourceStockClaim: CarterSourceStockClaim | null;
}

export interface CarterCancellation {
  readonly tick: number;
  readonly reason: CarterCancellationReason;
  readonly releasedReservation: boolean;
}

export interface CarterWalker extends WalkerBase {
  readonly kind: "carter";
  readonly mission: CarterMission;
  readonly phase: CarterPhase;
  readonly destinationBuildingId: string;
  readonly reservation: CarterReservation;
  readonly cancellation: CarterCancellation | null;
}

export type DistributorPhase = "roaming" | "returning";

export interface DistributorWalker extends WalkerBase {
  readonly kind: "distributor";
  readonly phase: DistributorPhase;
  readonly junctionVisits: number;
  readonly tilesTravelled: number;
  readonly priorTile: TilePos | null;
}

export type Walker = CarterWalker | DistributorWalker;
