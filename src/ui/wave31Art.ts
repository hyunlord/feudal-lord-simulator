import type { CSSProperties } from "react";
import { assetUrlForBase } from "../render/worldAssets";
import { WAVE31_IMAGES } from "./wave31ArtManifest.generated";

// PLAGUE-b Wave 31 chapter opening paintings (scripts/installWave31.py, 1920 × 1080): the chronicle's chapter-start
// card and the chapter's opening screen (JPEG 70 runtime copies of the received JPEG 95 files).
export type Wave31ImageId = keyof typeof WAVE31_IMAGES;

export const wave31Url = (id: Wave31ImageId): string => assetUrlForBase(WAVE31_IMAGES[id].url, import.meta.env?.BASE_URL ?? "/");

export function wave31ImageStyle(id: Wave31ImageId, width: number): CSSProperties {
  const image = WAVE31_IMAGES[id];
  return { width, height: Math.round(width * image.height / image.width), backgroundImage: `url("${wave31Url(id)}")`, backgroundSize: "cover" };
}

/** The chapter's opening painting, or null for a chapter without one (chapter 2's is Wave 16's chapter2_intro). */
export function chapterIntro(chapter: number): Wave31ImageId | null {
  return (Object.keys(WAVE31_IMAGES) as Wave31ImageId[]).find(id => WAVE31_IMAGES[id].chapter === chapter) ?? null;
}

/** BUDGET-1b: request each Wave 31 painting `include` admits (preloadGameArt.ts CHAPTER_SCOPED_MANIFESTS). */
export function preloadWave31Art(include: (url: string) => boolean): void {
  const base = import.meta.env?.BASE_URL ?? "/";
  for (const image of Object.values(WAVE31_IMAGES)) {
    if (include(image.url)) {
      const img = new Image();
      img.src = assetUrlForBase(image.url, base);
    }
  }
}
