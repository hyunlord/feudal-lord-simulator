import { waterFrameRect } from "./waterMotionModel";
import { WAVE29_WATER, type Wave29WaterKey } from "./wave29WaterManifest.generated";
import { assetUrlForBase } from "./worldAssets";
import { drawCroppedWorldSprite } from "./worldSprite";

// INSTALL-29 water motion art (public/assets/wave29/water, scripts/installWave29.py): the browser image cache and each
// sheet's frames cut to their own canvases. A sheet is one row of frames with no margins, so a smoothed draw or a
// repeat pattern sampling the sheet itself would bleed the neighbour frame in at the frame's edge: every draw takes its
// frame's own canvas instead (cut exactly on waterFrameRect, unsmoothed), which clamps the UVs inside the frame by
// construction. Node has no Image: every water draw returns before touching the context there; tests stand images and
// a canvas factory in with setWaterArtForTest.
type Entry = { readonly image: HTMLImageElement; status: "loading" | "ready" | "missing" };
type FrameCanvas = { readonly canvas: CanvasImageSource; readonly context: CanvasRenderingContext2D };
export type WaterCanvasFactory = (width: number, height: number) => FrameCanvas | null;

const entries = new Map<Wave29WaterKey, Entry>();
let testArt: ((key: Wave29WaterKey) => CanvasImageSource | null) | null = null;
let testFactory: WaterCanvasFactory | null = null;

export function waterImage(key: Wave29WaterKey): CanvasImageSource | null {
  if (testArt !== null) return testArt(key);
  if (typeof Image !== "function") return null;
  let entry = entries.get(key);
  if (entry === undefined) {
    const image = new Image();
    const created: Entry = { image, status: "loading" };
    image.onload = () => { created.status = "ready"; };
    image.onerror = () => { created.status = "missing"; };
    image.src = assetUrlForBase(WAVE29_WATER[key].url, import.meta.env?.BASE_URL ?? "/");
    entries.set(key, created);
    entry = created;
  }
  return entry.status === "ready" ? entry.image : null;
}

/** Every key loaded (starts the loads that have not started). */
export function waterArtReady(keys: readonly Wave29WaterKey[]): boolean {
  let ready = true;
  for (const key of keys) if (waterImage(key) === null) ready = false;
  return ready;
}

export function setWaterArtForTest(art: ((key: Wave29WaterKey) => CanvasImageSource | null) | null, factory: WaterCanvasFactory | null = null): void {
  testArt = art;
  testFactory = factory;
  frameCanvases.clear();
}

function browserCanvas(width: number, height: number): FrameCanvas | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  return context === null ? null : { canvas, context };
}

// Cache (AGENTS rule 10): each frame of a sheet copied to its own canvas; key: the sheet image and the frame index (77
// frames over the 14 sheets, 1,008,384 px = 4.0 MB if all were cut; the mill race's 6 only once a fulling mill's race
// is in view). Reason: see the head comment (a pattern repeats its whole source; a smoothed sub-rect draw may sample across the frame's edge); the image
// is the key, so a reload (a new image) cuts afresh, and the frame index is the only other input. Measured (headless
// Chrome --disable-gpu on the Mac, 5 runs): cutting all 77 frames 1.2-1.5 ms, once; all 77 cached lookups under the
// 0.1 ms timer step.
const frameCanvases = new Map<CanvasImageSource, (CanvasImageSource | null)[]>();

/** The canvas of `frame` of `key` (null: not loaded, no canvas). */
export function waterFrameCanvas(key: Wave29WaterKey, frame: number): CanvasImageSource | null {
  const image = waterImage(key);
  if (image === null) return null;
  const count = WAVE29_WATER[key].frames;
  let frames = frameCanvases.get(image);
  if (frames === undefined) { frames = Array.from({ length: count }, () => null); frameCanvases.set(image, frames); }
  const index = ((Math.floor(frame) % count) + count) % count;
  const cached = frames[index];
  if (cached !== null && cached !== undefined) return cached;
  const rect = waterFrameRect(key, index);
  const cut = (testFactory ?? browserCanvas)(rect.width, rect.height);
  if (cut === null) return null;
  drawCroppedWorldSprite(cut.context, image, rect, { x: 0, y: 0, width: rect.width, height: rect.height }, false, false);
  frames[index] = cut.canvas;
  return cut.canvas;
}

// Cache (AGENTS rule 10): the pattern of each frame canvas; key: the context and the canvas (a new canvas makes new
// patterns). Reason: createPattern per fill would allocate a pattern per layer per frame (the Wave 9 / INSTALL-23 rule).
const patterns = new WeakMap<CanvasRenderingContext2D, Map<CanvasImageSource, CanvasPattern | null>>();

/** The repeat pattern of `frame` of `key` (`repeat-x` for the X-only shore strips), or null. */
export function waterFramePattern(context: CanvasRenderingContext2D, key: Wave29WaterKey, frame: number): CanvasPattern | null {
  if (typeof context.createPattern !== "function") return null;
  const source = waterFrameCanvas(key, frame);
  if (source === null) return null;
  let byContext = patterns.get(context);
  if (byContext === undefined) { byContext = new Map(); patterns.set(context, byContext); }
  if (!byContext.has(source)) byContext.set(source, context.createPattern(source, WAVE29_WATER[key].repeatY ? "repeat" : "repeat-x"));
  return byContext.get(source) ?? null;
}
