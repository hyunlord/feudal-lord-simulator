import type { GameState } from "../engine/engine.types";
import type { Tile } from "../world/world.types";
import { stateCalendar } from "../engine/scenarioState";
import { hashNumbers } from "../world/boundary/boundaryGeometry";
import { TILE_H, tileToScreen } from "./iso";
import { drawWave7, type Wave7Key } from "./wave7Art";

// INSTALL-7 season on the ground (Wave 7 decals): winter frost patches, autumn leaves, high-summer dry grass on open
// grass tiles (no building, road or zone paint underneath is excluded by the tile fields), a deterministic scatter:
// a tile carries a decal when its seeded hash falls under DENSITY, and the hash picks the variant. Spring has none,
// so the frost is gone when spring comes. Drawn in the ground pass over the cached terrain; nothing is stored.
// LOD: from DECAL_MIN_ZOOM (below it a 20 px patch is noise on the map).
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

export function drawSeasonalDecals(context: CanvasRenderingContext2D, state: GameState, tiles: readonly Tile[], zoom: number): void {
  if (zoom < DECAL_MIN_ZOOM) return;
  const season = stateCalendar(state).season;
  if (season === 0) return;
  for (const tile of tiles) {
    const key = seasonalDecal(state.seed, tile, season);
    if (key === null) continue;
    const at = tileToScreen(tile.tx, tile.ty);
    drawWave7(context, key, at.sx, at.sy + TILE_H * 0.35, DECAL_SCALE);
  }
}
