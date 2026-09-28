import type { CSSProperties } from "react";

// UI-7b: a printed slot hidden on a page or card whose art bakes it in (the biography's shield and small circle, the
// person card's shield): a patch of the same art's blank parchment laid over the slot, so an empty slot reads as page.
export type ArtRect = Readonly<{ x: number; y: number; width: number; height: number }>;

/**
 * The patch's style: `url`'s art (`artWidth` × `artHeight`, drawn at `scale`) shown from `source` (a blank area, in art
 * pixels) over `slot` (in art pixels), absolutely placed in the page. `under`: the colour the page itself lies on, for an
 * art whose parchment is not quite opaque (the biography page's alpha is 249–250: without it the printed slot shows
 * through the patch).
 */
export function artPatchStyle(url: string, artWidth: number, artHeight: number, scale: number, slot: ArtRect, source: Readonly<{ x: number; y: number }>,
  under?: string): CSSProperties {
  return {
    ...(under === undefined ? {} : { backgroundColor: under }),
    position: "absolute", left: slot.x * scale, top: slot.y * scale, width: slot.width * scale, height: slot.height * scale,
    backgroundImage: `url("${url}")`, backgroundSize: `${artWidth * scale}px ${artHeight * scale}px`,
    backgroundPosition: `${-source.x * scale}px ${-source.y * scale}px`, backgroundRepeat: "no-repeat", pointerEvents: "none",
  };
}
