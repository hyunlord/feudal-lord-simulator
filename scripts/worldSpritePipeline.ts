import { PALETTE, RAMPS, type RampName } from "../src/content/palette";
import {
  DEFAULT_CHROMA_KEY,
  OUTLINE_ALPHA,
  byteIndex,
  findOpaqueBounds,
  hexToRgb,
  processSpriteImage,
  rgbKey,
  type Dimensions,
  type RgbaImage,
} from "./processBuildingSprite";

export type BuildingSpriteKey = keyof typeof BUILDING_SPRITE_CONTRACTS;
export type FoliageSpriteKey = keyof typeof FOLIAGE_SPRITE_CONTRACTS;
export type WorldSpriteKey = BuildingSpriteKey | FoliageSpriteKey;

export const BUILDING_SPRITE_CONTRACTS = {
  house_l1: { width: 96, height: 120, baselineY: 104, footprint: 1 },
  house_l2: { width: 96, height: 144, baselineY: 128, footprint: 1 },
  house_l3: { width: 160, height: 192, baselineY: 176, footprint: 2 },
  well: { width: 72, height: 80, baselineY: 64, footprint: 1 },
  storehouse: { width: 160, height: 136, baselineY: 120, footprint: 2 },
  wheat_farm: { width: 160, height: 96, baselineY: 80, footprint: 2 },
  logging_camp: { width: 96, height: 104, baselineY: 88, footprint: 1 },
  sawmill: { width: 112, height: 112, baselineY: 96, footprint: 1 },
} as const;

export const FOLIAGE_SPRITE_CONTRACTS = {
  tree_conifer_a: { width: 64, height: 96, baselineY: 96 },
  tree_conifer_b: { width: 56, height: 80, baselineY: 80 },
  tree_broadleaf_a: { width: 72, height: 88, baselineY: 88 },
  tree_broadleaf_b: { width: 64, height: 72, baselineY: 72 },
  shrub_a: { width: 40, height: 28, baselineY: 28 },
  shrub_b: { width: 32, height: 22, baselineY: 22 },
  grass_tuft: { width: 28, height: 18, baselineY: 18 },
  field_stone: { width: 24, height: 16, baselineY: 16 },
} as const;

const WORLD_SPRITE_CONTRACTS = {
  ...BUILDING_SPRITE_CONTRACTS,
  ...FOLIAGE_SPRITE_CONTRACTS,
} as const;

const BUILDING_KEYS: ReadonlySet<WorldSpriteKey> = new Set([
  "house_l1", "house_l2", "house_l3", "well", "storehouse", "wheat_farm", "logging_camp", "sawmill",
]);

const ROOF_RAMPS = {
  house_l1: "thatch",
  house_l2: "slate",
  house_l3: "slate",
  well: "thatch",
  storehouse: "slate",
  logging_camp: "slate",
  sawmill: "slate",
} as const satisfies Readonly<Record<Exclude<BuildingSpriteKey, "wheat_farm">, RampName>>;

const RAMP_NAMES = ["thatch", "timber", "plaster", "stone", "slate", "earth", "foliage", "water"] as const;
const rampEntries = RAMP_NAMES.flatMap((name) =>
  RAMPS[name].map((hex, shade) => [rgbKey(hexToRgb(hex)), { name, shade }] as const),
);
const RAMP_BY_RGB = new Map(rampEntries);
const INK_KEY = rgbKey(hexToRgb(PALETTE.ink));

export const worldSpriteContract = (key: WorldSpriteKey) => WORLD_SPRITE_CONTRACTS[key];

export const isBuildingSpriteKey = (key: WorldSpriteKey): key is BuildingSpriteKey => BUILDING_KEYS.has(key);

const setRampColour = (rgba: Uint8Array, index: number, ramp: RampName): void => {
  const key = `${rgba[index]},${rgba[index + 1]},${rgba[index + 2]}`;
  const shade = RAMP_BY_RGB.get(key)?.shade ?? 2;
  const colour = hexToRgb(RAMPS[ramp][shade] ?? RAMPS[ramp][2]);
  rgba[index] = colour.r;
  rgba[index + 1] = colour.g;
  rgba[index + 2] = colour.b;
};

export const enforceBuildingMaterialPolicy = (image: RgbaImage, key: BuildingSpriteKey): RgbaImage => {
  const bounds = findOpaqueBounds(image);
  if (bounds === null) return image;
  const rgba = new Uint8Array(image.rgba);
  const cutoff = bounds.top + Math.floor((bounds.bottom - bounds.top) * (key === "wheat_farm" ? 0.3 : 0.5));
  for (let y = bounds.top; y < bounds.bottom; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const index = byteIndex(image.dimensions, x, y);
      if (rgba[index + 3] !== 255) continue;
      if (key === "wheat_farm" && y >= cutoff) setRampColour(rgba, index, "earth");
      if (key !== "wheat_farm" && y < cutoff) setRampColour(rgba, index, ROOF_RAMPS[key]);
    }
  }
  return { dimensions: image.dimensions, rgba };
};

export const enforceFoliageMaterialPolicy = (image: RgbaImage): RgbaImage => {
  const rgba = new Uint8Array(image.rgba);
  for (let index = 0; index < rgba.length; index += 4) {
    if (rgba[index + 3] !== 255) continue;
    const key = `${rgba[index]},${rgba[index + 1]},${rgba[index + 2]}`;
    if (RAMP_BY_RGB.get(key)?.name !== "timber") setRampColour(rgba, index, "foliage");
  }
  return { dimensions: image.dimensions, rgba };
};

const enforceFieldStoneMaterialPolicy = (image: RgbaImage): RgbaImage => {
  const rgba = new Uint8Array(image.rgba);
  for (let index = 0; index < rgba.length; index += 4) {
    if (rgba[index + 3] !== 255) continue;
    const key = `${rgba[index]},${rgba[index + 1]},${rgba[index + 2]}`;
    const ramp = RAMP_BY_RGB.get(key)?.name;
    if (ramp !== "earth") setRampColour(rgba, index, "stone");
  }
  return { dimensions: image.dimensions, rgba };
};

const enforceLeafyGroundCoverMaterialPolicy = (image: RgbaImage): RgbaImage => {
  const rgba = new Uint8Array(image.rgba);
  for (let index = 0; index < rgba.length; index += 4) {
    if (rgba[index + 3] === 255) setRampColour(rgba, index, "foliage");
  }
  return { dimensions: image.dimensions, rgba };
};

export const enforceWorldMaterialPolicy = (image: RgbaImage, key: WorldSpriteKey): RgbaImage =>
  isBuildingSpriteKey(key)
    ? enforceBuildingMaterialPolicy(image, key)
    : key === "field_stone"
      ? enforceFieldStoneMaterialPolicy(image)
      : key === "shrub_a" || key === "shrub_b" || key === "grass_tuft"
        ? enforceLeafyGroundCoverMaterialPolicy(image)
      : enforceFoliageMaterialPolicy(image);

export const processWorldSprite = (
  source: RgbaImage,
  key: WorldSpriteKey,
  resize?: (image: RgbaImage, target: Dimensions) => RgbaImage,
): RgbaImage => {
  const contract = worldSpriteContract(key);
  const buildingContract = isBuildingSpriteKey(key) ? BUILDING_SPRITE_CONTRACTS[key] : undefined;
  const contentWidth = buildingContract === undefined
    ? undefined
    : Math.min(buildingContract.width - 2, buildingContract.footprint === 1 ? 88 : 139);
  const options = {
    target: { width: contract.width, height: contract.height },
    baselineY: contract.baselineY,
    chromaKey: DEFAULT_CHROMA_KEY,
    threshold: 24,
    softEdge: 96,
    outline: true,
    ...(contentWidth === undefined ? {} : { contentWidth }),
  };
  const processed = resize === undefined
    ? processSpriteImage(source, options)
    : processSpriteImage(source, options, resize);
  return enforceWorldMaterialPolicy(processed, key);
};

const assertDimensionsAndBaseline = (image: RgbaImage, key: WorldSpriteKey): void => {
  const contract = worldSpriteContract(key);
  if (image.dimensions.width !== contract.width || image.dimensions.height !== contract.height) {
    throw new Error(`${key} must be ${contract.width}x${contract.height}`);
  }
  for (let y = contract.baselineY + 1; y < contract.height; y += 1) {
    for (let x = 0; x < contract.width; x += 1) {
      if (image.rgba[byteIndex(image.dimensions, x, y) + 3] !== 0) {
        throw new Error(`${key} has an opaque pixel below baseline ${contract.baselineY}`);
      }
    }
  }
};

const exteriorMask = (image: RgbaImage): Uint8Array => {
  const mask = new Uint8Array(image.dimensions.width * image.dimensions.height);
  const queue: Array<readonly [number, number]> = [];
  const enqueue = (x: number, y: number): void => {
    const offset = y * image.dimensions.width + x;
    if (mask[offset] === 1 || image.rgba[byteIndex(image.dimensions, x, y) + 3] === 255) return;
    mask[offset] = 1;
    queue.push([x, y]);
  };
  for (let x = 0; x < image.dimensions.width; x += 1) {
    enqueue(x, 0);
    enqueue(x, image.dimensions.height - 1);
  }
  for (let y = 0; y < image.dimensions.height; y += 1) {
    enqueue(0, y);
    enqueue(image.dimensions.width - 1, y);
  }
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const point = queue[cursor];
    if (point === undefined) continue;
    for (const [dx, dy] of [[0, -1], [-1, 0], [1, 0], [0, 1]] as const) {
      const x = point[0] + dx;
      const y = point[1] + dy;
      if (x >= 0 && x < image.dimensions.width && y >= 0 && y < image.dimensions.height) enqueue(x, y);
    }
  }
  return mask;
};

const assertAlphaPolicy = (image: RgbaImage, key: WorldSpriteKey): void => {
  const interior = { dimensions: image.dimensions, rgba: new Uint8Array(image.rgba) };
  for (let index = 0; index < interior.rgba.length; index += 4) {
    if (interior.rgba[index + 3] !== 255) interior.rgba[index + 3] = 0;
  }
  const bounds = findOpaqueBounds(interior);
  if (bounds === null) throw new Error(`${key} has no opaque interior`);
  const lowerThird = bounds.top + Math.floor((bounds.bottom - bounds.top) * 2 / 3);
  const exterior = exteriorMask(image);
  for (let y = 0; y < image.dimensions.height; y += 1) {
    for (let x = 0; x < image.dimensions.width; x += 1) {
      const index = byteIndex(image.dimensions, x, y);
      const alpha = image.rgba[index + 3];
      if (alpha !== 0 && alpha !== 255 && alpha !== OUTLINE_ALPHA) throw new Error(`${key} has unsupported alpha ${String(alpha)}`);
      if (alpha !== OUTLINE_ALPHA) continue;
      const colour = `${image.rgba[index]},${image.rgba[index + 1]},${image.rgba[index + 2]}`;
      if (colour !== INK_KEY) throw new Error(`${key} outline must use ink at alpha ${OUTLINE_ALPHA}`);
      if (y >= lowerThird) throw new Error(`${key} has outline in the lower third`);
      if (exterior[y * image.dimensions.width + x] !== 1) throw new Error(`${key} outlines an interior hole`);
    }
  }
};

const assertVisibleWidth = (image: RgbaImage, key: BuildingSpriteKey): void => {
  const bounds = findOpaqueBounds(image);
  if (bounds === null) throw new Error(`${key} has no visible mass`);
  const contract = BUILDING_SPRITE_CONTRACTS[key];
  const band = contract.footprint === 1 ? [64, 90] as const : [115, 141] as const;
  const width = bounds.right - bounds.left;
  if (width < band[0] || width > band[1]) throw new Error(`${key} visible width ${width}px is outside ${band[0]}..${band[1]}`);
};

export const assertBuildingRoofPolicy = (image: RgbaImage, key: Exclude<BuildingSpriteKey, "wheat_farm">): void => {
  const bounds = findOpaqueBounds(image);
  if (bounds === null) throw new Error(`${key} has no visible mass`);
  const cutoff = bounds.top + Math.floor((bounds.bottom - bounds.top) * 0.5);
  const expected = ROOF_RAMPS[key];
  for (let y = bounds.top; y < cutoff; y += 1) {
    for (let x = bounds.left; x < bounds.right; x += 1) {
      const index = byteIndex(image.dimensions, x, y);
      if (image.rgba[index + 3] !== 255) continue;
      const colour = `${image.rgba[index]},${image.rgba[index + 1]},${image.rgba[index + 2]}`;
      if (RAMP_BY_RGB.get(colour)?.name !== expected) throw new Error(`${key} violates ${expected} roof policy`);
    }
  }
};

export const assertWheatFieldDominance = (image: RgbaImage): number => {
  let visible = 0;
  let earth = 0;
  for (let index = 0; index < image.rgba.length; index += 4) {
    if (image.rgba[index + 3] !== 255) continue;
    visible += 1;
    const colour = `${image.rgba[index]},${image.rgba[index + 1]},${image.rgba[index + 2]}`;
    if (RAMP_BY_RGB.get(colour)?.name === "earth") earth += 1;
  }
  const proportion = visible === 0 ? 0 : earth / visible;
  if (proportion <= 0.55) throw new Error(`wheat_farm earth ramp must dominate, got ${proportion.toFixed(3)}`);
  return proportion;
};

const assertFoliageMaterials = (image: RgbaImage, key: FoliageSpriteKey): void => {
  for (let index = 0; index < image.rgba.length; index += 4) {
    if (image.rgba[index + 3] !== 255) continue;
    const colour = `${image.rgba[index]},${image.rgba[index + 1]},${image.rgba[index + 2]}`;
    const ramp = RAMP_BY_RGB.get(colour)?.name;
    const foliageOnly = key === "shrub_a" || key === "shrub_b" || key === "grass_tuft";
    const allowed = key === "field_stone"
      ? ramp === "stone" || ramp === "earth"
      : foliageOnly ? ramp === "foliage" : ramp === "foliage" || ramp === "timber";
    if (!allowed) {
      const policy = key === "field_stone" ? "stone or earth" : foliageOnly ? "foliage-only" : "foliage or timber";
      throw new Error(`${key} interior must use ${policy} interior colours`);
    }
    if (colour === INK_KEY) throw new Error(`${key} ink is allowed only at alpha ${OUTLINE_ALPHA}`);
  }
};

export const assertGroundCoverSilhouette = (
  image: RgbaImage,
  key: "shrub_a" | "shrub_b",
): void => {
  const bounds = findOpaqueBounds(image);
  if (bounds === null) throw new Error(`${key} has no visible mass`);
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  if (width <= height) throw new Error(`${key} silhouette must be wider than tall`);
};

export const assertSpriteContract = (image: RgbaImage, key: WorldSpriteKey): void => {
  assertDimensionsAndBaseline(image, key);
  assertAlphaPolicy(image, key);
  if (isBuildingSpriteKey(key)) {
    assertVisibleWidth(image, key);
    if (key === "wheat_farm") assertWheatFieldDominance(image);
    else assertBuildingRoofPolicy(image, key);
    return;
  }
  assertFoliageMaterials(image, key);
  if (key === "shrub_a" || key === "shrub_b") assertGroundCoverSilhouette(image, key);
};

type HouseProgression = Readonly<Record<"house_l0" | "house_l1" | "house_l2" | "house_l3", RgbaImage>>;

export const assertHouseHeightProgression = (houses: HouseProgression): readonly number[] => {
  const keys = ["house_l0", "house_l1", "house_l2", "house_l3"] as const;
  const heights = keys.map((key) => {
    const bounds = findOpaqueBounds(houses[key]);
    if (bounds === null) throw new Error(`${key} has no visible mass`);
    return bounds.bottom - bounds.top;
  });
  if (heights.some((height, index) => index > 0 && height <= (heights[index - 1] ?? 0))) {
    throw new Error(`house bbox heights must strictly increase: ${heights.join(",")}`);
  }
  return heights;
};
