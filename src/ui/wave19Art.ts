import type { CSSProperties } from "react";
import { assetUrlForBase } from "../render/worldAssets";
import { frameLayerStyle } from "./frameBox";
import type { FrameKind } from "./frameTokens.generated";
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

/** UI-AUDIT-1: the frame kind (data-frame) of each Wave 19 frame drawn as a layer. */
export const WAVE19_FRAME_KIND = {
  frame_record_decision: "record-decision", frame_record_era: "record-era", frame_record_event: "record-event", frame_record_ledger: "record-ledger",
  frame_record_milestone: "record-milestone", frame_record_person: "record-person", frame_decision_compare: "decision",
  frame_snapshot_map_320: "snapshot-320", frame_snapshot_map_160: "snapshot-160",
} as const satisfies Partial<Record<Wave19FrameId, FrameKind>>;
export type Wave19LayerId = keyof typeof WAVE19_FRAME_KIND;

/**
 * CHRON-1: a Wave 19 9-slice frame as a layer's border image, its fixed insets drawn at `scale` (1 = the art's pixels;
 * the frame grows with its box, never below `minimumSize × scale`). UI-AUDIT-1: the layer covers the surface's border
 * box, whose border is the kind's safe inset at `scale` (frameBoxStyle / the `[data-frame]` rule).
 */
export const wave19FrameLayerStyle = (id: Wave19LayerId, scale: number): CSSProperties => frameLayerStyle(WAVE19_FRAME_KIND[id], scale);

/** A Wave 19 icon or strip as a `width` CSS px block (height from the art's aspect). */
export function wave19ImageStyle(id: Wave19ImageId, width: number): CSSProperties {
  const image = WAVE19_IMAGES[id];
  return { width, height: Math.round(width * image.height / image.width), backgroundImage: `url("${wave19Url(id)}")`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" };
}
