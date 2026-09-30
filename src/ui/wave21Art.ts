import type { CSSProperties } from "react";
import { assetUrlForBase } from "../render/worldAssets";
import { WAVE21_IMAGES } from "./wave21ArtManifest.generated";

// UI-8 / UI-9 / UI-10 Wave 21 chapter 3–5 illustrations (scripts/installWave21.py): decision cards (640 × 480),
// chronicle scenes (384 × 384), event illustrations (960 × 540), the chapter end pages and chapter 5's campaign end
// page (1920 × 1080), loaded as build-time JPEG derivatives of the received PNGs.
export type Wave21ImageId = keyof typeof WAVE21_IMAGES;

export const wave21Url = (id: Wave21ImageId): string => assetUrlForBase(WAVE21_IMAGES[id].url, import.meta.env?.BASE_URL ?? "/");

export function wave21ImageStyle(id: Wave21ImageId, width: number): CSSProperties {
  const image = WAVE21_IMAGES[id];
  return { width, height: Math.round(width * image.height / image.width), backgroundImage: `url("${wave21Url(id)}")`, backgroundSize: "cover" };
}

/**
 * BUDGET-1b chapter 3 preload: request each Wave 21 illustration for which `include` returns true.
 * Called from src/render/preloadGameArt.ts CHAPTER_SCOPED_MANIFESTS so the startupArtList script
 * (scripts/checks/startupArtList.ts) can track these as chapter-3-bound art.
 */
export function preloadWave21Art(include: (url: string) => boolean): void {
  const base = import.meta.env?.BASE_URL ?? "/";
  for (const image of Object.values(WAVE21_IMAGES)) {
    if (include(image.url)) {
      const img = new Image();
      img.src = assetUrlForBase(image.url, base);
    }
  }
}
