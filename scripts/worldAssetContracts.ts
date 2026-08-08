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

export const STONE_TOWN_ASSET_KEYS = [
  "quarry",
  "masonry",
  "market",
  "church",
  "keep",
  "house_l4",
  "stone_wall_segment",
] as const;

export const FOLIAGE_KEYS = [
  "tree_oak_large",
  "tree_oak_small",
  "tree_pine_tall",
  "tree_pine_short",
  "tree_birch",
  "tree_dead",
  "stump_fresh",
  "stump_old",
  "shrub_a",
  "shrub_b",
  "grass_tuft",
  "field_stone",
] as const;

export const TREE_STUMP_KEYS = [
  "tree_oak_large",
  "tree_oak_small",
  "tree_pine_tall",
  "tree_pine_short",
  "tree_birch",
  "tree_dead",
  "stump_fresh",
  "stump_old",
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
export type StoneTownAssetKey = (typeof STONE_TOWN_ASSET_KEYS)[number];
export type FoliageKey = (typeof FOLIAGE_KEYS)[number];
export type TerrainKey = (typeof TERRAIN_KEYS)[number];
export type TreeStumpKey = (typeof TREE_STUMP_KEYS)[number];
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

export const ACCEPTED_REFERENCE_KEYS = ["house_03", "mill_02", "granary_08"] as const;
export type AcceptedReferenceKey = (typeof ACCEPTED_REFERENCE_KEYS)[number];

const oneByOne = { width: 1, height: 1 } as const;
const twoByTwo = { width: 2, height: 2 } as const;
const wallFootprint = { width: 0, height: 0 } as const;

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

export const STONE_TOWN_ASSET_CANDIDATE_COUNT = 6;

export type StoneTownGenerationContract = SpriteSpec & {
  readonly form: string;
  readonly referenceKeys: readonly AcceptedReferenceKey[];
  readonly lighting: "upper-left";
  readonly background: "transparent";
  readonly camera: "exact-2:1-isometric";
  readonly palette: "canonical-muted";
  readonly shadow: "no-baked-shadow";
};

export const STONE_TOWN_ASSET_SPECS = {
  quarry: { width: 160, height: 120, baselineY: 104, footprint: twoByTwo },
  masonry: { width: 112, height: 120, baselineY: 104, footprint: oneByOne },
  market: { width: 176, height: 136, baselineY: 120, footprint: twoByTwo },
  church: { width: 176, height: 208, baselineY: 192, footprint: twoByTwo },
  keep: { width: 176, height: 232, baselineY: 216, footprint: twoByTwo },
  house_l4: { width: 112, height: 160, baselineY: 144, footprint: oneByOne },
  stone_wall_segment: { width: 96, height: 80, baselineY: 80, footprint: wallFootprint },
} as const satisfies Readonly<Record<StoneTownAssetKey, SpriteSpec>>;

export const STONE_TOWN_ASSET_GENERATION_CONTRACTS = {
  quarry: {
    ...STONE_TOWN_ASSET_SPECS.quarry,
    form: "an open cut into a rock face, cut blocks stacked on pallets, a timber crane frame, loose rubble",
    referenceKeys: ACCEPTED_REFERENCE_KEYS,
    lighting: "upper-left",
    background: "transparent",
    camera: "exact-2:1-isometric",
    palette: "canonical-muted",
    shadow: "no-baked-shadow",
  },
  masonry: {
    ...STONE_TOWN_ASSET_SPECS.masonry,
    form: "a low workshop with an open working face, dressed blocks and a mason's banker outside, stone dust",
    referenceKeys: ACCEPTED_REFERENCE_KEYS,
    lighting: "upper-left",
    background: "transparent",
    camera: "exact-2:1-isometric",
    palette: "canonical-muted",
    shadow: "no-baked-shadow",
  },
  market: {
    ...STONE_TOWN_ASSET_SPECS.market,
    form: "an open timber-framed hall, wide shingle roof on posts, trestle tables and cloth awnings beneath, no walls",
    referenceKeys: ACCEPTED_REFERENCE_KEYS,
    lighting: "upper-left",
    background: "transparent",
    camera: "exact-2:1-isometric",
    palette: "canonical-muted",
    shadow: "no-baked-shadow",
  },
  church: {
    ...STONE_TOWN_ASSET_SPECS.church,
    form: "a small stone church, steep slate roof, square bell tower at one end, arched windows",
    referenceKeys: ACCEPTED_REFERENCE_KEYS,
    lighting: "upper-left",
    background: "transparent",
    camera: "exact-2:1-isometric",
    palette: "canonical-muted",
    shadow: "no-baked-shadow",
  },
  keep: {
    ...STONE_TOWN_ASSET_SPECS.keep,
    form: "a square stone tower house, crenellated parapet, slit windows, stone forebuilding at its base",
    referenceKeys: ACCEPTED_REFERENCE_KEYS,
    lighting: "upper-left",
    background: "transparent",
    camera: "exact-2:1-isometric",
    palette: "canonical-muted",
    shadow: "no-baked-shadow",
  },
  house_l4: {
    ...STONE_TOWN_ASSET_SPECS.house_l4,
    form: "a tall stone townhouse, three storeys, slate roof, shuttered windows, shop front at street level",
    referenceKeys: ACCEPTED_REFERENCE_KEYS,
    lighting: "upper-left",
    background: "transparent",
    camera: "exact-2:1-isometric",
    palette: "canonical-muted",
    shadow: "no-baked-shadow",
  },
  stone_wall_segment: {
    ...STONE_TOWN_ASSET_SPECS.stone_wall_segment,
    form: "dressed stone curtain wall with crenellated top, matching the palisade segment footprint",
    referenceKeys: ACCEPTED_REFERENCE_KEYS,
    lighting: "upper-left",
    background: "transparent",
    camera: "exact-2:1-isometric",
    palette: "canonical-muted",
    shadow: "no-baked-shadow",
  },
} as const satisfies Readonly<Record<StoneTownAssetKey, StoneTownGenerationContract>>;

export const FOLIAGE_SPECS = {
  tree_oak_large: { width: 88, height: 112, baselineY: 112, footprint: oneByOne },
  tree_oak_small: { width: 64, height: 80, baselineY: 80, footprint: oneByOne },
  tree_pine_tall: { width: 64, height: 120, baselineY: 120, footprint: oneByOne },
  tree_pine_short: { width: 56, height: 88, baselineY: 88, footprint: oneByOne },
  tree_birch: { width: 60, height: 96, baselineY: 96, footprint: oneByOne },
  tree_dead: { width: 56, height: 80, baselineY: 80, footprint: oneByOne },
  stump_fresh: { width: 40, height: 24, baselineY: 24, footprint: oneByOne },
  stump_old: { width: 36, height: 20, baselineY: 20, footprint: oneByOne },
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

export type Sha256 = string;

export type AcceptedReference = Dimensions & {
  readonly key: AcceptedReferenceKey;
  readonly path: string;
  readonly sha256: Sha256;
};

export const FOLIAGE_CANDIDATE_COUNT = 8;

export type CandidateChecks = Dimensions & {
  readonly sha256: Sha256;
  readonly palette: true;
  readonly alpha: true;
  readonly transparentBackground: true;
  readonly bakedGroundShadowAbsent: true;
};

export type SelectionRubric = {
  readonly trunkGroundContact: 0 | 1 | 2;
  readonly silhouette: 0 | 1 | 2;
  readonly lightingVariation: 0 | 1 | 2;
  readonly referenceStyle: 0 | 1 | 2;
  readonly total: number;
};

export type FoliageCandidate = CandidateChecks & {
  readonly candidate: number;
  readonly seed: number;
  readonly path: string;
  readonly selected: boolean;
  readonly hardRejected: boolean;
  readonly rubric: SelectionRubric;
};

export type FoliageSelection = {
  readonly key: TreeStumpKey;
  readonly selectedCandidate: number;
  readonly candidates: readonly FoliageCandidate[];
  readonly tieBreak: "lowest-seed";
};

export type ParchmentCandidateMetrics = Dimensions & {
  readonly candidate: number;
  readonly path: string;
  readonly sha256: Sha256;
  readonly opposingEdgesByteCompatible: boolean;
  readonly joinBandMaxDelta: number;
  readonly internalBandMaxDelta: number;
  readonly blockLumaRange: number;
  readonly blockLumaStandardDeviation: number;
  readonly passed: boolean;
};

export type ParchmentMetrics = {
  readonly decision: "flat-token" | "generated-texture";
  readonly thresholds: {
    readonly joinBandMaxDelta: 24;
    readonly joinToInternalRatio: 2;
    readonly internalTolerance: 4;
    readonly blockLumaRangeMax: 16;
    readonly blockLumaStandardDeviationMin: 1;
    readonly blockLumaStandardDeviationMax: 8;
  };
  readonly candidates: readonly ParchmentCandidateMetrics[];
};

type BaseAsset<Key extends WorldAssetKey, Category extends string> = {
  readonly key: Key;
  readonly category: Category;
  readonly path: string;
  readonly sha256: Sha256;
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
  readonly scale: { readonly min: 0.7; readonly max: 1.3 };
  readonly offset: "in-tile";
  readonly sway: "sine";
};

export type FoliageAsset = BaseAsset<FoliageKey, "foliage"> & {
  readonly palettePolicy: "foliage-timber" | "stone-earth";
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
  readonly acceptedReferences: readonly AcceptedReference[];
  readonly foliageSelections: readonly FoliageSelection[];
  readonly parchmentMetrics: ParchmentMetrics;
  readonly assets: readonly WorldAsset[];
};
