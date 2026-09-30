import type { LegacyEndingId } from "../content/legacyConfig";
import { assetUrlForBase } from "../render/worldAssets";
import { ENDING_IMAGES } from "./endingArtManifest.generated";

// INSTALL-33 the campaign's ending paintings (scripts/installEndings.py): one 1920 × 1080 painting per LegacyEndingId,
// the ending screen's backdrop (in place of the one Wave 21 ch5_campaign_ending all six shared), shipped as received.
export const endingArtUrl = (id: LegacyEndingId): string => assetUrlForBase(ENDING_IMAGES[id].url, import.meta.env?.BASE_URL ?? "/");

/** BUDGET-1b: request each ending painting `include` admits (preloadGameArt.ts CHAPTER_SCOPED_MANIFESTS). */
export function preloadEndingArt(include: (url: string) => boolean): void {
  const base = import.meta.env?.BASE_URL ?? "/";
  for (const image of Object.values(ENDING_IMAGES)) {
    if (include(image.url)) {
      const img = new Image();
      img.src = assetUrlForBase(image.url, base);
    }
  }
}
