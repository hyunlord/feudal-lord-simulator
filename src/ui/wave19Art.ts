import type { CSSProperties } from "react";
import { assetUrlForBase } from "../render/worldAssets";
import type { SeasonSceneId } from "./seasonLedgerScenes";
import { WAVE19_IMAGES } from "./wave19ArtManifest.generated";

// UI-4b Wave 19 art (scripts/installWave19.py): the 24 season-ledger scene icons (96 x 96 masters, drawn at 24-40 px)
// in use now; the record-card frames, timeline, biography and faction pages and the decision record registered for
// CHRON-1 (9-slice insets and minimum sizes in the manifest).
export type Wave19ImageId = keyof typeof WAVE19_IMAGES;

export const wave19Url = (id: Wave19ImageId): string => assetUrlForBase(WAVE19_IMAGES[id].url, import.meta.env?.BASE_URL ?? "/");

/** A season scene icon as a `size` px square block. */
export function seasonSceneStyle(scene: SeasonSceneId, size: number): CSSProperties {
  return { width: size, height: size, backgroundImage: `url("${wave19Url(`scene_${scene}`)}")`, backgroundSize: "contain", backgroundRepeat: "no-repeat" };
}

type Wave19FrameId = { [K in Wave19ImageId]: (typeof WAVE19_IMAGES)[K] extends { readonly nineSlice: unknown } ? K : never }[Wave19ImageId];

/**
 * CHRON-1: a Wave 19 9-slice frame as a layer's border image, its fixed insets drawn at `scale` (1 = the art's pixels;
 * the frame grows with its box, never below `minimumSize × scale`).
 */
export function wave19FrameLayerStyle(id: Wave19FrameId, scale = 1): CSSProperties {
  const { top, right, bottom, left } = WAVE19_IMAGES[id].nineSlice.insets;
  const widths = `${top * scale}px ${right * scale}px ${bottom * scale}px ${left * scale}px`;
  return { borderStyle: "solid", borderColor: "transparent", borderWidth: widths,
    borderImage: `url("${wave19Url(id)}") ${top} ${right} ${bottom} ${left} fill / ${widths} / 0 stretch` };
}

/** A Wave 19 icon or strip as a `width` CSS px block (height from the art's aspect). */
export function wave19ImageStyle(id: Wave19ImageId, width: number): CSSProperties {
  const image = WAVE19_IMAGES[id];
  return { width, height: Math.round(width * image.height / image.width), backgroundImage: `url("${wave19Url(id)}")`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" };
}
