import { useEffect, useState, type CSSProperties } from "react";
import { createArtAdapters } from "../../render/art/artAdapters";
import type { ArtInsets, UiFrameEntry, UiImageEntry } from "../../render/art/artContract";
import type { ArtImageEnvironment } from "../../render/art/artImageLoader";
import type { ArtRegistry } from "../../render/art/artRegistry";
import { ART_REGISTRY } from "../../render/art/wave42Registry";
import { FRAME_GAP } from "../frameTokens.generated";

// LM-R2: the lord screens' UI parts from renderer B's art contract (src/render/art: the `ui-frame` and `ui-image` kinds,
// handed to the screen by the `ui-handoff` placement). A part is drawn only once its picture has loaded at its declared
// size; a missing id, a failed load or a size the entry does not declare gives null, and the screen keeps the kit's own
// look (its class and data-frame) — never an empty box, never a second request (the loader settles each id once).

/** A frame on the frame-box contract (src/ui/frameBox.ts): border = the content-safe inset, padding = the gap. */
export type UiFrameArt = { readonly style: CSSProperties; readonly dataFrame: "flat" };

const px = ({ top, right, bottom, left }: ArtInsets, scale: number, round: (value: number) => number = value => value): string =>
  [top, right, bottom, left].map(side => `${round(side * scale)}px`).join(" ");
const up = (value: number): number => Math.ceil(value - 1e-6);

export function createUiPartArt(registry: ArtRegistry, environment?: ArtImageEnvironment) {
  const adapters = createArtAdapters(registry, environment);
  /** The entry with its deployed URL, when it is that kind and its picture is ready. */
  function ready<K extends "ui-frame" | "ui-image">(id: string, kind: K): Extract<UiFrameEntry | UiImageEntry, { kind: K }> | null {
    const placed = adapters.placement(id, { at: { x: 0, y: 0 } });
    if (placed?.type !== "ui-handoff" || placed.entry.kind !== kind) return null;
    adapters.image(id);
    return adapters.status(id).status === "ready" ? placed.entry as Extract<UiFrameEntry | UiImageEntry, { kind: K }> : null;
  }
  /** A 9-slice frame drawn at its own scale (null: keep the kit's frame). */
  function frame(id: string): UiFrameArt | null {
    const entry = ready(id, "ui-frame");
    if (entry === null) return null;
    const { top, right, bottom, left } = entry.slice;
    const fill = entry.centre === "fill" ? " fill" : "";
    return { dataFrame: "flat", style: {
      borderStyle: "solid", borderColor: "transparent", borderWidth: px(entry.contentInset, entry.scale, up), padding: FRAME_GAP,
      borderImage: `url("${entry.image.url}") ${top} ${right} ${bottom} ${left}${fill} / ${px(entry.slice, entry.scale)} / 0 ${entry.repeat}`,
    } };
  }
  /** A picture at one of its declared CSS widths: the smallest file that covers 1x and 2x (null: keep the kit's look). */
  function image(id: string, cssWidth: number): CSSProperties | null {
    const entry = ready(id, "ui-image");
    if (entry === null || !entry.cssWidths.includes(cssWidth)) return null;
    const files = [entry, ...entry.derivatives.filter(item => item.assetId !== id).map(item => ready(item.assetId, "ui-image"))];
    if (files.some(file => file === null)) return null;
    const sorted = (files as UiImageEntry[]).slice().sort((a, b) => a.image.width - b.image.width);
    const cover = (width: number): UiImageEntry => sorted.find(file => file.image.width >= width) ?? sorted[sorted.length - 1]!;
    const one = cover(cssWidth); const two = cover(cssWidth * 2);
    const backgroundImage = one === two ? `url("${one.image.url}")` : `image-set(url("${one.image.url}") 1x, url("${two.image.url}") 2x)`;
    return { width: cssWidth, height: cssWidth * entry.image.height / entry.image.width, backgroundImage,
      backgroundSize: "100% 100%", backgroundRepeat: "no-repeat" };
  }
  /** Starts the parts' loads; resolves when every one has settled (ready, missing or unavailable). */
  const settled = (ids: readonly string[]): Promise<unknown> => Promise.all(ids.map(id => adapters.loadSettled(id)));
  return { frame, image, settled };
}

/** The startup registry's parts. Cache (AGENTS rule 10): the loader's (a) key is the asset id; (b) nothing else enters —
 * the registry is the startup catalog snapshot, fixed for the session; (c) so a part is requested and decoded once. */
export const UI_PART_ART = createUiPartArt(ART_REGISTRY);

/** Re-renders once the named parts have settled, so a screen swaps the kit look for the art when it is ready. */
export function useUiParts(ids: readonly string[]): typeof UI_PART_ART {
  const [, setSettled] = useState(0);
  const key = ids.join("|");
  useEffect(() => {
    let live = true;
    void UI_PART_ART.settled(key === "" ? [] : key.split("|")).then(() => { if (live) setSettled(count => count + 1); });
    return () => { live = false; };
  }, [key]);
  return UI_PART_ART;
}
