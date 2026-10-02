import { SEMANTIC_PALETTE } from "../content/palette";
import type { GameState } from "../engine/engine.types";
import { boundsOf, hashNumbers, type BoundaryPoint } from "../world/boundary/boundaryGeometry";
import { cellContourLoops } from "../world/boundary/cellContours";
import type { Tile } from "../world/world.types";
import { landGroundOf, type LandGround } from "./archetypeGroundModel";
import { landWarp, regionLoopHash, smoothRegionLoop, type ChunkRegion, type FillRegion } from "./archetypeGroundRegions";
import { ROCK_WARP_SCALE } from "./landRegionWarp";
import { chunkTileBounds, pointInPolygon, type GroundChunkPlan } from "./groundSceneParts";
import { tileToScreen } from "./iso";
import { getTerrainPattern, TERRAIN_TEXTURE_COMPOSITE_OPACITY, type TerrainPatternAssets } from "./terrainPatterns";

// NAT-5 (QA-039; N5-D1: every land, the riverside too): the rock was its tiles' diamonds — each with its own light /
// dark variation and the 8 x 8 blocks' quarter turns of the texture — (on a new land clipped out of the land fill), with
// ink-outlined pebble marks (drawTerrainSeams.ts rockPebbles: 2-3 small stroked diamonds on every grass edge of a rock
// tile) repeating along the staircase: the small black squares. The rock tiles are now laid as the ground around them
// (groundTileAs: the grass, under a new land's fill), and the rock is one region over the ground, outlined as the land
// fills are (marching squares, Chaikin, the land's warp at ROCK_WARP_SCALE: archetypeGroundRegions.ts smoothRegionLoop),
// filled with the rock texture (Wave 41's ENV-07 rework, public/assets/terrain/rock.png) unturned over the rock colour
// (the tile pass's 0.6 texture over the colour), once ROCK_RIM tiles wider at ROCK_RIM_ALPHA first, so the rock's edge
// fades into the ground instead of a cut line. No pebble marks (drawGroundChunk).
// Cache (AGENTS rule 10): a new land's rock lives on its land layer (archetypeGroundModel.ts: the terrain is in that
// key). The riverside has no land layer: (a) its rock ground is keyed on the tiles array identity, then on the seed, the
// map size and the rock cells' hash (a road or a building is a new tiles array with the same rock); (b) nothing else
// enters (no drained cells on the riverside); (c) the contours and the warp are a few ms, every chunk raster reads them.
// Per chunk, the part a chunk draws is cached; its loops' hashes are the chunk content key's rock token (rockChunkToken),
// empty for a chunk the rock does not reach, so those chunks keep their keys.

/** How far the soft rim reaches past the outline (tiles), and its alpha. */
export const ROCK_RIM = 0.18;
export const ROCK_RIM_ALPHA = 0.45;
type ScreenBox = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

/** What the rock reads of a map: a land layer has all of it; the riverside gets its own (rockGroundOf). */
export type RockGround = Pick<LandGround, "seed" | "width" | "height" | "rock" | "drained"> & {
  readonly cache: { rock?: FillRegion; readonly rockChunks: Map<number, ChunkRegion | null> };
};

let riverside: { readonly tiles: readonly Tile[]; readonly hash: number; readonly ground: RockGround } | null = null;

/** The map's rock ground: the land layer on a new land, else the riverside's (cached as the header says). */
export function rockGroundOf(state: GameState): RockGround {
  const land = landGroundOf(state);
  if (land !== null) return land;
  if (riverside !== null && riverside.tiles === state.tiles) return riverside.ground;
  const rock = Uint8Array.from(state.tiles, tile => (tile.terrain === "rock" ? 1 : 0));
  const hash = hashNumbers([state.seed, state.width, state.height, ...rock]);
  if (riverside !== null && riverside.hash === hash) { riverside = { tiles: state.tiles, hash, ground: riverside.ground }; return riverside.ground; }
  const ground: RockGround = { seed: state.seed, width: state.width, height: state.height, rock, drained: new Uint8Array(rock.length), cache: { rockChunks: new Map() } };
  riverside = { tiles: state.tiles, hash, ground };
  return ground;
}

/** The map's rock as one region (no strips; beyond the map is not rock). */
export function rockRegion(ground: RockGround): FillRegion {
  if (ground.cache.rock !== undefined) return ground.cache.rock;
  const field = landWarp(ground, ROCK_WARP_SCALE);
  const loops = cellContourLoops({ width: ground.width, height: ground.height, inside: (tx, ty) => ground.rock[ty * ground.width + tx] === 1, outside: false })
    .map(loop => {
      const smoothed = smoothRegionLoop(field, loop);
      return { smoothed, bounds: boundsOf(smoothed, 0.5 + ROCK_RIM), hash: regionLoopHash(loop, smoothed, []), strips: smoothed.map(() => null) };
    });
  const region: FillRegion = { base: "rock", outside: false, loops };
  ground.cache.rock = region;
  return region;
}

/** How near (tiles) a rock outline point must come to a chunk's tiles for the chunk to draw that loop (the rim, a segment). */
const ROCK_REACH = 1.5;

/**
 * The rock a chunk draws, or null (cached per chunk): the loops with a point within ROCK_REACH of its tiles — not every
 * loop whose box overlaps it, so a chunk the rock does not reach keeps its key and its picture — and its parity.
 */
export function chunkRock(ground: RockGround, plan: GroundChunkPlan): ChunkRegion | null {
  const id = plan.cy * 4096 + plan.cx;
  const cached = ground.cache.rockChunks.get(id);
  if (cached !== undefined) return cached;
  const region = rockRegion(ground);
  const tiles = chunkTileBounds(plan.cx, plan.cy);
  const near = (point: BoundaryPoint) => point.x >= tiles.left - ROCK_REACH && point.x <= tiles.right + ROCK_REACH && point.y >= tiles.top - ROCK_REACH && point.y <= tiles.bottom + ROCK_REACH;
  const loops = region.loops.flatMap((loop, index) => (loop.smoothed.some(near) ? [index] : []));
  const centre = { x: (tiles.left + tiles.right) / 2, y: (tiles.top + tiles.bottom) / 2 };
  const parity = region.loops.filter((loop, index) => !loops.includes(index) && pointInPolygon(centre, loop.smoothed)).length % 2 === 1;
  const part = loops.length > 0 || parity ? { region, loops, parity } : null;
  ground.cache.rockChunks.set(id, part);
  return part;
}

/** The chunk content key's rock part: its loops' hashes and parity, or "" where the rock does not reach. */
export function rockChunkToken(ground: RockGround, plan: GroundChunkPlan): string {
  const part = chunkRock(ground, plan);
  return part === null ? "" : `|R${hashNumbers([part.parity ? 1 : 0, ...part.loops.map(index => part.region.loops[index]?.hash ?? 0)])}`;
}

/** The tile as the diamond pass lays it: forest, water and (NAT-5) rock as grass; their own outlines paint over. */
export function groundTileAs(tile: Tile): Tile {
  return tile.terrain === "forest" || tile.terrain === "water" || tile.terrain === "rock" ? { ...tile, terrain: "grass" } : tile;
}

/** The rock over a chunk's ground: the soft rim, then the rock. Returns the fills drawn. */
export function drawLandRock(context: CanvasRenderingContext2D, ground: RockGround, plan: GroundChunkPlan, box: ScreenBox, patterns?: TerrainPatternAssets): number {
  const part = chunkRock(ground, plan);
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
