import { SEMANTIC_PALETTE } from "../content/palette";
import { boundaryHash, type BoundaryPoint } from "../world/boundary/boundaryGeometry";
import { YARD_SUBCELLS, type BuildingApron, type BuildingGrounds, type BuildingYard } from "../world/boundary/buildingGrounds";
import { fillRoadSurface } from "./drawRoadRibbons";
import { tileToScreen } from "./iso";
import { withAlpha } from "./style";

// Building yards and aprons in the ground chunks (C1d). Order inside a chunk: zone fills (with the yards cut out, so a
// plot's tone stops at the yard) -> yards -> field clusters -> zone lines -> aprons; the road chunks then lay the
// ribbon over the apron's far edge. Everything here is a pure function of the scene's grounds and the seed, and is
// part of the chunk content key through the yard and apron hashes (groundBoundaryScene).

/** Yard: trodden ground, a low tone over the grass plus a few earth and grass blotches (8-12 source px). */
const YARD_TONE_ALPHA = 0.2;
const YARD_BLOTCH_CHANCE = 5;
const YARD_BLOTCH_RADIUS = [0.045, 0.075] as const;
const YARD_BLOTCHES = [
  { color: SEMANTIC_PALETTE.earthDark, alpha: 0.2 },
  { color: SEMANTIC_PALETTE.earth, alpha: 0.32 },
  { color: SEMANTIC_PALETTE.sageDark, alpha: 0.24 },
] as const;
/** Apron: the ribbon's own crown surface (earth or stone, as the contact cells) at 75 %, over a faint earth base. */
const APRON_BASE_ALPHA = 0.3;
const APRON_SURFACE_ALPHA = 0.75;

/** Clip region that leaves out every yard in `indexes` (callers save / restore around it). */
export function clipOutYards(context: CanvasRenderingContext2D, grounds: BuildingGrounds, indexes: readonly number[], frame: readonly BoundaryPoint[]): void {
  context.beginPath();
  addRing(context, frame);
  for (const index of indexes) for (const ring of grounds.yards[index]?.rings ?? []) addRing(context, ring);
  context.clip("evenodd");
}

export function drawYards(context: CanvasRenderingContext2D, grounds: BuildingGrounds, indexes: readonly number[], seed: number): void {
  if (indexes.length === 0) return;
  context.beginPath();
  for (const index of indexes) for (const ring of grounds.yards[index]?.rings ?? []) addRing(context, ring);
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.earth, YARD_TONE_ALPHA);
  context.fill("evenodd");
  const blotches = indexes.flatMap(index => { const yard = grounds.yards[index]; return yard === undefined ? [] : yardBlotches(yard, seed); });
  YARD_BLOTCHES.forEach((style, kind) => {
    const own = blotches.filter(blotch => blotch.kind === kind);
    if (own.length === 0) return;
    context.beginPath();
    for (const blotch of own) {
      const screen = tileToScreen(blotch.x, blotch.y);
      // A tile-space circle is an ellipse on screen (2:1).
      context.moveTo(screen.sx + blotch.radius * 45.25, screen.sy);
      context.ellipse(screen.sx, screen.sy, blotch.radius * 45.25, blotch.radius * 22.63, 0, 0, Math.PI * 2);
    }
    context.fillStyle = withAlpha(style.color, style.alpha);
    context.fill();
  });
}

export function drawAprons(context: CanvasRenderingContext2D, grounds: BuildingGrounds, indexes: readonly number[], ribbonWidth: number): void {
  const aprons = indexes.flatMap(index => { const apron = grounds.aprons[index]; return apron === undefined ? [] : [apron]; });
  if (aprons.length === 0) return;
  const trace = (list: readonly BuildingApron[]) => (): void => { context.beginPath(); for (const apron of list) addRing(context, apron.polygon); };
  trace(aprons)();
  context.fillStyle = withAlpha(SEMANTIC_PALETTE.earth, APRON_BASE_ALPHA);
  context.fill();
  const previousAlpha = context.globalAlpha;
  context.globalAlpha = previousAlpha * APRON_SURFACE_ALPHA;
  for (const material of ["earth", "stone"] as const) {
    const own = aprons.filter(apron => apron.material === material);
    if (own.length > 0) fillRoadSurface(context, material, ribbonWidth, trace(own));
  }
  context.globalAlpha = previousAlpha;
}

type Blotch = { readonly x: number; readonly y: number; readonly radius: number; readonly kind: number };
const blotchCache = new WeakMap<BuildingYard, Blotch[]>();

/**
 * Blotch centres are yard subcells (outside the footprint's sprite base) whose whole blotch stays inside the yard,
 * picked by a hash of the subcell index: the same yard always gets the same blotches, whatever the draw order.
 */
export function yardBlotches(yard: BuildingYard, seed: number): readonly Blotch[] {
  const cached = blotchCache.get(yard);
  if (cached !== undefined) return cached;
  const S = YARD_SUBCELLS;
  const set = new Set(yard.subcells);
  const stride = yard.subcellStride;
  const { tx, ty, width, height } = yard.footprint;
  const blotches: Blotch[] = [];
  for (const subcell of yard.subcells) {
    const hash = boundaryHash(subcell, seed, 41);
    if (hash % 100 >= YARD_BLOTCH_CHANCE) continue;
    // Whole blotch inside: the subcells one step around are in the yard too.
    if (![1, -1, stride, -stride, stride + 1, stride - 1, -stride + 1, -stride - 1].every(step => set.has(subcell + step))) continue;
    const ai = subcell % stride; const aj = (subcell - ai) / stride;
    const x = (ai + 0.5) / S - 0.5; const y = (aj + 0.5) / S - 0.5;
    if (Math.round(x) >= tx && Math.round(x) < tx + width && Math.round(y) >= ty && Math.round(y) < ty + height) continue;
    const t = (hash >>> 8) % 1000 / 1000;
    blotches.push({ x, y,
      radius: YARD_BLOTCH_RADIUS[0] + (YARD_BLOTCH_RADIUS[1] - YARD_BLOTCH_RADIUS[0]) * t, kind: (hash >>> 20) % YARD_BLOTCHES.length });
  }
  blotchCache.set(yard, blotches);
  return blotches;
}

function addRing(context: CanvasRenderingContext2D, ring: readonly BoundaryPoint[]): void {
  ring.forEach((point, index) => {
    const screen = tileToScreen(point.x, point.y);
    if (index === 0) context.moveTo(screen.sx, screen.sy); else context.lineTo(screen.sx, screen.sy);
  });
  context.closePath();
}

