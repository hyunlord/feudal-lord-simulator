import type { BoundaryBounds, BoundaryPoint } from "../world/boundary/boundaryGeometry";
import type { Shoreline } from "../world/boundary/shoreline";
import type { Tile } from "../world/world.types";
import { hashSeed } from "../content/seedHash";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { manifestArt } from "./manifestArt";
import { EDGE_BAND_WIDEN, stripImage } from "./landEdgeBand";
import { wallStripsEnabled } from "./renderWallStripsFlag";
import type { SeasonIndex } from "./seasonArt";
import { WAVE22_GROUND_IMAGES, type Wave22GroundKey } from "./wave22GroundManifest.generated";
import { GROUND_CHUNK_TILES, TILE_RING, chunkTileBounds, type GroundChunkPlan } from "./groundSceneParts";
import { chunkHash, fillArtKey, fillVariant, isWaterStrip, landArtKeys, landStripLoops, loopStrips, type LandGround, type StripFamily } from "./archetypeGroundModel";
import { chunkRegions, type ChunkRegion } from "./archetypeGroundRegions";
import type { ShoreStripOverride } from "./drawShoreline";

// LAND-UI: a land's Wave 22 ground in the V2 ground chunks (drawTerrainBoundaryV2 drawGroundChunk; the layer and its
// keys: archetypeGroundModel.ts). Art loads on its first draw (manifestArt), never in the startup preload.
//  1. Fills, after the grass diamonds (kept under them, so a fill's antialiased edge never shows the empty raster): per
//     fill one path of its tiles with pattern a, then one path of its b blocks with pattern b — two fills per fill
//     kind and chunk, not one per tile. The 256 x 128 source covers a 2 x 2 tile block in the tile plane (the proof's
//     UV: the 256-unit world square, then the iso projection), origin on a block corner, so a / b switch on repeats.
//  2. Transition strips (boundary/*_edge, 512 x 64, X-repeating; top = the meadow, bottom = the named ground,
//     records/strips-sources.json) on each tile edge where a land fill meets the meadow or the heath: flat in the tile
//     plane like the old shore strip (u = 128 source px per tile along the edge, from the edge's map coordinate so
//     collinear edges run on; v across, centred on the edge), a and b joined into one 1024 px repeat. LU-D11: laid
//     EDGE_BAND_WIDEN times wider across (a tile, not half) with their alpha feathered (landEdgeBand.ts).
//     Water-side bands are not laid on tile edges (3).
//  3. Shore and reed-bed strips (512 x 96, land on top, painted waterline at row 50 measured on all eight) carry their
//     own water, so on a loop whose land side has them (the coast's sea, the fen's water) they replace the old shore
//     strip (drawShoreline skips those loops) along the same smoothed line: a strip over the old one would draw two
//     waterlines and two mud fringes, and a strip on the tile staircase would not meet the smoothed water body.
//  4. Decals and props at their ground pivot (w / 2, h - 8), 0.5 world px per source px (records/README.md: 0.5 at zoom
//     1, 0.3 at zoom 0.6), on the chunk's tiles and a TILE_RING ring (the raster clips at the chunk), never on a road or
//     a building, in painter's order; driftwood and rock pools lean a third of a tile toward their sea.

const art = manifestArt<Wave22GroundKey>(WAVE22_GROUND_IMAGES);
const STRIP_WIDTH = 512;
const STRIP_JOIN_FADE = 48;
const PX_PER_TILE = 128;
const EDGE_HEIGHT = 64;
/** The painted waterline of the shore and reed strips (rows 47-56 measured; 50 is their middle). */
const WATERLINE_ROW = 50;
const WATER_STRIP_HEIGHT = 96;
const DECAL_SCALE = 0.5;
const NEIGHBOURS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;
type ScreenBox = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

/** The land's Wave 22 readiness in `season` (one bit per file it draws): part of the chunk content key. */
export function landArtReadiness(land: LandGround, season: SeasonIndex): string {
  preloadLandArt(land);
  // Asked for every chunk request of every frame: once all the season's files are ready the bits cannot change.
  const ready = land.cache.allReady.get(season);
  if (ready !== undefined) return ready;
  const bits = landArtKeys(land, season).map(key => (art.art(key) === null ? 0 : 1)).join("");
  if (!bits.includes("0")) land.cache.allReady.set(season, bits);
  return bits;
}

/**
 * Every season's land art starts loading on the land's first draw, as the Wave 15 grass does (preloadSeasonArt): the
 * staging before a season turn then finds the next season's files ready, so its rasters are made once and match the
 * turn's keys (before, each file landing during the staging moved the readiness bits and re-staged every chunk).
 */
function preloadLandArt(land: LandGround): void {
  if (land.cache.preloaded === true) return;
  for (const season of [0, 1, 2, 3] as const) for (const key of landArtKeys(land, season)) art.art(key);
  land.cache.preloaded = true;
}

/**
 * The land's part of a ground chunk's content key: the land, its layer's hash over the chunk and its ring (with the
 * shore strips of the chunk's loops), and the readiness of the land's art in `season` (the staging pass asks for the next
 * season, which also starts that season's files loading). The riverside has no land: its keys gain nothing.
 */
export function landChunkToken(land: LandGround, plan: GroundChunkPlan, shore: Shoreline, season: SeasonIndex): string {
  return `|L${land.id}:${chunkHash(land, plan, shore)}:${landArtReadiness(land, season)}`;
}

/** drawShoreline's override: the loops whose strip the land lays (3), and how. */
export function landShoreStrips(context: CanvasRenderingContext2D, land: LandGround, shore: Shoreline, loops: readonly number[], tileBounds: BoundaryBounds): ShoreStripOverride {
  return { loops: landStripLoops(land, shore, loops), draw: loop => { drawLandShoreStrips(context, land, shore, [loop], tileBounds); } };
}

/** True when the tile wears a land fill (no season grass, no code-drawn tufts there). */
export function hasLandFill(land: LandGround, tile: Tile): boolean {
  return land.fillBase[land.fill[tile.ty * land.width + tile.tx]!] !== null;
}

const patterns = new WeakMap<CanvasRenderingContext2D, Map<CanvasImageSource, CanvasPattern | null>>();
function patternOf(context: CanvasRenderingContext2D, image: CanvasImageSource): CanvasPattern | null {
  if (typeof context.createPattern !== "function") return null;
  let map = patterns.get(context);
  if (map === undefined) { map = new Map(); patterns.set(context, map); }
  if (!map.has(image)) map.set(image, context.createPattern(image, "repeat"));
  return map.get(image) ?? null;
}

function traceDiamond(context: CanvasRenderingContext2D, tile: Tile): void {
  const centre = tileToScreen(tile.tx, tile.ty);
  context.moveTo(centre.sx, centre.sy - TILE_H / 2); context.lineTo(centre.sx + TILE_W / 2, centre.sy);
  context.lineTo(centre.sx, centre.sy + TILE_H / 2); context.lineTo(centre.sx - TILE_W / 2, centre.sy);
  context.closePath();
}

/** Traces a chunk's part of a fill region (its loops, plus the chunk's box when the chunk lies inside): fill "evenodd". */
function traceRegion(context: CanvasRenderingContext2D, part: ChunkRegion, box: ScreenBox): void {
  context.beginPath();
  for (const index of part.loops) {
    const line = part.region.loops[index]?.smoothed ?? [];
    line.forEach((point, at) => { const s = tileToScreen(point.x, point.y); if (at === 0) context.moveTo(s.sx, s.sy); else context.lineTo(s.sx, s.sy); });
    context.closePath();
  }
  if (part.parity) { context.moveTo(box.left, box.top); context.lineTo(box.right, box.top); context.lineTo(box.right, box.bottom); context.lineTo(box.left, box.bottom); context.closePath(); }
}

/** 1. The land fills over the chunk's grass diamonds and season grass, clipped off its rock tiles. Returns the fill passes. */
export function drawLandFills(context: CanvasRenderingContext2D, land: LandGround, plan: GroundChunkPlan, tiles: readonly Tile[], box: ScreenBox, season: SeasonIndex): number {
  const parts = chunkRegions(land, plan);
  if (parts.length === 0) return 0;
  const rock = tiles.filter(tile => tile.terrain === "rock");
  const bounds = chunkTileBounds(plan.cx, plan.cy);
  let passes = 0;
  for (const part of parts) {
    for (const variant of ["a", "b"] as const) {
      const image = art.art(fillArtKey(part.region.base, season, variant));
      const pattern = image === null ? null : patternOf(context, image);
      if (pattern === null) continue;
      // Pattern px (u, v) -> tile (u / 128 - 0.5, v / 64 - 0.5) -> iso screen: 2 x 2 tiles per repeat, origin on a block corner.
      pattern.setTransform({ a: 0.25, b: 0.125, c: -0.5, d: 0.25, e: 0, f: -TILE_H / 2 });
      context.save();
      if (rock.length > 0) {
        context.beginPath();
        context.moveTo(box.left, box.top); context.lineTo(box.right, box.top); context.lineTo(box.right, box.bottom); context.lineTo(box.left, box.bottom); context.closePath();
        for (const tile of rock) traceDiamond(context, tile);
        context.clip("evenodd");
      }
      traceRegion(context, part, box);
      if (variant === "b") {
        // The b blocks inside the region: the region as the clip, then the blocks' 2 x 2 diamonds.
        context.clip("evenodd");
        context.beginPath();
        for (let by = Math.floor((bounds.top - 1) / 2); by <= Math.ceil((bounds.bottom + 1) / 2); by += 1) {
          for (let bx = Math.floor((bounds.left - 1) / 2); bx <= Math.ceil((bounds.right + 1) / 2); bx += 1) {
            if (fillVariant(land.seed, bx * 2, by * 2) === "b") traceBlock(context, bx, by);
          }
        }
        context.fillStyle = pattern;
        context.fill();
      } else {
        context.fillStyle = pattern;
        context.fill("evenodd");
      }
      context.restore();
      passes += 1;
    }
  }
  return passes;
}

function traceBlock(context: CanvasRenderingContext2D, bx: number, by: number): void {
  const corners = [[bx * 2 - 0.5, by * 2 - 0.5], [bx * 2 + 1.5, by * 2 - 0.5], [bx * 2 + 1.5, by * 2 + 1.5], [bx * 2 - 0.5, by * 2 + 1.5]] as const;
  corners.forEach(([x, y], at) => { const s = tileToScreen(x, y); if (at === 0) context.moveTo(s.sx, s.sy); else context.lineTo(s.sx, s.sy); });
  context.closePath();
}

type Vec = BoundaryPoint;
const iso = (v: Vec): Vec => ({ x: (v.x - v.y) * TILE_W / 2, y: (v.x + v.y) * TILE_H / 2 });

/** Fills the tile-plane quad `corners` with `pattern`, its px (u, v) mapped to tile `origin + uAxis u + vAxis v`. */
function fillStripQuad(context: CanvasRenderingContext2D, pattern: CanvasPattern, corners: readonly Vec[], origin: Vec, uAxis: Vec, vAxis: Vec): void {
  context.beginPath();
  corners.forEach((corner, at) => { const s = tileToScreen(corner.x, corner.y); if (at === 0) context.moveTo(s.sx, s.sy); else context.lineTo(s.sx, s.sy); });
  context.closePath();
  const u = iso(uAxis); const v = iso(vAxis); const base = tileToScreen(origin.x, origin.y);
  pattern.setTransform({ a: u.x, b: u.y, c: v.x, d: v.y, e: base.sx, f: base.sy });
  context.fillStyle = pattern;
  context.fill();
}

/** 2. Transition strips along the fill regions' smoothed outlines, where a fill meets the meadow or the heath. */
export function drawLandEdges(context: CanvasRenderingContext2D, land: LandGround, plan: GroundChunkPlan): number {
  const bounds = chunkTileBounds(plan.cx, plan.cy);
  let quads = 0;
  for (const part of chunkRegions(land, plan)) {
    for (const index of part.loops) {
      const loop = part.region.loops[index];
      if (loop === undefined) continue;
      // The inside (the named ground, the strip's bottom) lies left of travel (y down), so the top (the meadow) along
      // the right normal (-t.y, t.x).
      quads += drawLineStrip(context, loop.smoothed, loop.strips, bounds, { above: EDGE_HEIGHT / 2, below: EDGE_HEIGHT / 2, side: 1, widen: EDGE_BAND_WIDEN });
    }
  }
  return quads;
}

/**
 * Lays X-repeating strips along a closed smoothed line, one quad per segment whose family is set: texture u = arc length
 * (128 px per tile), v across with row `above` on the line, `above` rows to the top side and `below` to the bottom side,
 * `widen` times 1 / 128 tile per row; `side` +1 when the top lies along the normal (-t.y, t.x), -1 along (t.y, -t.x).
 */
function drawLineStrip(context: CanvasRenderingContext2D, line: readonly Vec[], families: readonly (StripFamily | null)[], bounds: BoundaryBounds,
  rows: { readonly above: number; readonly below: number; readonly side: 1 | -1; readonly widen: number }, skip?: (index: number) => boolean): number {
  const { above, below, side, widen } = rows;
  const count = line.length;
  const topNormal = (index: number): Vec => {
    const a = line[index % count] as Vec; const b = line[(index + 1) % count] as Vec;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / length * side, y: (b.x - a.x) / length * side };
  };
  const vertexNormal = (index: number): Vec => {
    const p = topNormal((index - 1 + count) % count); const q = topNormal(index);
    const length = Math.hypot(p.x + q.x, p.y + q.y) || 1;
    return { x: (p.x + q.x) / length, y: (p.y + q.y) / length };
  };
  const up = (above - 1) * widen / PX_PER_TILE; const down = (below - 1) * widen / PX_PER_TILE;
  let quads = 0; let arc = 0;
  for (let index = 0; index < count; index += 1) {
    const a = line[index] as Vec; const b = line[(index + 1) % count] as Vec;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const start = arc; arc += length;
    const family = families[index] ?? null;
    if (length === 0 || family === null || skip?.(index) === true) continue;
    if (Math.max(a.x, b.x) < bounds.left - 1.5 || Math.min(a.x, b.x) > bounds.right + 1.5
      || Math.max(a.y, b.y) < bounds.top - 1.5 || Math.min(a.y, b.y) > bounds.bottom + 1.5) continue;
    const image = stripImage(family, half => art.art(`${family}_${half}` as Wave22GroundKey), STRIP_JOIN_FADE, !isWaterStrip(family));
    const pattern = image === null ? null : patternOf(context, image);
    if (pattern === null) continue;
    const t = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const na = vertexNormal(index); const nb = vertexNormal(index + 1); const n = topNormal(index);
    const a0 = { x: a.x - t.x * 0.01, y: a.y - t.y * 0.01 }; const b0 = { x: b.x + t.x * 0.01, y: b.y + t.y * 0.01 };
    // Texture (u, v) -> tile: a + t (u - u0) / 128 - n widen (v - above) / 128 (the top side up).
    const u0 = (start * PX_PER_TILE) % (STRIP_WIDTH * 2);
    const uAxis = { x: t.x / PX_PER_TILE, y: t.y / PX_PER_TILE }; const vAxis = { x: -n.x * widen / PX_PER_TILE, y: -n.y * widen / PX_PER_TILE };
    const origin = { x: a.x - uAxis.x * u0 - vAxis.x * above, y: a.y - uAxis.y * u0 - vAxis.y * above };
    fillStripQuad(context, pattern, [
      { x: a0.x + na.x * up, y: a0.y + na.y * up }, { x: b0.x + nb.x * up, y: b0.y + nb.y * up },
      { x: b0.x - nb.x * down, y: b0.y - nb.y * down }, { x: a0.x - na.x * down, y: a0.y - na.y * down },
    ], origin, uAxis, vAxis);
    quads += 1;
  }
  return quads;
}

/** 3. Shore and reed-bed strips along the land's loops (drawShoreline leaves these loops' old strip out). */
export function drawLandShoreStrips(context: CanvasRenderingContext2D, land: LandGround, shore: Shoreline, loops: readonly number[], tileBounds: BoundaryBounds): number {
  const wallStrips = wallStripsEnabled();
  let quads = 0;
  for (const loopIndex of loops) {
    const strips = loopStrips(land, shore, loopIndex);
    const loop = shore.loops[loopIndex];
    if (strips === null || loop === undefined) continue;
    // Along a wall standing on the water the wall face is the edge (as the old strip, D3b).
    const walled = (index: number) => wallStrips && loop.walled[index] === true && loop.walled[(index + 1) % loop.walled.length] === true;
    quads += drawLineStrip(context, loop.smoothed, strips, tileBounds, { above: WATERLINE_ROW, below: WATER_STRIP_HEIGHT - WATERLINE_ROW - 1, side: loop.landSide, widen: 1 }, walled);
  }
  return quads;
}

/** 4. Decals and props of the chunk and its ring, in painter's order. Returns the number drawn. */
export function drawLandDecals(context: CanvasRenderingContext2D, land: LandGround, mapTiles: readonly Tile[], plan: GroundChunkPlan): number {
  const x0 = plan.cx * GROUND_CHUNK_TILES - TILE_RING; const y0 = plan.cy * GROUND_CHUNK_TILES - TILE_RING;
  const size = GROUND_CHUNK_TILES + TILE_RING * 2;
  let drawn = 0;
  for (let depth = 0; depth <= (size - 1) * 2; depth += 1) {
    for (let dx = Math.max(0, depth - size + 1); dx <= Math.min(size - 1, depth); dx += 1) {
      const tx = x0 + dx; const ty = y0 + depth - dx;
      if (tx < 0 || ty < 0 || tx >= land.width || ty >= land.height) continue;
      const index = ty * land.width + tx;
      const key = land.keys[land.decal[index]!];
      const tile = mapTiles[index];
      if (land.decal[index] === 0 || key === undefined || tile === undefined || tile.hasRoad || tile.buildingId !== null) continue;
      const salt = hashSeed(land.seed, "wave22:decal-at", index);
      let x = tx + ((salt % 101) / 100 - 0.5) * 0.4; let y = ty + (((salt >>> 8) % 101) / 100 - 0.5) * 0.4;
      if (key.includes("driftwood") || key.includes("rock_pool")) {
        const sea = NEIGHBOURS.find(([ox, oy]) => mapTiles[(ty + oy) * land.width + tx + ox]?.terrain === "water" && tx + ox >= 0 && tx + ox < land.width);
        if (sea !== undefined) { x = tx + sea[0] / 3; y = ty + sea[1] / 3; }
      }
      const at = tileToScreen(x, y);
      if (art.draw(context, key as Wave22GroundKey, at.sx, at.sy, DECAL_SCALE)) drawn += 1;
    }
  }
  return drawn;
}
