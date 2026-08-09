import type { TerrainType } from "../content/terrainConfig";
import type { Grid } from "./grid";
import type { Tile } from "./world.types";

export interface WorldGridSize {
  readonly width: number;
  readonly height: number;
}

function coordinateHash(tx: number, ty: number): number {
  let hash = Math.imul(tx, 374_761_393) + Math.imul(ty, 668_265_263);
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function terrainScore(tx: number, ty: number): number {
  return coordinateHash(tx, ty) / 4_294_967_295;
}

export function terrainVariation(tx: number, ty: number): number {
  return terrainScore(tx, ty) * 0.12 - 0.06;
}

export function generateTerrainTile(tx: number, ty: number): TerrainType {
  const river = Math.abs(((tx * 2 + ty * 3 + 11) % 17) - 8) <= 1;
  if (river) return "water";

  const ridge = Math.abs(((tx * 5 - ty * 2 + 7) % 23) - 11) <= 1;
  if (ridge) return "rock";

  const score = terrainScore(tx, ty);
  if (score < 0.34) return "forest";

  return "grass";
}

export function buildWorldGrid(size: WorldGridSize): Grid {
  const tiles: Tile[] = [];
  for (let ty = 0; ty < size.height; ty += 1) {
    for (let tx = 0; tx < size.width; tx += 1) {
      tiles.push({
        tx,
        ty,
        terrain: generateTerrainTile(tx, ty),
        buildingId: null,
        hasRoad: false,
      });
    }
  }

  return {
    width: size.width,
    height: size.height,
    tiles,
  };
}
