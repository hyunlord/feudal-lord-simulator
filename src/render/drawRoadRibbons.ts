import { SEMANTIC_PALETTE } from "../content/palette";
import type { BoundaryPoint } from "../world/boundary/boundaryGeometry";
import type { RoadCenterlineGraph, RoadChain, RoadMaterial } from "../world/boundary/roadCenterline";
import { boundaryAsset } from "./boundaryAssets";
import type { BoundaryAssetKey } from "./boundaryAssetManifest";
import { tileToScreen } from "./iso";
import { drawCroppedWorldSprite } from "./worldSprite";

// Road ribbons along the smoothed centreline. The top-down strip (512x64, art in rows 8..56) repeats along the path:
// every centreline segment is one quad filled with the strip pattern under that segment's own affine transform
// (tile space -> iso screen is affine, so one matrix per segment is exact). Patterns are only ever used with path
// fill(); never clip()+fillRect (B11 P-F1).

export const ROAD_RIBBON_VISIBLE_WIDTH = 0.55;
const STRIP_WIDTH = 512;
const STRIP_HEIGHT = 64;
const STRIP_ART_ROWS = 48;
/** Isotropic texture scale: the 48 art rows span the visible ribbon width. */
const PX_PER_TILE = STRIP_ART_ROWS / ROAD_RIBBON_VISIBLE_WIDTH;
const HALF_WIDTH = STRIP_HEIGHT / 2 / PX_PER_TILE;
/** Quads overlap by this much along the path so antialiased seams between them do not show the ground. */
const SEAM_OVERLAP = 0.03;
/** Earth/stone blend span centred on the cell boundary where the material changes (about half a tile). */
const TRANSITION_HALF_SPAN = 0.25;
const DISC_RADIUS = ROAD_RIBBON_VISIBLE_WIDTH / 2 * 1.15;
/**
 * Discs (junctions, dead ends) and plazas use an opaque band of the strip, mirrored so it tiles in both directions
 * at the ribbon's own texel size: the earth crown between the ruts, and the stone field. World-aligned, so a plaza
 * that spans several chunks has no seam.
 */
const SURFACE_BANDS = { earth_strip: { from: 28, to: 36 }, stone_strip: { from: 18, to: 46 } } as const;

type Matrix = { readonly a: number; readonly b: number; readonly c: number; readonly d: number; readonly e: number; readonly f: number };
type RibbonPlan = { readonly chains: readonly number[]; readonly fixedPoints: readonly number[]; readonly plazas: readonly number[] };

const patternCache = new WeakMap<CanvasRenderingContext2D, Map<HTMLImageElement, CanvasPattern>>();
const surfaceCache = new WeakMap<CanvasRenderingContext2D, Map<HTMLImageElement, CanvasPattern>>();
const surfaceCanvases = new WeakMap<HTMLImageElement, HTMLCanvasElement>();

export function drawRoadRibbons(context: CanvasRenderingContext2D, graph: RoadCenterlineGraph, plan: RibbonPlan): void {
  const earth = stripPattern(context, "earth_strip");
  const stone = stripPattern(context, "stone_strip");
  const patternFor = (material: RoadMaterial): CanvasPattern | null => material === "stone" ? stone ?? earth : earth;
  const earthSurface = surfacePattern(context, "earth_strip");
  const stoneSurface = surfacePattern(context, "stone_strip");
  const surfaceFor = (material: RoadMaterial): CanvasPattern | null => material === "stone" ? stoneSurface ?? earthSurface : earthSurface;
  for (const index of plan.plazas) {
    const plaza = graph.plazaLoops[index];
    if (plaza === undefined) continue;
    fillWith(context, surfaceFor(plaza.material), SURFACE_TRANSFORM, () => tracePolygon(context, plaza.smoothed));
  }
  for (const index of plan.chains) {
    const chain = graph.chains[index];
    if (chain !== undefined) drawChain(context, chain, earth, stone ?? earth);
  }
  for (const index of plan.fixedPoints) {
    const point = graph.fixedPoints[index];
    if (point === undefined) continue;
    const centre = { x: point.tx, y: point.ty };
    for (const direction of point.bridgeDirections) {
      // Bank stub: the chain ends at the bank cell centre; the deck starts at the water edge half a tile away.
      const end = { x: centre.x + direction.x * (0.5 + SEAM_OVERLAP), y: centre.y + direction.y * (0.5 + SEAM_OVERLAP) };
      fillWith(context, patternFor(point.material), segmentTransform(centre, direction, 0),
        () => traceQuad(context, centre, end, { x: -direction.y, y: direction.x }, { x: -direction.y, y: direction.x }));
    }
    const radius = point.kinds.includes("dead_end") ? ROAD_RIBBON_VISIBLE_WIDTH / 2 : DISC_RADIUS;
    if (point.degree >= 3 || point.kinds.includes("dead_end") || point.kinds.includes("isolated") || point.kinds.includes("plaza")) {
      fillWith(context, surfaceFor(point.material), SURFACE_TRANSFORM, () => traceDisc(context, centre, radius));
    }
  }
}

function drawChain(context: CanvasRenderingContext2D, chain: RoadChain, earth: CanvasPattern | null, stone: CanvasPattern | null): void {
  const line = chain.closed ? [...chain.centreline, chain.centreline[0] as BoundaryPoint] : chain.centreline;
  if (line.length < 2) return;
  const lengths = [0];
  for (let index = 1; index < line.length; index += 1) {
    const a = line[index - 1] as BoundaryPoint; const b = line[index] as BoundaryPoint;
    lengths.push((lengths[index - 1] as number) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = lengths[lengths.length - 1] as number;
  const span = chain.closed ? chain.cells.length : chain.cells.length - 1;
  const normals = line.map((_, index) => vertexNormal(line, index, chain.closed));
  const stoneWeight = (s: number): number => stoneWeightAt(chain, total === 0 ? 0 : s / total * span);
  for (const pass of ["earth", "stone"] as const) {
    for (let index = 0; index + 1 < line.length; index += 1) {
      const a = line[index] as BoundaryPoint; const b = line[index + 1] as BoundaryPoint;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 1e-6) continue;
      const tangent = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
      const weight = stoneWeight(((lengths[index] as number) + (lengths[index + 1] as number)) / 2);
      if (pass === "earth" && weight >= 1) continue;
      if (pass === "stone" && (weight <= 0 || stone === null)) continue;
      const from = { x: a.x - tangent.x * SEAM_OVERLAP, y: a.y - tangent.y * SEAM_OVERLAP };
      const to = { x: b.x + tangent.x * SEAM_OVERLAP, y: b.y + tangent.y * SEAM_OVERLAP };
      const previousAlpha = context.globalAlpha;
      if (pass === "stone") context.globalAlpha = previousAlpha * weight;
      fillWith(context, pass === "stone" ? stone : earth, segmentTransform(a, tangent, lengths[index] as number),
        () => traceQuad(context, from, to, normals[index] as BoundaryPoint, normals[index + 1] as BoundaryPoint));
      context.globalAlpha = previousAlpha;
    }
  }
}

/** Stone share at chain parameter t (cell index units). Blends linearly over +-0.25 tile around a material change. */
export function stoneWeightAt(chain: Pick<RoadChain, "materials" | "closed">, t: number): number {
  const count = chain.materials.length;
  const materialAt = (index: number): number => {
    const wrapped = chain.closed ? ((index % count) + count) % count : Math.max(0, Math.min(count - 1, index));
    return chain.materials[wrapped] === "stone" ? 1 : 0;
  };
  const boundary = Math.floor(t - 0.5) + 0.5;
  for (const edge of [boundary, boundary + 1]) {
    const before = materialAt(Math.floor(edge)); const after = materialAt(Math.ceil(edge));
    if (before !== after && Math.abs(t - edge) < TRANSITION_HALF_SPAN) {
      const blend = (t - (edge - TRANSITION_HALF_SPAN)) / (TRANSITION_HALF_SPAN * 2);
      return before + (after - before) * blend;
    }
  }
  return materialAt(Math.round(t));
}

function vertexNormal(line: readonly BoundaryPoint[], index: number, closed: boolean): BoundaryPoint {
  const count = line.length;
  const at = (offset: number): BoundaryPoint | undefined => {
    const target = index + offset;
    if (closed) return line[((target % (count - 1)) + (count - 1)) % (count - 1)];
    return line[target];
  };
  const previous = at(-1) ?? line[index] as BoundaryPoint; const next = at(1) ?? line[index] as BoundaryPoint;
  const dx = next.x - previous.x; const dy = next.y - previous.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: -dy / length, y: dx / length };
}

function segmentTransform(origin: BoundaryPoint, tangent: BoundaryPoint, arcLength: number): Matrix {
  const normal = { x: -tangent.y, y: tangent.x };
  const u0 = (arcLength * PX_PER_TILE) % STRIP_WIDTH;
  return affine(origin, { x: tangent.x / PX_PER_TILE, y: tangent.y / PX_PER_TILE }, { x: normal.x / PX_PER_TILE, y: normal.y / PX_PER_TILE }, u0, STRIP_HEIGHT / 2);
}

const SURFACE_TRANSFORM = affine({ x: 0, y: 0 }, { x: 1 / PX_PER_TILE, y: 0 }, { x: 0, y: 1 / PX_PER_TILE }, 0, 0);

/** Maps texture (u,v) to screen: tile = origin + uAxis*(u-u0) + vAxis*(v-v0), then the iso projection. */
function affine(origin: BoundaryPoint, uAxis: BoundaryPoint, vAxis: BoundaryPoint, u0: number, v0: number): Matrix {
  const iso = (x: number, y: number) => ({ x: (x - y) * 32, y: (x + y) * 16 });
  const u = iso(uAxis.x, uAxis.y); const v = iso(vAxis.x, vAxis.y);
  const base = tileToScreen(origin.x, origin.y);
  return { a: u.x, b: u.y, c: v.x, d: v.y, e: base.sx - u.x * u0 - v.x * v0, f: base.sy - u.y * u0 - v.y * v0 };
}

function fillWith(context: CanvasRenderingContext2D, pattern: CanvasPattern | null, transform: Matrix, trace: () => void): void {
  trace();
  if (pattern === null) {
    context.fillStyle = SEMANTIC_PALETTE.earth;
    context.fill();
    return;
  }
  pattern.setTransform(transform);
  context.fillStyle = pattern;
  context.fill();
}

function traceQuad(context: CanvasRenderingContext2D, from: BoundaryPoint, to: BoundaryPoint, fromNormal: BoundaryPoint, toNormal: BoundaryPoint): void {
  const corners = [
    { x: from.x + fromNormal.x * HALF_WIDTH, y: from.y + fromNormal.y * HALF_WIDTH },
    { x: to.x + toNormal.x * HALF_WIDTH, y: to.y + toNormal.y * HALF_WIDTH },
    { x: to.x - toNormal.x * HALF_WIDTH, y: to.y - toNormal.y * HALF_WIDTH },
    { x: from.x - fromNormal.x * HALF_WIDTH, y: from.y - fromNormal.y * HALF_WIDTH },
  ];
  tracePolygon(context, corners);
}

function traceDisc(context: CanvasRenderingContext2D, centre: BoundaryPoint, radius: number): void {
  tracePolygon(context, Array.from({ length: 20 }, (_, index) => {
    const angle = index * Math.PI / 10;
    return { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius };
  }));
}

function tracePolygon(context: CanvasRenderingContext2D, points: readonly BoundaryPoint[]): void {
  context.beginPath();
  points.forEach((point, index) => {
    const screen = tileToScreen(point.x, point.y);
    if (index === 0) context.moveTo(screen.sx, screen.sy);
    else context.lineTo(screen.sx, screen.sy);
  });
  context.closePath();
}

function stripPattern(context: CanvasRenderingContext2D, key: Extract<BoundaryAssetKey, "earth_strip" | "stone_strip">): CanvasPattern | null {
  const image = boundaryAsset(key);
  if (image === null || typeof context.createPattern !== "function") return null;
  let cache = patternCache.get(context);
  if (cache === undefined) { cache = new Map(); patternCache.set(context, cache); }
  const cached = cache.get(image);
  if (cached !== undefined) return cached;
  const pattern = context.createPattern(image, "repeat");
  if (pattern !== null) cache.set(image, pattern);
  return pattern;
}

function surfacePattern(context: CanvasRenderingContext2D, key: Extract<BoundaryAssetKey, "earth_strip" | "stone_strip">): CanvasPattern | null {
  const image = boundaryAsset(key);
  if (image === null || typeof document === "undefined" || typeof context.createPattern !== "function") return null;
  let cache = surfaceCache.get(context);
  if (cache === undefined) { cache = new Map(); surfaceCache.set(context, cache); }
  const cached = cache.get(image);
  if (cached !== undefined) return cached;
  let canvas = surfaceCanvases.get(image);
  if (canvas === undefined) {
    const band = SURFACE_BANDS[key];
    const rows = band.to - band.from;
    canvas = document.createElement("canvas");
    canvas.width = STRIP_WIDTH; canvas.height = rows * 2;
    const paint = canvas.getContext("2d");
    if (paint === null) return null;
    const source = { x: 0, y: band.from, width: STRIP_WIDTH, height: rows };
    drawCroppedWorldSprite(paint, image, source, { x: 0, y: 0, width: STRIP_WIDTH, height: rows }, false, true);
    paint.save();
    paint.translate(0, rows * 2);
    paint.scale(1, -1);
    drawCroppedWorldSprite(paint, image, source, { x: 0, y: 0, width: STRIP_WIDTH, height: rows }, false, true);
    paint.restore();
    surfaceCanvases.set(image, canvas);
  }
  const pattern = context.createPattern(canvas, "repeat");
  if (pattern !== null) cache.set(image, pattern);
  return pattern;
}
