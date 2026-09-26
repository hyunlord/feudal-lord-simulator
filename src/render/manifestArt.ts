import { assetUrlForBase } from "./worldAssets";
import { drawCroppedWorldSprite } from "./worldSprite";

// A browser image cache and pivot draws for a generated art manifest (Wave 7 INSTALL-7, Wave 11 INSTALL-11): each
// entry has its url, size, pivot (Astra's registration) and, for a sheet, its frame cells. Node has no Image, so every
// caller keeps its fallback there.
type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
type Meta = { readonly url: string; readonly width: number; readonly height: number; readonly pivot: { readonly x: number; readonly y: number };
  readonly frames?: { readonly width: number; readonly height: number; readonly count: number } };

export function manifestArt<K extends string>(manifest: Readonly<Record<K, Meta>>) {
  type Entry = { readonly image: HTMLImageElement; status: "loading" | "ready" | "missing" };
  const entries = new Map<K, Entry>();
  const art = (key: K): HTMLImageElement | null => {
    if (typeof Image !== "function") return null;
    let entry = entries.get(key);
    if (entry === undefined) {
      const image = new Image();
      const created: Entry = { image, status: "loading" };
      image.onload = () => { created.status = "ready"; };
      image.onerror = () => { created.status = "missing"; };
      image.src = assetUrlForBase(manifest[key].url, import.meta.env?.BASE_URL ?? "/");
      entries.set(key, created);
      entry = created;
    }
    return entry.status === "ready" ? entry.image : null;
  };
  return {
    art,
    preload: (): void => { for (const key of Object.keys(manifest) as K[]) art(key); },
    /** Draws `key` with its pivot at (x, y), `scale` world px per asset px; `frame` picks a sheet cell. False until loaded. */
    draw: (context: CanvasRenderingContext2D, key: K, x: number, y: number, scale: number, frame = 0): boolean => {
      const image = art(key);
      if (image === null) return false;
      const meta = manifest[key];
      const cell = meta.frames ?? { width: meta.width, height: meta.height, count: 1 };
      const index = ((frame % cell.count) + cell.count) % cell.count;
      drawCroppedWorldSprite(context, image, { x: index * cell.width, y: 0, width: cell.width, height: cell.height },
        { x: x - meta.pivot.x * scale, y: y - meta.pivot.y * scale, width: cell.width * scale, height: cell.height * scale }, false, true);
      return true;
    },
    /** Draws a layer painted on another art's canvas into that art's rect, through its crop (in `declared` units). */
    drawOnReference: (context: CanvasRenderingContext2D, key: K, crop: Rect, declared: { readonly width: number; readonly height: number }, rect: Rect): boolean => {
      const image = art(key);
      if (image === null) return false;
      const meta = manifest[key];
      const kx = meta.width / declared.width, ky = meta.height / declared.height;
      drawCroppedWorldSprite(context, image, { x: crop.x * kx, y: crop.y * ky, width: crop.width * kx, height: crop.height * ky }, rect, false, true);
      return true;
    },
  };
}
