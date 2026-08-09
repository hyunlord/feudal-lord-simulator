import { type TerrainKey } from "./terrainTexturePipeline";
import { readPng } from "./processBuildingSprite";
import {
  FOLIAGE_SPECS,
  type FoliageKey,
} from "./worldAssetContracts";
import { assertSpriteContract } from "./worldSpritePipeline";

export class Phase10SurfaceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Phase10SurfaceValidationError";
  }
}

export const PHASE10_TERRAIN_SPECS = {
  grass: { width: 256, height: 256 },
  forest_floor: { width: 256, height: 256 },
  water: { width: 256, height: 256 },
  rock: { width: 256, height: 256 },
  packed_earth_road: { width: 256, height: 256 },
} as const satisfies Readonly<Record<TerrainKey, { readonly width: number; readonly height: number }>>;

export const assertSelectedFoliageCandidate = (filePath: string, key: FoliageKey): void => {
  const image = readPng(filePath);
  const expected = FOLIAGE_SPECS[key];
  if (image.dimensions.width !== expected.width || image.dimensions.height !== expected.height) {
    throw new Phase10SurfaceValidationError(
      `${key} dimensions ${image.dimensions.width}x${image.dimensions.height} did not match ${expected.width}x${expected.height}`,
    );
  }
  assertSpriteContract(image, key);
};

export const assertSelectedTerrainCandidate = (filePath: string, key: TerrainKey): void => {
  const image = readPng(filePath);
  const expected = PHASE10_TERRAIN_SPECS[key];
  if (image.dimensions.width !== expected.width || image.dimensions.height !== expected.height) {
    throw new Phase10SurfaceValidationError(
      `${key} terrain dimensions ${image.dimensions.width}x${image.dimensions.height} did not match ${expected.width}x${expected.height}`,
    );
  }
  assertOpaqueTerrain(image, key);
  assertLegacyTerrainEdges(image, key);
};

const assertOpaqueTerrain = (image: ReturnType<typeof readPng>, key: TerrainKey): void => {
  for (let index = 0; index < image.rgba.length; index += 4) {
    if (image.rgba[index + 3] !== 255) throw new Phase10SurfaceValidationError(`${key} terrain must be opaque`);
  }
};

const pixelKey = (image: ReturnType<typeof readPng>, x: number, y: number): string => {
  const index = (y * image.dimensions.width + x) * 4;
  return `${image.rgba[index]},${image.rgba[index + 1]},${image.rgba[index + 2]},${image.rgba[index + 3]}`;
};

const assertLegacyTerrainEdges = (image: ReturnType<typeof readPng>, key: TerrainKey): void => {
  const lastX = image.dimensions.width - 1;
  const lastY = image.dimensions.height - 1;
  for (let y = 0; y < image.dimensions.height; y += 1) {
    if (pixelKey(image, 0, y) !== pixelKey(image, lastX, y)) {
      throw new Phase10SurfaceValidationError(`${key} terrain seam check failed: horizontal opposing edges differ`);
    }
  }
  for (let x = 0; x < image.dimensions.width; x += 1) {
    if (pixelKey(image, x, 0) !== pixelKey(image, x, lastY)) {
      throw new Phase10SurfaceValidationError(`${key} terrain seam check failed: vertical opposing edges differ`);
    }
  }
};
