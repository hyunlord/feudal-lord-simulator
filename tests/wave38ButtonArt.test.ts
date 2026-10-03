/**
 * LM-R1 buttons: Wave 38's UI controls (scripts/installWave38.py; docs/ops/install-plan-20261003/SPECS/wave38.md) — the
 * 40 confirmed pictures (the reworked primary four and tab_hover where the ledger points) installed byte for byte, the
 * records' 9-slice and text_safe in the manifest, a token per state (frameTokens.generated.css) with the P0 fallback, the
 * kit's state rules (disabled first, hover only where the pointer hovers, the focus ring apart), the loader's one-swap
 * fallback, the kit parts that wear the fixed-size pictures (radio, chip, close) and their provenance.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BUTTON_TOKENS } from "../src/ui/frameTokens.generated";
import { Chip, CloseButton, Radio } from "../src/ui/kit";
import { preloadWave38Art, UI_ART_FALLBACK } from "../src/ui/wave38Art";
import { WAVE38_ART, type Wave38ArtId } from "../src/ui/wave38ArtManifest.generated";

const read = (path: string) => readFileSync(path, "utf8");
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const csvRows = (path: string) => {
  const [head, ...lines] = read(path).replace(/^﻿/, "").split(/\r?\n/).filter(line => line !== "");
  const cells = (line: string) => [...line.matchAll(/"((?:[^"]|"")*)"|([^,]+)|(?<=,|^)(?=,|$)/g)].map(match => (match[1] ?? match[2] ?? "").replace(/""/g, "\""));
  const names = cells(head!);
  return lines.map(line => Object.fromEntries(cells(line).map((value, index) => [names[index]!, value])));
};
const inbox = csvRows("assets-inbox/INBOX_LEDGER.csv");
const pngSize = (path: string) => { const bytes = readFileSync(path); return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]; };

test("the 40 runtime pictures are the ledger's current Wave 38 files (reworks where it points), at their records' size", () => {
  const candidates = csvRows("assets-inbox/wave38/candidates-20260930/records/assets.csv");
  const ids = Object.keys(WAVE38_ART) as Wave38ArtId[];
  assert.equal(ids.length, 40);
  assert.deepEqual([...ids].sort(), candidates.map(row => row.id!).sort());
  const reworked: string[] = [];
  for (const id of ids) {
    const item = WAVE38_ART[id];
    let entry = inbox.find(row => row.file === `wave38/candidates-20260930/assets/${id}.png`)!;
    if (entry.status === "superseded") { reworked.push(id); entry = inbox.find(row => row.file === entry.replaced_by)!; }
    assert.equal(entry.status, "confirmed", id);
    const runtime = `public/${item.url}`;
    assert.equal(sha(runtime), entry.sha256, `${id}: the received bytes`);
    assert.deepEqual(pngSize(runtime), [item.width, item.height], id);
    const bytes = readFileSync(runtime).toString("latin1");
    assert.ok(!/caBX|jumb|c2pa/.test(bytes), `${id}: no C2PA chunk`);
    const record = candidates.find(row => row.id === id)!;
    assert.deepEqual(item.slice, { top: Number(record.slice_top), right: Number(record.slice_right), bottom: Number(record.slice_bottom), left: Number(record.slice_left) }, id);
    const safe = JSON.parse(record.text_safe!) as number[] | null;
    assert.deepEqual(item.textSafe === null ? null : [item.textSafe.x, item.textSafe.y, item.textSafe.width, item.textSafe.height], safe, id);
  }
  assert.deepEqual(reworked.sort(), ["button_primary_disabled", "button_primary_hover", "button_primary_normal", "button_primary_pressed", "tab_hover"]);
});

test("each picture has its provenance row (received file, prompt, usedIn) under its runtime path", () => {
  const ledger = csvRows("docs/provenance/assets.csv");
  for (const [id, item] of Object.entries(WAVE38_ART)) {
    const row = ledger.find(entry => entry.runtimePath === `public/${item.url}`);
    assert.ok(row !== undefined, id);
    assert.equal(row.runtimeSha256, sha(`public/${item.url}`), id);
    assert.equal(row.sourceSha256, row.runtimeSha256, id);
    assert.match(row.sourcePath!, /^assets-inbox\/wave38\/(candidates-20260930|rework-20261001)\/assets\//, id);
    assert.ok(read(row.prompt!).trim().length > 40, `${id}: prompt file`);
    assert.match(row.usedIn!, /wave38ArtManifest/, id);
  }
});

test("every button family's state is a Wave 38 token, and the P0 fallback block swaps each back", () => {
  const css = read("src/styles/frameTokens.generated.css");
  const families: Record<string, readonly string[]> = { primary: ["", "-hover", "-pressed", "-disabled"], secondary: ["", "-hover", "-pressed", "-disabled"],
    danger: ["", "-hover", "-pressed", "-disabled"], icon: ["", "-hover", "-pressed", "-disabled"], tab: ["", "-hover", "-selected"] };
  const [main, fallback] = css.split(':root[data-ui-art="p0"] {');
  assert.ok(fallback !== undefined, "the fallback block");
  for (const [family, states] of Object.entries(families)) {
    assert.match(main!, new RegExp(`--button-${family}-width: 10px;`));
    for (const state of states) {
      assert.match(main!, new RegExp(`--button-${family}${state}-art: url\\("/assets/wave38/[a-z_]+\\.png"\\) 10 fill / var\\(--button-${family}-width\\) / 0 stretch;`), `${family}${state}`);
      assert.match(fallback, new RegExp(`--button-${family}${state}-art: url\\("/assets/ui-p0/[a-z_]+\\.png"\\)`), `${family}${state} fallback`);
    }
  }
  assert.match(main!, /--button-primary-art: url\("\/assets\/wave38\/button_primary_normal\.png"\)/);
  assert.match(main!, /--button-tab-selected-art: url\("\/assets\/wave38\/tab_selected\.png"\)/);
  for (const id of ["checkbox_checked", "radio_selected", "toggle_on", "close_pressed", "slider_thumb"]) {
    assert.match(main!, new RegExp(`--control-${id.replaceAll("_", "-")}: url\\("/assets/wave38/${id}\\.png"\\);`));
    assert.match(fallback, new RegExp(`--control-${id.replaceAll("_", "-")}: none;`));
  }
  assert.equal(BUTTON_TOKENS.primary.scale, 1);
  assert.deepEqual(BUTTON_TOKENS.primary.safe, { top: 7, right: 5, bottom: 5, left: 5 });
  assert.equal(BUTTON_TOKENS.chip.url, "assets/ui-p0/chip_condition_base.png", "the build cards' small chips stay P0");
});

test("kit states: hover only for a hovering pointer, disabled last and above hover / pressed, the focus ring on its own", () => {
  const css = read("src/styles/uiKit.css");
  const hover = css.indexOf("@media (hover: hover) {\n  :root .ui-btn.ui-btn:not(.ui-btn--surface):not(:disabled):not([aria-disabled=\"true\"]):hover { border-image: var(--ui-btn-hover-art); }");
  const pressed = css.indexOf(":root .ui-btn.ui-btn:not(.ui-btn--surface):not(:disabled):not([aria-disabled=\"true\"]):active { border-image: var(--ui-btn-pressed-art); }");
  const disabled = css.indexOf(":root .ui-btn.ui-btn.ui-btn.ui-btn:is(.ui-btn--primary, .ui-btn--secondary, .ui-btn--danger, .ui-btn--icon, .ui-btn--toggle):is(:disabled, [aria-disabled=\"true\"]) {");
  assert.ok(hover > 0 && pressed > hover && disabled > pressed, "hover, then pressed, then disabled");
  assert.match(css.slice(disabled, css.indexOf("}", disabled)), /border-image: var\(--ui-btn-disabled-art\);/);
  assert.match(css, /:root \.ui-btn\.ui-btn:focus-visible \{ outline: 2px solid var\(--seal-red\); outline-offset: 2px; \}/);
  // The selected tab keeps its picture under the pointer and while pressed (selected reads brighter than hover).
  assert.match(css, /\.ui-btn--tab:is\(\[aria-selected="true"\], \[aria-pressed="true"\]\) \{\n {2}--ui-btn-art: var\(--button-tab-selected-art\);\n {2}--ui-btn-hover-art: var\(--button-tab-selected-art\);\n {2}--ui-btn-pressed-art: var\(--button-tab-selected-art\);/);
  // Primary text on the dark oak.
  assert.match(css, /\.ui-btn--primary \{[^}]*color: var\(--primary-ink\);/);
  assert.match(read("src/styles/uiSkin.css"), /--primary-ink: #f1e4c6;/);
  // No stylesheet keeps a brightness hover for kit buttons outside the P0 fallback.
  assert.doesNotMatch(css.replace(/:root\[data-ui-art="p0"\][^\n]*/g, ""), /ui-btn[^{\n]*:hover \{ filter: brightness/);
});

test("the loader asks for each picture once and marks the root for the P0 fallback on the first failure only", () => {
  const made: { onerror: unknown; src: string }[] = [];
  const attributes: [string, string][] = [];
  const root = { setAttribute: (name: string, value: string) => { attributes.push([name, value]); } };
  const urls = preloadWave38Art(root, () => { const image = { onerror: null as unknown, src: "" }; made.push(image); return image; });
  assert.equal(urls.length, 40);
  assert.deepEqual(made.map(image => image.src), urls);
  assert.equal(new Set(urls).size, 40);
  assert.deepEqual(attributes, []);
  (made[3]!.onerror as () => void)();
  (made[7]!.onerror as () => void)();
  assert.deepEqual(attributes, [[UI_ART_FALLBACK.attribute, UI_ART_FALLBACK.value]]);
  assert.deepEqual(preloadWave38Art(null, null), []);
});

test("the kit's radio, selected chip and close button carry the classes their pictures hang on", () => {
  const radio = renderToStaticMarkup(createElement(Radio<"a" | "b">, { label: "고르기", value: "b", onChange: () => undefined,
    options: [{ value: "a", label: "가" }, { value: "b", label: "나", disabled: false }] }));
  assert.match(radio, /<div role="radiogroup" aria-label="고르기" class="ui-radio-group">/);
  assert.match(radio, /class="ui-radio ui-btn ui-btn--quiet" role="radio" aria-checked="false" tabindex="-1"/);
  assert.match(radio, /class="ui-radio ui-btn ui-btn--quiet" role="radio" aria-checked="true" tabindex="0"><span class="ui-radio-box" aria-hidden="true"><span class="ui-radio-dot"><\/span>/);
  assert.match(renderToStaticMarkup(createElement(Chip, { selected: true, children: "고름" })), /^<span class="ui-chip ui-chip--selected">고름<\/span>$/);
  assert.match(renderToStaticMarkup(createElement(CloseButton, { label: "닫기", children: "x" })), /^<button type="button" class="ui-btn ui-btn--close" aria-label="닫기">x<\/button>$/);
});
