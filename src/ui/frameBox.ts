import type { CSSProperties } from "react";
import { assetUrlForBase } from "../render/worldAssets";
import { FRAME_GAP, FRAME_TOKENS, type FrameKind } from "./frameTokens.generated";

// UI-AUDIT-1: the frame box contract for surfaces styled from TS (frame layers, card paintings, 9-slices drawn at a
// view's own scale). The surface root carries `data-frame="<kind>"`; its border is the kind's safe inset (transparent),
// its padding the one gap, so its content box is the audit's inner box — the same as the CSS surfaces
// (src/styles/frameTokens.generated.css). Values from src/ui/frameTokens.generated.ts (scripts/frameTokens.ts).
type Sides = Readonly<{ top: number; right: number; bottom: number; left: number }>;
type FrameToken = Readonly<{
  type: "css" | "layer" | "painting"; url: string; size: Readonly<{ width: number; height: number }>; slice: Sides | null; scale: number;
  repeat: "stretch" | "round"; width: Sides | null; safe: Sides; safeSource: Sides;
  variants?: Readonly<Record<string, Readonly<{ url: string; slice: Sides; width: Sides }>>>;
}>;
const TOKENS: Readonly<Record<FrameKind, FrameToken>> = FRAME_TOKENS;

export const frameToken = (kind: FrameKind): FrameToken => TOKENS[kind];
const url = (path: string): string => assetUrlForBase(path, import.meta.env?.BASE_URL ?? "/");
const sidesPx = ({ top, right, bottom, left }: Sides): string => `${top}px ${right}px ${bottom}px ${left}px`;
const times = (value: Sides, by: number): Sides => ({ top: value.top * by, right: value.right * by, bottom: value.bottom * by, left: value.left * by });

/** The kind's safe inset in CSS px when drawn at `scale` (its own by default), rounded up to whole px. */
export function frameSafe(kind: FrameKind, scale = TOKENS[kind].scale): Sides {
  const { safeSource } = TOKENS[kind]; const up = (side: number) => Math.ceil(side * scale - 1e-6);
  return { top: up(safeSource.top), right: up(safeSource.right), bottom: up(safeSource.bottom), left: up(safeSource.left) };
}

/** The surface root's box: border = the safe inset, padding = the gap (a painting's background from the border box). */
export function frameBoxStyle(kind: FrameKind, scale = TOKENS[kind].scale): CSSProperties {
  return { borderStyle: "solid", borderColor: "transparent", borderWidth: sidesPx(frameSafe(kind, scale)), padding: FRAME_GAP,
    ...(TOKENS[kind].type === "painting" ? { backgroundOrigin: "border-box" } : {}) };
}

/** A 9-slice worn by the surface itself at `scale` (the box and the art; `variant` a state's art). */
export function frameSurfaceStyle(kind: FrameKind, scale = TOKENS[kind].scale, variant?: string): CSSProperties {
  return { ...frameBoxStyle(kind, scale), borderImage: frameArt(kind, scale, variant) };
}

/** The `border-image` value: the art, its slice, `fill`, drawn at its width × `scale / token scale`, no outset. */
export function frameArt(kind: FrameKind, scale = TOKENS[kind].scale, variant?: string): string {
  const token = TOKENS[kind]; const art = variant === undefined ? token : token.variants?.[variant];
  if (art === undefined || art.slice === null || art.width === null) throw new Error(`frame ${kind} ${variant ?? ""} has no 9-slice`);
  const { top, right, bottom, left } = art.slice;
  return `url("${url(art.url)}") ${top} ${right} ${bottom} ${left} fill / ${sidesPx(times(art.width, scale / token.scale))} / 0 ${token.repeat}`;
}

/** A frame layer (an absolutely placed sibling span): it covers the surface's border box (its parent's padding box
 * grown by the safe border) and draws the frame there. */
export function frameLayerStyle(kind: FrameKind, scale = TOKENS[kind].scale): CSSProperties {
  const safe = frameSafe(kind, scale); const width = TOKENS[kind].width;
  if (width === null) throw new Error(`frame ${kind} has no 9-slice`);
  return { position: "absolute", top: -safe.top, right: -safe.right, bottom: -safe.bottom, left: -safe.left,
    borderStyle: "solid", borderColor: "transparent", borderWidth: sidesPx(times(width, scale / TOKENS[kind].scale)), borderImage: frameArt(kind, scale) };
}

/** A wrapper that gives a painting's children the art's own coordinates again (the surface's border box: slots, patches
 * and bands stay where the art prints them). */
export function frameArtSpaceStyle(kind: FrameKind, scale = TOKENS[kind].scale): CSSProperties {
  const safe = frameSafe(kind, scale);
  return { position: "absolute", top: -safe.top, right: -safe.right, bottom: -safe.bottom, left: -safe.left };
}

/** A body that fills the surface's content box (absolutely placed in a fixed-size surface). */
export const frameContentStyle = (): CSSProperties => ({ position: "absolute", inset: FRAME_GAP });
