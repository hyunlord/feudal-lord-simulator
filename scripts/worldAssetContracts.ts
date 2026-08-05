export const BUILDING_KEYS = [
  "house_l0",
  "house_l1",
  "house_l2",
  "house_l3",
  "mill",
  "barn",
  "well",
  "storehouse",
  "wheat_farm",
  "logging_camp",
  "sawmill",
] as const;

export const FOLIAGE_KEYS = [
  "tree_conifer_a",
  "tree_conifer_b",
  "tree_broadleaf_a",
  "tree_broadleaf_b",
  "shrub_a",
  "shrub_b",
  "grass_tuft",
  "field_stone",
] as const;

export const TERRAIN_KEYS = [
  "grass",
  "forest_floor",
  "water",
  "rock",
  "packed_earth_road",
] as const;

export const WORLD_ASSET_KEYS = [
  ...BUILDING_KEYS,
  ...FOLIAGE_KEYS,
  ...TERRAIN_KEYS,
] as const;

export type BuildingKey = (typeof BUILDING_KEYS)[number];
export type FoliageKey = (typeof FOLIAGE_KEYS)[number];
export type TerrainKey = (typeof TERRAIN_KEYS)[number];
export type WorldAssetKey = (typeof WORLD_ASSET_KEYS)[number];

export type Dimensions = {
  readonly width: number;
  readonly height: number;
};

export type Footprint = Dimensions;

export type SpriteSpec = Dimensions & {
  readonly baselineY: number;
  readonly footprint: Footprint;
};

export type TerrainPalettePolicy =
  | "terrain-foliage-earth"
  | "terrain-foliage-earth-timber"
  | "terrain-water"
  | "terrain-stone-slate"
  | "terrain-earth-timber";

export type TerrainSpec = Dimensions & {
  readonly footprint: Footprint;
  readonly palettePolicy: TerrainPalettePolicy;
};

const oneByOne = { width: 1, height: 1 } as const;
const twoByTwo = { width: 2, height: 2 } as const;

export const BUILDING_SPECS = {
  house_l0: { width: 96, height: 112, baselineY: 96, footprint: oneByOne },
  house_l1: { width: 96, height: 120, baselineY: 104, footprint: oneByOne },
  house_l2: { width: 96, height: 144, baselineY: 128, footprint: oneByOne },
  house_l3: { width: 160, height: 192, baselineY: 176, footprint: twoByTwo },
  mill: { width: 96, height: 160, baselineY: 144, footprint: oneByOne },
  barn: { width: 160, height: 144, baselineY: 128, footprint: twoByTwo },
  well: { width: 72, height: 80, baselineY: 64, footprint: oneByOne },
  storehouse: { width: 160, height: 136, baselineY: 120, footprint: twoByTwo },
  wheat_farm: { width: 160, height: 96, baselineY: 80, footprint: twoByTwo },
  logging_camp: { width: 96, height: 104, baselineY: 88, footprint: oneByOne },
  sawmill: { width: 112, height: 112, baselineY: 96, footprint: oneByOne },
} as const satisfies Readonly<Record<BuildingKey, SpriteSpec>>;

export const FOLIAGE_SPECS = {
  tree_conifer_a: { width: 64, height: 96, baselineY: 96, footprint: oneByOne },
  tree_conifer_b: { width: 56, height: 80, baselineY: 80, footprint: oneByOne },
  tree_broadleaf_a: { width: 72, height: 88, baselineY: 88, footprint: oneByOne },
  tree_broadleaf_b: { width: 64, height: 72, baselineY: 72, footprint: oneByOne },
  shrub_a: { width: 40, height: 28, baselineY: 28, footprint: oneByOne },
  shrub_b: { width: 32, height: 22, baselineY: 22, footprint: oneByOne },
  grass_tuft: { width: 28, height: 18, baselineY: 18, footprint: oneByOne },
  field_stone: { width: 24, height: 16, baselineY: 16, footprint: oneByOne },
} as const satisfies Readonly<Record<FoliageKey, SpriteSpec>>;

export const TERRAIN_SPECS = {
  grass: { width: 256, height: 256, footprint: oneByOne, palettePolicy: "terrain-foliage-earth" },
  forest_floor: {
    width: 256,
    height: 256,
    footprint: oneByOne,
    palettePolicy: "terrain-foliage-earth-timber",
  },
  water: { width: 256, height: 256, footprint: oneByOne, palettePolicy: "terrain-water" },
  rock: { width: 256, height: 256, footprint: oneByOne, palettePolicy: "terrain-stone-slate" },
  packed_earth_road: {
    width: 256,
    height: 256,
    footprint: oneByOne,
    palettePolicy: "terrain-earth-timber",
  },
} as const satisfies Readonly<Record<TerrainKey, TerrainSpec>>;

export type Anchor = {
  readonly x: number;
  readonly y: number;
};

export type AssetSource = {
  readonly seed: number;
  readonly candidate: number;
};

type BaseAsset<Key extends WorldAssetKey, Category extends string> = {
  readonly key: Key;
  readonly category: Category;
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly anchor: Anchor;
  readonly footprint: Footprint;
  readonly source: AssetSource;
};

export type BuildingAsset = BaseAsset<BuildingKey, "building"> & {
  readonly palettePolicy: "canonical-building";
  readonly alphaPolicy: "transparent-outline-179";
};

export type FoliageVariation = {
  readonly selection: "hash";
  readonly scale: { readonly min: 0.75; readonly max: 1.25 };
  readonly offset: "in-tile";
  readonly sway: "sine";
};

export type FoliageAsset = BaseAsset<FoliageKey, "foliage"> & {
  readonly palettePolicy: "foliage-timber";
  readonly alphaPolicy: "transparent-outline-179";
  readonly variation: FoliageVariation;
};

export type TerrainSeamMetrics = {
  readonly horizontalJoinDelta: number;
  readonly verticalJoinDelta: number;
  readonly horizontalInternalDelta: number;
  readonly verticalInternalDelta: number;
  readonly threshold: number;
  readonly passed: true;
};

export type TerrainAsset = BaseAsset<TerrainKey, "terrain"> & {
  readonly palettePolicy: TerrainPalettePolicy;
  readonly alphaPolicy: "opaque";
  readonly seamMetrics: TerrainSeamMetrics;
};

export type WorldAsset = BuildingAsset | FoliageAsset | TerrainAsset;

export type WorldAssetManifest = {
  readonly version: 1;
  readonly assets: readonly WorldAsset[];
};
