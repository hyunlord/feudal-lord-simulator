import type { BoundaryBounds, BoundaryPoint } from "../world/boundary/boundaryGeometry";
import type { Shoreline } from "../world/boundary/shoreline";
import type { Tile } from "../world/world.types";
import { hashSeed } from "../content/seedHash";
import { TILE_H, TILE_W, tileToScreen } from "./iso";
import { manifestArt } from "./manifestArt";
import { joinStripImages } from "./stripJoin";
import { wallStripsEnabled } from "./renderWallStripsFlag";
import type { SeasonIndex } from "./seasonArt";
import { WAVE22_GROUND_IMAGES, type Wave22GroundKey } from "./wave22GroundManifest.generated";
import { GROUND_CHUNK_TILES, TILE_RING, type GroundChunkPlan } from "./groundSceneParts";
import { chunkHash, fillArtKey, fillVariant, isWaterStrip, landArtKeys, landStripLoops, loopStrips, stripFamily, type LandGround, type StripFamily } from "./archetypeGroundModel";
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
//     collinear edges run on; v across, half a tile wide, centred on the edge), a and b joined into one 1024 px repeat.
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
const EDGE_OF: Readonly<Record<string, StripFamily>> = { chalk_down: "boundary/chalk_edge", heath: "boundary/heath_edge", fen: "boundary/fen_edge", coastal_grass: "boundary/coastal_edge" };

/** The land's Wave 22 readiness in `season` (one bit per file it draws): part of the chunk content key. */
export function landArtReadiness(land: LandGround, season: SeasonIndex): string {
  return landArtKeys(land, season).map(key => (art.art(key) === null ? 0 : 1)).join("");
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

/** 1. The land fills over the chunk's grass diamonds. */
export function drawLandFills(context: CanvasRenderingContext2D, land: LandGround, tiles: readonly Tile[], season: SeasonIndex): void {
  const byBase = new Map<string, Tile[]>();
  for (const tile of tiles) {
    const base = land.fillBase[land.fill[tile.ty * land.width + tile.tx]!] ?? null;
    if (base !== null) { const list = byBase.get(base); if (list === undefined) byBase.set(base, [tile]); else list.push(tile); }
  }
  for (const [base, group] of byBase) {
    for (const variant of ["a", "b"] as const) {
      const image = art.art(fillArtKey(base, season, variant));
      const pattern = image === null ? null : patternOf(context, image);
      if (pattern === null) continue;
      // Pattern px (u, v) -> tile (u / 128 - 0.5, v / 64 - 0.5) -> iso screen.
      pattern.setTransform({ a: 0.25, b: 0.125, c: -0.5, d: 0.25, e: 0, f: -TILE_H / 2 });
      context.beginPath();
      for (const tile of group) if (variant === "a" || fillVariant(land.seed, tile.tx, tile.ty) === "b") traceDiamond(context, tile);
      context.fillStyle = pattern;
      context.fill();
    }
  }
}

const joined = new Map<StripFamily, CanvasImageSource>();
/** A strip family's a | b joined into one seamless repeat (the a image alone where there is no canvas). */
function stripImage(family: StripFamily): CanvasImageSource | null {
  const done = joined.get(family);
  if (done !== undefined) return done;
  const a = art.art(`${family}_a` as Wave22GroundKey); const b = art.art(`${family}_b` as Wave22GroundKey);
  if (a === null || b === null) return null;
  const image = typeof document === "undefined" ? a : joinStripImages([a, b], STRIP_WIDTH, a.naturalHeight, STRIP_JOIN_FADE);
  if (image !== null) joined.set(family, image);
  return image;
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

/** 2. Transition strips on the tile edges where a land fill meets the meadow or the heath. */
export function drawLandEdges(context: CanvasRenderingContext2D, land: LandGround, tiles: readonly Tile[]): number {
  let quads = 0;
  for (const tile of tiles) {
    const index = tile.ty * land.width + tile.tx;
    const band = stripFamily(land.keys[land.band[index]!]);
    if (band === null || isWaterStrip(band)) continue;
    const own = land.fill[index]!;
    for (const [dx, dy] of NEIGHBOURS) {
      const x = tile.tx + dx, y = tile.ty + dy;
      if (x < 0 || y < 0 || x >= land.width || y >= land.height) continue;
      const other = land.fill[y * land.width + x]!;
      if (other === 0 || other === own) continue;
      // The named side (the strip's bottom): the land fill against the meadow, the heath against the chalk.
      const ownBase = land.fillBase[own] ?? null; const otherBase = land.fillBase[other] ?? null;
      const named = otherBase === "heath" || ownBase === null ? otherBase : ownBase;
      if (named !== ownBase || named === null) continue;
      const family = EDGE_OF[named];
      const image = family === undefined ? null : stripImage(family);
      const pattern = image === null ? null : patternOf(context, image);
      if (pattern === null) continue;
      const t = { x: dy === 0 ? 0 : 1, y: dy === 0 ? 1 : 0 };
      const inward = { x: -dx, y: -dy };
      const mid = { x: tile.tx + dx / 2, y: tile.ty + dy / 2 };
      const half = EDGE_HEIGHT / 2 / PX_PER_TILE;
      const corner = (along: number, across: number): Vec => ({ x: mid.x + t.x * along + inward.x * across, y: mid.y + t.y * along + inward.y * across });
      // u from the map coordinate along the edge; v = 0 on the meadow side, 32 on the edge line.
      const origin = { x: t.x === 0 ? mid.x - inward.x * half : 0, y: t.y === 0 ? mid.y - inward.y * half : 0 };
      fillStripQuad(context, pattern, [corner(-0.5, -half), corner(0.5, -half), corner(0.5, half), corner(-0.5, half)], origin,
        { x: t.x / PX_PER_TILE, y: t.y / PX_PER_TILE }, { x: inward.x / PX_PER_TILE, y: inward.y / PX_PER_TILE });
      quads += 1;
    }
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
    const line = loop.smoothed; const count = line.length;
    const landHalf = (WATERLINE_ROW - 1) / PX_PER_TILE; const waterHalf = (WATER_STRIP_HEIGHT - 2 - WATERLINE_ROW) / PX_PER_TILE;
    const segmentNormal = (index: number): Vec => {
      const a = line[index % count] as Vec; const b = line[(index + 1) % count] as Vec;
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: -(b.y - a.y) / length * loop.landSide, y: (b.x - a.x) / length * loop.landSide };
    };
    const vertexNormal = (index: number): Vec => {
      const p = segmentNormal((index - 1 + count) % count); const q = segmentNormal(index);
      const length = Math.hypot(p.x + q.x, p.y + q.y) || 1;
      return { x: (p.x + q.x) / length, y: (p.y + q.y) / length };
    };
    let arc = 0;
    for (let index = 0; index < count; index += 1) {
      const a = line[index] as Vec; const b = line[(index + 1) % count] as Vec;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const start = arc; arc += length;
      if (length === 0) continue;
      if (wallStrips && loop.walled[index] === true && loop.walled[(index + 1) % count] === true) continue;
      if (Math.max(a.x, b.x) < tileBounds.left - 1.5 || Math.min(a.x, b.x) > tileBounds.right + 1.5
        || Math.max(a.y, b.y) < tileBounds.top - 1.5 || Math.min(a.y, b.y) > tileBounds.bottom + 1.5) continue;
      const image = stripImage(strips[index]!);
      const pattern = image === null ? null : patternOf(context, image);
      if (pattern === null) continue;
      const t = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
      const na = vertexNormal(index); const nb = vertexNormal(index + 1); const n = segmentNormal(index);
      const a0 = { x: a.x - t.x * 0.01, y: a.y - t.y * 0.01 }; const b0 = { x: b.x + t.x * 0.01, y: b.y + t.y * 0.01 };
      // Texture (u, v) -> tile: a + t (u - u0) / 128 - n (v - WATERLINE_ROW) / 128 (land up, as the old strip).
      const u0 = (start * PX_PER_TILE) % (STRIP_WIDTH * 2);
      const uAxis = { x: t.x / PX_PER_TILE, y: t.y / PX_PER_TILE }; const vAxis = { x: -n.x / PX_PER_TILE, y: -n.y / PX_PER_TILE };
      const origin = { x: a.x - uAxis.x * u0 - vAxis.x * WATERLINE_ROW, y: a.y - uAxis.y * u0 - vAxis.y * WATERLINE_ROW };
      fillStripQuad(context, pattern, [
        { x: a0.x + na.x * landHalf, y: a0.y + na.y * landHalf }, { x: b0.x + nb.x * landHalf, y: b0.y + nb.y * landHalf },
        { x: b0.x - nb.x * waterHalf, y: b0.y - nb.y * waterHalf }, { x: a0.x - na.x * waterHalf, y: a0.y - na.y * waterHalf },
      ], origin, uAxis, vAxis);
      quads += 1;
    }
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
