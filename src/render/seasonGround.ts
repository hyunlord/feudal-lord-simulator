import type { Tile } from "../world/world.types";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { seasonArtReadiness, seasonImage, seasonVariant, seasonVariants, type SeasonIndex, type SeasonKey } from "./seasonArt";

// INSTALL-15 seasonal ground in the V2 ground chunks: autumn and winter lay the Wave 15 grass fill (world-aligned,
// 256x128 source = 2x2 tiles, like the zone floors) over the grass diamonds, before the forest, water, zones and
// fields paint over it; rock keeps its own texture. At SEASON_GRASS_ALPHA the summer grain still shows through faintly.
export const SEASON_GRASS_ALPHA = 0.9;
// Wave 15 bases the ground chunks draw (grass fill, fringe and grass-edge decals, pasture and soil floors, the fallow
// ridge); their variants' readiness is part of the chunk key, so a chunk re-rasters once its season art has loaded.
const CHUNK_BASES = new Set(["grass", "forest_fringe_a", "forest_fringe_b", "forest_fringe_c", "grass_edge", "pasture_fill",
  "pasture_fill_b", "pasture_fill_c", "soil_a", "soil_b", "ridge_fallow_a", "ridge_fallow_b"]);
const chunkKeys = new Map<SeasonIndex, readonly SeasonKey[]>();

/**
 * The season part of a ground or road chunk's content key: empty in summer (the chunk keys are the pre-INSTALL-15
 * keys), else the season and its chunk art's readiness. It is left out of the deferKey, so a season change may be
 * spread over a few frames like a zone edit (groundChunkCache header (b)).
 */
export function seasonChunkToken(season: SeasonIndex): string {
  if (season === 1) return "";
  let keys = chunkKeys.get(season);
  if (keys === undefined) {
    keys = seasonVariants(season).filter(key => CHUNK_BASES.has(baseOfVariant(key)));
    chunkKeys.set(season, keys);
  }
  return `|s${season}:${seasonArtReadiness(keys)}`;
}

function baseOfVariant(key: SeasonKey): string {
  for (const base of CHUNK_BASES) for (const season of [0, 2, 3] as const) if (seasonVariant(base, season) === key) return base;
  return "";
}

const patterns = new WeakMap<CanvasRenderingContext2D, Map<CanvasImageSource, CanvasPattern | null>>();

export function drawSeasonGrass(context: CanvasRenderingContext2D, tiles: readonly Tile[], season: SeasonIndex): void {
  const variant = seasonVariant("grass", season);
  const image = variant === null ? null : seasonImage(variant);
  if (image === null || typeof context.createPattern !== "function") return;
  let map = patterns.get(context);
  if (map === undefined) { map = new Map(); patterns.set(context, map); }
  if (!map.has(image)) map.set(image, context.createPattern(image, "repeat"));
  const pattern = map.get(image) ?? null;
  if (pattern === null) return;
  pattern.setTransform({ a: 0.5, b: 0, c: 0, d: 0.5, e: 0, f: 0 });
  context.beginPath();
  for (const tile of tiles) {
    if (tile.terrain === "rock") continue;
    const centre = tileToScreen(tile.tx, tile.ty);
    context.moveTo(centre.sx, centre.sy - TILE_H / 2); context.lineTo(centre.sx + TILE_W / 2, centre.sy);
    context.lineTo(centre.sx, centre.sy + TILE_H / 2); context.lineTo(centre.sx - TILE_W / 2, centre.sy);
    context.closePath();
  }
  const previousAlpha = context.globalAlpha;
  context.globalAlpha = previousAlpha * SEASON_GRASS_ALPHA;
  context.fillStyle = pattern;
  context.fill();
  context.globalAlpha = previousAlpha;
}
