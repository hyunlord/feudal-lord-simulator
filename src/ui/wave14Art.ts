import type { CSSProperties } from "react";
import { assetUrlForBase } from "../render/worldAssets";
import { frameSurfaceStyle } from "./frameBox";
import { WAVE14_IMAGES } from "./wave14ArtManifest.generated";

// UI-6: Wave 14 pictures by id (the rights register frame, the right icons, the Crown's hanging seal).
export type Wave14ImageId = keyof typeof WAVE14_IMAGES;

export const wave14Url = (id: Wave14ImageId): string => assetUrlForBase(WAVE14_IMAGES[id].url, import.meta.env?.BASE_URL ?? "/");

export function wave14ImageStyle(id: Wave14ImageId, width: number): CSSProperties {
  const image = WAVE14_IMAGES[id];
  return { display: "inline-block", width, height: Math.round(width * image.height / image.width), backgroundImage: `url("${wave14Url(id)}")`,
    backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" };
}

/** A 9-slice frame as a border image (the rights register: 24 px insets); the frame tokens' box (UI-AUDIT-1). */
export const wave14FrameStyle = (_id: "frame_rights_register"): CSSProperties => frameSurfaceStyle("rights");
