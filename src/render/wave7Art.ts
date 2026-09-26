import { WAVE7_ART } from "./wave7ArtManifest.generated";
import { assetUrlForBase } from "./worldAssets";
import { drawCroppedWorldSprite } from "./worldSprite";

// INSTALL-7 Wave 7 art (public/assets/wave7, scripts/installWave7.py): a browser image cache and one draw at the
// asset's own registration (Astra's pivot; sheets pick a frame cell). Node has no Image, so every caller keeps its
// fallback there (C25 and the unit tests draw without it).
export type Wave7Key = keyof typeof WAVE7_ART;

type Entry = { readonly image: HTMLImageElement; status: "loading" | "ready" | "missing" };
const entries = new Map<Wave7Key, Entry>();

export function wave7Art(key: Wave7Key): HTMLImageElement | null {
  if (typeof Image !== "function") return null;
  let entry = entries.get(key);
  if (entry === undefined) {
    const image = new Image();
    const created: Entry = { image, status: "loading" };
    image.onload = () => { created.status = "ready"; };
    image.onerror = () => { created.status = "missing"; };
    image.src = assetUrlForBase(WAVE7_ART[key].url, import.meta.env?.BASE_URL ?? "/");
    entries.set(key, created);
    entry = created;
  }
  return entry.status === "ready" ? entry.image : null;
}

export function preloadWave7Art(): void {
  for (const key of Object.keys(WAVE7_ART) as Wave7Key[]) wave7Art(key);
}

/** Draws `key` with its pivot at (x, y), `scale` world px per asset px; `frame` picks a sheet cell. False until loaded. */
export function drawWave7(context: CanvasRenderingContext2D, key: Wave7Key, x: number, y: number, scale: number, frame = 0): boolean {
  const image = wave7Art(key);
  if (image === null) return false;
  const meta = WAVE7_ART[key];
  const cell = "frames" in meta ? meta.frames : { width: meta.width, height: meta.height, count: 1 };
  const index = ((frame % cell.count) + cell.count) % cell.count;
  drawCroppedWorldSprite(context, image, { x: index * cell.width, y: 0, width: cell.width, height: cell.height },
    { x: x - meta.pivot.x * scale, y: y - meta.pivot.y * scale, width: cell.width * scale, height: cell.height * scale }, false, true);
  return true;
}

/** Draws an overlay painted on the same canvas as the art it covers (roof snow, boarded windows) into that art's rect. */
export function drawWave7Overlay(context: CanvasRenderingContext2D, key: Wave7Key,
  crop: { readonly x: number; readonly y: number; readonly width: number; readonly height: number },
  declared: { readonly width: number; readonly height: number },
  rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }): boolean {
  const image = wave7Art(key);
  if (image === null) return false;
  const meta = WAVE7_ART[key];
  const kx = meta.width / declared.width, ky = meta.height / declared.height;
  drawCroppedWorldSprite(context, image, { x: crop.x * kx, y: crop.y * ky, width: crop.width * kx, height: crop.height * ky }, rect, false, true);
  return true;
}
