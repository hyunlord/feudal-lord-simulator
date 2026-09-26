import type { CSSProperties } from "react";
import { assetUrlForBase } from "../render/worldAssets";
import { PORTRAIT_IMAGES } from "./portraitArtManifest.generated";

// CHRON-1 portrait pool runtime (scripts/installChronicleArt.py): each PERSON-0 pool picture (`PortraitChoice.portraitId`)
// ships as a 256 px and a 96 px JPEG made at build time from the received PNG. A slot up to 96 CSS px draws the 96 at
// 1x and the 256 at 2x; a larger slot draws the 256.
export type PortraitImageId = keyof typeof PORTRAIT_IMAGES;

const hasPortrait = (id: string): id is PortraitImageId => Object.hasOwn(PORTRAIT_IMAGES, id);
const url = (path: string) => assetUrlForBase(path, import.meta.env?.BASE_URL ?? "/");

export function portraitUrl(portraitId: string, size: 96 | 256): string | null {
  if (!hasPortrait(portraitId)) return null;
  return url(size === 96 ? PORTRAIT_IMAGES[portraitId].url96 : PORTRAIT_IMAGES[portraitId].url);
}

/** The portrait as a `size` px square background (null for an id outside the pool). */
export function portraitStyle(portraitId: string, size: number): CSSProperties | null {
  if (!hasPortrait(portraitId)) return null;
  const image = PORTRAIT_IMAGES[portraitId];
  const backgroundImage = size <= 96 ? `image-set(url("${url(image.url96)}") 1x, url("${url(image.url)}") 2x)` : `url("${url(image.url)}")`;
  return { width: size, height: size, backgroundImage, backgroundSize: "cover", backgroundPosition: "center" };
}
