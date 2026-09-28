import { readFileSync } from "node:fs";
import type { GameState } from "../../src/engine/engine.types";
import { pieceBlit, stripBlits, type CountryBlit } from "../../src/render/countrysideArt";
import { countrysideDrawnAt } from "../../src/render/countrysideDraw";
import { countrysideOf } from "../../src/render/countrysideLayout";
import { screenToTile, tileToScreen } from "../../src/render/iso";
import { DECAL_MIN_ZOOM } from "../../src/render/seasonalDecals";
import type { SeasonIndex } from "../../src/render/seasonArt";
import { WAVE28_COUNTRY_IMAGES, type Wave28CountryKey } from "../../src/render/wave28CountryManifest.generated";
import { decodePng } from "../../scripts/keyartDerivatives";

// INSTALL-28 coverage measure: the union of the countryside's alpha > 0 pixels over one view (the README's measure:
// overlapping pieces count once, alpha is not weighted), from the same blits the canvas draws (countrysideArt.ts),
// sampled nearest from the installed PNGs. Reported over the whole view and over the open country in view (the
// conservative "empty land outside the walls" mask: pixels whose tile is open country, countrysideLand.ts).

export type CoverageView = { readonly width: number; readonly height: number; readonly zoom: number; readonly centre: { readonly tx: number; readonly ty: number }; readonly season: SeasonIndex };
export type Coverage = {
  /** Point props only, over the whole view. */
  readonly props: number;
  /** Props, patches and strips, over the whole view. */
  readonly all: number;
  /** Open-country pixels in view, and the share of them the props / everything cover. */
  readonly openPixels: number;
  readonly propsOverOpen: number;
  readonly allOverOpen: number;
};

const alphaCache = new Map<Wave28CountryKey, { readonly width: number; readonly alpha: Uint8Array }>();
function alphaOf(key: Wave28CountryKey): { readonly width: number; readonly alpha: Uint8Array } {
  let entry = alphaCache.get(key);
  if (entry === undefined) {
    const image = decodePng(readFileSync(new URL(`../../public/${WAVE28_COUNTRY_IMAGES[key].url}`, import.meta.url)));
    const alpha = new Uint8Array(image.width * image.height);
    for (let index = 0; index < alpha.length; index += 1) alpha[index] = image.data[index * 4 + 3]!;
    entry = { width: image.width, alpha };
    alphaCache.set(key, entry);
  }
  return entry;
}

export function countrysideCoverage(state: GameState, view: CoverageView): Coverage {
  const layout = countrysideOf(state);
  const centre = tileToScreen(view.centre.tx, view.centre.ty);
  const panX = view.width / 2 - centre.sx * view.zoom; const panY = view.height / 2 - centre.sy * view.zoom;
  const props = new Uint8Array(view.width * view.height);
  const all = new Uint8Array(view.width * view.height);
  const paint = (blit: CountryBlit, masks: readonly Uint8Array[]): void => {
    const [a, b, c, d, e, f] = blit.m;
    const { alpha, width } = alphaOf(blit.key);
    const corners = [[0, 0], [blit.source.width, 0], [0, blit.source.height], [blit.source.width, blit.source.height]]
      .map(([px, py]) => ({ x: (a * px! + c * py! + e) * view.zoom + panX, y: (b * px! + d * py! + f) * view.zoom + panY }));
    const left = Math.max(0, Math.floor(Math.min(...corners.map(p => p.x)))); const right = Math.min(view.width - 1, Math.ceil(Math.max(...corners.map(p => p.x))));
    const top = Math.max(0, Math.floor(Math.min(...corners.map(p => p.y)))); const bottom = Math.min(view.height - 1, Math.ceil(Math.max(...corners.map(p => p.y))));
    const det = a * d - b * c;
    for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) {
      const wx = (x + 0.5 - panX) / view.zoom - e; const wy = (y + 0.5 - panY) / view.zoom - f;
      const px = (d * wx - c * wy) / det; const py = (-b * wx + a * wy) / det;
      if (px < 0 || py < 0 || px >= blit.source.width || py >= blit.source.height) continue;
      if (alpha[(blit.source.y + Math.floor(py)) * width + blit.source.x + Math.floor(px)]! > 0) for (const mask of masks) mask[y * view.width + x] = 1;
    }
  };
  if (view.zoom >= DECAL_MIN_ZOOM) for (const piece of layout.fields) paint(pieceBlit(piece, view.season), [all]);
  for (const piece of layout.strips) if (countrysideDrawnAt(piece, view.zoom)) for (const blit of stripBlits(piece, view.season)) paint(blit, [all]);
  for (const piece of layout.props) if (countrysideDrawnAt(piece, view.zoom)) paint(pieceBlit(piece, view.season), [props, all]);
  let openPixels = 0; let propsOpen = 0; let allOpen = 0; let propsTotal = 0; let allTotal = 0;
  for (let y = 0; y < view.height; y += 1) for (let x = 0; x < view.width; x += 1) {
    const index = y * view.width + x;
    propsTotal += props[index]!; allTotal += all[index]!;
    const tile = screenToTile((x + 0.5 - panX) / view.zoom, (y + 0.5 - panY) / view.zoom);
    const tx = Math.round(tile.tx); const ty = Math.round(tile.ty);
    if (tx < 0 || ty < 0 || tx >= layout.width || ty >= layout.height || layout.countryside[ty * layout.width + tx] !== 1) continue;
    openPixels += 1; propsOpen += props[index]!; allOpen += all[index]!;
  }
  const area = view.width * view.height;
  return { props: propsTotal / area, all: allTotal / area, openPixels,
    propsOverOpen: openPixels === 0 ? 0 : propsOpen / openPixels, allOverOpen: openPixels === 0 ? 0 : allOpen / openPixels };
}
