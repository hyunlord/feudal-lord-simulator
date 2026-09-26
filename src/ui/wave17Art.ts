import type { CSSProperties } from "react";
import { assetUrlForBase } from "../render/worldAssets";
import { WAVE17_IMAGES } from "./wave17ArtManifest.generated";

// CHRON-1 Wave 17 chronicle illustrations (scripts/installChronicleArt.py): the two the ledger's records use now (the
// stone town proclaimed and finished), loaded as build-time JPEG derivatives of the received PNGs.
export type Wave17ImageId = keyof typeof WAVE17_IMAGES;

export const wave17Url = (id: Wave17ImageId): string => assetUrlForBase(WAVE17_IMAGES[id].url, import.meta.env?.BASE_URL ?? "/");

export function wave17ImageStyle(id: Wave17ImageId, width: number): CSSProperties {
  const image = WAVE17_IMAGES[id];
  return { width, height: Math.round(width * image.height / image.width), backgroundImage: `url("${wave17Url(id)}")`, backgroundSize: "cover" };
}
