import type { TerrainType } from "../content/terrainConfig";
import type { Grid } from "./grid";
import { fbm } from "./noise";
import type { Tile } from "./world.types";

export interface WorldGridSize {
  readonly width: number;
  readonly height: number;
  readonly seed: number;
}

export const TERRAIN_THRESHOLDS = {
  waterElevation: 0.32,
  rockElevation: 0.78,
  forestMoisture: 0.58,
} as const;

const MINIMUM_REGION_SIZE: Readonly<Record<"water" | "forest" | "rock", number>> = {
  water: 6,
  forest: 4,
  rock: 4,
};

const WORLD_SAMPLE_ORIGIN = { tx: 5, ty: 2 } as const;

const ORTHOGONAL_OFFSETS = [
  { tx: 0, ty: -1 },
  { tx: 1, ty: 0 },
  { tx: 0, ty: 1 },
  { tx: -1, ty: 0 },
] as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function amplify(value: number, contrast: number): number {
  return clamp01(0.5 + (value - 0.5) * contrast);
}

function terrainFields(tx: number, ty: number, seed: number) {
  const elevationDetail = fbm(tx * 0.034, ty * 0.034, seed, 4);
  const elevationMass = fbm(tx * 0.018, ty * 0.018, seed + 4_009, 3);
  const elevationRaw = clamp01(
    amplify(elevationDetail, 1.7) + (elevationMass - 0.5) * 0.45,
  );
  const elevation =
    elevationRaw <= 0.5 ? elevationRaw : 0.5 + (elevationRaw - 0.5) * 0.62;
  const moisture = amplify(
    fbm((tx + 41) * 0.03, (ty - 29) * 0.03, seed + 8_021, 4),
    1.7,
  );

  return { elevation, moisture };
}

export function terrainVariation(
  tx: number,
  ty: number,
  seed: number,
): number {
  const coherentValue = fbm(
    (tx + 11) * 0.055,
    (ty - 17) * 0.055,
    seed + 12_271,
    4,
  );
  return Math.max(-0.05, Math.min(0.05, (coherentValue - 0.5) * 0.14));
}

export function generateTerrainTile(
  tx: number,
  ty: number,
  seed: number,
): TerrainType {
  const { elevation, moisture } = terrainFields(tx, ty, seed);

  if (elevation < TERRAIN_THRESHOLDS.waterElevation) return "water";
  if (elevation > TERRAIN_THRESHOLDS.rockElevation) return "rock";
  if (moisture > TERRAIN_THRESHOLDS.forestMoisture) return "forest";
  return "grass";
}

function collectRegion(
  terrains: readonly TerrainType[],
  width: number,
  height: number,
  startIndex: number,
  terrain: TerrainType,
  visited: Uint8Array,
): number[] {
  const region: number[] = [];
  const queue = [startIndex];
  visited[startIndex] = 1;

  for (let queueIndex = 0; queueIndex < queue.length; queueIndex += 1) {
    const index = queue[queueIndex];
    if (index === undefined) continue;
    region.push(index);

    const tx = index % width;
    const ty = Math.floor(index / width);
    for (const offset of ORTHOGONAL_OFFSETS) {
      const neighbourTx = tx + offset.tx;
      const neighbourTy = ty + offset.ty;
      if (
        neighbourTx < 0 ||
        neighbourTy < 0 ||
        neighbourTx >= width ||
        neighbourTy >= height
      ) {
        continue;
      }

      const neighbourIndex = neighbourTy * width + neighbourTx;
      if (
        visited[neighbourIndex] === 0 &&
        terrains[neighbourIndex] === terrain
      ) {
        visited[neighbourIndex] = 1;
        queue.push(neighbourIndex);
      }
    }
  }

  return region;
}

function removeSmallRegions(
  terrains: TerrainType[],
  width: number,
  height: number,
  terrain: "water" | "forest" | "rock",
): void {
  const visited = new Uint8Array(terrains.length);
  const minimumSize = MINIMUM_REGION_SIZE[terrain];

  for (let index = 0; index < terrains.length; index += 1) {
    if (visited[index] !== 0 || terrains[index] !== terrain) continue;
    const region = collectRegion(terrains, width, height, index, terrain, visited);
    if (region.length >= minimumSize) continue;

    for (const regionIndex of region) {
      terrains[regionIndex] = "grass";
    }
  }
}

function fillEnclosedGrass(
  terrains: TerrainType[],
  width: number,
  height: number,
): void {
  const enclosed: number[] = [];

  for (let ty = 1; ty < height - 1; ty += 1) {
    for (let tx = 1; tx < width - 1; tx += 1) {
      const index = ty * width + tx;
      if (terrains[index] !== "grass") continue;

      const surrounded = ORTHOGONAL_OFFSETS.every((offset) => {
        const neighbourIndex = (ty + offset.ty) * width + tx + offset.tx;
        return terrains[neighbourIndex] === "water";
      });
      if (surrounded) enclosed.push(index);
    }
  }

  for (const index of enclosed) {
    terrains[index] = "water";
  }
}

export function cleanupTerrainRegions(
  terrains: readonly TerrainType[],
  width: number,
  height: number,
): TerrainType[] {
  const cleaned = [...terrains];
  removeSmallRegions(cleaned, width, height, "water");
  removeSmallRegions(cleaned, width, height, "forest");
  removeSmallRegions(cleaned, width, height, "rock");
  fillEnclosedGrass(cleaned, width, height);
  return cleaned;
}

export function buildWorldGrid(size: WorldGridSize): Grid {
  const terrains: TerrainType[] = [];
  for (let ty = 0; ty < size.height; ty += 1) {
    for (let tx = 0; tx < size.width; tx += 1) {
      terrains.push(
        generateTerrainTile(
          tx + WORLD_SAMPLE_ORIGIN.tx,
          ty + WORLD_SAMPLE_ORIGIN.ty,
          size.seed,
        ),
      );
    }
  }

  const cleanedTerrains = cleanupTerrainRegions(
    terrains,
    size.width,
    size.height,
  );

  const tiles: Tile[] = cleanedTerrains.map((terrain, index) => ({
    tx: index % size.width,
    ty: Math.floor(index / size.width),
    terrain,
    buildingId: null,
    hasRoad: false,
  }));

  return {
    width: size.width,
    height: size.height,
    tiles,
  };
}
