import type { Building } from "../content/buildingConfig";
import type { Rng } from "../content/random";
import type { TilePos, Walker } from "./walker.types";

export interface RoamingHouse {
  readonly buildingId: string;
  readonly width?: number;
  readonly height?: number;
  readonly tx: number;
  readonly ty: number;
  readonly residents?: number;
  readonly breadStock: number;
  readonly lastServicedTick: number;
}

export interface RoamingRoutePort {
  readonly homePath: (buildingId: string) => readonly TilePos[] | null;
  readonly returnPath: (
    start: TilePos,
    buildingId: string,
  ) => readonly TilePos[] | null;
  readonly neighbors: (tile: TilePos) => readonly TilePos[];
  readonly isRoad: (tile: TilePos) => boolean;
  readonly canTraverse?: (from: TilePos, to: TilePos) => boolean;
  readonly servicePath?: (start: TilePos, house: RoamingHouse) => readonly TilePos[] | null;
  readonly canServiceHouse?: (tile: TilePos, house: RoamingHouse) => boolean;
}

export interface RoamingSpawnInput {
  readonly tick: number;
  readonly buildings: readonly Building[];
  readonly walkers: readonly Walker[];
  readonly routes: RoamingRoutePort;
}

export interface RoamingSpawnResult {
  readonly buildings: readonly Building[];
  readonly walkers: readonly Walker[];
}

export interface RoamingJunctionInput {
  readonly walkerId: string;
  readonly tick: number;
  readonly tile: TilePos;
  readonly visitCount: number;
}

export interface RoamingDeliveryEvent {
  readonly homeBuildingId: string;
  readonly houseBuildingId: string;
  readonly amount: number;
}

export interface RoamingStepInput {
  readonly tick: number;
  readonly buildings: readonly Building[];
  readonly walkers: readonly Walker[];
  readonly houses: readonly RoamingHouse[];
  readonly routes: RoamingRoutePort;
  readonly rngForJunction: (input: RoamingJunctionInput) => Rng;
}

export interface RoamingStepResult {
  readonly buildings: readonly Building[];
  readonly walkers: readonly Walker[];
  readonly houses: readonly RoamingHouse[];
  readonly deliveryEvents: readonly RoamingDeliveryEvent[];
}
