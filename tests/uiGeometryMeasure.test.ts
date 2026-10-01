import assert from "node:assert/strict";
import test from "node:test";

import { gateMode, geometryInputHash } from "../scripts/checks/uiGeometry.mjs";
import { evaluateSurface, snapLine, type Box, type Collected, type Item, type MeasureSpec } from "../scripts/uiGeometryMeasure";
import { EXTREME, extremeNumbers, mapTile } from "../scripts/uiGeometryScene";
import { ledgerStateProblem } from "../src/ledger/ledgerValidation";

// UI-AUDIT-1: the geometry audit's pure half (scripts/uiGeometryMeasure.ts evaluateSurface) on synthetic surfaces —
// what the page collects, as rects — and its scene helpers.
const box = (l: number, t: number, r: number, b: number): Box => ({ l, t, r, b });
const none = { t: 0, r: 0, b: 0, l: 0 };
const even = (value: number) => ({ t: value, r: value, b: value, l: value });
const text = (path: string, rect: Box, extra: Partial<Item> = {}): Item => ({ kind: "text", path, rect, full: rect, clipper: null, slot: false, lines: [rect], inControls: [], within: [], ...extra });
const button = (path: string, rect: Box, control: Item["control"] = { kit: true, art: true, variant: "secondary" }, extra: Partial<Item> = {}): Item =>
  ({ kind: "control", path, rect, full: rect, clipper: null, slot: false, inControls: [], within: [], control, ...extra });
/** A 200×100 surface at (100, 100): a 16 px frame (border 16), padding 8 → the inner box is (124, 124)–(276, 176). */
const surface = (items: readonly Item[], overrides: Partial<NonNullable<Collected["root"]>> = {}, rest: Partial<Collected> = {}): Collected => ({
  found: true, viewport: { w: 1280, h: 800 }, expectFound: null,
  root: { path: "section.card", rect: box(100, 100, 300, 200), frame: even(16), padding: even(8), kind: null, overflow: { x: 0, y: 0 }, scrollable: { x: false, y: false }, ...overrides },
  layer: null, slot: null, items, scrollers: [], portrait: null, siblings: [], ...rest,
});
const css: MeasureSpec = { root: ".card", frame: "css", gap: 8 };
const fill = (l: number, t: number, r: number, b: number) => text("p", box(l, t, r, b));

test("Given text inside the inner box When evaluated Then nothing fails and the inner box is frame + gap", () => {
  const result = evaluateSurface(surface([fill(124, 124, 276, 176)]), css);
  assert.deepEqual(result.inner, box(124, 124, 276, 176));
  assert.equal(result.failures.length, 0);
  assert.deepEqual(result.empty, { ratio: 1, warn: false });
});

test("Given text 5 px into the gap When evaluated Then it is outside by its px, whatever the padding", () => {
  const result = evaluateSurface(surface([text("p.line", box(124, 124, 281, 140))]), css);
  assert.deepEqual(result.failures.map(failure => [failure.check, failure.path, failure.px]), [["outside", "p.line", 5]]);
  // The inner box is the frame + the 8 px gap: a padding of 2 (the frame painted over it) does not move it.
  const thin = evaluateSurface(surface([text("p", box(118, 130, 200, 140))], { padding: even(2) }), css);
  assert.deepEqual(thin.failures.map(failure => [failure.check, failure.px]), [["outside", 6]]);
});

test("Given a button beyond the box with its label and icon inside it When evaluated Then only the button is counted", () => {
  const result = evaluateSurface(surface([button("button.wide", box(124, 150, 290, 170)), { ...text("span.label", box(200, 152, 288, 168)), within: [0], inControls: [0] },
    { kind: "image", path: "span.icon", rect: box(270, 152, 286, 168), full: box(270, 152, 286, 168), clipper: null, slot: false, inControls: [0], within: [0] }]), css);
  assert.deepEqual(result.failures.map(failure => [failure.check, failure.path]).sort(), [["border", "button.wide"], ["outside", "button.wide"]]);
  // A surface button (a whole-card hit area) is checked by its contents only.
  const card = evaluateSurface(surface([button("button.card-body", box(100, 100, 300, 200), { kit: true, art: false, variant: "surface" }),
    { ...text("span.line", box(130, 130, 200, 150)), within: [0], inControls: [0] }]), css);
  assert.equal(card.failures.length, 0);
});

test("Given a surface that scrolls vertically When its text runs into the bottom padding Then only sideways reach fails", () => {
  const spec: MeasureSpec = { ...css, scroll: "y" };
  const result = evaluateSurface(surface([text("li", box(124, 170, 276, 184)), text("li.wide", box(124, 150, 280, 160))], { overflow: { x: 0, y: 300 }, scrollable: { x: false, y: true } }), spec);
  assert.deepEqual(result.failures.map(failure => [failure.check, failure.path]), [["outside", "li.wide"]]);
});

test("Given clipped text When the clipper has no ellipsis Then overflow fails; with an ellipsis or a scroller it does not", () => {
  const clipped = (clipper: Item["clipper"]) => text("h2", box(124, 124, 200, 140), { full: box(124, 124, 260, 140), clipper });
  const bare = evaluateSurface(surface([clipped({ path: "div.text", scroll: false, ellipsis: false })]), css);
  assert.deepEqual(bare.failures.map(failure => [failure.check, failure.px]), [["overflow", 60]]);
  assert.equal(evaluateSurface(surface([clipped({ path: "div.text", scroll: false, ellipsis: true })]), css).failures.length, 0);
  assert.equal(evaluateSurface(surface([clipped({ path: "div.list", scroll: true, ellipsis: false })]), css).failures.length, 0);
  const tall = evaluateSurface(surface([fill(124, 124, 276, 150), text("p.last", box(124, 170, 200, 236))], { overflow: { x: 0, y: 40 }, border: even(16) }), css);
  assert.deepEqual(tall.failures.filter(failure => failure.check === "overflow").map(failure => [failure.what, failure.px]), [["content taller than the surface", 40]]);
});

test("Given a root whose frame layer covers its border box When its scroll overflow is only that layer Then it is no overflow", () => {
  // The layer (-safe, left out of the items) makes scrollHeight 20 px taller; the content ends inside the padding box.
  const layered = evaluateSurface(surface([fill(124, 124, 276, 176)], { overflow: { x: 20, y: 20 }, border: even(16) }), css);
  assert.deepEqual(layered.failures, []);
  // Content that does reach past the padding box still counts, as far as it reaches (not the layer's 20).
  const spilled = evaluateSurface(surface([fill(124, 124, 276, 176), { ...text("p.spill", box(124, 150, 290, 170)), slot: false }], { overflow: { x: 20, y: 20 }, border: even(16) }), css);
  assert.deepEqual(spilled.failures.filter(failure => failure.check === "overflow").map(failure => [failure.what, failure.px]), [["content wider than the surface", 6]]);
});

test("Given a button on the frame band When evaluated Then border and outside both report it", () => {
  const result = evaluateSurface(surface([button("button.close", box(270, 180, 296, 198))]), css);
  assert.deepEqual(result.failures.map(failure => [failure.check, failure.px]).sort(), [["border", 14], ["outside", 22]]);
});

test("Given overlapping buttons, text under a button and nested controls When evaluated Then only the true overlaps fail", () => {
  const items = [
    button("button.a", box(130, 150, 160, 170)), button("button.b", box(155, 150, 185, 170)),
    button("summary.outer", box(230, 130, 270, 170)), button("span.inner", box(235, 135, 265, 165), { kit: true, art: true, variant: "icon" }, { inControls: [2] }),
    text("span.label", box(135, 155, 150, 165), { inControls: [0] }), text("p.caption", box(231, 166, 269, 169)),
    text("p.x", box(124, 172, 160, 176)), text("p.y", box(150, 170, 180, 176)),
  ];
  const result = evaluateSurface(surface(items), css);
  assert.deepEqual(result.failures.map(failure => [failure.check, failure.what, failure.path]).sort(), [
    ["overlap", "buttons overlap", "button.a ✕ button.b"], ["overlap", "text over text", "p.x ✕ p.y"], ["overlap", "text under a button", "p.caption ✕ summary.outer"]]);
});

test("Given controls When one is not a kit Button and one wears no art Then controls fails for both (surface cells are exempt)", () => {
  const result = evaluateSurface(surface([
    button("div.row", box(124, 124, 150, 140), { kit: false, art: false, variant: null }),
    button("button.bare", box(160, 124, 190, 140), { kit: true, art: false, variant: "secondary" }),
    button("button.cell", box(200, 124, 230, 140), { kit: true, art: false, variant: "surface" }),
  ]), css);
  assert.deepEqual(result.failures.map(failure => failure.what), ["a clickable that is not a kit Button", "a kit Button without button art"]);
});

test("Given a painting surface drawn at 1.5× When evaluated Then its safe rect is scaled from art pixels and the ring checks the portrait", () => {
  const spec: MeasureSpec = { root: ".person-card", frame: "painting", gap: 8, painting: { art: { w: 320, h: 200 }, safe: { x: 15, y: 22, w: 290, h: 155 } } };
  const collected = surface([text("h2", box(130, 150, 300, 170)), button("button.close", box(500, 340, 560, 380))],
    { rect: box(100, 100, 580, 400), frame: none, padding: none }, {
      portrait: { ring: { cx: 189, cy: 225, r: 64 }, face: { cx: 190, cy: 241, r: 58, path: "span.face" },
        ornament: { path: "span.ornament", rect: box(130, 180, 250, 300), opaque: 900, outside: 120, maxOut: 18.4 } },
    });
  const result = evaluateSurface(collected, spec);
  // 15 × 1.5 = 22.5 in, + 8: the inner box starts at x 130.5, y 141 and ends at 100 + 305 × 1.5 − 8 = 549.5, 100 + 177 × 1.5 − 8 = 357.5.
  assert.deepEqual(result.inner, box(130.5, 141, 549.5, 357.5));
  assert.deepEqual(result.failures.map(failure => [failure.check, failure.what.split(" ").slice(0, 3).join(" "), failure.px]), [
    ["outside", "control beyond the", 22.5], ["border", "control on the", 14.5], ["portrait", "the face reaches", 10], ["portrait", "120 of 900", 18.4]]);
  // Grown downward (a 9-slice card 480 × 450): one scale (the width's, 1.5), the bottom rule kept its distance from the bottom.
  const grown = evaluateSurface(surface([], { rect: box(100, 100, 580, 550), frame: none, padding: none }), spec);
  assert.deepEqual(grown.inner, box(130.5, 141, 549.5, 507.5));
});

test("Given a layer frame with a content slot When evaluated Then the slot's box is the inner box (its gap is inside it) and frame slots are free", () => {
  const spec: MeasureSpec = { root: ".petition-card", frame: "layer", gap: 8, frameLayer: ".petition-frame", contentSlot: ".petition-body", frameSlots: [".petition-roundel"] };
  const collected = surface([text("p.who", box(170, 140, 400, 160)), { ...text("span.roundel", box(100, 100, 130, 130)), slot: true }],
    { rect: box(100, 100, 600, 500), frame: none, padding: none }, { slot: { rect: box(160, 120, 580, 480), padding: none }, layer: { rect: box(100, 100, 600, 500), frame: { t: 86, r: 25, b: 27, l: 64 } } });
  const result = evaluateSurface(collected, spec);
  assert.deepEqual(result.inner, box(160, 120, 580, 480));
  assert.equal(result.failures.length, 0);
});

test("Given a root on the frame tokens (data-frame) When evaluated Then its computed content box is the inner box, whatever its kind", () => {
  // A painting kind: border 20 (the safe inset), padding 8 → content box (128, 128)–(572, 372); the registry's art rect is not read.
  const spec: MeasureSpec = { root: ".person-card", frame: "painting", gap: 8, painting: { art: { w: 320, h: 200 }, safe: { x: 15, y: 22, w: 290, h: 155 } } };
  const result = evaluateSurface(surface([text("h2", box(128, 128, 300, 150))], { rect: box(100, 100, 600, 400), frame: even(20), padding: even(8), kind: "person-card" }), spec);
  assert.deepEqual(result.inner, box(128, 128, 572, 372));
  assert.equal(result.failures.length, 0);
  // A padding under the gap still leaves the gap.
  const thin = evaluateSurface(surface([text("p", box(124, 130, 200, 140))], { frame: even(2), padding: even(4), kind: "light" }), css);
  assert.deepEqual(thin.inner, box(110, 110, 290, 190));
  assert.deepEqual(thin.failures.map(failure => failure.px), []);
});

test("Given a flat root that paints nothing When evaluated Then it is a container: its border box is the inner box, and its children are still checked", () => {
  const dock = (paints: boolean) => surface([button("button.build", box(100, 100, 160, 140)), button("button.ledger", box(150, 100, 210, 140)), fill(100, 150, 300, 200)],
    { frame: none, padding: none, kind: "flat", paints });
  const container = evaluateSurface(dock(false), { ...css, frame: "flat" });
  assert.deepEqual(container.inner, box(100, 100, 300, 200));
  assert.deepEqual(container.failures.map(failure => [failure.check, failure.what]), [["overlap", "buttons overlap"]]);
  // The same root with a fill (a vellum card): the 8 px gap is back, and the flush children are outside it.
  const card = evaluateSurface(dock(true), { ...css, frame: "flat" });
  assert.deepEqual(card.inner, box(108, 108, 292, 192));
  assert.ok(card.failures.some(failure => failure.check === "outside"));
});

test("Given a mostly empty surface When evaluated Then the empty-space warning is set but nothing fails", () => {
  const result = evaluateSurface(surface([text("h2", box(124, 124, 180, 140))]), css);
  assert.equal(result.failures.length, 0);
  assert.ok(result.empty !== null && result.empty.ratio < 0.4 && result.empty.warn);
});

test("Given a root its scrolling ancestor shows in part When evaluated Then empty space counts only the shown part", () => {
  // R15 triage: a part of the panel slot runs below the slot's scrolled view; what is scrolled out holds no content to count.
  const items = [text("p", box(124, 124, 276, 148))];
  const whole = evaluateSurface(surface(items), css);
  const shown = evaluateSurface(surface(items, { visible: box(100, 100, 300, 150) }), css);
  assert.ok(whole.empty !== null && shown.empty !== null && shown.empty.ratio > whole.empty.ratio && !shown.empty.warn);
});

test("Given a drawer whose view collapsed to its frame When none of its text is in view Then content fails; one line in view passes", () => {
  // R15: the population drawer opened 18 px tall (top and bottom both set): its log clipped away entirely.
  const clipper = { path: "div.slot-panel", scroll: true, ellipsis: false };
  const hidden = [text("h2", box(124, 124, 220, 140), { rect: null, clipper }), text("p", box(124, 144, 260, 160), { rect: null, clipper })];
  assert.deepEqual(evaluateSurface(surface(hidden), css).failures.map(failure => failure.check), ["content"]);
  const one = [text("h2", box(124, 124, 220, 140), { clipper }), text("p", box(124, 144, 260, 160), { rect: null, clipper })];
  assert.deepEqual(evaluateSurface(surface(one), css).failures, []);
});

test("Given a title line centred on a whole-pixel glyph box 0.7 px above its block When evaluated Then it is snapped onto the block; 3 px out still fails", () => {
  // R15: screen.welcome at 1024×768 — the h2 block starts on the inner box (124), its estimated line box at 123.3.
  const block = box(140, 124, 260, 143.4);
  const snapped = snapLine(box(150, 123.3, 250, 142.7), block);
  assert.deepEqual([snapped.t, snapped.b].map(value => Math.round(value * 100) / 100), [124, 143.4]);
  assert.deepEqual(evaluateSurface(surface([text("h2", box(150, 123.3, 250, 142.7), { block })]), css).failures, []);
  const out = evaluateSurface(surface([text("h2", box(150, 121, 250, 140.4), { block: box(140, 121, 260, 140.4) })]), css);
  assert.deepEqual(out.failures.map(failure => failure.check), ["outside"]);
  const overflowing = box(150, 140, 250, 159.4);
  assert.deepEqual(snapLine(overflowing, block), overflowing);
});

test("Given a registry-listed sibling group When two members overlap Then overlap fails unless one holds the other", () => {
  const siblings = [{ selector: ".slot", rects: [{ path: "a", rect: box(120, 120, 200, 180) }, { path: "b", rect: box(190, 130, 260, 170) }, { path: "c", rect: box(125, 125, 150, 150) }], nested: [[0, 2]] as const }];
  const result = evaluateSurface(surface([], {}, { siblings }), css);
  assert.deepEqual(result.failures.map(failure => failure.path), ["a ✕ b"]);
});

test("Given a state with a ledger When numbers go extreme Then the cash balance still equals the treasury and names are long", () => {
  const state = {
    tick: 10, treasuryCoin: 300, treasuryTimber: 5, population: 12,
    ledger: { nextEntryOrdinal: 3, rollups: [{ account: "cash", periodStart: 0, periodEnd: 4, byCategory: { rent: 100 } }],
      entries: [{ id: "ledger-000001", account: "cash", category: "rent", amount: 150, tick: 5, sourceRefs: [{ type: "building", id: "b" }] },
        { id: "ledger-000002", account: "cash", category: "rent", amount: 50, tick: 6, sourceRefs: [{ type: "building", id: "b" }] }] },
    buildings: [{ kind: "house", tx: 4, ty: 5, inventory: { wheat: 3, timber: 0 } }, { kind: "granary", tx: 9, ty: 9, inventory: { wheat: 40 } }],
    constructionSites: [{ kind: "palisade_segment", tx: 1, ty: 1 }, { kind: "mill", tx: 7, ty: 2 }],
    walkers: [{ position: { tx: 3.5, ty: 4 } }],
    persons: { people: [{ givenName: "Alice", surname: "Hayward" }, { givenName: "John" }] },
  };
  assert.equal(ledgerStateProblem(state), null);
  const extreme = extremeNumbers(state);
  assert.equal(ledgerStateProblem(extreme), null);
  assert.equal(extreme.treasuryCoin, EXTREME.cash);
  assert.equal(extreme.population, EXTREME.population);
  assert.deepEqual(extreme.buildings.map(building => building.inventory), [{ wheat: EXTREME.stock, timber: 0 }, { wheat: EXTREME.stock }]);
  assert.equal(extreme.persons.people[0]!.surname?.length, 12);
  assert.equal(state.treasuryCoin, 300, "the input is not changed");
  assert.deepEqual(mapTile(state, { site: true }), { tx: 7, ty: 2 });
  assert.deepEqual(mapTile(state, { building: ["farmstead", "granary"], offset: [1, 2] }), { tx: 10, ty: 11 });
  assert.deepEqual(mapTile(state, { walker: true }), { tx: 3.5, ty: 4 });
  assert.throws(() => mapTile(state, { building: ["keep"] }));
});

test("Given the summary step When its inputs and mode are read Then the hash is stable and the gate mode follows the environment", () => {
  const inputs = ["a1 src/ui/A.tsx", "b2 src/styles/b.css"];
  assert.equal(geometryInputHash(inputs), geometryInputHash([...inputs]));
  assert.notEqual(geometryInputHash(inputs), geometryInputHash(["a9 src/ui/A.tsx", "b2 src/styles/b.css"]));
  assert.equal(gateMode({ FLS_UI_GEOMETRY_GATE: "warn" }), "warn");
});
