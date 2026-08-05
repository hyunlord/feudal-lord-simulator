import { RAMPS, type RampName } from "../src/content/palette";
import {
  readPng,
  resizeRgbaLanczos,
  writePng,
  type Dimensions,
  type RgbaImage,
} from "./processBuildingSprite";
import { rgbToLab, type Lab, type Rgb } from "./quantisePalette";

export const TERRAIN_KEYS = ["grass", "forest_floor", "water", "rock", "packed_earth_road"] as const;
export type TerrainKey = (typeof TERRAIN_KEYS)[number];

export const TERRAIN_POLICIES = {
  grass: { ramps: ["foliage"] },
  forest_floor: { ramps: ["foliage", "earth"] },
  water: { ramps: ["water"] },
  rock: { ramps: ["stone", "slate"] },
  packed_earth_road: { ramps: ["earth"] },
} as const satisfies Readonly<Record<TerrainKey, { readonly ramps: readonly RampName[] }>>;

export type TerrainSeamMetrics = {
  readonly horizontalOpposingEdgeMaxDelta: number;
  readonly verticalOpposingEdgeMaxDelta: number;
  readonly horizontalJoinBandDelta: number;
  readonly verticalJoinBandDelta: number;
  readonly horizontalInternalBandDelta: number;
  readonly verticalInternalBandDelta: number;
};

export type TerrainProcessResult = {
  readonly texture: RgbaImage;
  readonly tiledPreview: RgbaImage;
  readonly seamMetrics: TerrainSeamMetrics;
};

type PaletteColour = Rgb & { readonly lab: Lab };
type Point = { readonly x: number; readonly y: number };
type Axis = "horizontal" | "vertical";

export class TerrainPipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TerrainPipelineError";
  }
}

const TARGET = { width: 256, height: 256 } as const satisfies Dimensions;
const OFFSET = 128;
const BLEND_WIDTH = 16;
const METRIC_BAND_WIDTH = 4;
const MAX_JOIN_BAND_DELTA = 24;
const MAX_JOIN_TO_INTERNAL_RATIO = 2;
const INTERNAL_TOLERANCE = 4;

const hexToRgb = (hex: string): Rgb => {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
};

const paletteFor = (key: TerrainKey): readonly PaletteColour[] =>
  TERRAIN_POLICIES[key].ramps.flatMap((ramp) => RAMPS[ramp]).map((hex) => {
    const rgb = hexToRgb(hex);
    return { ...rgb, lab: rgbToLab(rgb) };
  });

const deltaE76 = (left: Lab, right: Lab): number =>
  Math.hypot(left.l - right.l, left.a - right.a, left.b - right.b);

const nearestColour = (rgb: Rgb, palette: readonly PaletteColour[]): PaletteColour => {
  const lab = rgbToLab(rgb);
  const first = palette[0];
  if (first === undefined) throw new TerrainPipelineError("Terrain palette cannot be empty");
  let nearest = first;
  let nearestDelta = deltaE76(lab, nearest.lab);
  for (const candidate of palette.slice(1)) {
    const delta = deltaE76(lab, candidate.lab);
    if (delta < nearestDelta) {
      nearest = candidate;
      nearestDelta = delta;
    }
  }
  return nearest;
};

const indexAt = (dimensions: Dimensions, point: Point): number =>
  (point.y * dimensions.width + point.x) * 4;

const readRgb = (image: RgbaImage, point: Point): Rgb => {
  const index = indexAt(image.dimensions, point);
  const r = image.rgba[index];
  const g = image.rgba[index + 1];
  const b = image.rgba[index + 2];
  if (r === undefined || g === undefined || b === undefined) {
    throw new TerrainPipelineError(`Missing RGB pixel at ${point.x},${point.y}`);
  }
  return { r, g, b };
};

const writeRgb = (image: RgbaImage, point: Point, rgb: Rgb): void => {
  const index = indexAt(image.dimensions, point);
  image.rgba[index] = rgb.r;
  image.rgba[index + 1] = rgb.g;
  image.rgba[index + 2] = rgb.b;
  image.rgba[index + 3] = 255;
};

const assertWholeImage = (image: RgbaImage): void => {
  const expected = image.dimensions.width * image.dimensions.height * 4;
  if (image.rgba.length !== expected) {
    throw new TerrainPipelineError(`RGBA length ${image.rgba.length} did not match ${expected}`);
  }
};

const offsetAndQuantise = (source: RgbaImage, palette: readonly PaletteColour[]): RgbaImage => {
  const output: RgbaImage = { dimensions: TARGET, rgba: new Uint8Array(TARGET.width * TARGET.height * 4) };
  for (let y = 0; y < TARGET.height; y += 1) {
    for (let x = 0; x < TARGET.width; x += 1) {
      const sourcePoint = { x: (x + OFFSET) % TARGET.width, y: (y + OFFSET) % TARGET.height };
      writeRgb(output, { x, y }, nearestColour(readRgb(source, sourcePoint), palette));
    }
  }
  return output;
};

const mix = (left: Rgb, right: Rgb, factor: number): Rgb => ({
  r: Math.round(left.r + (right.r - left.r) * factor),
  g: Math.round(left.g + (right.g - left.g) * factor),
  b: Math.round(left.b + (right.b - left.b) * factor),
});

const blendAxis = (image: RgbaImage, axis: Axis, palette: readonly PaletteColour[]): void => {
  for (let distance = 0; distance < BLEND_WIDTH; distance += 1) {
    const factor = 1 - distance / BLEND_WIDTH;
    for (let position = 0; position < TARGET.width; position += 1) {
      const low = axis === "horizontal" ? { x: distance, y: position } : { x: position, y: distance };
      const highCoordinate = TARGET.width - 1 - distance;
      const high = axis === "horizontal" ? { x: highCoordinate, y: position } : { x: position, y: highCoordinate };
      const lowRgb = readRgb(image, low);
      const highRgb = readRgb(image, high);
      const average = mix(lowRgb, highRgb, 0.5);
      writeRgb(image, low, nearestColour(mix(lowRgb, average, factor), palette));
      writeRgb(image, high, nearestColour(mix(highRgb, average, factor), palette));
    }
  }
};

const colourDelta = (left: Rgb, right: Rgb): number =>
  (Math.abs(left.r - right.r) + Math.abs(left.g - right.g) + Math.abs(left.b - right.b)) / 3;

const bandDelta = (image: RgbaImage, axis: Axis, centre: number): number => {
  let total = 0;
  let samples = 0;
  for (let offset = -METRIC_BAND_WIDTH; offset < METRIC_BAND_WIDTH; offset += 1) {
    const lowCoordinate = (centre + offset + TARGET.width) % TARGET.width;
    const highCoordinate = (lowCoordinate + 1) % TARGET.width;
    for (let position = 0; position < TARGET.width; position += 1) {
      const low = axis === "horizontal" ? { x: lowCoordinate, y: position } : { x: position, y: lowCoordinate };
      const high = axis === "horizontal" ? { x: highCoordinate, y: position } : { x: position, y: highCoordinate };
      total += colourDelta(readRgb(image, low), readRgb(image, high));
      samples += 1;
    }
  }
  return total / samples;
};

const opposingEdgeMax = (image: RgbaImage, axis: Axis): number => {
  let maximum = 0;
  for (let position = 0; position < TARGET.width; position += 1) {
    const first = axis === "horizontal" ? { x: 0, y: position } : { x: position, y: 0 };
    const last = axis === "horizontal" ? { x: 255, y: position } : { x: position, y: 255 };
    maximum = Math.max(maximum, colourDelta(readRgb(image, first), readRgb(image, last)));
  }
  return maximum;
};

export const measureTerrainSeams = (image: RgbaImage): TerrainSeamMetrics => {
  assertWholeImage(image);
  if (image.dimensions.width !== 256 || image.dimensions.height !== 256) {
    throw new TerrainPipelineError(`Terrain metrics require 256x256 input, got ${image.dimensions.width}x${image.dimensions.height}`);
  }
  return {
    horizontalOpposingEdgeMaxDelta: opposingEdgeMax(image, "horizontal"),
    verticalOpposingEdgeMaxDelta: opposingEdgeMax(image, "vertical"),
    horizontalJoinBandDelta: bandDelta(image, "horizontal", 0),
    verticalJoinBandDelta: bandDelta(image, "vertical", 0),
    horizontalInternalBandDelta: bandDelta(image, "horizontal", OFFSET),
    verticalInternalBandDelta: bandDelta(image, "vertical", OFFSET),
  };
};

export const assertTerrainSeams = (metrics: TerrainSeamMetrics): void => {
  if (metrics.horizontalOpposingEdgeMaxDelta !== 0 || metrics.verticalOpposingEdgeMaxDelta !== 0) {
    throw new TerrainPipelineError("Opposing terrain edges are not byte-compatible");
  }
  const axes = [
    ["horizontal", metrics.horizontalJoinBandDelta, metrics.horizontalInternalBandDelta],
    ["vertical", metrics.verticalJoinBandDelta, metrics.verticalInternalBandDelta],
  ] as const;
  for (const [axis, join, internal] of axes) {
    if (join > MAX_JOIN_BAND_DELTA || join > internal * MAX_JOIN_TO_INTERNAL_RATIO + INTERNAL_TOLERANCE) {
      throw new TerrainPipelineError(`${axis} join band delta ${join.toFixed(3)} exceeds internal ${internal.toFixed(3)}`);
    }
  }
};

export const buildTerrainTile2x2 = (texture: RgbaImage): RgbaImage => {
  assertWholeImage(texture);
  const dimensions = { width: texture.dimensions.width * 2, height: texture.dimensions.height * 2 };
  const tiled: RgbaImage = { dimensions, rgba: new Uint8Array(dimensions.width * dimensions.height * 4) };
  for (let y = 0; y < dimensions.height; y += 1) {
    for (let x = 0; x < dimensions.width; x += 1) {
      writeRgb(tiled, { x, y }, readRgb(texture, { x: x % texture.dimensions.width, y: y % texture.dimensions.height }));
    }
  }
  return tiled;
};

export const processTerrainRgba = (
  source: RgbaImage,
  key: TerrainKey,
  resize: (image: RgbaImage, target: Dimensions) => RgbaImage = resizeRgbaLanczos,
): TerrainProcessResult => {
  assertWholeImage(source);
  const resized = source.dimensions.width === 256 && source.dimensions.height === 256 ? source : resize(source, TARGET);
  const palette = paletteFor(key);
  const texture = offsetAndQuantise(resized, palette);
  blendAxis(texture, "horizontal", palette);
  blendAxis(texture, "vertical", palette);
  const seamMetrics = measureTerrainSeams(texture);
  assertTerrainSeams(seamMetrics);
  return { texture, tiledPreview: buildTerrainTile2x2(texture), seamMetrics };
};

export const processTerrainFile = (inputPath: string, outputPath: string, key: TerrainKey): TerrainSeamMetrics => {
  const result = processTerrainRgba(readPng(inputPath), key);
  writePng(outputPath, result.texture);
  return result.seamMetrics;
};
