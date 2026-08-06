import type { Walker } from "../agents/walker.types";
import type { Building } from "../economy/economy.types";
import type { House } from "../population/population.types";
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

export interface GameState {
  tick: number;
  seed: number;
  tiles: Tile[];
  width: number;
  height: number;
  buildings: Building[];
  houses: House[];
  walkers: Walker[];
  population: number;
  idleWorkers: number;
  treasuryTimber: number;
  roadRevision: number;
  pathCache: RoadPathCache;
}
