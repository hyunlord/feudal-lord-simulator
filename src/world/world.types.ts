import type { TerrainType } from "../content/terrainConfig";

export type { TerrainType } from "../content/terrainConfig";

export interface Tile {
  tx: number;
  ty: number;
  terrain: TerrainType;
  buildingId: string | null;
  hasRoad: boolean;
}
