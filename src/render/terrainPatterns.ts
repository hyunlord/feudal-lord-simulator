import type { TerrainType } from "../content/terrainConfig";
import {
  getSprite,
  spriteMeta,
  type AssetMeta,
  type LoadStatus,
} from "./worldAssets";

export const TERRAIN_TEXTURE_KEYS = [
  "grass",
  "forest_floor",
  "water",
  "rock",
  "packed_earth_road",
] as const;

export type TerrainTextureKey = (typeof TERRAIN_TEXTURE_KEYS)[number];

export type TerrainPatternMeta = Pick<AssetMeta, "status"> & {
  readonly key: TerrainTextureKey;
  readonly category: "terrain";
};

export type TerrainPatternAssets = {
  readonly meta: (key: TerrainTextureKey) => TerrainPatternMeta | null;
  readonly sprite: (key: TerrainTextureKey) => CanvasImageSource | null;
};

type PatternCacheEntry = {
  readonly image: CanvasImageSource;
  readonly patterns: Map<"base" | 0 | 1 | 2 | 3, CanvasPattern>;
};

export type PatternQuarterTurn = 0 | 1 | 2 | 3;

const TERRAIN_TO_TEXTURE = {
  grass: "grass",
  forest: "forest_floor",
  water: "water",
  rock: "rock",
} as const satisfies Readonly<Record<TerrainType, TerrainTextureKey>>;

const patternCache = new WeakMap<
  CanvasRenderingContext2D,
  Map<TerrainTextureKey, PatternCacheEntry>
>();

const worldAssetTerrainPatterns: TerrainPatternAssets = {
  meta: (key) => {
    const meta = spriteMeta(key);
    if (meta === null || meta.category !== "terrain" || !isLoadStatus(meta.status)) return null;
    return { key, category: "terrain", status: meta.status };
  },
  sprite: (key) => getSprite(key),
};

export function terrainTextureKeyFor(terrain: TerrainType): TerrainTextureKey {
  return TERRAIN_TO_TEXTURE[terrain];
}

export function terrainPatternQuarterTurn(
  key: TerrainTextureKey,
  tx: number,
  ty: number,
  seed: number,
): PatternQuarterTurn {
  const regionTx = Math.floor(tx / 8);
  const regionTy = Math.floor(ty / 8);
  let hash = Math.imul(regionTx + 40_961, 73_856_093) ^ Math.imul(regionTy + 73_121, 19_349_663);
  hash ^= Math.imul(seed + 101_111, 83_492_791);
  hash ^= materialSalt(key);
  hash = Math.imul(hash ^ (hash >>> 13), 1_274_126_177);
  return ((hash ^ (hash >>> 16)) >>> 0 & 3) as PatternQuarterTurn;
}

export function getTerrainPattern(
  context: CanvasRenderingContext2D,
  key: TerrainTextureKey,
  assets: TerrainPatternAssets = worldAssetTerrainPatterns,
  quarterTurn?: PatternQuarterTurn,
): CanvasPattern | null {
  const meta = assets.meta(key);
  if (meta?.status !== "ready") return null;
  const image = assets.sprite(key);
  if (image === null) return null;

  const cache = cacheForContext(context);
  const cached = cache.get(key);
  const variant = quarterTurn ?? "base";
  if (cached !== undefined && cached.image === image) {
    const cachedPattern = cached.patterns.get(variant);
    if (cachedPattern !== undefined) return cachedPattern;
  }

  const pattern = context.createPattern(image, "repeat");
  if (pattern === null) return null;
  if (quarterTurn !== undefined) pattern.setTransform(patternTransform(quarterTurn));
  const patterns = cached?.image === image ? cached.patterns : new Map();
  patterns.set(variant, pattern);
  cache.set(key, { image, patterns });
  return pattern;
}

function patternTransform(turn: PatternQuarterTurn): DOMMatrix2DInit {
  switch (turn) {
    case 0: return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    case 1: return { a: 0, b: 1, c: -1, d: 0, e: 256, f: 0 };
    case 2: return { a: -1, b: 0, c: 0, d: -1, e: 256, f: 256 };
    case 3: return { a: 0, b: -1, c: 1, d: 0, e: 0, f: 256 };
  }
}

function cacheForContext(
  context: CanvasRenderingContext2D,
): Map<TerrainTextureKey, PatternCacheEntry> {
  const existing = patternCache.get(context);
  if (existing !== undefined) return existing;
  const created = new Map<TerrainTextureKey, PatternCacheEntry>();
  patternCache.set(context, created);
  return created;
}

function isLoadStatus(value: string): value is LoadStatus {
  return value === "idle" || value === "loading" || value === "ready" || value === "missing";
}

function materialSalt(key: TerrainTextureKey): number {
  switch (key) {
    case "grass": return 0;
    case "forest_floor": return 1_001;
    case "water": return 2_003;
    case "rock": return 3_007;
    case "packed_earth_road": return 4_009;
  }
}
