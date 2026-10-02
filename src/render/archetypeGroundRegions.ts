import { boundsOf, chaikinClosed, hashNumbers, type BoundaryBounds, type BoundaryPoint } from "../world/boundary/boundaryGeometry";
import { cellContourLoops, type CellContourLoop } from "../world/boundary/cellContours";
import { BOUNDARY_CHAIKIN_ROUNDS } from "../world/boundary/terrainBoundaries";
import { chunkTileBounds, overlaps, pointInPolygon, type GroundChunkPlan } from "./groundSceneParts";
import { STRIP_FAMILIES, type LandGround, type StripFamily } from "./archetypeGroundModel";
import { FOREST_EDGE_FAMILY, FOREST_EDGE_FILL, stripFamilyInstalled } from "./landEdgeBand";
import { WARP_VERSION, distanceToCells, warpLine, type WarpField } from "./landRegionWarp";

// LAND-UI: each land fill as smoothed regions, the way the forest and the water are outlined (marching squares over the
// tile centres, then Chaikin, terrainBoundaries.ts), so a fill meets the meadow on a curve and not on the tile
// staircase. A fill's mask is its own tiles plus the tiles that are not open ground (rock, forest, water: fill 0) in
// the same 4-connected piece (beyond the map is one more such tile, joined to every edge tile), so its outline runs only
// where it meets another open fill — under the forest and the water their own outlines decide, and the rock tiles are
// clipped out at draw time (they keep today's tile edge) — and a lake out in the meadow is no part of it (its piece
// holds none of the fill's own tiles). Each smoothed segment carries the transition strip that
// runs along it: the named side (the strip's bottom) is the fill against the meadow, the heath against the chalk; none
// against a drained cell (the drainage art draws that edge, LU-D5), none for the woodland floor (Wave 22 has no edge;
// NAT-4 / LU-D11: Wave 41's forest edge strip takes it while installed — landEdgeBand.ts).
// NAT-5 (QA-040, vision TOP10 #5 / #10): the smoothed outline is then warped (landRegionWarp.ts), so it no longer runs
// along the tile grid; the strips follow the warped line. The rock (landRockRegions.ts) is outlined the same way.
// Cached on the land layer (its cache key is the layer's: archetypeGroundModel.ts) and per chunk.

export type RegionLoop = { readonly smoothed: readonly BoundaryPoint[]; readonly bounds: BoundaryBounds; readonly hash: number;
  /** Per smoothed segment (point k to k + 1): its transition strip, or null. */
  readonly strips: readonly (StripFamily | null)[] };
/** `outside`: beyond the map is in the region, so a point no loop encloses lies inside. */
export type FillRegion = { readonly base: string; readonly outside: boolean; readonly loops: readonly RegionLoop[] };
/** A region as one chunk draws it: the loops that reach it, and whether it otherwise lies inside. */
export type ChunkRegion = { readonly region: FillRegion; readonly loops: readonly number[]; readonly parity: boolean };

export const EDGE_OF: Readonly<Record<string, StripFamily>> = { chalk_down: "boundary/chalk_edge", heath: "boundary/heath_edge", fen: "boundary/fen_edge", coastal_grass: "boundary/coastal_edge",
  ...(stripFamilyInstalled(FOREST_EDGE_FAMILY) ? { [FOREST_EDGE_FILL]: FOREST_EDGE_FAMILY } : {}) };

export function fillRegions(land: LandGround): readonly FillRegion[] {
  if (land.cache.regions !== undefined) return land.cache.regions;
  const bases = [...new Set(land.fillBase.filter((base): base is string => base !== null))].sort();
  const regions = bases.map(base => regionOf(land, base));
  land.cache.regions = regions;
  return regions;
}

function regionOf(land: LandGround, base: string): FillRegion {
  const own = (index: number) => land.fillBase[land.fill[index]!] === base;
  const { mask, outside } = regionMask(land, own);
  const field = landWarp(land, 1);
  const loops = cellContourLoops({ width: land.width, height: land.height, inside: (tx, ty) => mask[ty * land.width + tx] === 1, outside })
    .map(loop => {
      const smoothed = smoothRegionLoop(field, loop);
      const count = loop.points.length;
      // Chaikin's two rounds give 4 points per contour edge; segments 4v - 3 … 4v lie around contour vertex v (the
      // midpoint of one tile edge: its inside cell and, across it, its outside cell).
      const byVertex = loop.points.map((point, vertex) => {
        const cell = loop.insideCells[vertex]!;
        const out = { tx: 2 * point.x - cell.tx, ty: 2 * point.y - cell.ty };
        if (!own(cell.ty * land.width + cell.tx) || out.tx < 0 || out.ty < 0 || out.tx >= land.width || out.ty >= land.height) return null;
        const outside = out.ty * land.width + out.tx;
        if (land.fill[outside] === 0 || land.drained[outside] === 1) return null;
        if (base === "heath") return EDGE_OF.heath ?? null;
        return land.fillBase[land.fill[outside]!] === "heath" ? null : EDGE_OF[base] ?? null;
      });
      const strips = smoothed.map((_, segment) => byVertex[Math.floor((segment + 3) / 4) % count] ?? null);
      return { smoothed, bounds: boundsOf(smoothed, 0.5), hash: regionLoopHash(loop, smoothed, strips.map(strip => (strip === null ? 0 : STRIP_FAMILIES.indexOf(strip) + 1))), strips };
    });
  return { base, outside, loops };
}

/** The land's warp at `scale` (1 for the fills), pinned at its drained cells (landRegionWarp.ts). */
export function landWarp(land: Pick<LandGround, "seed" | "width" | "height" | "drained">, scale: number): WarpField {
  const pinned = distanceToCells(land.width, land.height, land.drained);
  return { seed: land.seed, width: land.width, height: land.height, scale, ...(pinned === undefined ? {} : { pinned }) };
}

/** A contour loop as a region draws it: Chaikin, then the warp. */
export function smoothRegionLoop(field: WarpField, loop: CellContourLoop): BoundaryPoint[] {
  return warpLine(field, chaikinClosed(loop.points, BOUNDARY_CHAIKIN_ROUNDS));
}

/**
 * A region loop's hash: its contour, the warp's version, its per-segment strips and the warped points themselves
 * (1/64 tile), which carry the seed and every drained cell near the loop (a drain elsewhere moves it without a contour change).
 */
export function regionLoopHash(loop: CellContourLoop, smoothed: readonly BoundaryPoint[], strips: readonly number[]): number {
  return hashNumbers([loop.hash, WARP_VERSION, ...strips, ...smoothed.flatMap(point => [Math.round(point.x * 64), Math.round(point.y * 64)])]);
}

/** The fill's own tiles and the 4-connected pieces of own-or-closed tiles that hold one (beyond the map: piece 0). */
function regionMask(land: LandGround, own: (index: number) => boolean): { readonly mask: Uint8Array; readonly outside: boolean } {
  const { width, height } = land;
  const candidate = (index: number) => land.fill[index] === 0 || own(index);
  const piece = new Int32Array(width * height).fill(-1);
  const keep: boolean[] = [];
  const flood = (seeds: readonly number[], id: number): void => {
    const queue = [...seeds]; let found = false;
    for (const seed of seeds) piece[seed] = id;
    for (let head = 0; head < queue.length; head += 1) {
      const index = queue[head]!;
      if (own(index)) found = true;
      const tx = index % width, ty = Math.floor(index / width);
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
        const x = tx + dx, y = ty + dy;
        if (x < 0 || y < 0 || x >= width || y >= height) continue;
        const next = y * width + x;
        if (piece[next] === -1 && candidate(next)) { piece[next] = id; queue.push(next); }
      }
    }
    keep[id] = found;
  };
  const edge: number[] = [];
  for (let index = 0; index < width * height; index += 1) {
    const tx = index % width, ty = Math.floor(index / width);
    if ((tx === 0 || ty === 0 || tx === width - 1 || ty === height - 1) && candidate(index)) edge.push(index);
  }
  flood(edge, 0);
  for (let index = 0; index < width * height; index += 1) if (piece[index] === -1 && candidate(index)) flood([index], keep.length);
  const mask = new Uint8Array(width * height);
  for (let index = 0; index < mask.length; index += 1) if (piece[index]! >= 0 && keep[piece[index]!] === true) mask[index] = 1;
  return { mask, outside: keep[0] === true };
}

/** The regions a chunk draws (cached per chunk on the layer). */
export function chunkRegions(land: LandGround, plan: GroundChunkPlan): readonly ChunkRegion[] {
  const id = plan.cy * 4096 + plan.cx;
  const cached = land.cache.chunks.get(id);
  if (cached !== undefined) return cached;
  const found = fillRegions(land).map(region => regionPart(region, plan)).filter((part): part is ChunkRegion => part !== null);
  land.cache.chunks.set(id, found);
  return found;
}

/** The part of a region a chunk draws: the loops that reach it and its parity, or null when it draws none. */
export function regionPart(region: FillRegion, plan: GroundChunkPlan): ChunkRegion | null {
  const tiles = chunkTileBounds(plan.cx, plan.cy);
  const box = { left: tiles.left - 1.5, top: tiles.top - 1.5, right: tiles.right + 1.5, bottom: tiles.bottom + 1.5 };
  const centre = { x: (tiles.left + tiles.right) / 2, y: (tiles.top + tiles.bottom) / 2 };
  const loops = region.loops.flatMap((loop, index) => (overlaps(loop.bounds, box) ? [index] : []));
  // With beyond the map inside (`outside`), a point no loop encloses lies in the region: inside = an even count then.
  const parity = (region.loops.filter((loop, index) => !loops.includes(index) && pointInPolygon(centre, loop.smoothed)).length % 2 === 0) === region.outside;
  return loops.length > 0 || parity ? { region, loops, parity } : null;
}
