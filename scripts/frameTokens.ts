import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { UI_ART_MANIFEST } from "../src/ui/uiArtManifest.generated";
import { WAVE8_FRAMES } from "../src/ui/wave8ArtManifest.generated";
import { WAVE14_IMAGES } from "../src/ui/wave14ArtManifest.generated";
import { WAVE19_IMAGES } from "../src/ui/wave19ArtManifest.generated";
import { WAVE25_IMAGES } from "../src/ui/wave25ArtManifest.generated";
import { WAVE38_ART, type Wave38ArtId } from "../src/ui/wave38ArtManifest.generated";

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
  /** css kinds: the picture (at the kind's scale) worn when a Wave 38 picture did not load (`data-ui-art="p0"`). */
  fallback?: Readonly<{ url: string; slice: Sides; scale: number }>;
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
  // LM-R1: the select's open list (Wave 38 select_open_list, drawn 1:1; measured edge 10 9 10 9). Fallback: the light panel.
  "select-list": { type: "css", url: WAVE38_ART.select_open_list.url, size: { width: WAVE38_ART.select_open_list.width, height: WAVE38_ART.select_open_list.height },
    slice: WAVE38_ART.select_open_list.slice, scale: 1, safe: sides(10, 9, 10, 9), note: "the select's open list (Wave 38)",
    fallback: { url: P0.frame_panel_light.url, slice: P0.frame_panel_light.slice as Sides, scale: 0.5 } },
  "pause-badge": { type: "painting", url: "assets/wave8/time/pause_badge.png", size: { width: 128, height: 48 }, slice: null, scale: 44 / 48,
    safe: sides(2, 1, 2, 25), note: "the pause badge (hand: the hourglass at its left)" },
} as const satisfies Record<string, KindSpec>;

/** One button picture: its url and 9-slice (source px). */
type Art = Readonly<{ url: string; slice: Sides }>;
const w38 = (id: Wave38ArtId): Art => ({ url: WAVE38_ART[id].url, slice: WAVE38_ART[id].slice });
const art = (id: P0Id): Art => ({ url: P0[id].url, slice: P0[id].slice as Sides });
/** A button family: a picture per state (`normal` first), drawn at `scale` CSS px per source px; `safe` the painted edge in
 * source px (the largest of its states); `fallback` the P0 picture (at its own scale 0.5) every state wears when a Wave 38
 * picture did not load (src/ui/wave38Art.ts sets `data-ui-art="p0"` on the root). */
type ButtonSpec = Readonly<{ states: Readonly<Record<string, Art>> & { readonly normal: Art }; scale: number; safe: Sides; fallback?: Art }>;
/**
 * Button art, LM-R1: Wave 38 (assets-inbox/wave38, the reworked primary four and tab_hover), one picture per state, drawn
 * 1:1 (the art is made at its CSS size, 128 × 40 and 48 × 48; the batch's 9-slice is 10 px). Safe insets measured by
 * scripts/measureFrameSafe.py (the button-* kinds), the family's largest. The chip stays P0: the build cards' chips are
 * about 20 px tall and the Wave 38 chip is a fixed 28 px (the kit Chip wears it, CONTROLS below).
 */
const BUTTONS = {
  primary: { states: { normal: w38("button_primary_normal"), hover: w38("button_primary_hover"), pressed: w38("button_primary_pressed"),
    disabled: w38("button_primary_disabled") }, scale: 1, safe: sides(7, 5, 5, 5), fallback: art("button_primary_base") },
  secondary: { states: { normal: w38("button_secondary_normal"), hover: w38("button_secondary_hover"), pressed: w38("button_secondary_pressed"),
    disabled: w38("button_secondary_disabled") }, scale: 1, safe: sides(8, 5, 6, 5), fallback: art("button_secondary_base") },
  danger: { states: { normal: w38("button_danger_normal"), hover: w38("button_danger_hover"), pressed: w38("button_danger_pressed"),
    disabled: w38("button_danger_disabled") }, scale: 1, safe: sides(7, 4, 6, 4), fallback: art("button_secondary_base") },
  icon: { states: { normal: w38("button_icon_normal"), hover: w38("button_icon_hover"), pressed: w38("button_icon_pressed"),
    disabled: w38("button_icon_disabled") }, scale: 1, safe: sides(6), fallback: art("button_icon_square_base") },
  tab: { states: { normal: w38("tab_unselected"), hover: w38("tab_hover"), selected: w38("tab_selected") }, scale: 1, safe: sides(7, 5, 7, 5),
    fallback: art("tab_build_base") },
  chip: { states: { normal: art("chip_condition_base") }, scale: 0.5, safe: sides(2, 3, 3, 3) },
} as const satisfies Record<string, ButtonSpec>;
// LM-R1: each size clears Wave 38's text_safe x (14 source px = 14 CSS px at 1:1) with the 2 px border: sm 12 + 2.
const BUTTON_SIZES = { sm: "2px 12px", md: "6px 14px", lg: "10px 22px" } as const;
/** Wave 38 controls (scale 1). 9-slice pieces become `--control-K[-state]-art` border-images (with a P0 fallback where one
 * exists, else `none`: the kit keeps its drawn shape); fixed-size pictures become `--control-K` url()s (`none` in fallback).
 * Safe insets measured like the buttons; hand-set: select right 26 = the chevron's slice (records: "Right 26px slice
 * protects glyph"), so a label never runs under the chevron. */
const CONTROLS = {
  input: { states: { normal: w38("input_normal"), focus: w38("input_focus") }, scale: 1, safe: sides(10, 8, 9, 8), fallback: art("frame_tooltip") },
  select: { states: { normal: w38("select_closed") }, scale: 1, safe: sides(8, 26, 7, 6), fallback: art("button_secondary_base") },
  "select-row": { states: { normal: w38("select_row_hover") }, scale: 1, safe: sides(6, 5, 6, 5) },
  chip: { states: { normal: w38("chip_normal"), selected: w38("chip_selected") }, scale: 1, safe: sides(5, 4, 5, 4), fallback: art("chip_condition_base") },
  "slider-track": { states: { normal: w38("slider_track") }, scale: 1, safe: sides(5, 5, 4, 5) },
  "scrollbar-track": { states: { normal: w38("scrollbar_track") }, scale: 1, safe: sides(8, 4, 7, 5) },
  "scrollbar-thumb": { states: { normal: w38("scrollbar_thumb") }, scale: 1, safe: sides(2, 1, 1, 1) },
} as const satisfies Record<string, ButtonSpec>;
const FIXED_CONTROLS = ["checkbox_empty", "checkbox_checked", "checkbox_disabled", "radio_empty", "radio_selected", "toggle_off", "toggle_on",
  "close_normal", "close_hover", "close_pressed", "slider_thumb"] as const satisfies readonly Wave38ArtId[];

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
  css.push("  /* Buttons (LM-R1: Wave 38, one picture per state; the chip P0), the kit's border and size paddings. Per family F:",
    "     --button-F-art (normal), --button-F-<state>-art, --button-F-width, --button-F-safe. Wave 38 controls: --control-K[-state]-art",
    "     (9-slice) and --control-<id> (fixed-size url). `:root[data-ui-art=\"p0\"]` below swaps the P0 pictures back. */");
  css.push("  --button-border: 2px;");
  for (const [size, padding] of Object.entries(BUTTON_SIZES)) css.push(`  --button-pad-${size}: ${padding};`);
  ts.push("} as const;", "", "export const BUTTON_TOKENS = {");
  const fallback: string[] = [];
  const family = (prefix: string, name: string, spec: ButtonSpec, tsName: string) => {
    const width = map(spec.states.normal.slice, side => side * spec.scale); const safe = map(spec.safe, side => Math.ceil(side * spec.scale - 1e-6));
    css.push(`  --${prefix}-${name}-width: ${cssSides(width)};`);
    for (const [state, picture] of Object.entries(spec.states)) {
      const own = map(picture.slice, side => side * spec.scale);
      const widthVar = state === "normal" || cssSides(own) === cssSides(width) ? `var(--${prefix}-${name}-width)` : cssSides(own);
      css.push(`  --${prefix}-${name}${state === "normal" ? "" : `-${state}`}-art: ${cssUrl(picture.url)} ${sliceText(picture.slice)} fill / ${widthVar} / 0 stretch;`);
    }
    css.push(`  --${prefix}-${name}-safe: ${cssSides(safe)};`);
    if (spec.fallback !== undefined) {
      const old = map(spec.fallback.slice, side => side * 0.5);
      fallback.push(`  --${prefix}-${name}-width: ${cssSides(old)};`);
      for (const state of Object.keys(spec.states)) {
        fallback.push(`  --${prefix}-${name}${state === "normal" ? "" : `-${state}`}-art: ${cssUrl(spec.fallback.url)} ${sliceText(spec.fallback.slice)} fill / var(--${prefix}-${name}-width) / 0 stretch;`);
      }
    } else if (prefix === "control") for (const state of Object.keys(spec.states)) fallback.push(`  --${prefix}-${name}${state === "normal" ? "" : `-${state}`}-art: none;`);
    ts.push(`  "${tsName}": { url: "${spec.states.normal.url}", slice: ${JSON.stringify(spec.states.normal.slice)}, scale: ${spec.scale}, width: ${JSON.stringify(width)}, safe: ${JSON.stringify(safe)}, `
      + `states: ${JSON.stringify(Object.fromEntries(Object.entries(spec.states).map(([state, picture]) => [state, picture.url])))} },`);
  };
  for (const [name, button] of Object.entries(BUTTONS)) family("button", name, button, name);
  for (const [name, control] of Object.entries(CONTROLS)) family("control", name, control, `control-${name}`);
  for (const id of FIXED_CONTROLS) {
    const name = id.replaceAll("_", "-");
    css.push(`  --control-${name}: ${cssUrl(WAVE38_ART[id].url)};`);
    fallback.push(`  --control-${name}: none;`);
  }
  for (const kind of Object.keys(KINDS) as Kind[]) {
    const spec: KindSpec = KINDS[kind];
    if (spec.fallback === undefined) continue;
    const old = spec.fallback;
    fallback.push(`  --frame-${kind}-width: ${cssSides(map(old.slice, side => side * old.scale))};`);
    fallback.push(`  --frame-${kind}-art: ${cssUrl(old.url)} ${sliceText(old.slice)} fill / var(--frame-${kind}-width) / 0 ${spec.repeat ?? "stretch"};`);
  }
  css.push("}", "");
  css.push("/* The box contract, keyed on the surface's `data-frame` (0-4-0: an older screen rule's border or padding cannot win).",
    "   Geometry only: each surface's skin rule wears the art (`border-image: var(--frame-K-art)`, a state's variant). */");
  for (const kind of Object.keys(KINDS) as Kind[]) {
    const spec: KindSpec = KINDS[kind];
    css.push(`:root [data-frame][data-frame][data-frame="${kind}"] { border-style: solid; border-color: transparent; border-width: var(--frame-${kind}-safe);`
      + ` padding: var(--frame-gap);${spec.type === "painting" ? " background-origin: border-box;" : ""} }`);
  }
  css.push("", "/* LM-R1: a Wave 38 picture did not load (src/ui/wave38Art.ts): every button and control wears its P0 picture again, the",
    "   fixed-size controls their drawn shapes (uiKit.css), so nothing is left blank. */", ':root[data-ui-art="p0"] {', ...fallback, "}");
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
