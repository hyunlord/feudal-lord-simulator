import type { TerrainType } from "../content/terrainConfig";

export type { TerrainType } from "../content/terrainConfig";

export interface Tile {
  readonly tx: number;
  readonly ty: number;
  readonly terrain: TerrainType;
  readonly buildingId: string | null;
  readonly hasRoad: boolean;
}

export interface WorldView {
  readonly tiles: readonly Tile[];
  readonly width: number;
  readonly height: number;
  readonly treasuryTimber: number;
}
