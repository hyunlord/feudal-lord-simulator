import { manifestArt } from "./manifestArt";
import { tileToScreen } from "./iso";
import type { SeasonIndex } from "./seasonArt";
import { drawCroppedWorldSprite } from "./worldSprite";
import { WAVE28_COUNTRY_IMAGES, type Wave28CountryKey } from "./wave28CountryManifest.generated";
import type { CountryPiece } from "./countrysideLayout";
import type { CountryStripPiece } from "./countrysideLand";

// INSTALL-28 Wave 28 art (public/assets/wave28, scripts/installWave28.py) through the shared manifest cache
// (manifestArt; every picture loads on its first draw, so a season's 13 load when it first shows). Spring shares the
// summer files (records/README.md). Every draw is one `CountryBlit`: a source rect and the affine map from its pixels
// to world px, so the canvas draw and the coverage measure (tests/countryside.test.ts) place the same pixels.
//  - Strips (512 x 64, repeating along x, ground line y = 56): one tile edge takes 32 / STRIP_SCALE source px, laid on
//    the edge by the shear that tilts only the ground axis (x' = x, y' = y + slope * x; slope +0.5 along tile x, -0.5
//    along tile y), the vertical axis kept (README "배치 계약"). A slice that crosses the repeat is cut in two.
//  - Props and patches: their ground pivot (generation-records.csv) on the anchor cell's centre, nudged by the salt up
//    to a fifth of a tile so a row of blocks does not read as a grid.
// Sizes (world px per picture px, zoom 1) keep the proof's proportions to the houses (proofs/01: a solitary oak about a
// house and a half, a hedge about half a house wall): a hedge stands ~24 px, an oak ~85 px, a skep row ~33 px wide.

export type CountryFamily = (typeof WAVE28_COUNTRY_IMAGES)[Wave28CountryKey]["family"];
export type CountryBlit = {
  readonly key: Wave28CountryKey;
  readonly source: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** world = (a * px + c * py + e, b * px + d * py + f), px / py from the source rect's corner. */
  readonly m: readonly [number, number, number, number, number, number];
};

export const STRIP_SCALE = 0.625;
export const COUNTRY_SCALE: Readonly<Record<Exclude<CountryFamily, "hedgerow_a" | "hedgerow_b" | "baulk" | "dry_stone_wall">, number>> = {
  oak_solitary: 0.62, willow_pollard: 0.42, roadside_cross: 0.36, haystack: 0.45, hurdle_fold: 0.5, skep_row: 0.38, boundary_stone: 0.36,
  wildflower_small: 0.68, wildflower_large: 0.64,
};
const STRIP_WIDTH = 512;
const STRIP_GROUND = 56;
const EDGE_SCREEN = 32;

const art = manifestArt<Wave28CountryKey>(WAVE28_COUNTRY_IMAGES);
export const countryArt = art.art;
export const preloadCountryArt = art.preload;

/** The file a family draws in `season` (0 spring and 1 summer share the summer file). */
export function countryKey(family: CountryFamily, season: SeasonIndex): Wave28CountryKey {
  return `${family}_${season === 2 ? "autumn" : season === 3 ? "winter" : "summer"}` as Wave28CountryKey;
}

/** The slices of one strip piece (one, or two where it crosses the 512 px repeat). */
export function stripBlits(piece: CountryStripPiece, season: SeasonIndex): readonly CountryBlit[] {
  const key = countryKey(piece.family, season);
  const perEdge = EDGE_SCREEN / STRIP_SCALE;
  const slope = piece.axis === "x" ? 0.5 : -0.5;
  // The edge's screen-left end: (tx - 0.5, ty + 0.5) on an x edge, (tx + 0.5, ty + 0.5) on a y edge.
  const left = tileToScreen(piece.axis === "x" ? piece.tx - 0.5 : piece.tx + 0.5, piece.ty + 0.5);
  const start = (piece.offset * STRIP_WIDTH + piece.step * perEdge) % STRIP_WIDTH;
  const blits: CountryBlit[] = [];
  for (let from = start, done = 0; done < perEdge - 1e-6;) {
    const width = Math.min(perEdge - done, STRIP_WIDTH - from);
    const u = done * STRIP_SCALE;
    blits.push({ key, source: { x: from, y: 0, width, height: 64 },
      m: [STRIP_SCALE, slope * STRIP_SCALE, 0, STRIP_SCALE, left.sx + u, left.sy + slope * u - STRIP_GROUND * STRIP_SCALE] });
    done += width; from = 0;
  }
  return blits;
}

/** The one blit of a prop or wildflower patch. */
export function pieceBlit(piece: CountryPiece, season: SeasonIndex): CountryBlit {
  const key = countryKey(piece.family, season);
  const meta = WAVE28_COUNTRY_IMAGES[key];
  const scale = COUNTRY_SCALE[piece.family];
  const nudge = (shift: number): number => ((((piece.salt >>> shift) % 101) / 100) - 0.5) * 0.4;
  const at = tileToScreen(piece.tx + nudge(0), piece.ty + nudge(7));
  return { key, source: { x: 0, y: 0, width: meta.width, height: meta.height },
    m: [scale, 0, 0, scale, at.sx - meta.pivot.x * scale, at.sy - meta.pivot.y * scale] };
}

/** Draws a blit in world coordinates (the caller's camera transform stays); false until its picture has loaded. */
export function drawCountryBlit(context: CanvasRenderingContext2D, blit: CountryBlit): boolean {
  const image = art.art(blit.key);
  if (image === null) return false;
  context.save();
  context.transform(...blit.m);
  drawCroppedWorldSprite(context, image, blit.source, { x: 0, y: 0, width: blit.source.width, height: blit.source.height }, false, true);
  context.restore();
  return true;
}
