import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import type { BoundaryPoint } from "../world/boundary/boundaryGeometry";
import { GATE_HALF_CLEARANCE } from "../world/wallTraversal";
import type { WallBaselines, WallChain, WallMaterial, WallNode, WallPillar } from "../world/boundary/wallBaseline";
import { drawRegisteredGate } from "./gateArtRenderer";
import { tileToScreen } from "./iso";
import { drawMasonrySolid } from "./stoneWallMasonry";
import { stoneWallNodeSolids } from "./stoneWallNodeGeometry";
import type { StoneWallSolid } from "./stoneWallFallbackGeometry";
import { preloadStoneWallAssets, stoneWallMaterial } from "./stoneWallAssets";
import type { StoneWallNode } from "./stoneWallTopology";
import { joinStripImages } from "./stripJoin";
import { drawCroppedWorldSprite } from "./worldSprite";
import { preloadWallFaceAssets, wallFaceAsset } from "./terrainVariantAssets";
import { TERRAIN_VARIANTS, type WallFaceKey } from "./terrainVariantManifest";
import { drawGateMarker, drawPost } from "./timberGateRenderer";
import { preloadTimberWallAssets } from "./timberWallAssets";

// Wall faces (D3b, RENDER_BOUNDARY_V2 only): completed walls are the Wave 4b face strips extruded along the wall
// baselines (world/boundary/wallBaseline), and modules stand on the nodes. Each object-queue wall item is one unit edge
// of the logic path; it draws the stretch of face whose raw arc position lies on that edge, so the depth order of the
// wall pieces is the existing one.
//  - Extrusion: every baseline sample pair is one quad from the projected baseline straight up FACE_HEIGHT (a tile's
//    screen height, the strip's 128 source px), textured by an affine map (u = arc length at 128 px per tile, plus a
//    phase hashed per chain; v = height). The three variants are joined a | b | c (12-tile period).
//  - Tone: the strips are lit front elevations; a face turned toward the lower right (a wall along the tile y axis)
//    takes a dark wash of FACE_SHADE, one along the x axis none, others in between (the old pieces' light rule).
//  - Gates: the face stops GATE_HALF_CLEARANCE short of a gate; the existing gate art (or its fallback) stands there.
//  - Modules (existing pieces, no new art): stone uses the masonry piers, taller at towers; timber uses the posts.

export const FACE_HEIGHT = 32;
const FACE_WIDTH = 512;
const FACE_SOURCE_HEIGHT = 128;
const FACE_PX_PER_TILE = 128;
const FACE_JOIN_FADE = 48;
const FACE_SHADE = 0.22;
/** Wall thickness (tiles) and the cap's height as a share of the face (below the merlons / stake points). */
const WALL_THICKNESS: Readonly<Record<WallMaterial, number>> = { stone: 0.3, timber: 0.16 };
const CAP_FRACTION: Readonly<Record<WallMaterial, number>> = { stone: 0.78, timber: 0.84 };
const CAP_COLOUR: Readonly<Record<WallMaterial, string>> = { stone: SEMANTIC_PALETTE.stone, timber: SEMANTIC_PALETTE.earthDark };
/** The wall body seen end-on (a run along the tile diagonal shows only this and its cap). */
const SIDE_COLOUR: Readonly<Record<WallMaterial, string>> = { stone: SEMANTIC_PALETTE.stoneDark, timber: SEMANTIC_PALETTE.earthDark };
/** Quads overlap by this much along the line so antialiased joins leave no hairline (tile units). */
const QUAD_OVERLAP = 0.005;

export type WallFaceSlice = { readonly chain: WallChain; readonly t0: number; readonly t1: number };

/** Unit edge key -> the chain stretch it draws. */
export function wallFaceSlices(walls: WallBaselines): ReadonlyMap<string, WallFaceSlice> {
  const slices = new Map<string, WallFaceSlice>();
  for (const chain of walls.chains) for (const [key, [t0, t1]] of chain.edges) slices.set(key, { chain, t0, t1 });
  return slices;
}

/** Edge space (integer = tile corner) -> world screen, as palisadeScreenPath. */
function screenOf(point: BoundaryPoint): BoundaryPoint {
  const s = tileToScreen(point.x, point.y);
  return { x: s.sx, y: s.sy - 16 };
}

export function drawWallFaceSlice(context: CanvasRenderingContext2D, slice: WallFaceSlice): void {
  void preloadWallFaceAssets();
  const { chain } = slice;
  const length = chain.raw.length - 1;
  // Gate clearance at chain ends that are gates.
  const low = Math.max(slice.t0, chain.startKind === "gate" ? GATE_HALF_CLEARANCE : 0);
  const high = Math.min(slice.t1, chain.endKind === "gate" ? length - GATE_HALF_CLEARANCE : length);
  if (high <= low) return;
  const samples = chain.samples;
  const pointAt = (t: number): BoundaryPoint => {
    let index = 0;
    while (index < samples.length - 2 && (samples[index + 1] as { t: number }).t < t) index += 1;
    const a = samples[index] as { point: BoundaryPoint; t: number }; const b = samples[index + 1] as { point: BoundaryPoint; t: number };
    const f = b.t === a.t ? 0 : Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t)));
    return { x: a.point.x + (b.point.x - a.point.x) * f, y: a.point.y + (b.point.y - a.point.y) * f };
  };
  const stretch: { point: BoundaryPoint; t: number }[] = [{ point: pointAt(low), t: low }];
  for (const sample of samples) if (sample.t > low && sample.t < high) stretch.push({ point: sample.point, t: sample.t });
  stretch.push({ point: pointAt(high), t: high });
  const face = faceCanvas(chain.material);
  const pattern = face === null || typeof context.createPattern !== "function" ? null : cachedPattern(context, face);
  // Arc length (world tiles) from the chain start to `low`, then along the stretch.
  const arcStart = arcTo(chain, low);
  const phase = (chain.hash % 12) * FACE_PX_PER_TILE;
  // Two passes: the body (end faces and cap) of the whole stretch first, then the textured front faces, so a later
  // segment's end face never paints over an earlier segment's front face.
  for (const pass of ["body", "face"] as const) {
    let arc = arcStart;
    for (let index = 0; index < stretch.length - 1; index += 1) {
      const a = stretch[index] as { point: BoundaryPoint }; const b = stretch[index + 1] as { point: BoundaryPoint };
      const dx = b.point.x - a.point.x; const dy = b.point.y - a.point.y;
      const segment = Math.hypot(dx, dy);
      if (segment === 0) continue;
      const ext = { x: dx / segment * QUAD_OVERLAP, y: dy / segment * QUAD_OVERLAP };
      // Thickness: the textured face stands on the side toward the camera (world normal with n . (1, 1) >= 0); the cap
      // joins it to the back side at cap height. A run along the tile diagonal (1, 1) is edge-on on screen: only its
      // body (end faces and cap) shows, which is what a wall seen along its length looks like.
      let n = { x: -dy / segment, y: dx / segment };
      if (n.x + n.y < 0) n = { x: -n.x, y: -n.y };
      const half = WALL_THICKNESS[chain.material] / 2;
      const front = (point: BoundaryPoint, sign: number) => screenOf({ x: point.x + n.x * half + ext.x * sign, y: point.y + n.y * half + ext.y * sign });
      const back = (point: BoundaryPoint, sign: number) => screenOf({ x: point.x - n.x * half + ext.x * sign, y: point.y - n.y * half + ext.y * sign });
      const fa = front(a.point, -1); const fb = front(b.point, 1);
      if (pass === "body") {
        const ba = back(a.point, -1); const bb = back(b.point, 1);
        const capHeight = FACE_HEIGHT * CAP_FRACTION[chain.material];
        context.beginPath();
        context.moveTo(ba.x, ba.y); context.lineTo(fa.x, fa.y); context.lineTo(fa.x, fa.y - capHeight); context.lineTo(ba.x, ba.y - capHeight);
        context.closePath();
        context.fillStyle = SIDE_COLOUR[chain.material];
        context.fill();
        context.beginPath();
        context.moveTo(fa.x, fa.y - capHeight); context.lineTo(fb.x, fb.y - capHeight); context.lineTo(bb.x, bb.y - capHeight); context.lineTo(ba.x, ba.y - capHeight);
        context.closePath();
        context.fillStyle = CAP_COLOUR[chain.material];
        context.fill();
        continue;
      }
      const sa = screenOf({ x: a.point.x + n.x * half, y: a.point.y + n.y * half }); const sb = screenOf({ x: b.point.x + n.x * half, y: b.point.y + n.y * half });
      if (Math.hypot(sb.x - sa.x, sb.y - sa.y) < 0.05) { arc += segment; continue; }
      context.beginPath();
      context.moveTo(fa.x, fa.y); context.lineTo(fb.x, fb.y); context.lineTo(fb.x, fb.y - FACE_HEIGHT); context.lineTo(fa.x, fa.y - FACE_HEIGHT);
      context.closePath();
      if (pattern !== null) {
        const u0 = arc * FACE_PX_PER_TILE + phase; const u1 = (arc + segment) * FACE_PX_PER_TILE + phase;
        const ma = (sb.x - sa.x) / (u1 - u0); const mb = (sb.y - sa.y) / (u1 - u0);
        const matrix = { a: ma, b: mb, c: 0, d: FACE_HEIGHT / FACE_SOURCE_HEIGHT, e: sa.x - ma * u0, f: sa.y - mb * u0 - FACE_HEIGHT };
        pattern.setTransform(matrix);
        lastTransform.set(pattern, matrix);
        context.fillStyle = pattern;
      } else {
        context.fillStyle = chain.material === "stone" ? SEMANTIC_PALETTE.stone : SEMANTIC_PALETTE.earth;
      }
      context.fill();
      // Light: a face along the tile y axis looks lower right (shaded), along x lower left (lit). The wash is the face's
      // own silhouette in ink (same pattern transform), so the transparent tops stay transparent.
      const shade = FACE_SHADE * (dy * dy) / (dx * dx + dy * dy);
      const shadow = face === null ? null : shadowCanvas(chain.material, face);
      const shadowPattern = shadow === null || pattern === null ? null : cachedPattern(context, shadow);
      if (shade > 0.005 && shadowPattern !== null && pattern !== null) {
        shadowPattern.setTransform(patternTransform(pattern));
        const previousAlpha = context.globalAlpha;
        context.globalAlpha = previousAlpha * shade;
        context.fillStyle = shadowPattern;
        context.fill();
        context.globalAlpha = previousAlpha;
      }
      arc += segment;
    }
  }
}

function arcTo(chain: WallChain, t: number): number {
  let arc = 0;
  for (let index = 0; index < chain.samples.length - 1; index += 1) {
    const a = chain.samples[index] as { point: BoundaryPoint; t: number }; const b = chain.samples[index + 1] as { point: BoundaryPoint; t: number };
    if (b.t <= t) { arc += Math.hypot(b.point.x - a.point.x, b.point.y - a.point.y); continue; }
    if (a.t < t) arc += Math.hypot(b.point.x - a.point.x, b.point.y - a.point.y) * (t - a.t) / (b.t - a.t);
    break;
  }
  return arc;
}

/** Modules owned by a wall item: gates, towers, ends, junctions, material joins and pillars. */
export function drawWallModules(context: CanvasRenderingContext2D, nodes: readonly WallNode[], pillars: readonly WallPillar[], material: WallMaterial, zoom: number): void {
  for (const node of nodes) {
    const stone = node.materials.includes("stone");
    const kind: WallMaterial = stone ? "stone" : material;
    const legacy: StoneWallNode = { point: node.point, neighbors: node.neighbors,
      kind: node.kind === "gate" ? "gate" : node.kind === "terminal" ? "terminal" : node.kind === "junction" ? "junction" : "corner" };
    if (node.kind === "gate") {
      if (drawRegisteredGate(context, legacy, kind)) continue;
      if (kind === "stone") { for (const solid of stoneWallNodeSolids(legacy)) drawMasonrySolid(context, solid, stoneWallMaterial(), false); }
      else drawGateMarker(context, node.neighbors.flatMap(point => [point, node.point]), node.point, zoom, legacy);
      continue;
    }
    const size = node.kind === "tower" ? { radius: 0.2, height: FACE_HEIGHT + 10, post: { width: 11, height: FACE_HEIGHT + 10 } }
      : { radius: 0.15, height: FACE_HEIGHT + 4, post: { width: 9, height: FACE_HEIGHT + 4 } };
    drawModule(context, node.point, kind, size, zoom);
  }
  for (const pillar of pillars) drawModule(context, pillar.point, pillar.material, { radius: 0.12, height: FACE_HEIGHT + 2, post: { width: 8, height: FACE_HEIGHT + 2 } }, zoom);
}

function drawModule(context: CanvasRenderingContext2D, point: BoundaryPoint, material: WallMaterial,
  size: { readonly radius: number; readonly height: number; readonly post: { readonly width: number; readonly height: number } }, zoom: number): void {
  if (material === "stone") {
    void preloadStoneWallAssets();
    for (const solid of pier(point, size.radius, size.height)) drawMasonrySolid(context, solid, stoneWallMaterial(), true);
    return;
  }
  void preloadTimberWallAssets();
  drawPost(context, screenOf(point), size.post, zoom);
}

function pier(point: BoundaryPoint, radius: number, height: number): readonly StoneWallSolid[] {
  const square = (r: number) => [
    screenOf({ x: point.x - r, y: point.y - r }), screenOf({ x: point.x + r, y: point.y - r }),
    screenOf({ x: point.x + r, y: point.y + r }), screenOf({ x: point.x - r, y: point.y + r }),
  ] as [BoundaryPoint, BoundaryPoint, BoundaryPoint, BoundaryPoint];
  return [{ footprint: square(radius), base: 0, height: height - 4 }, { footprint: square(radius * 1.12), base: height - 4, height: 4 }];
}

type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number };
const lastTransform = new WeakMap<CanvasPattern, Matrix>();
function patternTransform(pattern: CanvasPattern): Matrix {
  return lastTransform.get(pattern) ?? { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

const patterns = new WeakMap<CanvasRenderingContext2D, Map<CanvasImageSource, CanvasPattern | null>>();
function cachedPattern(context: CanvasRenderingContext2D, image: CanvasImageSource): CanvasPattern | null {
  let map = patterns.get(context);
  if (map === undefined) { map = new Map(); patterns.set(context, map); }
  if (!map.has(image)) map.set(image, context.createPattern(image, "repeat-x"));
  return map.get(image) ?? null;
}

// Browser image cache: the three face variants of a material joined once loaded (the a image alone in Node).
const joined = new Map<WallMaterial, CanvasImageSource>();
function faceCanvas(material: WallMaterial): CanvasImageSource | null {
  const cached = joined.get(material);
  if (cached !== undefined) return cached;
  const keys = (material === "stone" ? TERRAIN_VARIANTS.stoneFace : TERRAIN_VARIANTS.palisadeFace) as readonly WallFaceKey[];
  const images = keys.map(key => wallFaceAsset(key));
  if (images.some(image => image === null)) return null;
  const canvas = typeof document === "undefined" ? images[0] as HTMLImageElement : joinStripImages(images as HTMLImageElement[], FACE_WIDTH, FACE_SOURCE_HEIGHT, FACE_JOIN_FADE);
  if (canvas === null) return null;
  joined.set(material, canvas);
  return canvas;
}

// The joined face as an ink silhouette (same alpha), for the direction shade.
const shadows = new Map<WallMaterial, CanvasImageSource>();
function shadowCanvas(material: WallMaterial, face: CanvasImageSource): CanvasImageSource | null {
  const cached = shadows.get(material);
  if (cached !== undefined) return cached;
  if (typeof document === "undefined") return null;
  const width = (face as HTMLCanvasElement).width; const height = (face as HTMLCanvasElement).height;
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const paint = canvas.getContext("2d");
  if (paint === null) return null;
  paint.fillStyle = PALETTE.ink; paint.fillRect(0, 0, width, height);
  paint.globalCompositeOperation = "destination-in";
  drawCroppedWorldSprite(paint, face, { x: 0, y: 0, width, height }, { x: 0, y: 0, width, height }, false, false);
  shadows.set(material, canvas);
  return canvas;
}
