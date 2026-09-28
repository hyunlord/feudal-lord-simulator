import type { CSSProperties } from "react";
import type { ControllerActionId } from "../input/controllerActions";
import { assetUrlForBase } from "../render/worldAssets";
import { WAVE23_IMAGES } from "../render/wave23ArtManifest.generated";

// INSTALL-23 ⑤ pad glyphs (Wave 23 `pad`, brand-neutral parchment and ink; 32 and 48 px cells): what each controller
// action (controllerActions.ts, the gamepadTranslator's bindings) looks like on the pad. The shoulder and trigger art
// are two-cell sheets (L, R). The art has one stick picture (`stick_press`); it stands for either stick, and the
// glyph's accessible name and the hint's words say which.
export type PadGlyphId = "a" | "b" | "x" | "y" | "dpad" | "shoulder_l" | "shoulder_r" | "trigger_l" | "trigger_r" | "stick_l" | "stick_r" | "menu" | "view";

type SheetStem = "a" | "b" | "x" | "y" | "dpad" | "shoulder" | "trigger" | "stick_press" | "menu" | "view";
const ART: Readonly<Record<PadGlyphId, { readonly stem: SheetStem; readonly cell: 0 | 1 }>> = {
  a: { stem: "a", cell: 0 }, b: { stem: "b", cell: 0 }, x: { stem: "x", cell: 0 }, y: { stem: "y", cell: 0 }, dpad: { stem: "dpad", cell: 0 },
  shoulder_l: { stem: "shoulder", cell: 0 }, shoulder_r: { stem: "shoulder", cell: 1 }, trigger_l: { stem: "trigger", cell: 0 }, trigger_r: { stem: "trigger", cell: 1 },
  stick_l: { stem: "stick_press", cell: 0 }, stick_r: { stem: "stick_press", cell: 0 }, menu: { stem: "menu", cell: 0 }, view: { stem: "view", cell: 0 },
};

/** The glyphs of each controller action, as gamepadTranslator.ts binds them (standard mapping). */
export const ACTION_GLYPHS: Readonly<Record<ControllerActionId, readonly PadGlyphId[]>> = {
  cursor: ["stick_l", "dpad"],
  camera: ["stick_r"],
  select: ["a"],
  confirm: ["a"],
  cancel: ["b"],
  tool_prev: ["shoulder_l"],
  tool_next: ["shoulder_r"],
  zone_tool: ["x"],
  zoom_in: ["trigger_r"],
  zoom_out: ["trigger_l"],
  pause: ["y", "menu"],
  problem_view: ["view"],
  menu: ["menu"],
};

/** The glyphs of several actions in order, each once. */
export function glyphsOf(actions: readonly ControllerActionId[]): readonly PadGlyphId[] {
  return [...new Set(actions.flatMap(action => ACTION_GLYPHS[action]))];
}

const sheet = (stem: SheetStem, size: 32 | 48) => WAVE23_IMAGES[`pad_${stem}_${size}`];
const url = (stem: SheetStem, size: 32 | 48) => assetUrlForBase(sheet(stem, size).url, import.meta.env?.BASE_URL ?? "/");

/** A glyph as a `size` px square: up to 32 px the 32 px art at 1x and the 48 at 2x, larger the 48. */
export function padGlyphStyle(glyph: PadGlyphId, size: number): CSSProperties {
  const { stem, cell } = ART[glyph];
  const cells = sheet(stem, 48).width / sheet(stem, 48).frames.cellWidth;
  const backgroundImage = size <= 32 ? `image-set(url("${url(stem, 32)}") 1x, url("${url(stem, 48)}") 2x)` : `url("${url(stem, 48)}")`;
  return { width: size, height: size, backgroundImage, backgroundSize: `${cells * size}px ${size}px`, backgroundPosition: `${-cell * size}px 0`,
    backgroundRepeat: "no-repeat" };
}
