import { PALETTE, SEMANTIC_PALETTE } from "../content/palette";
import type { BoundaryPoint } from "../world/boundary/boundaryGeometry";
import type { RoadCenterlineGraph, RoadChain, RoadMaterial } from "../world/boundary/roadCenterline";
import type { JunctionPatch, PortalCap, RibbonArm, RibbonCap, RoadRibbonLayout, ShoulderDecal } from "../world/boundary/roadRibbonLayout";
import { boundaryAsset } from "./boundaryAssets";
import type { RoadStripSet } from "./boundaryAssetManifest";
import { tileToScreen } from "./iso";
import { roadStripSet } from "./roadRibbonStyle";
import { withAlpha } from "./style";
import { drawCroppedWorldSprite } from "./worldSprite";

// Road ribbons along the smoothed centreline. A top-down strip (512x64 per image) repeats along the path: every
// centreline segment is one quad filled with the strip pattern under that segment's own affine transform (tile space
// -> iso screen is affine, so one matrix per segment is exact). Patterns are only ever used with path fill(); never a
// clipped pattern rectangle fill (B11 P-F1).
//
// D1a-2 (research C04/C05/C07): the strip set (manifest ROAD_STRIP_SETS) decides which rows span the ribbon width
// and how hard the ruts read; strips with more than one image alternate span by span through a crossfaded canvas.
// Junction nodes are one patch each (drawn before the chains, which stop half a tile short of the node), dead ends a
// rounded cap, portals a rut-free threshold, and grass tufts break up both shoulders.
//
// Cache (AGENTS rule 10): strip canvases below are keyed by (context-independent) source image + strip set, built once
// per image load; they are pure functions of the decoded pixels. Everything drawn here lands in ground road chunks,
// whose content key hashes the ribbon layout (groundBoundaryScene).

const STRIP_IMAGE_WIDTH = 512;
const STRIP_HEIGHT = 64;
/** Quads overlap by this much along the path so antialiased seams between them do not show the ground. */
const SEAM_OVERLAP = 0.03;
/** Earth/stone blend span centred on the cell boundary where the material changes (about half a tile). */
const TRANSITION_HALF_SPAN = 0.25;
/** Crossfade half-width (texels) where strip image a meets image b. */
const JOIN_FADE = 40;
const CAP_TEXELS = 128;
const CAP_WEDGES = 8;

type Matrix = { readonly a: number; readonly b: number; readonly c: number; readonly d: number; readonly e: number; readonly f: number };
type RibbonPlan = { readonly chains: readonly number[]; readonly fixedPoints: readonly number[]; readonly plazas: readonly number[] };

type StripSource = {
  readonly image: CanvasImageSource;
  /** Pattern period along the road, texels. */
  readonly period: number;
  readonly set: RoadStripSet;
  readonly pxPerTile: number;
  /** Half the strip height in tiles (quads cover the whole strip height, transparent rows included). */
  readonly halfWidth: number;
  readonly rutFree: CanvasImageSource | null;
  readonly ruts: CanvasImageSource | null;
};

const sourceCanvases = new WeakMap<object, Map<string, { image: CanvasImageSource; rutFree: CanvasImageSource | null; ruts: CanvasImageSource | null }>>();
const patternCache = new WeakMap<CanvasRenderingContext2D, Map<CanvasImageSource, Map<string, CanvasPattern | null>>>();

export function drawRoadRibbons(context: CanvasRenderingContext2D, graph: RoadCenterlineGraph, layout: RoadRibbonLayout, plan: RibbonPlan): void {
  const sources = { earth: stripSource("earth", layout.width), stone: stripSource("stone", layout.width) };
  const sourceFor = (material: RoadMaterial): StripSource | null => material === "stone" ? sources.stone ?? sources.earth : sources.earth;
  for (const index of plan.plazas) {
    const plaza = graph.plazaLoops[index];
    if (plaza === undefined) continue;
    const source = sourceFor(plaza.material);
    fillWith(context, surfacePattern(context, source, "crown"), surfaceTransform(source), () => tracePolygon(context, plaza.smoothed));
  }
  for (const index of plan.fixedPoints) {
    const patch = layout.junctions[index];
    if (patch !== null && patch !== undefined) drawJunction(context, graph, patch, sourceFor(patch.material), layout.width);
  }
  for (const index of plan.chains) {
    const chain = graph.chains[index];
    const trim = layout.trims[index];
    if (chain !== undefined && trim !== undefined) drawChain(context, chain, trim, sources.earth, sources.stone ?? sources.earth);
  }
  for (const index of plan.fixedPoints) {
    const point = graph.fixedPoints[index];
    if (point === undefined) continue;
    const source = sourceFor(point.material);
    for (const end of layout.stubs[index] ?? []) {
      const centre = { x: point.tx, y: point.ty };
      const direction = unit({ x: end.x - centre.x, y: end.y - centre.y });
      const to = { x: end.x + direction.x * SEAM_OVERLAP, y: end.y + direction.y * SEAM_OVERLAP };
      const normal = { x: -direction.y, y: direction.x };
      fillWith(context, stripPatternOf(context, source), segmentTransform(source, centre, direction, 0),
        () => traceQuad(context, centre, to, normal, normal, source?.halfWidth ?? layout.width / 2));
    }
    const cap = layout.caps[index];
    if (cap !== null && cap !== undefined) drawCap(context, cap, source, layout.width);
    for (const portal of layout.portalCaps[index] ?? []) drawPortalCap(context, portal, sourceFor, layout.width);
  }
  const decals: ShoulderDecal[] = [];
  for (const index of plan.chains) decals.push(...(layout.shoulders[index] ?? []));
  for (const index of plan.fixedPoints) { const decal = layout.capDecals[index]; if (decal !== null && decal !== undefined) decals.push(decal); }
  drawShoulderDecals(context, decals);
}

/**
 * Fills a path traced by `trace` with the ribbon's crown surface of `material` (C1d building aprons): the same band,
 * texel size and world anchor as junction patches and plazas, so an apron reads as the road's own ground.
 */
export function fillRoadSurface(context: CanvasRenderingContext2D, material: RoadMaterial, width: number, trace: () => void): void {
  const earth = stripSource("earth", width);
  const source = material === "stone" ? stripSource("stone", width) ?? earth : earth;
  fillWith(context, surfacePattern(context, source, "crown"), surfaceTransform(source), trace);
}

// ---- chains -------------------------------------------------------------------------------------------------------

function drawChain(context: CanvasRenderingContext2D, chain: RoadChain, trim: { readonly start: number; readonly end: number },
  earth: StripSource | null, stone: StripSource | null): void {
  const line = chain.closed ? [...chain.centreline, chain.centreline[0] as BoundaryPoint] : chain.centreline;
  if (line.length < 2) return;
  const lengths = [0];
  for (let index = 1; index < line.length; index += 1) {
    const a = line[index - 1] as BoundaryPoint; const b = line[index] as BoundaryPoint;
    lengths.push((lengths[index - 1] as number) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = lengths[lengths.length - 1] as number;
  const from = trim.start; const to = total - trim.end;
  if (to - from < 1e-6) return;
  const span = chain.closed ? chain.cells.length : chain.cells.length - 1;
  const normals = line.map((_, index) => vertexNormal(line, index, chain.closed));
  const stoneWeight = (s: number): number => stoneWeightAt(chain, total === 0 ? 0 : s / total * span);
  const phase = chain.hash % 4096;
  for (const pass of ["earth", "stone"] as const) {
    const source = pass === "stone" ? stone : earth;
    const pattern = stripPatternOf(context, source);
    const halfWidth = source?.halfWidth ?? 0.4;
    for (let index = 0; index + 1 < line.length; index += 1) {
      const s0 = lengths[index] as number; const s1 = lengths[index + 1] as number;
      if (s1 <= from || s0 >= to) continue;
      const a = line[index] as BoundaryPoint; const b = line[index + 1] as BoundaryPoint;
      const length = s1 - s0;
      if (length < 1e-6) continue;
      const tangent = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
      const weight = stoneWeight((Math.max(s0, from) + Math.min(s1, to)) / 2);
      if (pass === "earth" && weight >= 1) continue;
      if (pass === "stone" && (weight <= 0 || stone === null)) continue;
      // Interior seams overlap; a trimmed end stops exactly at the junction patch, so no two ribbons overlap there.
      const startCut = s0 < from; const endCut = s1 > to;
      const head = startCut ? from - s0 : (s0 === from && trim.start > 0 ? 0 : -SEAM_OVERLAP);
      const tail = endCut ? to - s0 : (s1 === to && trim.end > 0 ? length : length + SEAM_OVERLAP);
      const at = (distance: number): BoundaryPoint => ({ x: a.x + tangent.x * distance, y: a.y + tangent.y * distance });
      const normalAt = (distance: number): BoundaryPoint => lerpNormal(normals[index] as BoundaryPoint, normals[index + 1] as BoundaryPoint, Math.max(0, Math.min(1, distance / length)));
      const previousAlpha = context.globalAlpha;
      if (pass === "stone") context.globalAlpha = previousAlpha * weight;
      fillWith(context, pattern, segmentTransform(source, a, tangent, s0 + phase / (source?.pxPerTile ?? 1)),
        () => traceQuad(context, at(head), at(tail), normalAt(head), normalAt(tail), halfWidth));
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

// ---- junctions ----------------------------------------------------------------------------------------------------

/**
 * One patch per junction: the union of every arm piece (node -> cut, extended a hair under the chain), a centre disc
 * and a fillet in each corner narrower than 150 degrees, filled once per layer (a single fill paints the union, so the
 * arms never double up). Layers: two soft shoulder rings, the crown, then each arm's ruts re-projected up to the
 * node centre in that chain's own strip phase, and for a crossing one worn patch in the middle.
 */
function drawJunction(context: CanvasRenderingContext2D, graph: RoadCenterlineGraph, patch: JunctionPatch, source: StripSource | null, width: number): void {
  const half = width / 2;
  const shoulder = surfacePattern(context, source, "shoulder");
  const crown = surfacePattern(context, source, "crown");
  const transform = surfaceTransform(source);
  const previousAlpha = context.globalAlpha;
  context.globalAlpha = previousAlpha * 0.6;
  fillWith(context, shoulder, transform, () => traceJunctionUnion(context, patch, half));
  fillWith(context, shoulder, transform, () => traceJunctionUnion(context, patch, half - 0.035 * width / 0.55));
  context.globalAlpha = previousAlpha;
  fillWith(context, crown, transform, () => traceJunctionUnion(context, patch, half - 0.09 * width / 0.55));
  const ruts = source?.ruts ?? null;
  if (ruts !== null && source !== null) {
    const pattern = cachedPattern(context, ruts, "repeat");
    // Ruts from several arms cross in the patch; a little lighter than on the ribbons so the node does not read as a grid.
    context.globalAlpha = previousAlpha * source.set.rutContrast * 0.75;
    for (const arm of patch.arms) {
      if (arm.chain === null) continue;
      const chain = graph.chains[arm.chain];
      if (chain === undefined) continue;
      drawArmRuts(context, arm, chain, source, pattern);
    }
    context.globalAlpha = previousAlpha;
  }
  if (patch.crossing) drawWornCentre(context, patch.centre, width);
}

function traceJunctionUnion(context: CanvasRenderingContext2D, patch: JunctionPatch, half: number): void {
  context.beginPath();
  for (const arm of patch.arms) {
    const points = extendEnd(arm.points, SEAM_OVERLAP);
    const left: BoundaryPoint[] = []; const right: BoundaryPoint[] = [];
    points.forEach((point, index) => {
      const normal = vertexNormal(points, index, false);
      left.push({ x: point.x + normal.x * half, y: point.y + normal.y * half });
      right.push({ x: point.x - normal.x * half, y: point.y - normal.y * half });
    });
    addSubpath(context, [...left, ...right.reverse()]);
  }
  addSubpath(context, Array.from({ length: 20 }, (_, index) => {
    const angle = index * Math.PI / 10;
    return { x: patch.centre.x + Math.cos(angle) * half, y: patch.centre.y + Math.sin(angle) * half };
  }));
  const count = patch.arms.length;
  for (let index = 0; index < count; index += 1) {
    const a = armDirection(patch.arms[index] as RibbonArm); const b = armDirection(patch.arms[(index + 1) % count] as RibbonArm);
    const gap = normaliseAngle(Math.atan2(b.y, b.x) - Math.atan2(a.y, a.x));
    if (gap < 0.35 || gap > 2.6) continue;
    // The corner where arm a's edge facing b meets arm b's edge facing a; the fillet rounds it off.
    const na = { x: -a.y, y: a.x }; const nb = { x: b.y, y: -b.x };
    const corner = lineIntersection({ x: patch.centre.x + na.x * half, y: patch.centre.y + na.y * half }, a,
      { x: patch.centre.x + nb.x * half, y: patch.centre.y + nb.y * half }, b);
    if (corner === null) continue;
    const radius = half * 0.7;
    const start = { x: corner.x + a.x * radius, y: corner.y + a.y * radius };
    const end = { x: corner.x + b.x * radius, y: corner.y + b.y * radius };
    const fillet: BoundaryPoint[] = [corner, start];
    for (let step = 1; step < 6; step += 1) {
      const t = step / 6; const u = 1 - t;
      fillet.push({ x: u * u * start.x + 2 * u * t * corner.x + t * t * end.x, y: u * u * start.y + 2 * u * t * corner.y + t * t * end.y });
    }
    fillet.push(end);
    addSubpath(context, fillet);
  }
}

function drawArmRuts(context: CanvasRenderingContext2D, arm: RibbonArm, chain: RoadChain, source: StripSource, pattern: CanvasPattern | null): void {
  // Walk the arm in chain direction so the strip phase continues exactly from the trimmed ribbon.
  const forward = arm.arcAtNode === 0;
  const points = forward ? arm.points : [...arm.points].reverse();
  const phase = chain.hash % 4096;
  let arc = forward ? 0 : arm.arcAtNode - polyLength(points);
  for (let index = 0; index + 1 < points.length; index += 1) {
    const a = points[index] as BoundaryPoint; const b = points[index + 1] as BoundaryPoint;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length < 1e-6) continue;
    const tangent = { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
    const normal = { x: -tangent.y, y: tangent.x };
    const overlap = index + 2 < points.length ? SEAM_OVERLAP : 0;
    fillWith(context, pattern, segmentTransform(source, a, tangent, arc + phase / source.pxPerTile),
      () => traceQuad(context, a, { x: b.x + tangent.x * overlap, y: b.y + tangent.y * overlap }, normal, normal, source.halfWidth));
    arc += length;
  }
}

/** Worn earth in the middle of a crossing: stacked low-alpha discs, so the darkening falls off toward the rim. */
function drawWornCentre(context: CanvasRenderingContext2D, centre: BoundaryPoint, width: number): void {
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.earthDark, 0.08);
  for (const share of [1, 0.8, 0.62, 0.46, 0.3]) {
    const radius = width * 0.62 * share;
    tracePolygon(context, Array.from({ length: 24 }, (_, index) => {
      const angle = index * Math.PI / 12;
      return { x: centre.x + Math.cos(angle) * radius, y: centre.y + Math.sin(angle) * radius };
    }));
    context.fill();
  }
}

// ---- caps and portals ---------------------------------------------------------------------------------------------

/**
 * Rounded end past the last cell centre: wedges whose strip rows run from the centre row (at the cell centre) to the
 * strip edge (at the rim), so the rim keeps the strip's own soft edge. A full disc for an isolated road cell.
 */
function drawCap(context: CanvasRenderingContext2D, cap: RibbonCap, source: StripSource | null, width: number): void {
  const pattern = stripPatternOf(context, source);
  const radius = source?.halfWidth ?? width / 2;
  const facing = cap.direction ?? { x: 1, y: 0 };
  const base = Math.atan2(facing.y, facing.x);
  const sweep = cap.direction === null ? Math.PI * 2 : Math.PI;
  const wedges = cap.direction === null ? CAP_WEDGES * 2 : CAP_WEDGES;
  const centreRow = source === null ? STRIP_HEIGHT / 2 : (source.set.artRows[0] + source.set.artRows[1]) / 2;
  const rimTexels = source === null ? 1 : radius * source.pxPerTile * sweep / wedges;
  for (let index = 0; index < wedges; index += 1) {
    const a0 = base - sweep / 2 + sweep * index / wedges - 0.01; const a1 = base - sweep / 2 + sweep * (index + 1) / wedges + 0.01;
    const r0 = { x: cap.centre.x + Math.cos(a0) * radius, y: cap.centre.y + Math.sin(a0) * radius };
    const r1 = { x: cap.centre.x + Math.cos(a1) * radius, y: cap.centre.y + Math.sin(a1) * radius };
    const u = index * rimTexels;
    const matrix = affineFromTriangles([{ x: u + rimTexels / 2, y: centreRow }, { x: u, y: 0 }, { x: u + rimTexels, y: 0 }],
      [cap.centre, r0, r1]);
    fillWith(context, pattern, matrix, () => tracePolygon(context, [cap.centre, r0, r1]));
  }
}

/**
 * One tile of rut-free threshold at a portal: centred on a gate crossing (fading in and out), or ending at a bridge
 * deck (fading in toward the deck). The strip keeps running underneath, so the fade never shows the ground.
 */
function drawPortalCap(context: CanvasRenderingContext2D, portal: PortalCap, sourceFor: (material: RoadMaterial) => StripSource | null, width: number): void {
  const halves = portal.kind === "gate"
    ? [{ from: -0.5, to: 0, material: portal.farMaterial, profile: "rise" as const }, { from: 0, to: 0.5, material: portal.material, profile: "fall" as const }]
    : [{ from: 1, to: 0, material: portal.material, profile: "rise" as const }];
  for (const half of halves) {
    const source = sourceFor(half.material);
    if (source === null || source.rutFree === null) continue;
    const canvas = capCanvas(source, half.profile);
    if (canvas === null) continue;
    const start = { x: portal.anchor.x + portal.axis.x * half.from, y: portal.anchor.y + portal.axis.y * half.from };
    const end = { x: portal.anchor.x + portal.axis.x * half.to, y: portal.anchor.y + portal.axis.y * half.to };
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const tangent = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
    const normal = { x: -tangent.y, y: tangent.x };
    const texelsPerTile = CAP_TEXELS / length;
    const matrix = affine(start, { x: tangent.x / texelsPerTile, y: tangent.y / texelsPerTile },
      { x: normal.x / source.pxPerTile, y: normal.y / source.pxPerTile }, 0, STRIP_HEIGHT / 2);
    fillWith(context, cachedPattern(context, canvas, "no-repeat"), matrix, () => traceQuad(context, start, end, normal, normal, source.halfWidth));
  }
  void width;
}

// ---- shoulder tufts -----------------------------------------------------------------------------------------------

/** grass_edge-v1 crop windows (source px): the tuft band runs from y~47 at x 16 to y~25 at x 112. */
const TUFT_CROP_WIDTH = 40;
const TUFT_CROPS = [16, 28, 40, 52, 64, 76] as const;
const bandYAt = (x: number): number => 47 - 0.23 * (x - 16);
/** Tufts at 80% of the decal's authored size and 85% opacity: breakup at the edge, not a row of bushes. */
const TUFT_SCALE = 0.8;
const TUFT_ALPHA = 0.85;

function drawShoulderDecals(context: CanvasRenderingContext2D, decals: readonly ShoulderDecal[]): void {
  const image = boundaryAsset("grass_edge");
  if (image === null || decals.length === 0) return;
  const previousAlpha = context.globalAlpha;
  context.globalAlpha = previousAlpha * TUFT_ALPHA;
  const placed = decals.map(decal => ({ decal, screen: tileToScreen(decal.anchor.x, decal.anchor.y) }))
    .sort((a, b) => a.screen.sy - b.screen.sy || a.screen.sx - b.screen.sx);
  for (const { decal, screen } of placed) {
    const crop = TUFT_CROPS[decal.variant % TUFT_CROPS.length] as number;
    const flip = decal.variant >= TUFT_CROPS.length;
    const scale = 0.5 * TUFT_SCALE * decal.scale;
    const bandY = bandYAt(crop + TUFT_CROP_WIDTH / 2);
    const destination = { x: screen.sx - TUFT_CROP_WIDTH / 2 * scale, y: screen.sy - bandY * scale, width: TUFT_CROP_WIDTH * scale, height: STRIP_HEIGHT * scale };
    const source = { x: crop, y: 0, width: TUFT_CROP_WIDTH, height: STRIP_HEIGHT };
    if (!flip) { drawCroppedWorldSprite(context, image, source, destination, false, true); continue; }
    context.save();
    context.translate(screen.sx * 2, 0);
    context.scale(-1, 1);
    drawCroppedWorldSprite(context, image, source, destination, false, true);
    context.restore();
  }
  context.globalAlpha = previousAlpha;
}

// ---- strip sources ------------------------------------------------------------------------------------------------

/**
 * The drawable strip for a material: in a browser, the set's images laid side by side (crossfaded at every join, so
 * a, b, a, b never shows a seam) with the ruts blended toward a vertical blur by (1 - rutContrast), plus a rut-free
 * copy (portal thresholds) and a ruts-only copy (junction re-projection). Without a DOM (tests) the first image as is.
 */
function stripSource(material: RoadMaterial, width: number): StripSource | null {
  const set = roadStripSet(material);
  const images = set.images.map(key => boundaryAsset(key));
  const first = images[0];
  if (first === undefined || first === null || images.some(image => image === null)) return null;
  const pxPerTile = (set.artRows[1] - set.artRows[0]) / width;
  const base = { set, pxPerTile, halfWidth: STRIP_HEIGHT / 2 / pxPerTile };
  if (typeof document === "undefined") return { ...base, image: first, period: STRIP_IMAGE_WIDTH, rutFree: null, ruts: null };
  let perImage = sourceCanvases.get(first);
  if (perImage === undefined) { perImage = new Map(); sourceCanvases.set(first, perImage); }
  const key = `${set.images.join("+")}|${set.rutContrast}|${set.artRows.join(",")}`;
  let built = perImage.get(key);
  if (built === undefined) {
    built = buildStripCanvases(images as HTMLImageElement[], set) ?? { image: first, rutFree: null, ruts: null };
    perImage.set(key, built);
  }
  return { ...base, image: built.image, period: STRIP_IMAGE_WIDTH * images.length, rutFree: built.rutFree, ruts: built.ruts };
}

function buildStripCanvases(images: readonly HTMLImageElement[], set: RoadStripSet): { image: HTMLCanvasElement; rutFree: HTMLCanvasElement; ruts: HTMLCanvasElement } | null {
  const width = STRIP_IMAGE_WIDTH * images.length;
  const joined = canvas2d(width, STRIP_HEIGHT);
  if (joined === null) return null;
  images.forEach((image, index) => blit(joined.context, image, 0, 0, STRIP_IMAGE_WIDTH, STRIP_HEIGHT, index * STRIP_IMAGE_WIDTH, 0));
  if (images.length > 1) {
    images.forEach((left, index) => {
      const right = images[(index + 1) % images.length] as HTMLImageElement;
      const join = ((index + 1) * STRIP_IMAGE_WIDTH) % width;
      const band = canvas2d(JOIN_FADE * 2, STRIP_HEIGHT); const incoming = canvas2d(JOIN_FADE * 2, STRIP_HEIGHT);
      if (band === null || incoming === null) return;
      // Both images wrap seamlessly on their own, so each can be continued across the join; blend the two continuations.
      blit(band.context, left, STRIP_IMAGE_WIDTH - JOIN_FADE, 0, JOIN_FADE, STRIP_HEIGHT, 0, 0);
      blit(band.context, left, 0, 0, JOIN_FADE, STRIP_HEIGHT, JOIN_FADE, 0);
      blit(incoming.context, right, STRIP_IMAGE_WIDTH - JOIN_FADE, 0, JOIN_FADE, STRIP_HEIGHT, 0, 0);
      blit(incoming.context, right, 0, 0, JOIN_FADE, STRIP_HEIGHT, JOIN_FADE, 0);
      mask(incoming.context, JOIN_FADE * 2, STRIP_HEIGHT, "x", [[0, 0], [1, 1]]);
      blit(band.context, incoming.canvas, 0, 0, JOIN_FADE * 2, STRIP_HEIGHT, 0, 0);
      for (const offset of join === 0 ? [width - JOIN_FADE, -JOIN_FADE] : [join - JOIN_FADE]) {
        joined.context.clearRect(offset, 0, JOIN_FADE * 2, STRIP_HEIGHT);
        blit(joined.context, band.canvas, 0, 0, JOIN_FADE * 2, STRIP_HEIGHT, offset, 0);
      }
    });
  }
  const [top, bottom] = set.artRows;
  const row = (fraction: number): number => (top + (bottom - top) * fraction) / STRIP_HEIGHT;
  // Vertical box blur by progressive averaging (copy k drawn at alpha 1/(k+1) leaves the exact mean).
  const blurred = canvas2d(width, STRIP_HEIGHT);
  if (blurred === null) return null;
  const offsets = [0, -2, 2, -4, 4, -6, 6];
  offsets.forEach((offset, index) => { blurred.context.globalAlpha = 1 / (index + 1); blit(blurred.context, joined.canvas, 0, 0, width, STRIP_HEIGHT, 0, offset); });
  blurred.context.globalAlpha = 1;
  mask(blurred.context, width, STRIP_HEIGHT, "y", [[row(0.14), 0], [row(0.26), 1], [row(0.74), 1], [row(0.86), 0]]);
  const rutFree = canvas2d(width, STRIP_HEIGHT);
  const tamed = canvas2d(width, STRIP_HEIGHT);
  const ruts = canvas2d(width, STRIP_HEIGHT);
  if (rutFree === null || tamed === null || ruts === null) return null;
  for (const [target, alpha] of [[rutFree, 1], [tamed, 1 - set.rutContrast]] as const) {
    blit(target.context, joined.canvas, 0, 0, width, STRIP_HEIGHT, 0, 0);
    if (alpha <= 0) continue;
    target.context.globalCompositeOperation = "source-atop";
    target.context.globalAlpha = alpha;
    blit(target.context, blurred.canvas, 0, 0, width, STRIP_HEIGHT, 0, 0);
    target.context.globalAlpha = 1;
    target.context.globalCompositeOperation = "source-over";
  }
  blit(ruts.context, joined.canvas, 0, 0, width, STRIP_HEIGHT, 0, 0);
  mask(ruts.context, width, STRIP_HEIGHT, "y", [[row(0.2), 0], [row(0.3), 1], [row(0.7), 1], [row(0.8), 0]]);
  return { image: tamed.canvas, rutFree: rutFree.canvas, ruts: ruts.canvas };
}

const capCanvases = new WeakMap<CanvasImageSource, Map<string, HTMLCanvasElement | null>>();
function capCanvas(source: StripSource, profile: "rise" | "fall"): HTMLCanvasElement | null {
  const rutFree = source.rutFree;
  if (rutFree === null) return null;
  let map = capCanvases.get(rutFree);
  if (map === undefined) { map = new Map(); capCanvases.set(rutFree, map); }
  if (map.has(profile)) return map.get(profile) ?? null;
  const cap = canvas2d(CAP_TEXELS, STRIP_HEIGHT);
  if (cap !== null) {
    blit(cap.context, rutFree, 0, 0, CAP_TEXELS, STRIP_HEIGHT, 0, 0);
    mask(cap.context, CAP_TEXELS, STRIP_HEIGHT, "x", profile === "rise" ? [[0, 0], [0.7, 0.8], [1, 0.8]] : [[0, 0.8], [0.3, 0.8], [1, 0]]);
  }
  map.set(profile, cap?.canvas ?? null);
  return cap?.canvas ?? null;
}

function canvas2d(width: number, height: number): { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D } | null {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  return context === null ? null : { canvas, context };
}

/**
 * Multiplies alpha by a piecewise linear profile along x or y (stops are [fraction of the size, alpha]). The profile is
 * painted one texel line at a time into its own canvas (the render guards keep canvas gradients out) and applied once
 * with destination-in: destination-in clears everything outside the shape drawn, so applying it line by line (as until
 * D3b) left only the last line and emptied the join crossfades and the rut masks.
 */
function mask(context: CanvasRenderingContext2D, width: number, height: number, axis: "x" | "y", stops: readonly (readonly [number, number])[]): void {
  const size = axis === "x" ? width : height;
  const profile = (at: number): number => {
    const first = stops[0] as readonly [number, number]; const last = stops[stops.length - 1] as readonly [number, number];
    if (at <= first[0]) return first[1];
    for (let index = 1; index < stops.length; index += 1) {
      const a = stops[index - 1] as readonly [number, number]; const b = stops[index] as readonly [number, number];
      if (at <= b[0]) return b[0] === a[0] ? b[1] : a[1] + (b[1] - a[1]) * (at - a[0]) / (b[0] - a[0]);
    }
    return last[1];
  };
  const ramp = canvas2d(width, height);
  if (ramp === null) return;
  for (let line = 0; line < size; line += 1) {
    ramp.context.fillStyle = withAlpha(PALETTE.ink, Math.max(0, Math.min(1, profile((line + 0.5) / size))));
    ramp.context.beginPath();
    if (axis === "x") ramp.context.rect(line, 0, 1, height); else ramp.context.rect(0, line, width, 1);
    ramp.context.fill();
  }
  context.globalCompositeOperation = "destination-in";
  blit(context, ramp.canvas, 0, 0, width, height, 0, 0);
  context.globalCompositeOperation = "source-over";
}

function blit(context: CanvasRenderingContext2D, image: CanvasImageSource, sx: number, sy: number, width: number, height: number, dx: number, dy: number): void {
  drawCroppedWorldSprite(context, image, { x: sx, y: sy, width, height }, { x: dx, y: dy, width, height }, false, false);
}

function stripPatternOf(context: CanvasRenderingContext2D, source: StripSource | null): CanvasPattern | null {
  return source === null ? null : cachedPattern(context, source.image, "repeat");
}

function cachedPattern(context: CanvasRenderingContext2D, image: CanvasImageSource, repetition: string): CanvasPattern | null {
  if (typeof context.createPattern !== "function") return null;
  let perContext = patternCache.get(context);
  if (perContext === undefined) { perContext = new Map(); patternCache.set(context, perContext); }
  let perImage = perContext.get(image);
  if (perImage === undefined) { perImage = new Map(); perContext.set(image, perImage); }
  if (perImage.has(repetition)) return perImage.get(repetition) ?? null;
  const pattern = context.createPattern(image, repetition);
  perImage.set(repetition, pattern);
  return pattern;
}

/**
 * Plazas and junction patches use an opaque band of the strip, mirrored so it tiles in both directions at the
 * ribbon's own texel size: the crown between the ruts, or the shoulder just inside the edge. World-aligned, so a
 * plaza that spans several chunks has no seam.
 */
const bandCanvases = new WeakMap<CanvasImageSource, Map<string, HTMLCanvasElement | null>>();
function surfacePattern(context: CanvasRenderingContext2D, source: StripSource | null, band: "crown" | "shoulder"): CanvasPattern | null {
  if (source === null || typeof document === "undefined") return null;
  const image = source.rutFree ?? source.image;
  let map = bandCanvases.get(image);
  if (map === undefined) { map = new Map(); bandCanvases.set(image, map); }
  let canvas = map.get(band);
  if (canvas === undefined) {
    const [top, bottom] = source.set.artRows;
    // "crown" spans the road interior (ruts blurred out), so a patch or plaza matches the ribbon's average tone.
    const [from, to] = band === "crown" ? [0.3, 0.7] : [0.1, 0.27];
    const y0 = Math.round(top + (bottom - top) * from); const rows = Math.max(2, Math.round((bottom - top) * (to - from)));
    const made = canvas2d(source.period, rows * 2);
    if (made !== null) {
      const crop = { x: 0, y: y0, width: source.period, height: rows };
      drawCroppedWorldSprite(made.context, image, crop, { x: 0, y: 0, width: source.period, height: rows }, false, true);
      made.context.save();
      made.context.translate(0, rows * 2);
      made.context.scale(1, -1);
      drawCroppedWorldSprite(made.context, image, crop, { x: 0, y: 0, width: source.period, height: rows }, false, true);
      made.context.restore();
    }
    canvas = made?.canvas ?? null;
    map.set(band, canvas);
  }
  return canvas === null ? null : cachedPattern(context, canvas, "repeat");
}

// ---- geometry helpers ---------------------------------------------------------------------------------------------

function segmentTransform(source: StripSource | null, origin: BoundaryPoint, tangent: BoundaryPoint, arcLength: number): Matrix {
  const pxPerTile = source?.pxPerTile ?? 48 / 0.55;
  const period = source?.period ?? STRIP_IMAGE_WIDTH;
  const normal = { x: -tangent.y, y: tangent.x };
  const u0 = ((arcLength * pxPerTile) % period + period) % period;
  return affine(origin, { x: tangent.x / pxPerTile, y: tangent.y / pxPerTile }, { x: normal.x / pxPerTile, y: normal.y / pxPerTile }, u0, STRIP_HEIGHT / 2);
}

function surfaceTransform(source: StripSource | null): Matrix {
  const pxPerTile = source?.pxPerTile ?? 48 / 0.55;
  return affine({ x: 0, y: 0 }, { x: 1 / pxPerTile, y: 0 }, { x: 0, y: 1 / pxPerTile }, 0, 0);
}

/** Maps texture (u,v) to screen: tile = origin + uAxis*(u-u0) + vAxis*(v-v0), then the iso projection. */
function affine(origin: BoundaryPoint, uAxis: BoundaryPoint, vAxis: BoundaryPoint, u0: number, v0: number): Matrix {
  const u = isoVector(uAxis); const v = isoVector(vAxis);
  const base = tileToScreen(origin.x, origin.y);
  return { a: u.x, b: u.y, c: v.x, d: v.y, e: base.sx - u.x * u0 - v.x * v0, f: base.sy - u.y * u0 - v.y * v0 };
}

/** The texture->screen matrix that sends three texture points to three tile points. */
function affineFromTriangles(texture: readonly BoundaryPoint[], tiles: readonly BoundaryPoint[]): Matrix {
  const [t0, t1, t2] = texture as [BoundaryPoint, BoundaryPoint, BoundaryPoint];
  const s = tiles.map(point => { const screen = tileToScreen(point.x, point.y); return { x: screen.sx, y: screen.sy }; }) as [BoundaryPoint, BoundaryPoint, BoundaryPoint];
  const du1 = t1.x - t0.x; const dv1 = t1.y - t0.y; const du2 = t2.x - t0.x; const dv2 = t2.y - t0.y;
  const det = du1 * dv2 - du2 * dv1 || 1e-9;
  const dx1 = s[1].x - s[0].x; const dy1 = s[1].y - s[0].y; const dx2 = s[2].x - s[0].x; const dy2 = s[2].y - s[0].y;
  const a = (dx1 * dv2 - dx2 * dv1) / det; const c = (dx2 * du1 - dx1 * du2) / det;
  const b = (dy1 * dv2 - dy2 * dv1) / det; const d = (dy2 * du1 - dy1 * du2) / det;
  return { a, b, c, d, e: s[0].x - a * t0.x - c * t0.y, f: s[0].y - b * t0.x - d * t0.y };
}

function isoVector(vector: BoundaryPoint): BoundaryPoint {
  return { x: (vector.x - vector.y) * 32, y: (vector.x + vector.y) * 16 };
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

function traceQuad(context: CanvasRenderingContext2D, from: BoundaryPoint, to: BoundaryPoint, fromNormal: BoundaryPoint, toNormal: BoundaryPoint, halfWidth: number): void {
  tracePolygon(context, [
    { x: from.x + fromNormal.x * halfWidth, y: from.y + fromNormal.y * halfWidth },
    { x: to.x + toNormal.x * halfWidth, y: to.y + toNormal.y * halfWidth },
    { x: to.x - toNormal.x * halfWidth, y: to.y - toNormal.y * halfWidth },
    { x: from.x - fromNormal.x * halfWidth, y: from.y - fromNormal.y * halfWidth },
  ]);
}

function tracePolygon(context: CanvasRenderingContext2D, points: readonly BoundaryPoint[]): void {
  context.beginPath();
  addSubpath(context, points);
}

function addSubpath(context: CanvasRenderingContext2D, points: readonly BoundaryPoint[]): void {
  points.forEach((point, index) => {
    const screen = tileToScreen(point.x, point.y);
    if (index === 0) context.moveTo(screen.sx, screen.sy);
    else context.lineTo(screen.sx, screen.sy);
  });
  context.closePath();
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

function lerpNormal(a: BoundaryPoint, b: BoundaryPoint, t: number): BoundaryPoint {
  return unit({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
}

function unit(vector: BoundaryPoint): BoundaryPoint {
  const length = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / length, y: vector.y / length };
}

function extendEnd(points: readonly BoundaryPoint[], distance: number): BoundaryPoint[] {
  const last = points[points.length - 1] as BoundaryPoint; const before = points[points.length - 2] ?? last;
  const direction = unit({ x: last.x - before.x, y: last.y - before.y });
  return [...points.slice(0, -1), { x: last.x + direction.x * distance, y: last.y + direction.y * distance }];
}

function armDirection(arm: RibbonArm): BoundaryPoint {
  const a = arm.points[0] as BoundaryPoint; const b = arm.points[arm.points.length - 1] as BoundaryPoint;
  return unit({ x: b.x - a.x, y: b.y - a.y });
}

function normaliseAngle(angle: number): number {
  const turn = Math.PI * 2;
  return ((angle % turn) + turn) % turn;
}

function lineIntersection(p: BoundaryPoint, r: BoundaryPoint, q: BoundaryPoint, s: BoundaryPoint): BoundaryPoint | null {
  const cross = r.x * s.y - r.y * s.x;
  if (Math.abs(cross) < 1e-6) return null;
  const t = ((q.x - p.x) * s.y - (q.y - p.y) * s.x) / cross;
  return { x: p.x + r.x * t, y: p.y + r.y * t };
}

function polyLength(points: readonly BoundaryPoint[]): number {
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot((points[index] as BoundaryPoint).x - (points[index - 1] as BoundaryPoint).x, (points[index] as BoundaryPoint).y - (points[index - 1] as BoundaryPoint).y);
  }
  return total;
}
