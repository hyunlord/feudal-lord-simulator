import type { CSSProperties } from "react";

import { assetUrlForBase } from "../render/worldAssets";
import { drawCroppedWorldSprite } from "../render/worldSprite";
import { UI_ART_MANIFEST } from "./uiArtManifest.generated";

// UX-2: the Astra UI P0 art (assets-inbox/ui-p0 → public/assets/ui-p0, scripts/installUiArt.py). Icons are drawn from
// the sheet copy made for their CSS size (1x) and its double (2x); the browser never scales one at run time.

const SHEETS = UI_ART_MANIFEST.iconSheets;

/** Short names of the icon sheets. */
export const UI_ICON_SHEETS = {
  resource: "icon_resource_sheet",
  category: "icon_build_category_sheet",
  layer: "icon_layer_mode_sheet",
  building: "icon_first_session_buildings_sheet",
  prediction: "icon_prediction_sheet",
  cause: "icon_cause_family_sheet",
  alert: "icon_alert_priority_sheet",
  time: "icon_time_sheet",
  action: "icon_objective_action_sheet",
  lock: "icon_lock_new_sheet",
  marker: "warning_map_marker_sheet",
} as const satisfies Record<string, keyof typeof SHEETS>;

export type UiIconSheet = keyof typeof UI_ICON_SHEETS;
export type UiIconCell<S extends UiIconSheet> = (typeof SHEETS)[(typeof UI_ICON_SHEETS)[S]]["cells"][number];
/** CSS sizes an icon is shown at; each has its own 1x and 2x sheet copy. */
export type UiIconSize = 24 | 32 | 48;
const SOURCE_FOR: Readonly<Record<UiIconSize, readonly ["24" | "32" | "48" | "64" | "96", "24" | "32" | "48" | "64" | "96"]>> = {
  24: ["24", "48"], 32: ["32", "64"], 48: ["48", "96"],
};

const base = (): string => import.meta.env?.BASE_URL ?? "/";
export const uiArtUrl = (url: string): string => assetUrlForBase(url, base());

export function uiIconCellIndex<S extends UiIconSheet>(sheet: S, cell: UiIconCell<S>): number {
  const cells: readonly string[] = SHEETS[UI_ICON_SHEETS[sheet]].cells;
  const index = cells.indexOf(cell);
  if (index < 0) throw new Error(`No ${String(cell)} icon in ${sheet}`);
  return index;
}

/** Background style showing one cell at `size` CSS px (image-set 1x / 2x, no run-time scaling). */
export function uiIconStyle<S extends UiIconSheet>(sheet: S, cell: UiIconCell<S>, size: UiIconSize): CSSProperties {
  const entry = SHEETS[UI_ICON_SHEETS[sheet]];
  const [x1, x2] = SOURCE_FOR[size];
  const sizes: Readonly<Record<string, { readonly url: string }>> = entry.sizes;
  const index = uiIconCellIndex(sheet, cell);
  return {
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: `image-set(url("${uiArtUrl(sizes[x1]!.url)}") 1x, url("${uiArtUrl(sizes[x2]!.url)}") 2x)`,
    backgroundSize: `${entry.cells.length * size}px ${size}px`,
    backgroundPosition: `${-index * size}px 0`,
    backgroundRepeat: "no-repeat",
  };
}

export type StewardTone = "neutral" | "concern" | "success";
/** The steward's portrait for a line's tone (1x 96 px copy, 2x the 192 px original). */
export function stewardPortraitStyle(tone: StewardTone): CSSProperties {
  const portrait = UI_ART_MANIFEST.portraits[`advisor_steward_portrait_${tone}`];
  return { backgroundImage: `image-set(url("${uiArtUrl(portrait.x1.url)}") 1x, url("${uiArtUrl(portrait.x2.url)}") 2x)` };
}

/** Cause-registry ids → the cause-family icon (water, food, access, labour, storage, safety, rights). */
export const CAUSE_ICON: Readonly<Record<string, UiIconCell<"cause">>> = {
  water: "water", bread: "food", delivery: "access", construction_access: "access", workers: "labour",
  operation_paused: "labour", storage_overflow: "storage", reserve_deadlock: "storage", wall: "safety",
  market: "rights", church: "rights",
};

// ---- Canvas: the map warning markers and cause icons (drawn from the sheet copy nearest the device size) ----
type CanvasSheet = { readonly image: HTMLImageElement; status: "loading" | "ready" | "missing" };
const canvasSheets = new Map<string, CanvasSheet>();

function canvasSheet(url: string): HTMLImageElement | null {
  if (typeof Image !== "function") return null;
  let entry = canvasSheets.get(url);
  if (entry === undefined) {
    const image = new Image();
    const created: CanvasSheet = { image, status: "loading" };
    image.onload = () => { created.status = "ready"; };
    image.onerror = () => { created.status = "missing"; };
    image.src = uiArtUrl(url);
    canvasSheets.set(url, created);
    entry = created;
  }
  return entry.status === "ready" ? entry.image : null;
}

/** Draws one icon cell centred on (x, y) at `size` device px; false while the sheet is still loading. */
export function drawUiIcon<S extends UiIconSheet>(context: CanvasRenderingContext2D, sheet: S, cell: UiIconCell<S>,
  x: number, y: number, size: number): boolean {
  const entry = SHEETS[UI_ICON_SHEETS[sheet]];
  const sizes: Readonly<Record<string, { readonly url: string }>> = entry.sizes;
  const source = [24, 32, 48, 64, 96].find(candidate => candidate >= size) ?? 96;
  const image = canvasSheet(sizes[String(source)]!.url);
  if (image === null) return false;
  const index = uiIconCellIndex(sheet, cell);
  drawCroppedWorldSprite(context, image, { x: index * source, y: 0, width: source, height: source },
    { x: x - size / 2, y: y - size / 2, width: size, height: size }, false, true);
  return true;
}

/** Draws a P0 frame as a 9-slice into (x, y, w, h); `edge` is the drawn slice width (the source inset / 2 at 1:1).
 * False while the frame is still loading (callers keep their flat plaque meanwhile). */
export function drawUiFrame(context: CanvasRenderingContext2D, frame: keyof typeof UI_ART_MANIFEST.frames,
  x: number, y: number, w: number, h: number, edge: number): boolean {
  const entry = UI_ART_MANIFEST.frames[frame];
  const image = canvasSheet(entry.url);
  if (image === null) return false;
  const { left, top, right, bottom } = entry.slice;
  const sx = [0, left, entry.width - right, entry.width];
  const sy = [0, top, entry.height - bottom, entry.height];
  const e = Math.min(edge, w / 2, h / 2);
  const dx = [x, x + e, x + w - e, x + w];
  const dy = [y, y + e, y + h - e, y + h];
  for (let row = 0; row < 3; row += 1) for (let col = 0; col < 3; col += 1) {
    const sw = sx[col + 1]! - sx[col]!, sh = sy[row + 1]! - sy[row]!, dw = dx[col + 1]! - dx[col]!, dh = dy[row + 1]! - dy[row]!;
    if (sw > 0 && sh > 0 && dw > 0 && dh > 0) {
      drawCroppedWorldSprite(context, image, { x: sx[col]!, y: sy[row]!, width: sw, height: sh },
        { x: dx[col]!, y: dy[row]!, width: dw, height: dh }, false, true);
    }
  }
  return true;
}

/** Starts loading the sheets the canvas draws (map markers, cause, prediction, resource icons) before a frame needs them. */
export function preloadCanvasIcons(): void {
  for (const sheet of [SHEETS.warning_map_marker_sheet, SHEETS.icon_cause_family_sheet, SHEETS.icon_prediction_sheet, SHEETS.icon_resource_sheet]) {
    const sizes: Readonly<Record<string, { readonly url: string }>> = sheet.sizes;
    for (const size of ["24", "32", "48"]) if (sizes[size] !== undefined) canvasSheet(sizes[size]!.url);
  }
}
