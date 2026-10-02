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
// quad as before). The shore and reed-bed strips keep their width and alpha:
// their painted waterline must meet the water body.
// The forest edge (Wave 22 has no band for the woodland floor) is Wave 41's woodland_grass_edge strip (NAT-4, installed
// by scripts/installWave41.py: 512 x 64, top the meadow, bottom the woodland floor, its paint on the same rows 9-54, one
// repeat per season): FOREST_EDGE_FAMILY is its name in the regions, laid with the same widen and feather.

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

const FOREST_EDGE_ART: readonly Wave41GroundKey[] = ["boundary/woodland_grass_edge_summer", "boundary/woodland_grass_edge_winter"];
const forestArt = manifestArt<Wave41GroundKey>(WAVE41_GROUND);

/** A strip family's art is installed: both Wave 22 halves, or for the forest edge its Wave 41 summer and winter strips. */
export function stripFamilyInstalled(family: string): boolean {
  return family === FOREST_EDGE_FAMILY ? FOREST_EDGE_ART.every(key => key in WAVE41_GROUND) : wave22StripInstalled(family);
}

/** Both Wave 22 halves of a strip family are installed (the files landArtKeys asks for; never the forest edge's). */
export function wave22StripInstalled(family: string): boolean {
  return `${family}_a` in WAVE22_GROUND_IMAGES && `${family}_b` in WAVE22_GROUND_IMAGES;
}

/**
 * The Wave 41 forest edge strip a game season draws (one 512 px repeat per season, no a / b). LU-D1: spring uses
 * summer; autumn uses summer too (the winter strip is frosted; the woodland floor's own autumn fill carries the season).
 */
export function forestEdgeArtKey(season: SeasonIndex): Wave41GroundKey {
  return season === 3 ? "boundary/woodland_grass_edge_winter" : "boundary/woodland_grass_edge_summer";
}
/**
 * The forest edge's part of the land's art readiness in `season` ("" for a land without the woodland floor): one bit,
 * its file loaded. The first call starts both seasons' files loading (as preloadLandArt does for Wave 22).
 */
export function forestEdgeReadiness(fillBases: readonly (string | null)[], season: SeasonIndex): string {
  if (!fillBases.includes(FOREST_EDGE_FILL) || !stripFamilyInstalled(FOREST_EDGE_FAMILY)) return "";
  for (const key of FOREST_EDGE_ART) forestArt.art(key);
  return forestArt.art(forestEdgeArtKey(season)) === null ? ":f0" : ":f1";
}

// Cache (AGENTS rule 10): (a) key: the strip family, and for the forest edge its season file; (b) nothing else enters —
// the files are fixed per family (and season), and whether it is an edge band (feathered) or a water strip is a property
// of the family; (c) the join and the feather are canvas work, done once per family instead of per chunk raster.
const joined = new Map<string, CanvasImageSource>();

/**
 * A strip family's repeat: Wave 22's a | b joined into one seamless 1024 px repeat, the forest edge's single 512 px
 * strip for `season`; an edge band's (`feather`) with its alpha ramp (the a image alone where there is no canvas). Null
 * until its files have loaded.
 */
export function stripImage(family: StripFamily, season: SeasonIndex, load: (half: "a" | "b") => HTMLImageElement | null, joinFade: number, feather: boolean): CanvasImageSource | null {
  const forest = family === FOREST_EDGE_FAMILY;
  const key = forest ? `${family}|${forestEdgeArtKey(season)}` : family;
  const done = joined.get(key);
  if (done !== undefined) return done;
  const images = forest ? [forestArt.art(forestEdgeArtKey(season))] : [load("a"), load("b")];
  const a = images[0] ?? null;
  if (a === null || images.some(image => image === null)) return null;
  if (typeof document === "undefined") { joined.set(key, a); return a; }
  const repeat = forest ? a : joinStripImages(images as HTMLImageElement[], a.naturalWidth, a.naturalHeight, joinFade);
  if (repeat === null) return null;
  const image = feather ? featherStripRows(repeat, a.naturalWidth * images.length, a.naturalHeight, edgeFeatherAlpha) : repeat;
  joined.set(key, image);
  return image;
}
