import type { CSSProperties } from "react";

import { frameContentStyle, frameLayerStyle } from "./frameBox";
import type { FrameKind } from "./frameTokens.generated";
import { uiArtUrl } from "./uiArt";
import { WAVE8_FRAMES, WAVE8_IMAGES } from "./wave8ArtManifest.generated";

// UI-3: Wave 8 art as CSS. A frame is drawn as its own layer (9-slice border-image over the surface's border box) because
// the frames' content rects and fixed slots sit inside the insets (the season ledger's three scene slots are in its
// 460 px left inset); the content is placed over it by `wave8ContentStyle`. Source pixels / sourceScale = CSS px.
// UI-AUDIT-1: the frame tokens (src/ui/frameTokens.generated.ts) carry the insets: the surface's border is the content
// rect's offsets (its `data-frame` kind), so the body fills the content box.
export type Wave8ImageId = keyof typeof WAVE8_IMAGES;
export type Wave8FrameId = keyof typeof WAVE8_FRAMES;

export const wave8Url = (id: Wave8ImageId): string => uiArtUrl(WAVE8_IMAGES[id].url);

/** The frame kind (data-frame) of each Wave 8 frame a surface wears. */
export const WAVE8_FRAME_KIND = { frame_chronicle_page: "chapter-page", frame_petition: "petition", frame_season_ledger: "season-ledger" } as const satisfies Partial<Record<Wave8FrameId, FrameKind>>;
type Wave8LayerId = keyof typeof WAVE8_FRAME_KIND;

/** A layer that paints the frame over the surface's border box (an absolutely placed sibling of the body). */
export const wave8FrameLayerStyle = (id: Wave8LayerId): CSSProperties => frameLayerStyle(WAVE8_FRAME_KIND[id]);

/** The frame's minimum CSS size. */
export const wave8FrameMinSize = (id: Wave8FrameId) => ({ width: WAVE8_FRAMES[id].minSize.width / WAVE8_FRAMES[id].sourceScale,
  height: WAVE8_FRAMES[id].minSize.height / WAVE8_FRAMES[id].sourceScale });

/** The body over the content rect: the surface's border is the rect's offsets from the frame's edges (the rect grows with
 * the frame's stretch), so the body fills the content box, the gap inside the rect. */
export const wave8ContentStyle = (_id: Wave8LayerId): CSSProperties => frameContentStyle();

/** A whole image as a CSS background at `width` CSS px (height from the image's aspect). */
export function wave8ImageStyle(id: Wave8ImageId, width: number): CSSProperties {
  const image = WAVE8_IMAGES[id];
  return { width, height: Math.round(width * image.height / image.width), backgroundImage: `url("${wave8Url(id)}")`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" };
}
