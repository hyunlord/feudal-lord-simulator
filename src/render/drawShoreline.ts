import { RAMPS, SEMANTIC_PALETTE } from "../content/palette";
import type { BoundaryBounds, BoundaryPoint } from "../world/boundary/boundaryGeometry";
import { SHALLOW_DEPTH, type Shoreline, type ShoreLoop } from "../world/boundary/shoreline";
import { tileToScreen } from "./iso";
import { joinStripImages } from "./stripJoin";
import { applyTextureStroke, withAlpha } from "./style";
import { ABUTMENT_DISPLAY_WIDTH, shoreAsset, shoreAssetRaster, shoreSurface } from "./terrainVariantAssets";
import { TERRAIN_VARIANTS, type ShoreAssetKey } from "./terrainVariantManifest";
import { waterPattern } from "./drawWater";
import { drawCroppedWorldSprite } from "./worldSprite";
import { wallStripsEnabled } from "./renderWallStripsFlag";

// Water in the ground chunks (D3a, RENDER_BOUNDARY_V2 only). Order inside a chunk, after the land and the forest:
//  1. deep water: the Wave 4d deep fills joined a | b | c (D3b-2; the old surface until they load), one even-odd path
//     from the shoreline loops (+ the chunk rectangle when the chunk lies wholly inside water), world-screen aligned at
//     half scale (a 256x128 fill = 2x2 tiles) with a phase from the seed, so chunks join without seams;
//  2. shallow band: `shallow_{a,b,c}` (one variant and phase per loop, hashed) stroked along the outline in world
//     space, clipped to the water, six stacked widths (1.2 .. 0.4 tile) so it fades out by SHALLOW_DEPTH;
//  3. shore strips: `shoreline_{a..f}` joined a | b | c | d | e | f (24-tile period) and laid along the outline segment
//     by segment (texture u = arc length, v across; land up), the painted waterline on the outline;
//  4. reeds and mudstones (Wave 4d sprites, mirrored by hash) at the scattered decal anchors, over the strips; the
//     D3a code-drawn blobs until the sprites load.
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
  const deep = deepWaterPattern(context, seed) ?? waterPattern(context);
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
  const sprites = decalSpritesReady();
  if (!sprites) {
    for (const index of loops) {
      const loop = shore.loops[index];
      if (loop !== undefined) drawShoreDecals(context, loop, tileBounds);
    }
  }
  context.restore();
  // 3. Shore strips (they reach over the land too).
  for (const index of loops) {
    const loop = shore.loops[index];
    if (loop !== undefined) drawShoreStrip(context, loop, tileBounds);
  }
  // 4. Reeds and mudstones over the strips (not clipped: reeds stand above the waterline).
  if (sprites) {
    for (const index of loops) {
      const loop = shore.loops[index];
      if (loop !== undefined) drawDecalSprites(context, loop, tileBounds);
    }
  }
}

/** A smoothed sprite, mirrored about its own vertical centre line when asked (decals, the SW abutment). */
function drawMirrorableSprite(context: CanvasRenderingContext2D, image: CanvasImageSource, source: { x: number; y: number; width: number; height: number },
  destination: { x: number; y: number; width: number; height: number }, mirrored: boolean): void {
  if (!mirrored) { drawCroppedWorldSprite(context, image, source, destination, false, true); return; }
  const centre = destination.x + destination.width / 2;
  context.save();
  context.translate(centre, 0); context.scale(-1, 1); context.translate(-centre, 0);
  drawCroppedWorldSprite(context, image, source, destination, false, true);
  context.restore();
}

/** Display widths at zoom 1 (source 96x96 reeds, 64x48 mudstones at 128 source px per tile along the shore). */
const DECAL_WIDTH = { weed: 24, stone: 16 } as const;
function decalSpritesReady(): boolean {
  return [...TERRAIN_VARIANTS.shoreReeds, ...TERRAIN_VARIANTS.shoreStones].every(key => shoreAsset(key) !== null);
}

function drawDecalSprites(context: CanvasRenderingContext2D, loop: ShoreLoop, tileBounds: BoundaryBounds): void {
  for (const decal of loop.decals) {
    if (decal.anchor.x < tileBounds.left - 1 || decal.anchor.x > tileBounds.right + 1 || decal.anchor.y < tileBounds.top - 1 || decal.anchor.y > tileBounds.bottom + 1) continue;
    const family = decal.kind === "stone" ? TERRAIN_VARIANTS.shoreStones : TERRAIN_VARIANTS.shoreReeds;
    const image = shoreAsset(family[decal.variant % family.length] as ShoreAssetKey);
    if (image === null) continue;
    const width = DECAL_WIDTH[decal.kind]; const height = width * image.naturalHeight / image.naturalWidth;
    const at = tileToScreen(decal.anchor.x, decal.anchor.y);
    // Bottom centre on the anchor (a mudstone sits a little into the water: its lower third below the anchor).
    const sink = decal.kind === "stone" ? height / 3 : height * 0.12;
    drawMirrorableSprite(context, image, { x: 0, y: 0, width: image.naturalWidth, height: image.naturalHeight },
      { x: at.sx - width / 2, y: at.sy - height + sink, width, height }, decal.flip);
  }
}

// Browser image cache: the three deep fills joined once (the a image alone in Node).
let joinedDeep: CanvasImageSource | null = null;
const DEEP_WIDTH = 256;
const DEEP_HEIGHT = 128;
const DEEP_JOIN_FADE = 32;
function deepWaterPattern(context: CanvasRenderingContext2D, seed: number): CanvasPattern | null {
  if (typeof context.createPattern !== "function") return null;
  if (joinedDeep === null) {
    const images = TERRAIN_VARIANTS.deepWater.map(key => shoreAsset(key));
    if (images.some(image => image === null)) return null;
    joinedDeep = typeof document === "undefined" ? images[0] as HTMLImageElement : joinStripImages(images as HTMLImageElement[], DEEP_WIDTH, DEEP_HEIGHT, DEEP_JOIN_FADE);
    if (joinedDeep === null) return null;
  }
  const pattern = cachedPattern(context, joinedDeep);
  if (pattern === null) return null;
  const phase = { x: hashOf(seed, 17) % (DEEP_WIDTH * 3), y: hashOf(seed, 29) % DEEP_HEIGHT };
  pattern.setTransform({ a: 0.5, b: 0, c: 0, d: 0.5, e: -phase.x * 0.5, f: -phase.y * 0.5 });
  return pattern;
}

/** World (tile-centre) -> world-screen matrix of the iso projection. */
const ISO = { a: 32, b: 16, c: -32, d: 16 } as const;

function drawShallowBand(context: CanvasRenderingContext2D, loop: ShoreLoop, seed: number): void {
  if (typeof context.createPattern !== "function") return;
  const variants = TERRAIN_VARIANTS.shallowWater;
  const pick = hashOf(loop.hash, seed) % variants.length;
  const image = shoreSurface(variants[pick] as ShoreAssetKey);
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
  const wallStrips = wallStripsEnabled();
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
    // Along a wall standing on the water the wall face is the edge: no shore strip under it (D3b, wall strips only;
    // the per-edge pieces leave the strip showing).
    if (wallStrips && loop.walled[index] === true && loop.walled[(index + 1) % count] === true) continue;
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

/**
 * Bridge abutments: at the back end of every bridge the Wave 4b NW module (x bridges) or NE module (y bridges); at the
 * front end (D3b-2) the Wave 4d SE module (x bridges) or the same module mirrored as SW (y bridges).
 */
export function drawBridgeAbutments(context: CanvasRenderingContext2D, shore: Shoreline): void {
  for (const end of shore.bridgeEnds) {
    const key: ShoreAssetKey = end.back ? (end.axis === "x" ? "bridge_abutment_nw_a" : "bridge_abutment_ne_a") : "bridge_abutment_se_a";
    const mirrored = !end.back && end.axis === "y";
    const raster = shoreAssetRaster(key);
    const image = raster?.image ?? shoreAsset(key);
    if (image === null) continue;
    const source = raster?.source ?? { x: 0, y: 0, width: ABUTMENT_SIZE.width, height: ABUTMENT_SIZE.height };
    const width = ABUTMENT_DISPLAY_WIDTH; const height = width * ABUTMENT_SIZE.height / ABUTMENT_SIZE.width;
    const at = tileToScreen(end.mid.x, end.mid.y);
    drawMirrorableSprite(context, image, source, { x: at.sx - width * ABUTMENT_ANCHOR.x / ABUTMENT_SIZE.width,
      y: at.sy - height * ABUTMENT_ANCHOR.y / ABUTMENT_SIZE.height, width, height }, mirrored);
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
  const images = TERRAIN_VARIANTS.shoreline.map(key => shoreSurface(key));
  if (images.some(image => image === null)) return null;
  joinedStrip = typeof document === "undefined" ? images[0] as HTMLImageElement : joinStripImages(images as HTMLImageElement[], STRIP_WIDTH, STRIP_HEIGHT, STRIP_JOIN_FADE);
  return joinedStrip;
}

/** Proof tools (seam check): the joined shore strip. */
export function shoreStripCanvasForProof(): CanvasImageSource | null {
  return shoreStripCanvas();
}
