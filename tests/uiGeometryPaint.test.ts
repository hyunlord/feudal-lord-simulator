import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluateSurface, type Collected, type MeasureSpec } from "../scripts/uiGeometryMeasure";
import { changedPixels, crossingLine, paintFacts, type Rgba } from "../scripts/uiGeometryPaint";

// QA round 15: the content, hud and ornament checks on synthetic captures and surfaces.
const W = 60, H = 30;
const capture = (paint: (x: number, y: number) => number): Rgba => {
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { const v = paint(x, y); const i = (y * W + x) * 4; data[i] = v; data[i + 1] = v; data[i + 2] = v; data[i + 3] = 255; }
  return { width: W, height: H, data };
};
const parchment = capture(() => 220);
const origin = { x: 100, y: 200 };
const box = (l: number, t: number, r: number, b: number) => ({ l: origin.x + l, t: origin.y + t, r: origin.x + r, b: origin.y + b });

test("changed pixels: glyphs that the second capture hides change; a covered text does not", () => {
  const withText = capture((x, y) => (x >= 10 && x < 40 && y >= 10 && y < 18 && x % 3 === 0 ? 40 : 220));
  assert.ok(changedPixels(withText, parchment, origin, [box(10, 10, 40, 18)]) > 50);
  assert.equal(changedPixels(parchment, parchment, origin, [box(10, 10, 40, 18)]), 0);
});

test("a drawn vertical line through a line box is found; plain ground and a rule at the box's end are not", () => {
  const rule = capture(x => (x === 30 || x === 31 ? 60 : 220));
  assert.equal(crossingLine(rule, origin, box(5, 8, 55, 22)), "x");
  assert.equal(crossingLine(parchment, origin, box(5, 8, 55, 22)), null);
  const edge = capture(x => (x === 6 ? 60 : 220));
  assert.equal(crossingLine(edge, origin, box(5, 8, 55, 22)), null);
  const strike = capture((_, y) => (y === 15 ? 60 : 220));
  assert.equal(crossingLine(strike, origin, box(5, 8, 55, 22)), "y");
});

const spec: MeasureSpec = { root: ".card", frame: "css", gap: 8, requires: ["h2", ".option"] };
const rect = box(0, 0, 60, 30);
const base = (extra: Partial<Collected>): Collected => ({
  found: true, viewport: { w: 1280, h: 800 }, expectFound: null,
  root: { path: "section.card", rect, frame: { t: 0, r: 0, b: 0, l: 0 }, padding: { t: 8, r: 8, b: 8, l: 8 }, kind: "flat", overflow: { x: 0, y: 0 }, scrollable: { x: false, y: false }, border: { t: 0, r: 0, b: 0, l: 0 }, paints: true },
  items: [{ kind: "text", path: "section.card > h2", text: "The Crown asks a tax", rect: box(10, 10, 40, 18), full: box(10, 10, 40, 18), clipper: null, slot: false, lines: [box(10, 10, 40, 18)], inControls: [], within: [] }],
  requires: [{ selector: "h2", rects: [box(10, 10, 40, 18)], hidden: 0 }, { selector: ".option", rects: [], hidden: 2 }],
  ...extra,
});

test("content: a text the frame covers, a required element not shown — both fail", () => {
  const covered = paintFacts(base({}), parchment, parchment, origin);
  const result = evaluateSurface({ ...base({}), paint: covered }, spec);
  const content = result.failures.filter(failure => failure.check === "content").map(failure => failure.what);
  assert.ok(content.some(what => what.startsWith("text not painted")));
  assert.ok(content.some(what => what === "required h2 not painted (covered by another layer)"));
  assert.ok(content.some(what => what.startsWith("required .option not shown")));
});

test("content: a painted text passes", () => {
  const withText = capture((x, y) => (x >= 10 && x < 40 && y >= 10 && y < 18 && x % 3 === 0 ? 40 : 220));
  const collected = base({ requires: [{ selector: "h2", rects: [box(10, 10, 40, 18)], hidden: 0 }] });
  const result = evaluateSurface({ ...collected, paint: paintFacts(collected, withText, parchment, origin) }, { ...spec, requires: ["h2"] });
  assert.deepEqual(result.failures.filter(failure => failure.check === "content"), []);
});

test("hud: a dock button over the surface fails, one the surface covers while live fails, one under a backdrop does not", () => {
  const hud = (over: boolean, live: boolean) => ({ path: "button.action-dock-button", rect: box(40, 20, 90, 60), shared: box(40, 20, 60, 30), over, live });
  const checks = (hit: ReturnType<typeof hud>) => evaluateSurface(base({ requires: [], hud: [hit] }), { ...spec, requires: [] }).failures.filter(failure => failure.check === "hud").map(failure => failure.what);
  assert.deepEqual(checks(hud(true, true)), ["the HUD paints over the surface"]);
  assert.deepEqual(checks(hud(false, true)), ["the surface covers a live HUD control"]);
  assert.deepEqual(checks(hud(false, false)), []);
});

test("ornament: a crossing found on the second capture fails the text", () => {
  const rule = capture(x => (x === 25 ? 60 : 220));
  const line = box(5, 8, 55, 26);
  const collected = base({ requires: [], items: [{ kind: "text", path: "section.card > p", text: "No records yet", rect: line, full: line, clipper: null, slot: false, lines: [line], inControls: [], within: [] }] });
  const result = evaluateSurface({ ...collected, paint: paintFacts(collected, rule, rule, origin) }, { ...spec, requires: [] });
  assert.deepEqual(result.failures.filter(failure => failure.check === "ornament").map(failure => failure.what), ["text crossed by a drawn vertical line"]);
});
