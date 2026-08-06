import type { Building } from "../content/buildingConfig";
import type { ResourceType } from "../content/resourceConfig";
import type { ConstructionSite } from "../economy/construction";
import type { CarterDestination, TilePos, Walker } from "./walker.types";

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
  readonly fromBuildingToDestination: (
    fromBuildingId: string,
    destination: CarterDestination,
  ) => readonly TilePos[] | null;
  readonly fromTileToBuilding: (
    start: TilePos,
    toBuildingId: string,
  ) => readonly TilePos[] | null;
  readonly fromTileToDestination: (
    start: TilePos,
    destination: CarterDestination,
  ) => readonly TilePos[] | null;
  readonly isRoad: (tile: TilePos) => boolean;
}

export interface DeliveryStepInput {
  readonly tick: number;
  readonly buildings: readonly Building[];
  readonly constructionSites?: readonly ConstructionSite[];
  readonly walkers: readonly Walker[];
  readonly treasuryTimber?: number;
  readonly inventory: DeliveryInventoryPort;
  readonly routes: DeliveryRoutePort;
}

export interface DeliveryStepResult {
  readonly buildings: readonly Building[];
  readonly constructionSites: readonly ConstructionSite[];
  readonly walkers: readonly Walker[];
  readonly treasuryTimber: number;
}

export interface RouteCandidate {
  readonly building: Building;
  readonly path: readonly TilePos[];
  readonly amount: number;
}
