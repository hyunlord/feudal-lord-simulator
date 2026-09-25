import { RAMPS, SEMANTIC_PALETTE } from "../content/palette";
import type { BoundaryBounds, BoundaryPoint } from "../world/boundary/boundaryGeometry";
import { SHALLOW_DEPTH, type Shoreline, type ShoreLoop } from "../world/boundary/shoreline";
import { tileToScreen } from "./iso";
import { joinStripImages } from "./stripJoin";
import { applyTextureStroke, withAlpha } from "./style";
import { ABUTMENT_DISPLAY_WIDTH, shoreAsset, shoreAssetRaster } from "./terrainVariantAssets";
import { TERRAIN_VARIANTS, type ShoreAssetKey } from "./terrainVariantManifest";
import { waterPattern } from "./drawWater";
import { drawCroppedWorldSprite } from "./worldSprite";

// Water in the ground chunks (D3a, RENDER_BOUNDARY_V2 only). Order inside a chunk, after the land and the forest:
//  1. deep water: the existing water surface, one even-odd path from the shoreline loops (+ the chunk rectangle when the
//     chunk lies wholly inside water), world-screen aligned exactly like the old per-tile water;
//  2. shallow band: `shallow_{a,b,c}` (one variant and phase per loop, hashed) stroked along the outline in world
//     space, clipped to the water, six stacked widths (1.2 .. 0.4 tile) so it fades out by SHALLOW_DEPTH;
//  3. code-drawn shallow stones and waterweed blobs;
//  4. shore strips: `shoreline_{a,b,c,d}` joined a | b | c | d (16-tile period) and laid along the outline segment by
//     segment (texture u = arc length, v across; land up), the painted waterline on the outline.
// Bridge abutments are drawn live after the bridge decks (drawTerrainBoundaryV2), with the decks.

const STRIP_WIDTH = 512;
const STRIP_HEIGHT = 96;
const STRIP_PX_PER_TILE = 128;
/** Source row of the painted mud line (the waterline): rows 0..41 land fringe, 42..95 water. */
const WATERLINE_ROW = 42;
const STRIP_JOIN_FADE = 48;
const WATER_EDGE_ROW = 88;
/** Quads overlap their neighbours by this much along the line so antialiased joins leave no hairline. */
const SEGMENT_OVERLAP = 0.01;
/**
 * Shallow band as stacked strokes (width, alpha): coverage builds from 0 at SHALLOW_DEPTH to ~0.74 at the shore, so
 * the light shallows fade into the darker old water surface without an edge (the shore strip's own water half, 0.42
 * tile, sits on top of the densest part).
 */
const SHALLOW_STROKES: readonly (readonly [number, number])[] = [SHALLOW_DEPTH * 2, 1.0, 0.85, 0.7, 0.55, 0.4].map(width => [width, 0.2] as const);
const ABUTMENT_SIZE = { width: 256, height: 192 } as const;
/** The deck's middle between its land and water sockets (both NE and NW modules), source px. */
const ABUTMENT_ANCHOR = { x: 128, y: 88 } as const;

type ScreenBounds = { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number };

function traceWater(context: CanvasRenderingContext2D, shore: Shoreline, loops: readonly number[], parity: boolean, chunk: ScreenBounds): void {
  context.beginPath();
  for (const index of loops) {
    const line = shore.loops[index]?.smoothed ?? [];
    line.forEach((point, at) => { const s = tileToScreen(point.x, point.y); if (at === 0) context.moveTo(s.sx, s.sy); else context.lineTo(s.sx, s.sy); });
    context.closePath();
  }
  if (parity) {
    context.moveTo(chunk.left, chunk.top); context.lineTo(chunk.right, chunk.top);
    context.lineTo(chunk.right, chunk.bottom); context.lineTo(chunk.left, chunk.bottom); context.closePath();
  }
}

export function drawShoreline(context: CanvasRenderingContext2D, shore: Shoreline, loops: readonly number[], parity: boolean,
  chunk: ScreenBounds, tileBounds: BoundaryBounds, seed: number): void {
  if (loops.length === 0 && !parity) return;
  // 1. Deep water.
  traceWater(context, shore, loops, parity, chunk);
  const deep = waterPattern(context);
  context.fillStyle = deep ?? SEMANTIC_PALETTE.water;
  context.fill("evenodd");
  if (loops.length === 0) return;
  // 2-3. Shallow band and its stones / weed, clipped to the water.
  context.save();
  traceWater(context, shore, loops, parity, chunk);
  context.clip("evenodd");
  for (const index of loops) {
    const loop = shore.loops[index];
    if (loop !== undefined) drawShallowBand(context, loop, seed);
  }
  for (const index of loops) {
    const loop = shore.loops[index];
    if (loop !== undefined) drawShoreDecals(context, loop, tileBounds);
  }
  context.restore();
  // 4. Shore strips (they reach over the land too).
  for (const index of loops) {
    const loop = shore.loops[index];
    if (loop !== undefined) drawShoreStrip(context, loop, tileBounds);
  }
}

/** World (tile-centre) -> world-screen matrix of the iso projection. */
const ISO = { a: 32, b: 16, c: -32, d: 16 } as const;

function drawShallowBand(context: CanvasRenderingContext2D, loop: ShoreLoop, seed: number): void {
  if (typeof context.createPattern !== "function") return;
  const variants = TERRAIN_VARIANTS.shallowWater;
  const pick = hashOf(loop.hash, seed) % variants.length;
  const image = shoreAsset(variants[pick] as ShoreAssetKey);
  const pattern = image === null ? null : cachedPattern(context, image);
  context.save();
  context.transform(ISO.a, ISO.b, ISO.c, ISO.d, 0, 0);
  context.beginPath();
  loop.smoothed.forEach((point, at) => { if (at === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y); });
  context.closePath();
  if (pattern !== null) {
    // The fill is screen aligned at half scale (256x128 = 2x2 tiles), offset per loop: pattern space -> world is
    // ISO^-1 * (0.5 scale + offset).
    const offset = { x: (hashOf(loop.hash, seed + 1) % 128), y: (hashOf(loop.hash, seed + 2) % 64) };
    const det = ISO.a * ISO.d - ISO.b * ISO.c;
    const inv = { a: ISO.d / det, b: -ISO.b / det, c: -ISO.c / det, d: ISO.a / det };
    pattern.setTransform({ a: inv.a * 0.5, b: inv.b * 0.5, c: inv.c * 0.5, d: inv.d * 0.5,
      e: inv.a * offset.x + inv.c * offset.y, f: inv.b * offset.x + inv.d * offset.y });
  }
  const previousAlpha = context.globalAlpha;
  for (const [width, alpha] of SHALLOW_STROKES) {
    applyTextureStroke(context, pattern ?? RAMPS.water[4], width);
    context.globalAlpha = previousAlpha * alpha;
    context.stroke();
  }
  context.globalAlpha = previousAlpha;
  context.restore();
}

function drawShoreDecals(context: CanvasRenderingContext2D, loop: ShoreLoop, tileBounds: BoundaryBounds): void {
  for (const decal of loop.decals) {
    if (decal.anchor.x < tileBounds.left - 1 || decal.anchor.x > tileBounds.right + 1 || decal.anchor.y < tileBounds.top - 1 || decal.anchor.y > tileBounds.bottom + 1) continue;
    context.save();
    context.transform(ISO.a, ISO.b, ISO.c, ISO.d, 0, 0);
    for (const blob of decal.blobs) {
      const x = decal.anchor.x + blob.dx; const y = decal.anchor.y + blob.dy;
      context.beginPath();
      context.ellipse(x, y, blob.rx, blob.ry, 0, 0, Math.PI * 2);
      context.fillStyle = decal.kind === "stone" ? withAlpha(RAMPS.stone[3], 0.8) : withAlpha(RAMPS.foliage[3], 0.7);
      context.fill();
      if (decal.kind === "stone") {
        context.beginPath();
        context.ellipse(x - blob.rx * 0.25, y - blob.ry * 0.3, blob.rx * 0.5, blob.ry * 0.45, 0, 0, Math.PI * 2);
        context.fillStyle = withAlpha(RAMPS.stone[5], 0.45);
        context.fill();
      }
    }
    context.restore();
  }
}

function drawShoreStrip(context: CanvasRenderingContext2D, loop: ShoreLoop, tileBounds: BoundaryBounds): void {
  if (typeof context.createPattern !== "function") return;
  const joined = shoreStripCanvas();
  if (joined === null) return;
  const pattern = cachedPattern(context, joined);
  if (pattern === null) return;
  const period = STRIP_WIDTH * TERRAIN_VARIANTS.shoreline.length;
  const line = loop.smoothed;
  const count = line.length;
  // Land side: one texel short of the top row (the pattern repeats; the edge would pull in the next repeat). Water
  // side: cut at WATER_EDGE_ROW, where the painted water is still light and half opaque, since its last rows darken
  // as they fade and drew a dark line on the shallows.
  const landHalf = (WATERLINE_ROW - 1) / STRIP_PX_PER_TILE;
  const waterHalf = (WATER_EDGE_ROW - WATERLINE_ROW) / STRIP_PX_PER_TILE;
  // Vertex normals toward land (average of the two segment normals).
  const segmentNormal = (index: number): BoundaryPoint => {
    const a = line[index % count] as BoundaryPoint; const b = line[(index + 1) % count] as BoundaryPoint;
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / length * loop.landSide, y: (b.x - a.x) / length * loop.landSide };
  };
  const vertexNormal = (index: number): BoundaryPoint => {
    const p = segmentNormal((index - 1 + count) % count); const q = segmentNormal(index);
    const x = p.x + q.x; const y = p.y + q.y; const length = Math.hypot(x, y) || 1;
    return { x: x / length, y: y / length };
  };
  const margin = 1.5;
  let arc = 0;
  for (let index = 0; index < count; index += 1) {
    const a = line[index] as BoundaryPoint; const b = line[(index + 1) % count] as BoundaryPoint;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const start = arc; arc += length;
    if (length === 0) continue;
    if (Math.max(a.x, b.x) < tileBounds.left - margin || Math.min(a.x, b.x) > tileBounds.right + margin
      || Math.max(a.y, b.y) < tileBounds.top - margin || Math.min(a.y, b.y) > tileBounds.bottom + margin) continue;
    const t = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const na = vertexNormal(index); const nb = vertexNormal(index + 1); const n = segmentNormal(index);
    const a0 = { x: a.x - t.x * SEGMENT_OVERLAP, y: a.y - t.y * SEGMENT_OVERLAP };
    const b0 = { x: b.x + t.x * SEGMENT_OVERLAP, y: b.y + t.y * SEGMENT_OVERLAP };
    context.beginPath();
    for (const [at, point] of [
      { x: a0.x + na.x * landHalf, y: a0.y + na.y * landHalf }, { x: b0.x + nb.x * landHalf, y: b0.y + nb.y * landHalf },
      { x: b0.x - nb.x * waterHalf, y: b0.y - nb.y * waterHalf }, { x: a0.x - na.x * waterHalf, y: a0.y - na.y * waterHalf },
    ].entries()) { const s = tileToScreen(point.x, point.y); if (at === 0) context.moveTo(s.sx, s.sy); else context.lineTo(s.sx, s.sy); }
    context.closePath();
    // Texture (u, v) -> tile: a + t (u - u0) / 128 - n (v - WATERLINE_ROW) / 128, then the iso projection.
    const u0 = ((start * STRIP_PX_PER_TILE) % period + period) % period;
    const uAxis = { x: t.x / STRIP_PX_PER_TILE, y: t.y / STRIP_PX_PER_TILE };
    const vAxis = { x: -n.x / STRIP_PX_PER_TILE, y: -n.y / STRIP_PX_PER_TILE };
    const iso = (v: BoundaryPoint) => ({ x: (v.x - v.y) * 32, y: (v.x + v.y) * 16 });
    const u = iso(uAxis); const v = iso(vAxis); const base = tileToScreen(a.x, a.y);
    pattern.setTransform({ a: u.x, b: u.y, c: v.x, d: v.y, e: base.sx - u.x * u0 - v.x * WATERLINE_ROW, f: base.sy - u.y * u0 - v.y * WATERLINE_ROW });
    context.fillStyle = pattern;
    context.fill();
  }
}

/** Bridge abutments (Wave 4b): at the back end of every bridge, the NW module for x bridges, the NE one for y bridges. */
export function drawBridgeAbutments(context: CanvasRenderingContext2D, shore: Shoreline): void {
  for (const end of shore.bridgeEnds) {
    if (!end.back) continue;
    const key: ShoreAssetKey = end.axis === "x" ? "bridge_abutment_nw_a" : "bridge_abutment_ne_a";
    const raster = shoreAssetRaster(key);
    const image = raster?.image ?? shoreAsset(key);
    if (image === null) continue;
    const source = raster?.source ?? { x: 0, y: 0, width: ABUTMENT_SIZE.width, height: ABUTMENT_SIZE.height };
    const width = ABUTMENT_DISPLAY_WIDTH; const height = width * ABUTMENT_SIZE.height / ABUTMENT_SIZE.width;
    const at = tileToScreen(end.mid.x, end.mid.y);
    drawCroppedWorldSprite(context, image, source, { x: at.sx - width * ABUTMENT_ANCHOR.x / ABUTMENT_SIZE.width,
      y: at.sy - height * ABUTMENT_ANCHOR.y / ABUTMENT_SIZE.height, width, height }, false, true);
  }
}

function hashOf(value: number, seed: number): number {
  let h = (value ^ Math.imul(seed + 0x9e3779b9, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

const patterns = new WeakMap<CanvasRenderingContext2D, Map<CanvasImageSource, CanvasPattern | null>>();
function cachedPattern(context: CanvasRenderingContext2D, image: CanvasImageSource): CanvasPattern | null {
  let map = patterns.get(context);
  if (map === undefined) { map = new Map(); patterns.set(context, map); }
  if (!map.has(image)) map.set(image, context.createPattern(image, "repeat"));
  return map.get(image) ?? null;
}

// Browser image cache: the four shore strips joined once they have loaded (null until then; the a image in Node).
let joinedStrip: CanvasImageSource | null = null;
function shoreStripCanvas(): CanvasImageSource | null {
  if (joinedStrip !== null) return joinedStrip;
  const images = TERRAIN_VARIANTS.shoreline.map(key => shoreAsset(key));
  if (images.some(image => image === null)) return null;
  joinedStrip = typeof document === "undefined" ? images[0] as HTMLImageElement : joinStripImages(images as HTMLImageElement[], STRIP_WIDTH, STRIP_HEIGHT, STRIP_JOIN_FADE);
  return joinedStrip;
}

/** Proof tools (seam check): the joined shore strip. */
export function shoreStripCanvasForProof(): CanvasImageSource | null {
  return shoreStripCanvas();
}
