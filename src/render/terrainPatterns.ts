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
  readonly pattern: CanvasPattern;
};

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

export function getTerrainPattern(
  context: CanvasRenderingContext2D,
  key: TerrainTextureKey,
  assets: TerrainPatternAssets = worldAssetTerrainPatterns,
): CanvasPattern | null {
  const meta = assets.meta(key);
  if (meta?.status !== "ready") return null;
  const image = assets.sprite(key);
  if (image === null) return null;

  const cache = cacheForContext(context);
  const cached = cache.get(key);
  if (cached !== undefined && cached.image === image) return cached.pattern;

  const pattern = context.createPattern(image, "repeat");
  if (pattern === null) return null;
  cache.set(key, { image, pattern });
  return pattern;
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
