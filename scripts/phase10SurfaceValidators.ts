import {
  assertTerrainSeams,
  measureTerrainSeams,
  type TerrainKey,
} from "./terrainTexturePipeline";
import { readPng } from "./processBuildingSprite";
import {
  FOLIAGE_SPECS,
  TERRAIN_SPECS,
  type FoliageKey,
} from "./worldAssetContracts";
import { assertSpriteContract } from "./worldSpritePipeline";

export class Phase10SurfaceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "Phase10SurfaceValidationError";
  }
}

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
  const expected = TERRAIN_SPECS[key];
  if (image.dimensions.width !== expected.width || image.dimensions.height !== expected.height) {
    throw new Phase10SurfaceValidationError(
      `${key} terrain dimensions ${image.dimensions.width}x${image.dimensions.height} did not match ${expected.width}x${expected.height}`,
    );
  }
  assertOpaqueTerrain(image, key);
  try {
    assertTerrainSeams(measureTerrainSeams(image));
  } catch (caught) {
    if (caught instanceof Error) {
      throw new Phase10SurfaceValidationError(`${key} terrain seam check failed: ${caught.message}`);
    }
    throw caught;
  }
};

const assertOpaqueTerrain = (image: ReturnType<typeof readPng>, key: TerrainKey): void => {
  for (let index = 0; index < image.rgba.length; index += 4) {
    if (image.rgba[index + 3] !== 255) throw new Phase10SurfaceValidationError(`${key} terrain must be opaque`);
  }
};
