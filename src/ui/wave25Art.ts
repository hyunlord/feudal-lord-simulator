import type { CSSProperties } from "react";
import { assetUrlForBase } from "../render/worldAssets";
import { frameSurfaceStyle } from "./frameBox";
import type { FrameKind } from "./frameTokens.generated";
import { WAVE25_IMAGES, type Wave25ImageId } from "./wave25ArtManifest.generated";

// UI-7 Wave 25 family tree parts (scripts/installWave25.py): the banner, generation label and person frames as 9-slice
// border images (their insets drawn at a scale), the branch lines as repeating strips, the joints, link and buttons as
// plain images.
export const wave25Url = (id: Wave25ImageId): string => assetUrlForBase(WAVE25_IMAGES[id].url, import.meta.env?.BASE_URL ?? "/");

type Wave25FrameId = { [K in Wave25ImageId]: (typeof WAVE25_IMAGES)[K] extends { readonly nineSlice: unknown } ? K : never }[Wave25ImageId];

/** UI-AUDIT-1: each part's frame kind (data-frame) and state variant in the frame tokens. */
export const WAVE25_FRAME_KIND = {
  tree_lineage_banner: ["tree-banner", undefined], tree_generation_label: ["tree-generation", undefined], tree_node_frame: ["tree-node", undefined],
  tree_node_frame_selected: ["tree-node", "selected"], tree_node_frame_deceased: ["tree-node", "deceased"],
} as const satisfies Record<Wave25FrameId, readonly [FrameKind, string | undefined]>;

/** A 9-slice part as a box's border image, its insets drawn at `scale` (1 = the art's pixels); the box's border is the
 * kind's safe inset, its padding the gap (the frame tokens). */
export function wave25FrameStyle(id: Wave25FrameId, scale = 1): CSSProperties {
  const [kind, variant] = WAVE25_FRAME_KIND[id];
  return frameSurfaceStyle(kind, scale, variant);
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
