import { hashSeed } from "../content/seedHash";
import type { StripFamily } from "./archetypeGroundModel";
import { manifestArt } from "./manifestArt";
import type { SeasonIndex } from "./seasonArt";
import { featherStripRows, joinStripImages } from "./stripJoin";
import { WAVE22_GROUND_IMAGES } from "./wave22GroundManifest.generated";
import { WAVE41_GROUND, type Wave41GroundKey } from "./wave41LandManifest.generated";

// LU-D11 (user 2026-10-02): the Wave 22 land edge bands (chalk edge, coastal grass, fen edge, heath, archetypeGroundDraw
// item 2) read on screen as thin bright outlines: the art paints rows 9-54 of its 64 with an 8-row soft edge, laid half
// a tile wide; the chalk edge's middle rows are near-white chalk. The render now lays them EDGE_BAND_WIDEN times wider
// across the edge (the pattern along the edge keeps its 128 px per tile) and multiplies their alpha by a smooth hump over
// the paint (0 at its first and last rows, EDGE_BAND_PEAK in its middle), so the band fades into the meadow above and
// the named ground below and no row of it is drawn opaque. Chosen on an offline preview of the four strips over their
// sampled fills (W 2 / 2.5 / 3, peak 1 / 0.75 / 0.65 / 0.6; the first DGX capture at W 2, an 18-row ramp, peak 1 still
// read as a line). Both are baked into the family's joined image once per page (no per-frame work; one fill per strip
// quad as before). The shore and reed-bed strips keep their width and alpha: their painted waterline must meet the
// water body.
// The forest edge (Wave 22 has no band for the woodland floor) is Wave 41's (NAT-4, scripts/installWave41.py; 512 x 64,
// top the meadow, bottom the woodland floor), laid with the same widen and feather: in summer (spring and autumn too)
// the irregular variants woodland_edge_a | b (INBOX-2z; paint on rows 2-61) joined into one seamless 1024 px repeat as
// the Wave 22 strips are, each run of the edge starting on a or b by a stable hash of its first point
// (forestRunPhases), so the band no longer repeats one image; in winter the frosted woodland_grass_edge_winter (rows
// 9-54). The first summer strip, woodland_grass_edge_summer, stays installed as the deep-woodland variant for later
// (DEEP_WOODLAND_EDGE, not drawn).

export const EDGE_BAND_WIDEN = 2.5;
/** The rows the four edge families paint (alpha > 8, measured on all eight files: first 9-10, last 53-54); the Wave 41 winter strip's too. */
export const EDGE_PAINT_TOP = 9;
export const EDGE_PAINT_BOTTOM = 54;
/** The ramp's length each side: half the paint, so the hump has no flat top. */
export const EDGE_FEATHER_ROWS = 23;
export const EDGE_BAND_PEAK = 0.65;
/** The paint of woodland_edge_a / _b (alpha > 8: rows 2-61, their own 13 px feather). */
export const WOODLAND_EDGE_PAINT = { top: 2, bottom: 61 } as const;
export const FOREST_EDGE_FAMILY = "boundary/forest_edge";
/** The fill whose edge FOREST_EDGE_FAMILY draws. */
export const FOREST_EDGE_FILL = "woodland_floor";
type Paint = { readonly top: number; readonly bottom: number };
const WAVE22_PAINT: Paint = { top: EDGE_PAINT_TOP, bottom: EDGE_PAINT_BOTTOM };

/**
 * The feather's alpha factor for source row `row`: EDGE_BAND_PEAK times a smoothstep 0 -> 1 over the paint's top half
 * and 1 -> 0 over its bottom half (Wave 22: rows 9-54, EDGE_FEATHER_ROWS each side).
 */
export function edgeFeatherAlpha(row: number, paint: Paint = WAVE22_PAINT): number {
  const centre = row + 0.5;
  const half = (paint.bottom - paint.top + 1) / 2;
  const rise = smoothstep((centre - paint.top) / half);
  const fall = smoothstep((paint.bottom + 1 - centre) / half);
  return EDGE_BAND_PEAK * Math.min(rise, fall);
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

const SUMMER_EDGE: readonly Wave41GroundKey[] = ["boundary/woodland_edge_a", "boundary/woodland_edge_b"];
const WINTER_EDGE: Wave41GroundKey = "boundary/woodland_grass_edge_winter";
/** The deep-woodland variant (INBOX-2z): installed, not drawn yet. */
export const DEEP_WOODLAND_EDGE: Wave41GroundKey = "boundary/woodland_grass_edge_summer";
const forestArt = manifestArt<Wave41GroundKey>(WAVE41_GROUND);

/** A strip family's art is installed: both Wave 22 halves, or for the forest edge its Wave 41 summer a / b and winter strips. */
export function stripFamilyInstalled(family: string): boolean {
  return family === FOREST_EDGE_FAMILY ? [...SUMMER_EDGE, WINTER_EDGE].every(key => key in WAVE41_GROUND) : wave22StripInstalled(family);
}

/** Both Wave 22 halves of a strip family are installed (the files landArtKeys asks for; never the forest edge's). */
export function wave22StripInstalled(family: string): boolean {
  return `${family}_a` in WAVE22_GROUND_IMAGES && `${family}_b` in WAVE22_GROUND_IMAGES;
}

/**
 * The forest edge files a game season draws: woodland_edge_a and _b in summer (LU-D1: spring uses summer; autumn too —
 * the winter strip is frosted, the woodland floor's own autumn fill carries the season), the winter strip in winter.
 */
export function forestEdgeArtKeys(season: SeasonIndex): readonly Wave41GroundKey[] {
  return season === 3 ? [WINTER_EDGE] : SUMMER_EDGE;
}

/**
 * The forest edge's part of the land's art readiness in `season` ("" for a land without the woodland floor): one bit,
 * its files loaded. The first call starts every season's files loading (as preloadLandArt does for Wave 22).
 */
export function forestEdgeReadiness(fillBases: readonly (string | null)[], season: SeasonIndex): string {
  if (!fillBases.includes(FOREST_EDGE_FILL) || !stripFamilyInstalled(FOREST_EDGE_FAMILY)) return "";
  for (const key of [...SUMMER_EDGE, WINTER_EDGE]) forestArt.art(key);
  return forestEdgeArtKeys(season).some(key => forestArt.art(key) === null) ? ":f0" : ":f1";
}

/**
 * Per segment of a closed line, the forest edge's repeat phase: 0 (the run starts on a) or 1 (on b), one per run of
 * consecutive forest-edge segments, by a stable hash of the run's first point (the same in every chunk that draws it);
 * null for a line without the forest edge.
 */
export function forestRunPhases(line: readonly { readonly x: number; readonly y: number }[], families: readonly (StripFamily | null)[]): readonly number[] | null {
  if (!families.includes(FOREST_EDGE_FAMILY)) return null;
  const count = families.length;
  const forest = (index: number) => families[((index % count) + count) % count] === FOREST_EDGE_FAMILY;
  const phases = new Array<number>(count).fill(0);
  let phase = 0;
  for (let index = 0; index < count; index += 1) {
    if (!forest(index)) continue;
    if (index === 0 || !forest(index - 1)) {
      // A run's first segment; a run crossing index 0 starts where the loop's last non-forest segment ends.
      let first = index;
      for (let step = 0; step < count - 1 && forest(first - 1); step += 1) first -= 1;
      const point = line[((first % count) + count) % count] ?? { x: 0, y: 0 };
      phase = hashSeed(0, "nat4:forest-edge-run", Math.round(point.x * 8), Math.round(point.y * 8)) % 2;
    }
    phases[index] = phase;
  }
  return phases;
}

// Cache (AGENTS rule 10): (a) key: the strip family, and for the forest edge its season's files; (b) nothing else
// enters — the files are fixed per family (and season), and whether it is an edge band (feathered) or a water strip is
// a property of the family; (c) the join and the feather are canvas work, done once per family instead of per chunk raster.
const joined = new Map<string, CanvasImageSource>();

/**
 * A strip family's repeat: a | b joined into one seamless 1024 px repeat (Wave 22, and the forest edge in summer), or
 * the forest edge's single 512 px winter strip; an edge band's (`feather`) with its alpha ramp over its own paint (the
 * a image alone where there is no canvas). Null until its files have loaded.
 */
export function stripImage(family: StripFamily, season: SeasonIndex, load: (half: "a" | "b") => HTMLImageElement | null, joinFade: number, feather: boolean): CanvasImageSource | null {
  const forest = family === FOREST_EDGE_FAMILY;
  const keys = forest ? forestEdgeArtKeys(season) : [];
  const key = forest ? `${family}|${keys.join("|")}` : family;
  const done = joined.get(key);
  if (done !== undefined) return done;
  const images = forest ? keys.map(name => forestArt.art(name)) : [load("a"), load("b")];
  const a = images[0] ?? null;
  if (a === null || images.some(image => image === null)) return null;
  if (typeof document === "undefined") { joined.set(key, a); return a; }
  const repeat = images.length === 1 ? a : joinStripImages(images as HTMLImageElement[], a.naturalWidth, a.naturalHeight, joinFade);
  if (repeat === null) return null;
  const paint = forest && keys[0] !== WINTER_EDGE ? WOODLAND_EDGE_PAINT : WAVE22_PAINT;
  const image = feather ? featherStripRows(repeat, a.naturalWidth * images.length, a.naturalHeight, row => edgeFeatherAlpha(row, paint)) : repeat;
  joined.set(key, image);
  return image;
}
