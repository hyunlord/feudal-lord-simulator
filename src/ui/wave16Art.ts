import type { CSSProperties } from "react";
import { assetUrlForBase } from "../render/worldAssets";
import { WAVE16_IMAGES } from "./wave16ArtManifest.generated";

// UI-4 Wave 16 illustrations (event cards 960 × 540, famine decisions 640 × 480, chronicle 384 × 384, chapter
// screens 1920 × 1080), loaded as the build-time web derivatives (scripts/keyartDerivatives.ts).
export type Wave16ImageId = keyof typeof WAVE16_IMAGES;

export const wave16Url = (id: Wave16ImageId): string => assetUrlForBase(WAVE16_IMAGES[id].url, import.meta.env?.BASE_URL ?? "/");

/** A block showing the illustration at `width` px, its aspect kept. */
export function wave16ImageStyle(id: Wave16ImageId, width: number): CSSProperties {
  const image = WAVE16_IMAGES[id];
  return { width, height: Math.round(width * image.height / image.width), backgroundImage: `url("${wave16Url(id)}")`, backgroundSize: "cover" };
}
