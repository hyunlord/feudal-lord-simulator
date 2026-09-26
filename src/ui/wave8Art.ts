import type { CSSProperties } from "react";

import { uiArtUrl } from "./uiArt";
import { WAVE8_FRAMES, WAVE8_IMAGES } from "./wave8ArtManifest.generated";

// UI-3: Wave 8 art as CSS. A frame is drawn as its own layer (9-slice border-image filling the element) because the
// frames' content rects and fixed slots sit inside the insets (the season ledger's three scene slots are in its
// 460 px left inset); the content is placed over it by `wave8ContentStyle`. Source pixels / sourceScale = CSS px.
export type Wave8ImageId = keyof typeof WAVE8_IMAGES;
export type Wave8FrameId = keyof typeof WAVE8_FRAMES;

export const wave8Url = (id: Wave8ImageId): string => uiArtUrl(WAVE8_IMAGES[id].url);

/** A layer that paints the frame over its whole box (position it absolutely, inset 0). */
export function wave8FrameLayerStyle(id: Wave8FrameId): CSSProperties {
  const frame = WAVE8_FRAMES[id]; const scale = frame.sourceScale; const { top, right, bottom, left } = frame.slice;
  return {
    borderStyle: "solid", borderColor: "transparent",
    borderWidth: `${top / scale}px ${right / scale}px ${bottom / scale}px ${left / scale}px`,
    borderImage: `url("${uiArtUrl(frame.url)}") ${top} ${right} ${bottom} ${left} fill / ${top / scale}px ${right / scale}px ${bottom / scale}px ${left / scale}px / 0 stretch`,
  };
}

/** The frame's minimum CSS size. */
export const wave8FrameMinSize = (id: Wave8FrameId) => ({ width: WAVE8_FRAMES[id].minSize.width / WAVE8_FRAMES[id].sourceScale,
  height: WAVE8_FRAMES[id].minSize.height / WAVE8_FRAMES[id].sourceScale });

/** The content rect as offsets from the frame's edges (the rect grows with the frame's stretch). */
export function wave8ContentStyle(id: Wave8FrameId, index = 0): CSSProperties {
  const frame = WAVE8_FRAMES[id]; const scale = frame.sourceScale; const rect = frame.content[index]!;
  return { position: "absolute", left: rect.x / scale, top: rect.y / scale,
    right: (frame.width - rect.x - rect.width) / scale, bottom: (frame.height - rect.y - rect.height) / scale };
}

/** A whole image as a CSS background at `width` CSS px (height from the image's aspect). */
export function wave8ImageStyle(id: Wave8ImageId, width: number): CSSProperties {
  const image = WAVE8_IMAGES[id];
  return { width, height: Math.round(width * image.height / image.width), backgroundImage: `url("${wave8Url(id)}")`, backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" };
}
