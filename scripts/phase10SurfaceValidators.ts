import {
  assertTerrainSeams,
  measureTerrainSeams,
  TERRAIN_POLICIES,
  type TerrainKey,
} from "./terrainTexturePipeline";
import { readPng } from "./processBuildingSprite";
import { RAMPS } from "../src/content/palette";
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
  assertTerrainPalette(image, key);
  try {
    assertTerrainSeams(measureTerrainSeams(image));
  } catch (caught) {
    if (caught instanceof Error) {
      throw new Phase10SurfaceValidationError(`${key} terrain seam check failed: ${caught.message}`);
    }
    throw caught;
  }
};

const rgbKey = (hex: string): string => {
  const value = Number.parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255},${(value >> 8) & 255},${value & 255}`;
};

const allowedTerrainColours = (key: TerrainKey): ReadonlySet<string> =>
  new Set(TERRAIN_POLICIES[key].ramps.flatMap((ramp) => RAMPS[ramp]).map(rgbKey));

const assertOpaqueTerrain = (image: ReturnType<typeof readPng>, key: TerrainKey): void => {
  for (let index = 0; index < image.rgba.length; index += 4) {
    if (image.rgba[index + 3] !== 255) throw new Phase10SurfaceValidationError(`${key} terrain must be opaque`);
  }
};

const assertTerrainPalette = (image: ReturnType<typeof readPng>, key: TerrainKey): void => {
  const allowed = allowedTerrainColours(key);
  for (let index = 0; index < image.rgba.length; index += 4) {
    const colour = `${image.rgba[index]},${image.rgba[index + 1]},${image.rgba[index + 2]}`;
    if (!allowed.has(colour)) throw new Phase10SurfaceValidationError(`${key} terrain violates its palette policy`);
  }
};
