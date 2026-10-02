import { SEMANTIC_PALETTE } from "../content/palette";
import { boundsOf, type BoundaryPoint } from "../world/boundary/boundaryGeometry";
import { cellContourLoops } from "../world/boundary/cellContours";
import type { Tile } from "../world/world.types";
import type { LandGround } from "./archetypeGroundModel";
import { landWarp, regionLoopHash, regionPart, smoothRegionLoop, type ChunkRegion, type FillRegion } from "./archetypeGroundRegions";
import { ROCK_WARP_SCALE } from "./landRegionWarp";
import type { GroundChunkPlan } from "./groundSceneParts";
import { tileToScreen } from "./iso";
import { getTerrainPattern, TERRAIN_TEXTURE_COMPOSITE_OPACITY, type TerrainPatternAssets } from "./terrainPatterns";

// NAT-5 (QA-039): on a land the rock was its tiles' diamonds — each with its own light / dark variation and the 8 x 8
// blocks' quarter turns of the texture — clipped out of the land fill, with the riverside's ink-outlined pebble marks
// (drawTerrainSeams.ts rockPebbles: 2-3 small stroked diamonds on every grass edge of a rock tile) repeating along the
// staircase: the small black squares. On a land the rock tiles are now laid as the ground around them (the fill or the
// meadow; groundTileAs), and the rock is one region over the fills, outlined as the fills are (marching squares, Chaikin,
// the land's warp at ROCK_WARP_SCALE: archetypeGroundRegions.ts smoothRegionLoop), filled with the rock texture (Wave 41's ENV-07 rework,
// public/assets/terrain/rock.png) unturned over the rock colour (the tile pass's 0.6 texture over the colour), once
// ROCK_RIM tiles wider at ROCK_RIM_ALPHA first, so the rock's edge fades into the ground instead of a cut line. No
// pebble marks on a land (drawGroundChunk). NAT-5 decision N5-D1: the riverside's rock too (riversideRock.ts), though its other ground stays as it was (LU-D2).
// Cached on the land layer with the fill regions (the terrain is in its key) and per chunk.

/** What the rock region reads: a land's ground, or (NAT-5, decision N5-D1) the riverside's rock-only ground (riversideRock.ts). */
export type RockGround = Pick<LandGround, "width" | "height" | "seed" | "drained" | "rock"> & { readonly cache: Pick<LandGround["cache"], "rock" | "rockChunks"> };

/** How far the soft rim reaches past the outline (tiles), and its alpha. */
export const ROCK_RIM = 0.18;
export const ROCK_RIM_ALPHA = 0.45;
type ScreenBox = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

/** The land's rock as one region (no strips; beyond the map is not rock). */
export function rockRegion(land: RockGround): FillRegion {
  if (land.cache.rock !== undefined) return land.cache.rock;
  const field = landWarp(land, ROCK_WARP_SCALE);
  const loops = cellContourLoops({ width: land.width, height: land.height, inside: (tx, ty) => land.rock[ty * land.width + tx] === 1, outside: false })
    .map(loop => {
      const smoothed = smoothRegionLoop(field, loop);
      return { smoothed, bounds: boundsOf(smoothed, 0.5 + ROCK_RIM), hash: regionLoopHash(loop, smoothed, []), strips: smoothed.map(() => null) };
    });
  const region: FillRegion = { base: "rock", outside: false, loops };
  land.cache.rock = region;
  return region;
}

/** The rock a chunk draws, or null (cached per chunk on the layer). */
export function chunkRock(land: RockGround, plan: GroundChunkPlan): ChunkRegion | null {
  const id = plan.cy * 4096 + plan.cx;
  const cached = land.cache.rockChunks.get(id);
  if (cached !== undefined) return cached;
  const part = regionPart(rockRegion(land), plan);
  land.cache.rockChunks.set(id, part);
  return part;
}

/** The tile as the land's diamond pass lays it: forest, water and (NAT-5) rock as grass; their own outlines paint over. */
export function groundTileAs(tile: Tile, land: RockGround | null): Tile {
  return tile.terrain === "forest" || tile.terrain === "water" || (land !== null && tile.terrain === "rock") ? { ...tile, terrain: "grass" } : tile;
}

/** The rock over a chunk's land fills: the soft rim, then the rock. Returns the fills drawn. */
export function drawLandRock(context: CanvasRenderingContext2D, land: RockGround, plan: GroundChunkPlan, box: ScreenBox, patterns?: TerrainPatternAssets): number {
  const part = chunkRock(land, plan);
  if (part === null) return 0;
  const pattern = getTerrainPattern(context, "rock", patterns);
  const previousAlpha = context.globalAlpha;
  let fills = 0;
  for (const [reach, alpha] of [[ROCK_RIM, ROCK_RIM_ALPHA], [0, 1]] as const) {
    traceRock(context, part, box, reach);
    context.globalAlpha = previousAlpha * alpha;
    context.fillStyle = SEMANTIC_PALETTE.stone;
    context.fill("evenodd"); fills += 1;
    if (pattern !== null) {
      context.globalAlpha = previousAlpha * alpha * TERRAIN_TEXTURE_COMPOSITE_OPACITY;
      context.fillStyle = pattern;
      context.fill("evenodd"); fills += 1;
    }
  }
  context.globalAlpha = previousAlpha;
  return fills;
}

/** Traces the chunk's rock loops pushed `reach` tiles outward (the rock lies left of travel), plus the box when inside. */
function traceRock(context: CanvasRenderingContext2D, part: ChunkRegion, box: ScreenBox, reach: number): void {
  context.beginPath();
  for (const index of part.loops) {
    const line = part.region.loops[index]?.smoothed ?? [];
    outward(line, reach).forEach((point, at) => { const s = tileToScreen(point.x, point.y); if (at === 0) context.moveTo(s.sx, s.sy); else context.lineTo(s.sx, s.sy); });
    context.closePath();
  }
  if (part.parity) { context.moveTo(box.left, box.top); context.lineTo(box.right, box.top); context.lineTo(box.right, box.bottom); context.lineTo(box.left, box.bottom); context.closePath(); }
}

/** A closed line moved `reach` along its right-hand vertex normals (-t.y, t.x), y down. */
function outward(line: readonly BoundaryPoint[], reach: number): readonly BoundaryPoint[] {
  if (reach === 0) return line;
  const count = line.length;
  const normal = (index: number): BoundaryPoint => {
    const a = line[(index + count) % count]!; const b = line[(index + 1) % count]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
  };
  return line.map((point, index) => {
    const p = normal(index - 1); const q = normal(index);
    const length = Math.hypot(p.x + q.x, p.y + q.y) || 1;
    return { x: point.x + (p.x + q.x) / length * reach, y: point.y + (p.y + q.y) / length * reach };
  });
}
