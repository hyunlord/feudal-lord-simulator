import { WAVE38_ART } from "./wave38ArtManifest.generated";
import { uiArtUrl } from "./uiArt";

// LM-R1: the Wave 38 control pictures are CSS tokens (frameTokens.generated.css). A CSS border-image that fails to load
// draws nothing, so each picture is loaded once here at start; if any fails, `data-ui-art="p0"` on the root swaps every
// button and control back to its P0 picture and the fixed-size ones to their drawn shapes (one swap, no retry, no reload
// loop). Until then and when all load, the tokens' Wave 38 pictures stand (the same requests: the browser's cache).

export const UI_ART_FALLBACK = { attribute: "data-ui-art", value: "p0" } as const;

/** What is used of an image: its error handler and its source (an HTMLImageElement, or a test's stand-in). */
type Loader = { onerror: unknown; src: string };

/** Starts loading every Wave 38 picture; the first failure marks `root` for the P0 fallback. Returns the urls asked for. */
export function preloadWave38Art(root: { setAttribute(name: string, value: string): void } | null = globalThis.document?.documentElement ?? null,
  makeImage: (() => Loader) | null = typeof Image === "function" ? () => new Image() : null): readonly string[] {
  if (root === null || makeImage === null) return [];
  let failed = false;
  const urls = Object.values(WAVE38_ART).map(item => uiArtUrl(item.url));
  for (const url of urls) {
    const image = makeImage();
    image.onerror = () => {
      if (failed) return;
      failed = true;
      root.setAttribute(UI_ART_FALLBACK.attribute, UI_ART_FALLBACK.value);
    };
    image.src = url;
  }
  return urls;
}
