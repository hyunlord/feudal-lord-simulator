import type { Walker } from "../agents/walker.types";
import type { Building } from "../economy/economy.types";
import type { ConstructionSite } from "../economy/construction";
import type { House } from "../population/population.types";
import type { PalisadePath, TileEdgePoint } from "../world/palisadeGeometry";
import type { TileCoordinate } from "../world/grid";
import type { Tile } from "../world/world.types";

export type OverlayMode =
  | "none"
  | "water"
  | "food"
  | "labour"
  | "roads"
  | "distribution"
  | "road_component";
export type GameSpeed = 0 | 1 | 3 | 5;
export type RoadPathCache = Record<string, readonly TileCoordinate[]>;
export type Era = "hamlet" | "palisade";
export type EraRequirementKey = "population" | "granary" | "chapel" | "timber";

export interface EraRequirement {
  readonly key: EraRequirementKey;
  readonly label: string;
  readonly current: number;
  readonly target: number;
  readonly met: boolean;
}

export interface PalisadeSegment {
  readonly id: string;
  readonly order: number;
  readonly edgePath: PalisadePath;
  readonly tileCount: number;
  readonly completed: boolean;
  readonly constructionSiteId: string | null;
}

export interface PalisadeState {
  readonly id: string;
  readonly polygon: PalisadePath;
  readonly gate: TileEdgePoint;
  readonly segments: readonly PalisadeSegment[];
}

export interface ForestHarvest {
  readonly tx: number;
  readonly ty: number;
  readonly harvestedAtTick: number;
}

export interface GameState {
  tick: number;
  seed: number;
  tiles: Tile[];
  width: number;
  height: number;
  buildings: Building[];
  constructionSites: ConstructionSite[];
  houses: House[];
  walkers: Walker[];
  population: number;
  idleWorkers: number;
  treasuryTimber: number;
  wallTick: number;
  era: Era;
  eraProclaimedTick: number | null;
  palisade: PalisadeState | null;
  readonly forestHarvests: readonly ForestHarvest[];
  nextConstructionOrdinal: number;
  roadRevision: number;
  pathCache: RoadPathCache;
}
