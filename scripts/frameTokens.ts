import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { UI_ART_MANIFEST } from "../src/ui/uiArtManifest.generated";
import { WAVE8_FRAMES } from "../src/ui/wave8ArtManifest.generated";
import { WAVE14_IMAGES } from "../src/ui/wave14ArtManifest.generated";
import { WAVE19_IMAGES } from "../src/ui/wave19ArtManifest.generated";
import { WAVE25_IMAGES } from "../src/ui/wave25ArtManifest.generated";

// UI-AUDIT-1: every frame's draw width and content-safe inset from one table, written as CSS custom properties
// (src/styles/frameTokens.generated.css, :root) and a TS module (src/ui/frameTokens.generated.ts) for the frame-layer and
// painting helpers and the geometry audit. The box contract (docs in the TS module's header): a framed surface's
// `border-width` is its kind's safe inset, its `padding` the one gap, so the browser's content box is the audit's inner box.
// Slices, sizes and content rects come from the art manifests; the safe insets are measured on the PNGs by
// scripts/measureFrameSafe.py (the painted edge along each side, raised where a corner ornament reaches the content box),
// in source px, then drawn at the kind's scale and rounded up to whole CSS px.
// Run: npx tsx scripts/frameTokens.ts      (tests/frameTokens.test.ts checks the committed files match)

export const FRAME_GAP = 8;

type Sides = Readonly<{ top: number; right: number; bottom: number; left: number }>;
type Rect = Readonly<{ x: number; y: number; width: number; height: number }>;
/** css: the surface's own border-image · layer: a sibling span draws the frame over the surface's border box · painting:
 * the whole card painting is the surface's background (no 9-slice) · flat: no art frame (a thin CSS rule). */
type FrameType = "css" | "layer" | "painting";
/** Another art of the same kind (a state): its own url and slice, the kind's safe inset. */
type Variant = Readonly<{ url: string; slice: Sides }>;
type KindSpec = Readonly<{
  type: FrameType; url: string; size: Readonly<{ width: number; height: number }>; slice: Sides | null; scale: number;
  repeat?: "stretch" | "round"; safe: Sides; note: string; variants?: Readonly<Record<string, Variant>>;
  content?: Rect; slots?: Readonly<Record<string, unknown>>;
}>;

const sides = (top: number, right = top, bottom = top, left = right): Sides => ({ top, right, bottom, left });
const P0 = UI_ART_MANIFEST.frames;
type P0Id = keyof typeof P0;
const p0 = (id: P0Id) => ({ url: P0[id].url, size: { width: P0[id].width, height: P0[id].height }, slice: P0[id].slice as Sides });
const w19 = (id: keyof typeof WAVE19_IMAGES) => {
  const image = WAVE19_IMAGES[id] as { url: string; width: number; height: number; nineSlice?: { insets: Sides } };
  return { url: image.url, size: { width: image.width, height: image.height }, slice: image.nineSlice?.insets ?? null };
};
const w25 = (id: "tree_lineage_banner" | "tree_generation_label" | "tree_node_frame" | "tree_node_frame_selected" | "tree_node_frame_deceased") =>
  ({ url: WAVE25_IMAGES[id].url, size: { width: WAVE25_IMAGES[id].width, height: WAVE25_IMAGES[id].height }, slice: WAVE25_IMAGES[id].nineSlice as Sides });
const w8 = (id: keyof typeof WAVE8_FRAMES) => {
  const frame = WAVE8_FRAMES[id]; const rect = frame.content[0];
  // A Wave 8 frame's content rect is its safe rect (the designer's; the season ledger's scenes sit in its left inset).
  return { url: frame.url, size: { width: frame.width, height: frame.height }, slice: frame.slice as Sides, content: rect,
    safe: sides(rect.y, frame.width - rect.x - rect.width, frame.height - rect.y - rect.height, rect.x) };
};
const personCard = WAVE14_IMAGES.frame_person_card;
const rights = WAVE14_IMAGES.frame_rights_register;

/**
 * Safe insets in source px (scripts/measureFrameSafe.py output, 2026-09-30). Hand-set, with the reason:
 * - advisor: the side rolls are 13 (normal) and 16 (warn) px deep; the roll's light middle reads as field, so the run
 *   stops at the outer rule (3). The family takes the larger of the two so a tone change does not move the text.
 * - objective: the family's largest (normal 9, complete 9 8 9 8, warn 8).
 * - tree-node: the family's largest (normal / selected 9 9 10 9, deceased 9 10 10 9).
 * - decision: the outer frame (9 9 13 13); the header plates under it (to 48) are the columns' title slots.
 * - record-person: the portrait ring at the top left (to 84) is the portrait's slot, not an ornament: the band (25).
 * - pause-badge: the hourglass printed at the badge's left runs to x 25.
 */
const KINDS = {
  light: { type: "css", ...p0("frame_panel_light"), scale: 0.5, safe: sides(3), note: "P0 light panel" },
  slot: { type: "css", ...p0("frame_panel_light"), scale: 10 / 32, safe: sides(3), note: "the HUD panel slot: the light panel drawn 10 px wide" },
  dark: { type: "css", ...p0("frame_panel_dark"), scale: 0.5, safe: sides(3), note: "P0 dark panel" },
  objective: { type: "css", ...p0("frame_objective_normal"), scale: 0.5, safe: sides(9), note: "goal cards",
    variants: { complete: p0("frame_objective_complete"), warn: p0("frame_objective_warn") } },
  advisor: { type: "css", ...p0("frame_advisor_normal"), scale: 0.5, safe: sides(9, 16, 10, 16), note: "the steward (hand: side rolls)",
    variants: { warn: p0("frame_advisor_warn") } },
  modal: { type: "css", ...p0("frame_modal"), scale: 0.5, safe: sides(17, 17, 19, 17), note: "dialogs: pause menu, welcome" },
  tooltip: { type: "css", ...p0("frame_tooltip"), scale: 0.5, safe: sides(3, 0, 1, 0), note: "small notes, the status pill" },
  toast: { type: "css", ...p0("toast_small"), scale: 0.5, safe: sides(4, 4, 4, 3), note: "toasts, status line, alert rows" },
  record: { type: "css", ...p0("toast_small"), scale: 0.5, safe: sides(4, 4, 4, 3), note: "kit Card (the toast art)" },
  "strip-top": { type: "css", ...p0("frame_hud_strip_top"), scale: 0.5, safe: sides(4), note: "HUD strip (speed cluster)" },
  "strip-bottom": { type: "css", ...p0("frame_hud_strip_bottom"), scale: 0.5, safe: sides(4, 4, 4, 3), note: "HUD strip (build drawer)" },
  banner: { type: "css", ...p0("banner_unlock"), scale: 0.5, safe: sides(2, 3, 3, 22), note: "unlock banner (left: the top-left ornament)" },
  ledger: { type: "css", ...w19("frame_record_ledger"), scale: 0.7, repeat: "round", safe: sides(23, 15, 24, 17), note: "the ledger drawer (Wave 19 ledger card ×0.7)" },
  rights: { type: "css", url: rights.url, size: { width: rights.width, height: rights.height }, slice: rights.nineSlice.insets, scale: 1,
    safe: sides(26, 18, 27, 18), note: "the rights register (Wave 14)" },
  "tree-banner": { type: "css", ...w25("tree_lineage_banner"), scale: 1, safe: sides(4), note: "family tree banner" },
  "tree-generation": { type: "css", ...w25("tree_generation_label"), scale: 1, safe: sides(4, 3, 3, 3), note: "family tree generation label" },
  "tree-node": { type: "css", ...w25("tree_node_frame"), scale: 0.6, safe: sides(9, 10, 10, 9), note: "family tree person (hand: family max)",
    variants: { selected: w25("tree_node_frame_selected"), deceased: w25("tree_node_frame_deceased") } },
  "chapter-page": { type: "layer", ...w8("frame_chronicle_page"), scale: 0.5, note: "chapter page, legacy ending, chronicle book (Wave 8 content rect)" },
  petition: { type: "layer", ...w8("frame_petition"), scale: 0.5, note: "petition card (Wave 8 content rect)" },
  "season-ledger": { type: "layer", ...w8("frame_season_ledger"), scale: 0.5, note: "season ledger card (Wave 8 content rect)" },
  "record-decision": { type: "layer", ...w19("frame_record_decision"), scale: 0.7, safe: sides(25, 14, 25, 30), note: "record card: decision" },
  "record-era": { type: "layer", ...w19("frame_record_era"), scale: 0.7, safe: sides(30, 21, 34, 21), note: "record card: era" },
  "record-event": { type: "layer", ...w19("frame_record_event"), scale: 0.7, safe: sides(28, 25, 30, 14), note: "record card: event (right: the leather corner)" },
  "record-ledger": { type: "layer", ...w19("frame_record_ledger"), scale: 0.7, safe: sides(23, 15, 24, 17), note: "record card: ledger" },
  "record-milestone": { type: "layer", ...w19("frame_record_milestone"), scale: 0.7, safe: sides(26, 16, 26, 16), note: "record card: milestone" },
  "record-person": { type: "layer", ...w19("frame_record_person"), scale: 0.7, safe: sides(25, 15, 23, 13), note: "record card: person (hand: the ring is a slot)" },
  decision: { type: "layer", ...w19("frame_decision_compare"), scale: 0.96, safe: sides(9, 9, 13, 13), note: "decision compare (hand: header plates are slots)" },
  "snapshot-320": { type: "layer", ...w19("frame_snapshot_map_320"), scale: 1, safe: sides(50, 45, 45, 45), note: "map then, large (the window; drawn at 1 or 1.5)" },
  "snapshot-160": { type: "layer", ...w19("frame_snapshot_map_160"), scale: 1, safe: sides(25, 23, 23, 23), note: "map then, small (the window; drawn at 1 or 1.5)" },
  "person-card": { type: "painting", url: personCard.url, size: { width: personCard.width, height: personCard.height }, slice: null, scale: 1.5,
    safe: sides(22, 15, 23, 15), note: "person card painting (inside the inner rule)", slots: personCard.slots },
  biography: { type: "painting", ...w19("frame_biography"), slice: null, scale: 1, safe: sides(29, 26, 28, 26), note: "biography page (drawn at the page scale)" },
  "faction-page": { type: "painting", ...w19("frame_faction_page"), slice: null, scale: 1, safe: sides(29, 28, 29, 28), note: "faction page (drawn at the page scale)" },
  "pause-badge": { type: "painting", url: "assets/wave8/time/pause_badge.png", size: { width: 128, height: 48 }, slice: null, scale: 44 / 48,
    safe: sides(2, 1, 2, 25), note: "the pause badge (hand: the hourglass at its left)" },
  // LM-R1: measured 168 40 39 44; the bottom is the slice's 110 by hand — the separator and the lower field under it are
  // the receipt's foot slot (its money line), not the reading field.
  receipt: { type: "layer", url: "assets/wave35-receipts/E_receipts/receipt_frame.png", size: { width: 384, height: 512 }, slice: sides(190, 40, 110, 40),
    scale: 0.875, safe: sides(168, 40, 110, 44), note: "the lord's why-here receipt (Wave 35; hand: the lower field is the foot slot)" },
} as const satisfies Record<string, KindSpec>;

/** Button art (Wave 38 replaces these per state later): draw width, the measured edge, the kit's border and paddings. */
const BUTTONS = {
  primary: { ...p0("button_primary_base"), safe: sides(2, 2, 3, 3) },
  secondary: { ...p0("button_secondary_base"), safe: sides(2) },
  icon: { ...p0("button_icon_square_base"), safe: sides(0) },
  tab: { ...p0("tab_build_base"), safe: sides(2) },
  chip: { ...p0("chip_condition_base"), safe: sides(2, 3, 3, 3) },
} as const;
const BUTTON_SIZES = { sm: "2px 10px", md: "6px 14px", lg: "10px 22px" } as const;

const px = (value: number): string => `${Number(value.toFixed(3))}px`;
const cssSides = (value: Sides): string => {
  const { top, right, bottom, left } = value;
  if (top === right && right === bottom && bottom === left) return px(top);
  if (top === bottom && right === left) return `${px(top)} ${px(right)}`;
  return `${px(top)} ${px(right)} ${px(bottom)} ${px(left)}`;
};
const map = (value: Sides, fn: (side: number) => number): Sides =>
  ({ top: fn(value.top), right: fn(value.right), bottom: fn(value.bottom), left: fn(value.left) });
const sliceText = (slice: Sides): string => slice.top === slice.right && slice.right === slice.bottom && slice.bottom === slice.left
  ? String(slice.top) : `${slice.top} ${slice.right} ${slice.bottom} ${slice.left}`;
const cssUrl = (url: string): string => `url("/${url}")`;

type Kind = keyof typeof KINDS;

function tokensOf(kind: Kind) {
  const spec: KindSpec = KINDS[kind];
  const width = spec.slice === null ? null : map(spec.slice, side => side * spec.scale);
  const safe = map(spec.safe, side => Math.ceil(side * spec.scale - 1e-6));
  return { spec, width, safe };
}

export function renderFrameTokens(): { readonly css: string; readonly ts: string } {
  const css: string[] = [
    "/* Generated by scripts/frameTokens.ts (UI-AUDIT-1) from the art manifests and the measured safe insets. Do not edit by hand.",
    "   Per frame kind K: --frame-K-art (the whole border-image), --frame-K-width (its draw width), --frame-K-safe (the content-safe",
    "   inset; also per side). A framed surface: border-width = --frame-K-safe, padding = --frame-gap (the `[data-frame]` rules below). */",
    ":root {",
    `  --frame-gap: ${FRAME_GAP}px;`,
  ];
  const ts: string[] = [
    "// Generated by scripts/frameTokens.ts (UI-AUDIT-1) from the art manifests and the measured safe insets. Do not edit by hand.",
    "// The frame box contract: every framed surface root carries `data-frame=\"<kind>\"`; its computed border-width is the kind's",
    "// `safe` (in CSS px at the drawn scale; transparent, the art drawn over it at `width` with no outset) and its padding is",
    "// FRAME_GAP, so the browser's content box is the audit's inner box. `css` kinds wear the art as their own border-image,",
    "// `layer` kinds under a sibling span that covers the border box, `painting` kinds as a background from the border box.",
    "// `slice` / `content` / `slots` are in source px; `scale` is CSS px per source px (a page or map drawn at another scale",
    "// multiplies by its own); `width` and `safe` are CSS px at `scale`. The kind \"flat\" (no art) is a surface with a thin rule.",
    `export const FRAME_GAP = ${FRAME_GAP};`,
    "",
    "export const FRAME_TOKENS = {",
  ];
  for (const kind of Object.keys(KINDS) as Kind[]) {
    const { spec, width, safe } = tokensOf(kind);
    const repeat = spec.repeat ?? "stretch";
    css.push(`  /* ${kind}: ${spec.note} — ${spec.url.split("/").pop()} ×${Number(spec.scale.toFixed(4))} */`);
    if (width !== null && spec.slice !== null) {
      css.push(`  --frame-${kind}-width: ${cssSides(width)};`);
      css.push(`  --frame-${kind}-art: ${cssUrl(spec.url)} ${sliceText(spec.slice)} fill / var(--frame-${kind}-width) / 0 ${repeat};`);
      for (const [name, variant] of Object.entries(spec.variants ?? {})) {
        css.push(`  --frame-${kind}-${name}-width: ${cssSides(map(variant.slice, side => side * spec.scale))};`);
        css.push(`  --frame-${kind}-${name}-art: ${cssUrl(variant.url)} ${sliceText(variant.slice)} fill / var(--frame-${kind}-${name}-width) / 0 ${repeat};`);
      }
    } else css.push(`  --frame-${kind}-art: ${cssUrl(spec.url)};`);
    css.push(`  --frame-${kind}-safe: ${cssSides(safe)};`);
    for (const side of ["top", "right", "bottom", "left"] as const) css.push(`  --frame-${kind}-safe-${side}: ${px(safe[side])};`);
    const fields = [`type: "${spec.type}"`, `url: "${spec.url}"`, `size: ${JSON.stringify(spec.size)}`,
      `slice: ${spec.slice === null ? "null" : JSON.stringify(spec.slice)}`, `scale: ${spec.scale}`, `repeat: "${repeat}"`,
      `width: ${width === null ? "null" : JSON.stringify(width)}`, `safe: ${JSON.stringify(safe)}`,
      `safeSource: ${JSON.stringify(spec.safe)}`];
    if (spec.variants !== undefined) fields.push(`variants: ${JSON.stringify(Object.fromEntries(Object.entries(spec.variants).map(([name, variant]) =>
      [name, { ...variant, width: map(variant.slice, side => side * spec.scale) }])))}`);
    if (spec.content !== undefined) fields.push(`content: ${JSON.stringify(spec.content)}`);
    if (spec.slots !== undefined) fields.push(`slots: ${JSON.stringify(spec.slots)}`);
    ts.push(`  "${kind}": { ${fields.join(", ")} },`);
  }
  css.push("  /* Buttons: the P0 art (one state; code draws hover / pressed / disabled), the kit's border and size paddings. */");
  css.push("  --button-border: 2px;");
  for (const [size, padding] of Object.entries(BUTTON_SIZES)) css.push(`  --button-pad-${size}: ${padding};`);
  ts.push("} as const;", "", "export const BUTTON_TOKENS = {");
  for (const [name, button] of Object.entries(BUTTONS)) {
    const width = map(button.slice, side => side * 0.5); const safe = map(button.safe, side => Math.ceil(side * 0.5 - 1e-6));
    css.push(`  --button-${name}-width: ${cssSides(width)};`);
    css.push(`  --button-${name}-art: ${cssUrl(button.url)} ${sliceText(button.slice)} fill / var(--button-${name}-width) / 0 stretch;`);
    css.push(`  --button-${name}-safe: ${cssSides(safe)};`);
    ts.push(`  "${name}": { url: "${button.url}", slice: ${JSON.stringify(button.slice)}, scale: 0.5, width: ${JSON.stringify(width)}, safe: ${JSON.stringify(safe)} },`);
  }
  css.push("}", "");
  css.push("/* The box contract, keyed on the surface's `data-frame` (0-4-0: an older screen rule's border or padding cannot win).",
    "   Geometry only: each surface's skin rule wears the art (`border-image: var(--frame-K-art)`, a state's variant). */");
  for (const kind of Object.keys(KINDS) as Kind[]) {
    const spec: KindSpec = KINDS[kind];
    css.push(`:root [data-frame][data-frame][data-frame="${kind}"] { border-style: solid; border-color: transparent; border-width: var(--frame-${kind}-safe);`
      + ` padding: var(--frame-gap);${spec.type === "painting" ? " background-origin: border-box;" : ""} }`);
  }
  css.push("");
  ts.push("} as const;", "", "export type FrameKind = keyof typeof FRAME_TOKENS;", "/** A surface's `data-frame`: a frame kind, or \"flat\" (no art frame). */",
    "export type FrameAttr = FrameKind | \"flat\";", "");
  return { css: css.join("\n"), ts: ts.join("\n") };
}

export const FRAME_TOKEN_FILES = { css: "src/styles/frameTokens.generated.css", ts: "src/ui/frameTokens.generated.ts" } as const;

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = resolve(fileURLToPath(import.meta.url), "../..");
  const out = renderFrameTokens();
  writeFileSync(resolve(root, FRAME_TOKEN_FILES.css), out.css);
  writeFileSync(resolve(root, FRAME_TOKEN_FILES.ts), out.ts);
  console.log(`wrote ${FRAME_TOKEN_FILES.css} and ${FRAME_TOKEN_FILES.ts}`);
}
