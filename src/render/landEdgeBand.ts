import type { StripFamily } from "./archetypeGroundModel";
import { featherStripRows, joinStripImages } from "./stripJoin";
import { WAVE22_GROUND_IMAGES } from "./wave22GroundManifest.generated";

// LU-D11 (user 2026-10-02): the Wave 22 land edge bands (chalk edge, coastal grass, fen edge, heath, archetypeGroundDraw
// item 2) read on screen as thin bright outlines: the art paints rows 9-54 of its 64 with an 8-row soft edge, laid half
// a tile wide; the chalk edge's middle rows are near-white chalk. The render now lays them EDGE_BAND_WIDEN times wider
// across the edge (the pattern along the edge keeps its 128 px per tile) and multiplies their alpha by a smooth hump over
// the paint (0 at its first and last rows, EDGE_BAND_PEAK in its middle), so the band fades into the meadow above and
// the named ground below and no row of it is drawn opaque. Chosen on an offline preview of the four strips over their
// sampled fills (W 2 / 2.5 / 3, peak 1 / 0.75 / 0.65 / 0.6; the first DGX capture at W 2, an 18-row ramp, peak 1 still
// read as a line). Both are baked into the family's joined image once per page (no per-frame work; one fill per strip
// quad as before). The shore and reed-bed strips keep their width and alpha:
// their painted waterline must meet the water body.
// The forest edge (Wave 22 has no band for the woodland floor) is Astra's: FOREST_EDGE_FAMILY is the name the band map
// and the regions use once `boundary/forest_edge_a` / `_b` (512 x 64, top the meadow, bottom the woodland floor) are in
// the Wave 22 manifest; until then nothing names it and nothing new is drawn.

export const EDGE_BAND_WIDEN = 2.5;
/** The rows the four edge families paint (alpha > 8, measured on all eight files: first 9-10, last 53-54). */
export const EDGE_PAINT_TOP = 9;
export const EDGE_PAINT_BOTTOM = 54;
/** The ramp's length each side: half the paint, so the hump has no flat top. */
export const EDGE_FEATHER_ROWS = 23;
export const EDGE_BAND_PEAK = 0.65;
export const FOREST_EDGE_FAMILY = "boundary/forest_edge";
/** The fill whose edge FOREST_EDGE_FAMILY draws. */
export const FOREST_EDGE_FILL = "woodland_floor";

/** The feather's alpha factor for source row `row`: EDGE_BAND_PEAK times a smoothstep 0 -> 1 over the paint's top EDGE_FEATHER_ROWS rows and 1 -> 0 over its bottom ones. */
export function edgeFeatherAlpha(row: number): number {
  const centre = row + 0.5;
  const rise = smoothstep((centre - EDGE_PAINT_TOP) / EDGE_FEATHER_ROWS);
  const fall = smoothstep((EDGE_PAINT_BOTTOM + 1 - centre) / EDGE_FEATHER_ROWS);
  return EDGE_BAND_PEAK * Math.min(rise, fall);
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** Both halves of a strip family are installed (the forest edge until Astra's art arrives: false). */
export function stripFamilyInstalled(family: string): boolean {
  return `${family}_a` in WAVE22_GROUND_IMAGES && `${family}_b` in WAVE22_GROUND_IMAGES;
}

// Cache (AGENTS rule 10): (a) key: the strip family; (b) nothing else enters — the a | b files are fixed per family and
// whether it is an edge band (feathered) or a water strip is a property of the family; (c) the join and the feather are
// canvas work, done once per family instead of per chunk raster.
const joined = new Map<StripFamily, CanvasImageSource>();

/**
 * A strip family's a | b joined into one seamless repeat, an edge band's (`feather`) with its alpha ramp (the a image
 * alone where there is no canvas). Null until both files have loaded.
 */
export function stripImage(family: StripFamily, load: (half: "a" | "b") => HTMLImageElement | null, joinFade: number, feather: boolean): CanvasImageSource | null {
  const done = joined.get(family);
  if (done !== undefined) return done;
  const a = load("a"); const b = load("b");
  if (a === null || b === null) return null;
  if (typeof document === "undefined") { joined.set(family, a); return a; }
  const repeat = joinStripImages([a, b], a.naturalWidth, a.naturalHeight, joinFade);
  if (repeat === null) return null;
  const image = feather ? featherStripRows(repeat, a.naturalWidth * 2, a.naturalHeight, edgeFeatherAlpha) : repeat;
  joined.set(family, image);
  return image;
}
