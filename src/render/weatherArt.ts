import { WAVE23_IMAGES, type Wave23Key } from "./wave23ArtManifest.generated";
import { RAIN_KEPT_RUNS, WEATHER_MEAN_RGBA } from "./pixelFacts.generated";
import { rgbaOfChannels } from "./style";
import { SEMANTIC_PALETTE } from "../content/palette";
import { RAIN_DRAW, type RainSheet } from "./weatherLayers";
import { assetUrlForBase } from "./worldAssets";
import { drawCroppedWorldSprite } from "./worldSprite";

// Catalog weather-shadow sources are owned exclusively by weatherShadowArt, not this legacy cache.
// INSTALL-23 weather art (public/assets/wave23/weather): the browser image cache, a sheet's frame cells and the repeat
// patterns. Node has no Image, so every weather draw returns before touching the context there (the C25 board and the
// render tests stay as they were); tests stand images in with setWeatherArtForTest.
type Entry = { readonly image: HTMLImageElement; status: "loading" | "ready" | "missing" };
const entries = new Map<Wave23Key, Entry>();
let testArt: ((key: Wave23Key) => CanvasImageSource | null) | null = null;

export function weatherImage(key: Wave23Key): CanvasImageSource | null {
  if (testArt !== null) return testArt(key);
  if (typeof Image !== "function") return null;
  let entry = entries.get(key);
  if (entry === undefined) {
    const image = new Image();
    const created: Entry = { image, status: "loading" };
    image.onload = () => { created.status = "ready"; };
    image.onerror = () => { created.status = "missing"; };
    image.src = assetUrlForBase(WAVE23_IMAGES[key].url, import.meta.env?.BASE_URL ?? "/");
    entries.set(key, created);
    entry = created;
  }
  return entry.status === "ready" ? entry.image : null;
}

export function setWeatherArtForTest(art: ((key: Wave23Key) => CanvasImageSource | null) | null): void {
  testArt = art;
  frameCells.clear();
  meanColours.clear();
}

export const weatherMeta = (key: Wave23Key) => WAVE23_IMAGES[key];

/** The cell rect of `frame` in a sheet (the whole image when it has one frame). */
export function weatherCell(key: Wave23Key, frame: number): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } {
  const meta = WAVE23_IMAGES[key];
  if (!("frames" in meta) || !("columns" in meta.frames)) return { x: 0, y: 0, width: meta.width, height: meta.height };
  const count = meta.frames.columns * meta.frames.rows;
  const index = ((Math.floor(frame) % count) + count) % count;
  return { x: (index % meta.frames.columns) * meta.frames.cellWidth, y: Math.floor(index / meta.frames.columns) * meta.frames.cellHeight,
    width: meta.frames.cellWidth, height: meta.frames.cellHeight };
}

export function weatherFrameCount(key: Wave23Key): number {
  const meta = WAVE23_IMAGES[key];
  return "frames" in meta && "columns" in meta.frames ? meta.frames.columns * meta.frames.rows : 1;
}

// Cache (AGENTS rule 10): each frame cell of a rain sheet copied to its own canvas; key: the sheet image and the
// frame (4 cells per sheet, two sheets). Reason: a repeat pattern repeats its whole source, so a 4-cell sheet cannot be
// a pattern of one cell; copying the cell every frame would be a 256 x 256 blit and a new canvas at 60 fps. Measured
// (headless Chrome --disable-gpu on a Mac, docs/verification/install23/weather/weather.json "cost.fillCost"): building
// a sheet's four cells and patterns 0.3-0.4 ms, against the rain's full-view fill of 1.4 ms it would add to every frame.
// INSTALL-23b: a rain cell is cut at its drawn scale (its halo cleared, then scaled nearest), once per cell as well.
const frameCells = new Map<CanvasImageSource, (HTMLCanvasElement | null)[]>();

function cellCanvas(key: Wave23Key, image: CanvasImageSource, frame: number): CanvasImageSource | null {
  if (weatherFrameCount(key) === 1) return image;
  if (typeof document === "undefined") return null;
  let cells = frameCells.get(image);
  if (cells === undefined) { cells = Array.from({ length: weatherFrameCount(key) }, () => null); frameCells.set(image, cells); }
  const index = ((frame % cells.length) + cells.length) % cells.length;
  const cached = cells[index];
  if (cached !== null && cached !== undefined) return cached;
  const cell = weatherCell(key, index);
  const canvas = document.createElement("canvas");
  canvas.width = cell.width; canvas.height = cell.height;
  const paint = canvas.getContext("2d");
  if (paint === null) return null;
  drawCroppedWorldSprite(paint, image, cell, { x: 0, y: 0, width: cell.width, height: cell.height }, false, false);
  const rain = key in RAIN_DRAW ? RAIN_DRAW[key as RainSheet] : null;
  if (rain !== null) {
    // INSTALL-23b: the halo cleared, then the cell scaled nearest to its drawn size (the streaks' share unchanged).
    // SMOOTH-2R: the halo is cleared by keeping only the cell's pixels over RAIN_ALPHA_FLOOR, their row runs measured
    // at build time (pixelFacts.generated.ts RAIN_KEPT_RUNS), filled opaque with destination-in — no pixel is read back.
    keepRuns(paint, RAIN_KEPT_RUNS[key]?.[index] ?? "");
    const scaled = document.createElement("canvas");
    scaled.width = Math.round(cell.width * rain.scale); scaled.height = Math.round(cell.height * rain.scale);
    const scaledPaint = scaled.getContext("2d");
    if (scaledPaint === null) return null;
    drawCroppedWorldSprite(scaledPaint, canvas, { x: 0, y: 0, width: cell.width, height: cell.height }, { x: 0, y: 0, width: scaled.width, height: scaled.height }, false, false);
    cells[index] = scaled;
    return scaled;
  }
  cells[index] = canvas;
  return canvas;
}

/** SMOOTH-2R: keeps only the pixels of the row runs `encoded` (scripts/buildPixelFacts.ts: per row a run count, then
 * per run its gap from the last run's end and its length - 1, one byte each, base64) and clears the rest. The runs are
 * whole pixels filled at full alpha, so a kept pixel keeps its exact value. */
function keepRuns(paint: CanvasRenderingContext2D, encoded: string): void {
  const bytes = atob(encoded);
  paint.save();
  paint.setTransform(1, 0, 0, 1, 0, 0);
  paint.globalCompositeOperation = "destination-in";
  paint.beginPath();
  for (let at = 0, row = 0; at < bytes.length; row += 1) {
    const runs = bytes.charCodeAt(at++);
    for (let run = 0, end = 0; run < runs; run += 1) {
      const start = end + bytes.charCodeAt(at++); const length = bytes.charCodeAt(at++) + 1;
      paint.rect(start, row, length, 1);
      end = start + length;
    }
  }
  paint.fillStyle = SEMANTIC_PALETTE.ink;
  paint.fill();
  paint.restore();
}

/** INSTALL-23b: clears every pixel at or under `floor` alpha (RGBA bytes, in place) — the rain streaks' faint halo, so
 * the streaks cover at most RAIN_AREA_MAX of the view (weatherLayers.ts). Returns the share of pixels left. */
export function clearFaintPixels(rgba: Uint8ClampedArray | Uint8Array, floor: number): number {
  let kept = 0;
  for (let index = 3; index < rgba.length; index += 4) {
    if ((rgba[index] ?? 0) <= floor) { rgba[index - 3] = 0; rgba[index - 2] = 0; rgba[index - 1] = 0; rgba[index] = 0; } else kept += 1;
  }
  return rgba.length === 0 ? 0 : kept / (rgba.length / 4);
}

// Cache (AGENTS rule 10): the repeat pattern of each source (a tint image or a rain cell canvas); key: the context and
// the source (a new canvas makes new patterns). Reason: createPattern per frame allocates a pattern per layer per frame
// (the Wave 9 rain overlay's rule, kept).
const patterns = new WeakMap<CanvasRenderingContext2D, Map<CanvasImageSource, CanvasPattern | null>>();

/** The repeat pattern of `key` (its `frame` cell for a sheet), or null (not loaded, no pattern support). */
export function weatherPattern(context: CanvasRenderingContext2D, key: Wave23Key, frame = 0): CanvasPattern | null {
  if (typeof context.createPattern !== "function") return null;
  const image = weatherImage(key);
  if (image === null) return null;
  const source = cellCanvas(key, image, frame);
  if (source === null) return null;
  let byContext = patterns.get(context);
  if (byContext === undefined) { byContext = new Map(); patterns.set(context, byContext); }
  if (!byContext.has(source)) byContext.set(source, context.createPattern(source, "repeat"));
  return byContext.get(source) ?? null;
}

/** Draws `frame` of `key` into `rect` (current transform), smoothed. False until loaded. */
export function drawWeatherSprite(context: CanvasRenderingContext2D, key: Wave23Key, frame: number,
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): boolean {
  const image = weatherImage(key);
  if (image === null) return false;
  drawCroppedWorldSprite(context, image, weatherCell(key, frame), rect, false, true);
  return true;
}

// Cache (AGENTS rule 10): a tint's mean colour (its RGB and alpha averaged over the image); key: the image (two tints).
// SMOOTH-2R: the mean is measured at build time (pixelFacts.generated.ts WEATHER_MEAN_RGBA), not read back from the
// image. Reason: a repeat pattern of the 256 x 256 tint over the whole view cost 3.8 ms a frame against 0.6 ms for a
// flat fill of the same blend (headless Chrome --disable-gpu on a Mac, 1280 x 800, multiply at 0.06, median of 40;
// scripts/weatherCaptures.ts "fillCost" repeats it). The tint's brush variation is kept to 25 % of its colour by Astra's
// processing, and at the 0.06-0.10 it is applied that is under two 8-bit levels, so the flat mean looks the same.
const meanColours = new Map<CanvasImageSource, string | null>();

/** The mean colour of a tint `key` (rgba, its mean alpha included), or null (not loaded; Node). */
export function weatherMeanColour(key: Wave23Key): string | null {
  const image = weatherImage(key);
  if (image === null) return null;
  if (meanColours.has(image)) return meanColours.get(image) ?? null;
  const mean = WEATHER_MEAN_RGBA[key] ?? null;
  const colour = mean === null ? null : rgbaOfChannels(mean[0], mean[1], mean[2], mean[3] / 255);
  meanColours.set(image, colour);
  return colour;
}
