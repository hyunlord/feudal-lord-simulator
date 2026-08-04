import type { Building } from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
import type { TilePos, Walker } from "./walker.types";

export interface DeliveryInventoryPort {
  readonly availableSpace: (building: Building) => number;
  readonly reserveSpace: (
    building: Building,
    resource: ResourceType,
    amount: number,
  ) => Building;
  readonly releaseSpace: (
    building: Building,
    resource: ResourceType,
    amount: number,
  ) => Building;
  readonly availableStock: (building: Building, resource: ResourceType) => number;
  readonly reserveStock: (
    building: Building,
    resource: ResourceType,
    amount: number,
  ) => Building;
  readonly releaseStock: (
    building: Building,
    resource: ResourceType,
    amount: number,
  ) => Building;
  readonly withdrawStock: (
    building: Building,
    resource: ResourceType,
    amount: number,
  ) => { readonly building: Building; readonly withdrawn: number };
}

export interface DeliveryRoutePort {
  readonly betweenBuildings: (
    fromBuildingId: string,
    toBuildingId: string,
  ) => readonly TilePos[] | null;
  readonly fromTileToBuilding: (
    start: TilePos,
    toBuildingId: string,
  ) => readonly TilePos[] | null;
  readonly isRoad: (tile: TilePos) => boolean;
}

export interface DeliveryStepInput {
  readonly tick: number;
  readonly buildings: readonly Building[];
  readonly walkers: readonly Walker[];
  readonly inventory: DeliveryInventoryPort;
  readonly routes: DeliveryRoutePort;
}

export interface DeliveryStepResult {
  readonly buildings: readonly Building[];
  readonly walkers: readonly Walker[];
}

export interface RouteCandidate {
  readonly building: Building;
  readonly path: readonly TilePos[];
  readonly amount: number;
}
