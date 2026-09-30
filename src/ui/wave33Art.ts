import type { CSSProperties } from "react";
import type { LegacyInterludeId } from "../content/legacyConfig";
import { assetUrlForBase } from "../render/worldAssets";
import { WAVE33_IMAGES } from "./wave33ArtManifest.generated";

// UI-10 Wave 33 interlude illustrations (scripts/installWave33.py): chapter 5's five 1384–1400 interlude events
// (960 × 540), one per LegacyInterludeId, loaded as build-time JPEG derivatives of the received PNGs.
export type Wave33ImageId = keyof typeof WAVE33_IMAGES;

export const wave33Url = (id: Wave33ImageId): string => assetUrlForBase(WAVE33_IMAGES[id].url, import.meta.env?.BASE_URL ?? "/");

export function wave33ImageStyle(id: Wave33ImageId, width: number): CSSProperties {
  const image = WAVE33_IMAGES[id];
  return { width, height: Math.round(width * image.height / image.width), backgroundImage: `url("${wave33Url(id)}")`, backgroundSize: "cover" };
}

/** The engine interlude's illustration (`interlude_<id>`; the type check keeps every LegacyInterludeId covered). */
export const interludeImageId = (id: LegacyInterludeId): Wave33ImageId => `interlude_${id}`;

/** BUDGET-1b: request each Wave 33 illustration `include` admits (preloadGameArt.ts CHAPTER_SCOPED_MANIFESTS). */
export function preloadWave33Art(include: (url: string) => boolean): void {
  const base = import.meta.env?.BASE_URL ?? "/";
  for (const image of Object.values(WAVE33_IMAGES)) {
    if (include(image.url)) {
      const img = new Image();
      img.src = assetUrlForBase(image.url, base);
    }
  }
}
