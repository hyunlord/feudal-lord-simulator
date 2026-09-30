import type { CSSProperties } from "react";
import { frameSafe } from "../frameBox";
import { FRAME_GAP, type FrameKind } from "../frameTokens.generated";

// UI-AUDIT-1: a slot measured on a page or frame painting (in art px), placed on the art-space layer (the surface's
// border box, frameArtSpaceStyle) at `scale` and kept inside the surface's content box — the painting's safe inset at
// that scale plus the gap. A slot the art prints nearer its edge than that is cut back to it; its other sides stay.
export type ArtRect = Readonly<{ left: number; top: number; width: number; height: number }>;
type Size = Readonly<{ width: number; height: number }>;

/** The content box on the art-space layer, in CSS px. */
export function contentBoxOnArt(kind: FrameKind, size: Size, scale: number): Readonly<{ left: number; top: number; right: number; bottom: number }> {
  const safe = frameSafe(kind, scale);
  return { left: safe.left + FRAME_GAP, top: safe.top + FRAME_GAP, right: size.width * scale - safe.right - FRAME_GAP, bottom: size.height * scale - safe.bottom - FRAME_GAP };
}

/** The slot `rect` (art px) as absolute CSS px on the art-space layer, cut to the content box. */
export function slotInside(kind: FrameKind, size: Size, scale: number, rect: ArtRect): CSSProperties {
  const box = contentBoxOnArt(kind, size, scale);
  const left = Math.max(rect.left * scale, box.left); const top = Math.max(rect.top * scale, box.top);
  const right = Math.min((rect.left + rect.width) * scale, box.right); const bottom = Math.min((rect.top + rect.height) * scale, box.bottom);
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}
