// QA round 15: the geometry audit's paint pass (scripts/uiGeometryMeasure.ts checks content and ornament). The audit
// captures the measured root twice — as it is, then with its text transparent and its controls hidden (`HIDE_CSS`) —
// and these pure functions compare the two: an element whose pixels do not change is not painted (another layer covers
// it, or it is transparent), and on the second capture a straight run of ink through the middle of a text's line box is
// a drawn line (the art's rule, a CSS border) crossing the text. Rects are page px; the captures start at `origin`
// (device scale 1).
import type { Box, Collected, Item } from "./uiGeometryMeasure";

export type Rgba = Readonly<{ width: number; height: number; data: Uint8Array }>;
export type Origin = Readonly<{ x: number; y: number }>;

/** The second capture: the root's text transparent, its controls hidden, nothing moving in it. */
export const HIDE_CSS = [
  "[data-geometry-root], [data-geometry-root] * { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important;",
  "  text-decoration-color: transparent !important; caret-color: transparent !important; transition: none !important; animation-play-state: paused !important; }",
  "[data-geometry-root] :is(button, summary, [role=\"button\"], [role=\"tab\"], [role=\"option\"], [role=\"switch\"], [role=\"checkbox\"], [role=\"slider\"],",
  "  [role=\"treeitem\"], a[href], input:not([type=\"hidden\"]), select, textarea) { visibility: hidden !important; }",
].join("\n");
/** The first capture holds still the same way (so a transition is not read as paint). */
export const STILL_CSS = "[data-geometry-root], [data-geometry-root] * { transition: none !important; animation-play-state: paused !important; }";

/** A channel step this large is a change (the two captures are the same render otherwise). */
const CHANGE = 24;
/** Ink on the second capture: this far (luminance) from the line box's own median. */
const INK = 40;

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
/** The capture's pixel rect for a page box, inset by `by` px (empty when nothing is left). */
function pixels(capture: Rgba, origin: Origin, box: Box, by = 0) {
  const l = clamp(Math.ceil(box.l - origin.x + by), 0, capture.width); const r = clamp(Math.floor(box.r - origin.x - by), 0, capture.width);
  const t = clamp(Math.ceil(box.t - origin.y + by), 0, capture.height); const b = clamp(Math.floor(box.b - origin.y - by), 0, capture.height);
  return { l, t, r, b, empty: r <= l || b <= t };
}

/** Pixels inside `boxes` (each once) that differ between the two captures; null when no pixel of them is in the capture
 * (scrolled out of the root, or beyond the screen: nothing to judge). */
export function changedPixels(a: Rgba, b: Rgba, origin: Origin, boxes: readonly Box[]): number | null {
  if (a.width !== b.width || a.height !== b.height) throw new Error("the two captures differ in size");
  const seen = new Set<number>(); let changed = 0;
  for (const box of boxes) {
    const area = pixels(a, origin, box); if (area.empty) continue;
    for (let y = area.t; y < area.b; y += 1) for (let x = area.l; x < area.r; x += 1) {
      const at = y * a.width + x; if (seen.has(at)) continue; seen.add(at);
      const i = at * 4;
      if (Math.abs(a.data[i]! - b.data[i]!) > CHANGE || Math.abs(a.data[i + 1]! - b.data[i + 1]!) > CHANGE || Math.abs(a.data[i + 2]! - b.data[i + 2]!) > CHANGE) changed += 1;
    }
  }
  // A few pixels at a box's edge are not enough to judge (a line half scrolled out).
  return seen.size < 12 ? null : changed;
}

const luminance = (data: Uint8Array, i: number) => 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;

/** A drawn line through the middle of a line box on the second capture: a 1–4 px run of columns (or rows) inked over at
 * least 90 % of the box's height (width), with clear ground 3 px to both sides, away from the box's ends. */
export function crossingLine(capture: Rgba, origin: Origin, line: Box): "x" | "y" | null {
  const area = pixels(capture, origin, line, 1);
  const w = area.r - area.l; const h = area.b - area.t;
  if (area.empty || w < 12 || h < 8) return null;
  const values: number[] = [];
  for (let y = area.t; y < area.b; y += 1) for (let x = area.l; x < area.r; x += 1) values.push(luminance(capture.data, (y * capture.width + x) * 4));
  const sorted = [...values].sort((p, q) => p - q); const median = sorted[sorted.length >> 1]!;
  const ink = (x: number, y: number) => Math.abs(values[(y - area.t) * w + (x - area.l)]! - median) > INK;
  const column = (x: number) => { let count = 0; for (let y = area.t; y < area.b; y += 1) if (ink(x, y)) count += 1; return count / h; };
  const row = (y: number) => { let count = 0; for (let x = area.l; x < area.r; x += 1) if (ink(x, y)) count += 1; return count / w; };
  const run = (size: number, fraction: (at: number) => number, from: number, to: number) => {
    const values = Array.from({ length: size }, (_, index) => fraction(index));
    for (let start = from; start < to; start += 1) {
      if (values[start]! < 0.9) continue;
      let end = start; while (end + 1 < size && values[end + 1]! >= 0.9) end += 1;
      const width = end - start + 1;
      const before = start - 3; const after = end + 3;
      if (width <= 4 && before >= 0 && after < size && values[before]! <= 0.3 && values[after]! <= 0.3) return true;
      start = end;
    }
    return false;
  };
  // Columns away from the text's two ends (a table rule at its edge is not a crossing); rows in the middle half only (a
  // rule under the line is the line's own underline or the frame's, not a crossing).
  if (run(w, index => column(area.l + index), 4, w - 4)) return "x";
  if (run(h, index => row(area.t + index), Math.floor(h * 0.25), Math.ceil(h * 0.75))) return "y";
  return null;
}

/** The paint facts for a collected surface: changed pixels per item and required rect, and the crossings. */
export function paintFacts(collected: Collected, a: Rgba, b: Rgba, origin: Origin): NonNullable<Collected["paint"]> {
  const items = collected.items ?? [];
  // A text inside a control is hidden with the control (the control's own count says it); a surface button paints
  // nothing of its own by design.
  const sampled = (item: Item) => item.rect !== null && !(item.kind === "text" && item.inControls.length > 0) && !(item.kind === "control" && item.control?.variant === "surface")
    && (item.kind === "text" || item.kind === "control");
  const counts = items.map(item => !sampled(item) ? null : changedPixels(a, b, origin, item.kind === "text" ? item.lines ?? [item.rect!] : [item.rect!]));
  const requires = (collected.requires ?? []).map(required => required.rects.map(rect => changedPixels(a, b, origin, [rect])).filter((count): count is number => count !== null));
  const crossings: { item: number; line: Box; axis: "x" | "y" }[] = [];
  items.forEach((item, index) => {
    if (item.kind !== "text" || item.inControls.length > 0 || item.rect === null) return;
    for (const line of item.lines ?? []) { const axis = crossingLine(b, origin, line); if (axis !== null) { crossings.push({ item: index, line, axis }); break; } }
  });
  return { items: counts, requires, crossings };
}
