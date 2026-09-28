import type { CSSProperties } from "react";
import { assetUrlForBase } from "../render/worldAssets";
import { WAVE25_IMAGES, type Wave25ImageId } from "./wave25ArtManifest.generated";

// UI-7 Wave 25 family tree parts (scripts/installWave25.py): the banner, generation label and person frames as 9-slice
// border images (their insets drawn at a scale), the branch lines as repeating strips, the joints, link and buttons as
// plain images.
export const wave25Url = (id: Wave25ImageId): string => assetUrlForBase(WAVE25_IMAGES[id].url, import.meta.env?.BASE_URL ?? "/");

type Wave25FrameId = { [K in Wave25ImageId]: (typeof WAVE25_IMAGES)[K] extends { readonly nineSlice: unknown } ? K : never }[Wave25ImageId];

/** A 9-slice part as a box's border image, its insets drawn at `scale` (1 = the art's pixels). */
export function wave25FrameStyle(id: Wave25FrameId, scale = 1): CSSProperties {
  const { top, right, bottom, left } = WAVE25_IMAGES[id].nineSlice;
  const widths = `${top * scale}px ${right * scale}px ${bottom * scale}px ${left * scale}px`;
  return { borderStyle: "solid", borderColor: "transparent", borderWidth: widths,
    borderImage: `url("${wave25Url(id)}") ${top} ${right} ${bottom} ${left} fill / ${widths} / 0 stretch` };
}

/** A branch line `length` px long and `thickness` px thick, the 8 px strip repeated along it. */
export function wave25LineStyle(axis: "h" | "v", length: number, thickness: number): CSSProperties {
  const image = WAVE25_IMAGES[axis === "h" ? "tree_line_h" : "tree_line_v"];
  const scale = thickness / 8;
  return axis === "h"
    ? { width: length, height: thickness, backgroundImage: `url("${wave25Url("tree_line_h")}")`, backgroundSize: `${image.width * scale}px ${thickness}px`, backgroundRepeat: "repeat-x" }
    : { width: thickness, height: length, backgroundImage: `url("${wave25Url("tree_line_v")}")`, backgroundSize: `${thickness}px ${image.height * scale}px`, backgroundRepeat: "repeat-y" };
}

/** A plain part as a `width` × `height` block. */
export function wave25ImageStyle(id: Wave25ImageId, width: number, height = width * WAVE25_IMAGES[id].height / WAVE25_IMAGES[id].width): CSSProperties {
  return { width, height, backgroundImage: `url("${wave25Url(id)}")`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" };
}
