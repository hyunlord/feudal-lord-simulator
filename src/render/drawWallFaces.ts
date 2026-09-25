import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import { boundaryHash, type BoundaryPoint } from "../world/boundary/boundaryGeometry";
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
import { rasterizeWorldSprite, type RasterizedWorldSprite } from "./worldSpriteRaster";
import { preloadWallFaceAssets, wallFaceAsset } from "./terrainVariantAssets";
import { TERRAIN_VARIANTS, type WallFaceKey } from "./terrainVariantManifest";
import { drawGateMarker, drawPost } from "./timberGateRenderer";
import { preloadTimberWallAssets } from "./timberWallAssets";

// Wall strips (D3b; v2 two-layer strips D3b-2; RENDER_WALL_STRIPS on the curved ground): completed walls are strips
// extruded along the wall baselines (world/boundary/wallBaseline), and modules stand on the nodes. Each object-queue
// wall item is one unit edge of the logic path; it draws the stretch whose raw arc position lies on that edge, so the
// depth order of the wall pieces is the existing one.
//  - Face (Wave 4d v2, no battlements): every baseline sample pair is one quad from the projected front line straight
//    up FACE_HEIGHT (the strip's 128 source px), textured by an affine map (u = arc length at 205 px per tile, plus a
//    phase hashed per chain; v = height). Stone: the Wave 4e rubble faces a | b (5 tiles); within GATE_ASHLAR_TILES of
//    a gate the Wave 4d ashlar faces a | b | c (12 tiles), which continue the gate art's dressed stone, blended in over
//    GATE_ASHLAR_BLEND. Timber: a | b (8 tiles).
//  - Top (Wave 4d, the wall walk with the merlons, or the stake tops): a strip of TOP_SOURCE_HEIGHT source px sheared
//    from the face's top edge (its bottom row, the merlons) back to the wall's rear line raised by TOP_HEIGHT, so the
//    wall has a readable top and thickness (stone: the rear line is 0.15 tile behind the baseline).
//  - Seen end-on (a run whose screen direction is within 60 degrees of vertical: along the tile diagonal) the face has
//    no width; such a run draws the diag_top strip, a top view across the wall's thickness, at wall height instead.
//  - Tone: a face turned toward the lower right (a wall along the tile y axis) takes a dark wash of FACE_SHADE.
//  - Gates: the strip stops GATE_HALF_CLEARANCE short of a gate; the existing gate art (or its fallback) stands there.
//  - Modules: a stone tower (90 degree corner) is the Wave 4d drum tower or the Wave 4e square tower b (position
//    hash), a stone pillar (135 degree bend) the Wave 4e chamfered pillar; other stone nodes use the masonry piers,
//    timber the posts.

/**
 * Face height at zoom 1 (D3b-2): 20 px, so face + top (about 28 px) stays under the gate arch and near the old pieces'
 * height (D3b's 32 px face was twice the pieces). The strip's 128 source rows map to it; along the wall the texture
 * keeps the same scale (205 source px per tile), so the stones keep their proportions.
 */
export const FACE_HEIGHT = 20;
const FACE_WIDTH = 512;
const FACE_SOURCE_HEIGHT = 128;
const FACE_PX_PER_TILE = 205;
const FACE_JOIN_FADE = 48;
const FACE_SHADE = 0.22;
/** Ashlar faces reach this far from a gate node along the wall (tiles; the gate's clearance is part of it), ... */
export const GATE_ASHLAR_TILES = GATE_HALF_CLEARANCE + 2;
/** ... and fade into the rubble over the last stretch of it. */
const GATE_ASHLAR_BLEND = 0.5;
const TOP_SOURCE_HEIGHT = 48;
/** The top strip's own screen height (48 source px at the face's 128 px = FACE_HEIGHT scale). */
export const TOP_HEIGHT = FACE_HEIGHT * TOP_SOURCE_HEIGHT / FACE_SOURCE_HEIGHT;
const DIAG_SOURCE_HEIGHT = 64;
/** Face runs: screen direction at least this far from vertical (|dx| / length); steeper runs draw the diag top. */
const FACE_MIN_SPREAD = 0.5;
/** Wall thickness (tiles): the face stands half of it in front of the baseline, the top reaches half of it behind. */
const WALL_THICKNESS: Readonly<Record<WallMaterial, number>> = { stone: 0.3, timber: 0.16 };
/** The wall body seen end-on (the side of a run's end). */
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
  const ashlar = chain.material === "stone" && (chain.startKind === "gate" || chain.endKind === "gate") ? gateFaceCanvas() : null;
  const top = topCanvas(chain.material);
  const diag = diagCanvas(chain.material);
  const canPattern = typeof context.createPattern === "function";
  const pattern = face === null || !canPattern ? null : cachedPattern(context, face);
  const ashlarPattern = ashlar === null || !canPattern ? null : cachedPattern(context, ashlar);
  // Ashlar weight of a stretch position: 1 up to the blend, then down to 0 at GATE_ASHLAR_TILES from the gate.
  const ashlarWeight = (t: number): number => {
    const distance = Math.min(chain.startKind === "gate" ? t : Infinity, chain.endKind === "gate" ? length - t : Infinity);
    return Math.max(0, Math.min(1, (GATE_ASHLAR_TILES - distance) / GATE_ASHLAR_BLEND));
  };
  const topPattern = top === null || !canPattern ? null : cachedPattern(context, top);
  const diagPattern = diag === null || !canPattern ? null : cachedPattern(context, diag);
  // Arc length (world tiles) from the chain start to `low`, then along the stretch.
  const arcStart = arcTo(chain, low);
  const phase = (chain.hash % 12) * FACE_PX_PER_TILE;
  const half = WALL_THICKNESS[chain.material] / 2;
  // Three passes: the body (end faces) of the whole stretch, then the faces (or the end-on top views), then the tops,
  // so a later segment's end face never paints over an earlier face and every top lies over the faces below it.
  for (const pass of ["body", "face", "top"] as const) {
    let arc = arcStart;
    for (let index = 0; index < stretch.length - 1; index += 1) {
      const a = stretch[index] as { point: BoundaryPoint; t: number }; const b = stretch[index + 1] as { point: BoundaryPoint; t: number };
      const dx = b.point.x - a.point.x; const dy = b.point.y - a.point.y;
      const segment = Math.hypot(dx, dy);
      if (segment === 0) continue;
      const ext = { x: dx / segment * QUAD_OVERLAP, y: dy / segment * QUAD_OVERLAP };
      // The face stands on the side toward the camera (world normal with n . (1, 1) >= 0), the top reaches the back.
      let n = { x: -dy / segment, y: dx / segment };
      if (n.x + n.y < 0) n = { x: -n.x, y: -n.y };
      const front = (point: BoundaryPoint, sign: number) => screenOf({ x: point.x + n.x * half + ext.x * sign, y: point.y + n.y * half + ext.y * sign });
      const back = (point: BoundaryPoint, sign: number) => screenOf({ x: point.x - n.x * half + ext.x * sign, y: point.y - n.y * half + ext.y * sign });
      const fa = front(a.point, -1); const fb = front(b.point, 1);
      const ba = back(a.point, -1); const bb = back(b.point, 1);
      const sa = screenOf({ x: a.point.x + n.x * half, y: a.point.y + n.y * half }); const sb = screenOf({ x: b.point.x + n.x * half, y: b.point.y + n.y * half });
      const screenLength = Math.hypot(sb.x - sa.x, sb.y - sa.y);
      const faceRun = screenLength > 0 && Math.abs(sb.x - sa.x) / screenLength >= FACE_MIN_SPREAD;
      const u0 = arc * FACE_PX_PER_TILE + phase; const u1 = (arc + segment) * FACE_PX_PER_TILE + phase;
      arc += segment;
      if (pass === "body") {
        context.beginPath();
        context.moveTo(ba.x, ba.y); context.lineTo(fa.x, fa.y); context.lineTo(fa.x, fa.y - FACE_HEIGHT); context.lineTo(ba.x, ba.y - FACE_HEIGHT);
        context.closePath();
        context.fillStyle = SIDE_COLOUR[chain.material];
        context.fill();
        continue;
      }
      if (pass === "face" && !faceRun) {
        // End-on: the top view across the thickness at wall height (u along the wall, v from the back to the front).
        quad(context, [ba, bb, fb, fa].map(point => ({ x: point.x, y: point.y - FACE_HEIGHT })) as Quad,
          diagPattern, strip(ba, bb, fa, u0, u1, DIAG_SOURCE_HEIGHT, FACE_HEIGHT), SIDE_COLOUR[chain.material]);
        continue;
      }
      if (!faceRun || screenLength < 0.05) continue;
      if (pass === "top") {
        // Sheared from the face's top edge (the strip's bottom row) to the rear line raised by TOP_HEIGHT.
        const rise = FACE_HEIGHT + TOP_HEIGHT;
        const backTopA = { x: ba.x, y: ba.y - rise }; const backTopB = { x: bb.x, y: bb.y - rise };
        quad(context, [backTopA, backTopB, { x: fb.x, y: fb.y - FACE_HEIGHT }, { x: fa.x, y: fa.y - FACE_HEIGHT }],
          topPattern, strip(ba, bb, fa, u0, u1, TOP_SOURCE_HEIGHT, rise, FACE_HEIGHT), CAP_FALLBACK[chain.material]);
        continue;
      }
      context.beginPath();
      context.moveTo(fa.x, fa.y); context.lineTo(fb.x, fb.y); context.lineTo(fb.x, fb.y - FACE_HEIGHT); context.lineTo(fa.x, fa.y - FACE_HEIGHT);
      context.closePath();
      const ma = (sb.x - sa.x) / (u1 - u0); const mb = (sb.y - sa.y) / (u1 - u0);
      const matrix = { a: ma, b: mb, c: 0, d: FACE_HEIGHT / FACE_SOURCE_HEIGHT, e: sa.x - ma * u0, f: sa.y - mb * u0 - FACE_HEIGHT };
      const weight = ashlarPattern === null ? 0 : ashlarWeight((a.t + b.t) / 2);
      // The face's own pattern (rubble, or ashlar when wholly beside a gate), then the ashlar over it while blending.
      const own = weight >= 1 ? ashlarPattern : pattern;
      if (own !== null) {
        own.setTransform(matrix);
        lastTransform.set(own, matrix);
        context.fillStyle = own;
      } else {
        context.fillStyle = chain.material === "stone" ? SEMANTIC_PALETTE.stone : SEMANTIC_PALETTE.earth;
      }
      context.fill();
      if (weight > 0 && weight < 1 && ashlarPattern !== null) {
        ashlarPattern.setTransform(matrix);
        const previousAlpha = context.globalAlpha;
        context.globalAlpha = previousAlpha * weight;
        context.fillStyle = ashlarPattern;
        context.fill();
        context.globalAlpha = previousAlpha;
      }
      // Light: a face along the tile y axis looks lower right (shaded), along x lower left (lit). The wash is the face's
      // own silhouette in ink (same pattern transform), so the transparent tops stay transparent.
      const shade = FACE_SHADE * (dy * dy) / (dx * dx + dy * dy);
      const shadeFace = weight >= 1 ? ashlar : face;
      const shadow = shadeFace === null ? null : shadowCanvas(shadeFace);
      const shadowPattern = shadow === null || own === null ? null : cachedPattern(context, shadow);
      if (shade > 0.005 && shadowPattern !== null && own !== null) {
        shadowPattern.setTransform(patternTransform(own));
        const previousAlpha = context.globalAlpha;
        context.globalAlpha = previousAlpha * shade;
        context.fillStyle = shadowPattern;
        context.fill();
        context.globalAlpha = previousAlpha;
      }
    }
  }
}

type Quad = [BoundaryPoint, BoundaryPoint, BoundaryPoint, BoundaryPoint];
const CAP_FALLBACK: Readonly<Record<WallMaterial, string>> = { stone: SEMANTIC_PALETTE.stoneDark, timber: SEMANTIC_PALETTE.earthDark };

/**
 * Pattern transform of a strip laid from the rear line (row 0) to the front line (last row): u runs along a -> b over
 * [u0, u1], v from the rear line raised by `rise` down to the front line raised by `frontRise` (screen px).
 */
function strip(rearA: BoundaryPoint, rearB: BoundaryPoint, frontA: BoundaryPoint, u0: number, u1: number, rows: number, rise: number, frontRise = rise): Matrix {
  const du = { x: (rearB.x - rearA.x) / (u1 - u0), y: (rearB.y - rearA.y) / (u1 - u0) };
  const origin = { x: rearA.x, y: rearA.y - rise };
  const dv = { x: (frontA.x - rearA.x) / rows, y: (frontA.y - frontRise - origin.y) / rows };
  return { a: du.x, b: du.y, c: dv.x, d: dv.y, e: origin.x - du.x * u0, f: origin.y - du.y * u0 };
}

function quad(context: CanvasRenderingContext2D, corners: Quad, pattern: CanvasPattern | null, matrix: Matrix, fallback: string): void {
  context.beginPath();
  corners.forEach((point, index) => { if (index === 0) context.moveTo(point.x, point.y); else context.lineTo(point.x, point.y); });
  context.closePath();
  if (pattern !== null) { pattern.setTransform(matrix); context.fillStyle = pattern; } else context.fillStyle = fallback;
  context.fill();
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
      if (drawRegisteredGate(context, legacy, kind, true)) continue;
      if (kind === "stone") { for (const solid of stoneWallNodeSolids(legacy)) drawMasonrySolid(context, solid, stoneWallMaterial(), false); }
      else drawGateMarker(context, node.neighbors.flatMap(point => [point, node.point]), node.point, zoom, legacy);
      continue;
    }
    if (node.kind === "tower" && kind === "stone" && drawCornerTower(context, node.point)) continue;
    const size = node.kind === "tower" ? { radius: 0.2, height: FACE_HEIGHT + 10, post: { width: 11, height: FACE_HEIGHT + 10 } }
      : { radius: 0.15, height: FACE_HEIGHT + 4, post: { width: 9, height: FACE_HEIGHT + 4 } };
    drawModule(context, node.point, kind, size, zoom);
  }
  for (const pillar of pillars) {
    if (pillar.material === "stone" && drawPillar135(context, pillar)) continue;
    drawModule(context, pillar.point, pillar.material, { radius: 0.12, height: FACE_HEIGHT + 2, post: { width: 8, height: FACE_HEIGHT + 2 } }, zoom);
  }
}

// Wave 4d corner tower (1774 x 887 source): the drum only (the painted wall stubs left and right would not follow the
// wall's arms; the strips meet the drum instead), its base centre as the anchor, and its display height (above the
// wall walk: FACE_HEIGHT + TOP_HEIGHT is about 28 px at zoom 1).
const TOWER_CROP = { x: 690, y: 214, width: 396, height: 597 } as const;
const TOWER_ANCHOR = { x: 887, y: 790 } as const;
const TOWER_HEIGHT = 44;
// Wave 4e square tower b (same 1774 x 887 frame): the whole tower (it has no wall stubs), anchored on its painted ground
// pivot (900, 855). Its footprint is wider than the drum's, so it is drawn at 36 px wide (0.56 tile, the drum 29 px)
// rather than at the drum's scale (47 px); 48 px high then, 4 px over the drum.
const TOWER_B_CROP = { x: 567, y: 17, width: 640, height: 845 } as const;
const TOWER_B_ANCHOR = { x: 900, y: 855 } as const;
const TOWER_B_HEIGHT = 48;
// 135 degree pillar (same frame): a chamfered buttress for the pillars at 135 degree bends, anchored on its painted
// ground pivot (940, 810), 30 px high (the wall face and top are about 28 px), 22 px wide. Wave 5c (INSTALL-5c) paints a
// left-turn b (long wing back-left) and a right-turn c (long wing back-right) in the Wave 4e pillar's registration:
// the bend's axis arm (the lattice x or y edge, the straight wall) picks the side its long wing points to.
const PILLAR_CROP = { x: 630, y: 101, width: 517, height: 692 } as const;
const PILLAR_ANCHOR = { x: 940, y: 810 } as const;
const PILLAR_HEIGHT = 30;
type Module = { readonly key: WallFaceKey; readonly crop: typeof TOWER_CROP | typeof TOWER_B_CROP | typeof PILLAR_CROP; readonly anchor: BoundaryPoint; readonly height: number };
const MODULES = {
  drum: { key: "stone_tower_corner", crop: TOWER_CROP, anchor: TOWER_ANCHOR, height: TOWER_HEIGHT },
  square: { key: "stone_tower_corner_b", crop: TOWER_B_CROP, anchor: TOWER_B_ANCHOR, height: TOWER_B_HEIGHT },
  pillar: { key: "stone_pillar_135", crop: PILLAR_CROP, anchor: PILLAR_ANCHOR, height: PILLAR_HEIGHT },
  pillarLeft: { key: "stone_pillar_135_b", crop: PILLAR_CROP, anchor: PILLAR_ANCHOR, height: PILLAR_HEIGHT },
  pillarRight: { key: "stone_pillar_135_c", crop: PILLAR_CROP, anchor: PILLAR_ANCHOR, height: PILLAR_HEIGHT },
} as const satisfies Record<string, Module>;
/** Drum or square tower at a 90 degree corner: by a hash of the corner (tile-edge lattice point), about half each. */
export function cornerTowerVariant(point: BoundaryPoint): "drum" | "square" {
  return ((boundaryHash(Math.round(point.x * 2) * 4099 + Math.round(point.y * 2), 0, 97) >>> 3) & 1) === 0 ? "drum" : "square";
}
function drawCornerTower(context: CanvasRenderingContext2D, point: BoundaryPoint): boolean {
  return drawModuleSprite(context, MODULES[cornerTowerVariant(point)], point) || drawModuleSprite(context, MODULES.drum, point);
}
/** Which way a 135 degree bend's long wing runs on screen: the axis arm's screen x (x - y in tile-edge space). */
export function pillarTurn(pillar: Pick<WallPillar, "corner" | "arms">): "left" | "right" {
  const lattice = pillar.corner;
  const axis = pillar.arms.find(arm => arm.x === lattice.x || arm.y === lattice.y) ?? pillar.arms[0];
  if (axis === undefined) return "left";
  return (axis.x - lattice.x) - (axis.y - lattice.y) < 0 ? "left" : "right";
}
function drawPillar135(context: CanvasRenderingContext2D, pillar: WallPillar): boolean {
  return drawModuleSprite(context, pillarTurn(pillar) === "left" ? MODULES.pillarLeft : MODULES.pillarRight, pillar.point)
    || drawModuleSprite(context, MODULES.pillar, pillar.point);
}
// One high-quality downscale per module at twice its display height (browser image cache, not state).
const moduleRasters = new Map<WallFaceKey, RasterizedWorldSprite | null>();
function drawModuleSprite(context: CanvasRenderingContext2D, module: Module, point: BoundaryPoint): boolean {
  const image = wallFaceAsset(module.key);
  if (image === null) return false;
  if (!moduleRasters.has(module.key)) moduleRasters.set(module.key, typeof document === "undefined" ? null : rasterizeWorldSprite(image, module.crop, module.height * 2));
  const raster = moduleRasters.get(module.key) ?? null;
  const scale = module.height / module.crop.height;
  const at = screenOf(point);
  const destination = { x: at.x - (module.anchor.x - module.crop.x) * scale, y: at.y - (module.anchor.y - module.crop.y) * scale,
    width: module.crop.width * scale, height: module.height };
  if (raster !== null) drawCroppedWorldSprite(context, raster.image, raster.source, destination, false, true);
  else drawCroppedWorldSprite(context, image, module.crop, destination, false, true);
  return true;
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

// The ashlar faces beside gates (a | b | c), joined once loaded like the faces.
let joinedGateFace: CanvasImageSource | undefined;
function gateFaceCanvas(): CanvasImageSource | null {
  if (joinedGateFace !== undefined) return joinedGateFace;
  const images = (TERRAIN_VARIANTS.stoneFaceGate as readonly WallFaceKey[]).map(key => wallFaceAsset(key));
  if (images.some(image => image === null)) return null;
  const canvas = typeof document === "undefined" ? images[0] as HTMLImageElement : joinStripImages(images as HTMLImageElement[], FACE_WIDTH, FACE_SOURCE_HEIGHT, FACE_JOIN_FADE);
  if (canvas === null) return null;
  joinedGateFace = canvas;
  return canvas;
}

// The top strips (stone a | b; timber one image) and the end-on top views, loaded with the faces.
const joinedTops = new Map<WallMaterial, CanvasImageSource>();
function topCanvas(material: WallMaterial): CanvasImageSource | null {
  const cached = joinedTops.get(material);
  if (cached !== undefined) return cached;
  const keys = (material === "stone" ? TERRAIN_VARIANTS.stoneTop : TERRAIN_VARIANTS.palisadeTop) as readonly WallFaceKey[];
  const images = keys.map(key => wallFaceAsset(key));
  if (images.some(image => image === null)) return null;
  const canvas = typeof document === "undefined" || images.length === 1 ? images[0] as HTMLImageElement
    : joinStripImages(images as HTMLImageElement[], FACE_WIDTH, TOP_SOURCE_HEIGHT, FACE_JOIN_FADE);
  if (canvas === null) return null;
  joinedTops.set(material, canvas);
  return canvas;
}

function diagCanvas(material: WallMaterial): CanvasImageSource | null {
  return wallFaceAsset((material === "stone" ? TERRAIN_VARIANTS.stoneDiagTop[0] : TERRAIN_VARIANTS.palisadeDiagTop[0]) as WallFaceKey);
}

// A joined face as an ink silhouette (same alpha), for the direction shade (browser image cache, per joined face).
const shadows = new Map<CanvasImageSource, CanvasImageSource>();
function shadowCanvas(face: CanvasImageSource): CanvasImageSource | null {
  const cached = shadows.get(face);
  if (cached !== undefined) return cached;
  if (typeof document === "undefined") return null;
  const width = (face as HTMLCanvasElement).width; const height = (face as HTMLCanvasElement).height;
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const paint = canvas.getContext("2d");
  if (paint === null) return null;
  paint.fillStyle = PALETTE.ink; paint.fillRect(0, 0, width, height);
  paint.globalCompositeOperation = "destination-in";
  drawCroppedWorldSprite(paint, face, { x: 0, y: 0, width, height }, { x: 0, y: 0, width, height }, false, false);
  shadows.set(face, canvas);
  return canvas;
}
