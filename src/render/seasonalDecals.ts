import type { GameState } from "../engine/engine.types";
import type { Tile } from "../world/world.types";
import { seasonBlend } from "./seasonTransition";
import { hashNumbers } from "../world/boundary/boundaryGeometry";
import { TILE_H, tileToScreen } from "./iso";
import { drawWave7, type Wave7Key } from "./wave7Art";
import { drawWave9, type Wave9Key } from "./wave9Art";
import { wetSummer } from "./wetSummer";
import { palisadeScreenPath } from "./palisadeRenderGeometry";
import { drawSeasonArt, type SeasonKey } from "./seasonArt";
import type { RenderQueueItem } from "./objectRenderTypes";
import { ZONE_VARIANTS } from "./zoneAssetManifest";

// INSTALL-7 season on the ground (Wave 7 decals): winter frost patches, autumn leaves, high-summer dry grass on open
// grass tiles (no building, road or zone paint underneath is excluded by the tile fields), a deterministic scatter:
// a tile carries a decal when its seeded hash falls under DENSITY, and the hash picks the variant. Spring has none,
// so the frost is gone when spring comes. Drawn in the ground pass over the cached terrain; nothing is stored.
// LOD: from DECAL_MIN_ZOOM (below it a 20 px patch is noise on the map).
// INSTALL-15 adds the Wave 15 decals on the same scatter (spring flowers, winter ice), drifts at the foot of fences
// and petals under the orchard trees in spring.
export const DECAL_DENSITY = 0.07;
export const DECAL_MIN_ZOOM = 0.6;
const DECAL_SCALE = 0.5;
const BY_SEASON: Readonly<Record<1 | 2 | 3, readonly Wave7Key[]>> = {
  1: ["dry_grass_a", "dry_grass_b"],
  2: ["leaves_a", "leaves_b", "leaves_c"],
  3: ["frost_patch_a", "frost_patch_b", "frost_patch_c"],
};

/** The decal a tile carries this season (null: none). Pure in (seed, tile, season). */
export function seasonalDecal(seed: number, tile: Pick<Tile, "tx" | "ty" | "terrain" | "buildingId" | "hasRoad">, season: 0 | 1 | 2 | 3): Wave7Key | null {
  if (season === 0 || tile.terrain !== "grass" || tile.buildingId !== null || tile.hasRoad) return null;
  const hash = hashNumbers([seed, tile.tx, tile.ty, 7_107]);
  if ((hash % 10_000) / 10_000 >= DECAL_DENSITY) return null;
  const keys = BY_SEASON[season];
  return keys[Math.floor(hash / 10_000) % keys.length]!;
}

// INSTALL-15 hash (not the curved-ground module's: these decals also draw with RENDER_BOUNDARY_V2 off).
const mix = (...values: readonly number[]): number => {
  let hash = 2_166_136_261;
  for (const value of values) { hash ^= Math.round(value); hash = Math.imul(hash, 16_777_619); hash ^= hash >>> 13; }
  return hash >>> 0;
};

/**
 * INSTALL-15 (Wave 15), a scatter of its own at the same density: spring flowers, and in winter a frozen puddle on
 * one tile in four of it (drawn instead of any frost there). Pure in (seed, tile, season).
 */
export function wave15GroundDecal(seed: number, tile: Pick<Tile, "tx" | "ty" | "terrain" | "buildingId" | "hasRoad">, season: 0 | 1 | 2 | 3): SeasonKey | null {
  if (season === 1 || season === 2 || tile.terrain !== "grass" || tile.buildingId !== null || tile.hasRoad) return null;
  const hash = mix(seed, tile.tx, tile.ty, 15_107);
  if ((hash % 10_000) / 10_000 >= DECAL_DENSITY) return null;
  const pick = Math.floor(hash / 10_000);
  if (season === 0) return pick % 2 === 0 ? "spring_flowers_a" : "spring_flowers_b";
  return pick % 4 === 0 ? "puddle_ice" : null;
}

/**
 * INSTALL-15 snow drifts along the foot of a fence in winter: at every second tile edge of a finished palisade
 * segment (by the edge's hash) and under every second yard hurdle, drift a or b. Orchard petals: in spring each zone
 * orchard tree drops a petal patch at its foot. Pure in (seed, the palisade, the props on screen).
 */
export function fenceDriftSpots(state: Pick<GameState, "seed" | "palisade">, items: readonly RenderQueueItem[]): readonly { readonly x: number; readonly y: number; readonly key: SeasonKey }[] {
  const spots: { x: number; y: number; key: SeasonKey }[] = [];
  const pick = (hash: number): SeasonKey => (Math.floor(hash / 2) % 2 === 0 ? "snow_drift_a" : "snow_drift_b");
  for (const segment of state.palisade?.segments ?? []) {
    if (!segment.completed) continue;
    const points = palisadeScreenPath(segment.edgePath);
    for (let index = 1; index < points.length; index += 1) {
      const a = points[index - 1]!; const b = points[index]!;
      const hash = mix(state.seed, a.x + b.x, a.y + b.y, 15_203);
      if (hash % 2 === 0) spots.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, key: pick(hash) });
    }
  }
  for (const item of items) {
    if (item.kind !== "zone_prop" || !item.prop.kind.startsWith("hurdle_")) continue;
    const hash = mix(state.seed, item.prop.x * 8, item.prop.y * 8, 15_211);
    if (hash % 2 === 0) { const at = tileToScreen(item.prop.x, item.prop.y); spots.push({ x: at.sx, y: at.sy, key: pick(hash) }); }
  }
  return spots;
}
const ORCHARD_TREES = new Set<string>(ZONE_VARIANTS.orchardTree);
const DRIFT_SCALE = 0.5;

/** UI-4: in a wet summer the dry-grass tiles hold puddles instead (Wave 9, the same scatter). */
const PUDDLES: readonly Wave9Key[] = ["decal_puddle_a", "decal_puddle_b"];

export function drawSeasonalDecals(context: CanvasRenderingContext2D, state: GameState, tiles: readonly Tile[], zoom: number, items: readonly RenderQueueItem[] = []): void {
  if (zoom < DECAL_MIN_ZOOM) return;
  // INSTALL-15: while the season turns, the old season's decals fade out as the new ones fade in (seasonBlend).
  const blend = seasonBlend(state);
  if (blend.from === null) { drawDecalsOf(context, state, tiles, items, blend.season); return; }
  const alpha = context.globalAlpha;
  context.globalAlpha = alpha * (1 - blend.t); drawDecalsOf(context, state, tiles, items, blend.from);
  context.globalAlpha = alpha * blend.t; drawDecalsOf(context, state, tiles, items, blend.season);
  context.globalAlpha = alpha;
}

function drawDecalsOf(context: CanvasRenderingContext2D, state: GameState, tiles: readonly Tile[], items: readonly RenderQueueItem[], season: 0 | 1 | 2 | 3): void {
  if (season === 0) {
    for (const tile of tiles) {
      const key = wave15GroundDecal(state.seed, tile, season);
      if (key === null) continue;
      const at = tileToScreen(tile.tx, tile.ty);
      drawSeasonArt(context, key, at.sx, at.sy + TILE_H * 0.35, DECAL_SCALE);
    }
    for (const item of items) {
      if (item.kind !== "zone_prop" || !ORCHARD_TREES.has(item.prop.kind)) continue;
      const at = tileToScreen(item.prop.x, item.prop.y);
      drawSeasonArt(context, "orchard_spring_petals", at.sx, at.sy, DECAL_SCALE * item.prop.scale);
    }
    return;
  }
  if (season === 1 && wetSummer(state)) {
    for (const tile of tiles) {
      const key = seasonalDecal(state.seed, tile, season);
      if (key === null) continue;
      const at = tileToScreen(tile.tx, tile.ty);
      drawWave9(context, PUDDLES[key === "dry_grass_a" ? 0 : 1]!, at.sx, at.sy + TILE_H * 0.35, DECAL_SCALE);
    }
    return;
  }
  for (const tile of tiles) {
    const at = tileToScreen(tile.tx, tile.ty);
    const ice = season === 3 ? wave15GroundDecal(state.seed, tile, season) : null;
    if (ice !== null && drawSeasonArt(context, ice, at.sx, at.sy + TILE_H * 0.35, DECAL_SCALE)) continue;
    const key = seasonalDecal(state.seed, tile, season);
    if (key !== null) drawWave7(context, key, at.sx, at.sy + TILE_H * 0.35, DECAL_SCALE);
  }
  if (season === 3) for (const spot of fenceDriftSpots(state, items)) drawSeasonArt(context, spot.key, spot.x, spot.y, DRIFT_SCALE);
}
