import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { CAUSE_MARKER_HIT_RADIUS_PX, hitCauseMarker } from "../src/render/causeMarkerLayout";

// Touch and Steam Deck size rules (B9, design master 13.1 rule 5 / AGENTS rule 4): text at least 12px (the Deck
// recommendation), every control at least 44x44 CSS px. Static checks over the sources; scripts/touchTargetAudit.mjs
// measures the same in a browser (docs/verification/b9-input/touch-audit-*.json).
const ROOT = new URL("../", import.meta.url).pathname;
const MIN_TEXT_PX = 12;
const MIN_TARGET_PX = 44;
const ROOT_FONT_PX = 16;

function files(dir: string, pattern: RegExp): string[] {
  return readdirSync(join(ROOT, dir)).flatMap(name => {
    const path = join(dir, name);
    return statSync(join(ROOT, path)).isDirectory() ? files(path, pattern) : pattern.test(name) ? [path] : [];
  });
}
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");
const CSS_FILES = [...files("src/styles", /\.css$/), ...files("src/ui", /\.css$/)];
const TSX_FILES = [...files("src/ui", /\.tsx$/), ...files("src/render", /\.tsx$/), "src/App.tsx"];

/** Custom properties declared anywhere in the stylesheets (last declaration wins, as in the cascade order used). */
function cssVariables(): Map<string, string> {
  const variables = new Map<string, string>();
  for (const file of CSS_FILES) for (const match of read(file).matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) variables.set(match[1]!, match[2]!.trim());
  return variables;
}

/** Smallest px size a font value can take: px, rem/em at a 16px root, clamp()/min() lower bounds, var() resolved. */
function smallestPx(value: string, variables: Map<string, string>, depth = 0): number | null {
  const resolved = value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => depth < 4 ? variables.get(name) ?? "" : "");
  const sizes = [...resolved.matchAll(/(\d+(?:\.\d+)?)(px|rem|em)\b/g)].map(match => Number(match[1]) * (match[2] === "px" ? 1 : ROOT_FONT_PX));
  return sizes.length === 0 ? null : Math.min(...sizes);
}

test("Given every stylesheet When its font sizes are resolved Then none is below 12px", () => {
  const variables = cssVariables();
  const small: string[] = [];
  for (const file of CSS_FILES) {
    for (const match of read(file).matchAll(/font-size\s*:\s*([^;}]+)/g)) {
      const px = smallestPx(match[1]!, variables);
      if (px !== null && px < MIN_TEXT_PX) small.push(`${file}: font-size ${match[1]!.trim()} = ${px}px`);
    }
    // `font:` shorthand: the size is the length before an optional /line-height.
    for (const match of read(file).matchAll(/(?:^|[;{\s])font\s*:\s*([^;}]+)/g)) {
      const size = match[1]!.replace(/\/\s*[^\s]+/, "").match(/(var\(--[\w-]+\)|\d+(?:\.\d+)?(?:px|rem|em))/)?.[1];
      const px = size === undefined ? null : smallestPx(size, variables);
      if (px !== null && px < MIN_TEXT_PX) small.push(`${file}: font ${match[1]!.trim()} = ${px}px`);
    }
  }
  assert.deepEqual(small, []);
  assert.ok((smallestPx("var(--font-badge)", variables) ?? 0) >= MIN_TEXT_PX, "badge size");
});

test("Given the UI components When their inline styles are read Then no font size is below 12px", () => {
  const small: string[] = [];
  for (const file of TSX_FILES) {
    for (const match of read(file).matchAll(/fontSize\s*:\s*["'`]?(\d+(?:\.\d+)?)(px|rem|em)?/g)) {
      const px = Number(match[1]) * (match[2] === "rem" || match[2] === "em" ? ROOT_FONT_PX : 1);
      if (px < MIN_TEXT_PX) small.push(`${file}: fontSize ${match[0]}`);
    }
  }
  assert.deepEqual(small, []);
});

test("Given every canvas text When its font is set Then the on-screen size is at least 12px", () => {
  // World-space sizes are written `N / zoom` (or `N / Math.max(zoom, 0.5)` for zoom >= MIN_ZOOM 0.5): N screen px.
  const small: string[] = [];
  for (const file of files("src/render", /\.ts$/)) {
    const source = read(file);
    for (const match of source.matchAll(/\.font\s*=\s*(`[^`]*`|'[^']*'|"[^"]*")/g)) {
      const text = match[1]!;
      const literal = text.match(/(\d+(?:\.\d+)?)px/)?.[1];
      const expression = text.match(/\$\{([^}]*)\}px/)?.[1];
      let size: number | null = literal === undefined ? null : Number(literal);
      if (expression !== undefined) {
        const variable = expression.trim().match(/^[A-Za-z_]\w*$/)?.[0];
        const definition = variable === undefined ? expression : source.match(new RegExp(`const ${variable}\\s*=\\s*([^;]+);`))?.[1] ?? "";
        const number = definition.match(/(\d+(?:\.\d+)?)/)?.[1];
        size = number === undefined ? null : Number(number);
      }
      assert.notEqual(size, null, `${file}: cannot read ${text}`);
      if ((size ?? 0) < MIN_TEXT_PX) small.push(`${file}: ${text}`);
    }
  }
  assert.deepEqual(small, []);
});

test("Given the stylesheets When the touch target floor is read Then every control kind is at least 44x44 and nothing caps it lower", () => {
  const css = CSS_FILES.map(read).join("\n");
  const floor = css.match(/\.app-shell :is\(([^)]*(?:\([^)]*\)[^)]*)*)\):not\(\.visually-hidden\)\s*\{([^}]*)\}/);
  assert.ok(floor !== null, "touch target floor rule");
  for (const kind of ["button", "summary", "[role=\"button\"]", "[role=\"tab\"]", "a[href]", "select", "input"]) {
    assert.ok(floor[1]!.includes(kind), `floor covers ${kind}`);
  }
  assert.match(floor[2]!, new RegExp(`min-width:\\s*${MIN_TARGET_PX}px !important`));
  assert.match(floor[2]!, new RegExp(`min-height:\\s*${MIN_TARGET_PX}px !important`));
  // Only an !important max-size could undercut the floor; a max below 44px on any rule would squeeze a control.
  const caps = [...css.matchAll(/max-(?:width|height)\s*:\s*(\d+(?:\.\d+)?)px/g)].filter(match => Number(match[1]) < MIN_TARGET_PX);
  assert.deepEqual(caps.map(match => match[0]), []);
  assert.deepEqual([...css.matchAll(/(?:^|[;{\s])(?:width|height)\s*:\s*(\d+(?:\.\d+)?)px\s*!important/g)]
    .filter(match => Number(match[1]) < MIN_TARGET_PX).map(match => match[0]), []);
});

test("Given the components When clickable elements are listed Then each is a control the floor covers", () => {
  // A click handler on a plain element would get no 44px floor and no keyboard focus. The welcome layer is the
  // full-screen "click anywhere" backdrop (the whole viewport is its target).
  const allowed = new Set(["welcome-dismiss-layer"]);
  const plain: string[] = [];
  for (const file of TSX_FILES) {
    for (const match of read(file).matchAll(/<(div|span|li|p|section|aside|img|svg|g|path|rect|circle|td|tr|label|header|strong|h[1-6])\b([^>]*?)\bon(?:Click|PointerDown|MouseDown)=/g)) {
      const className = match[2]!.match(/className="([^"]+)"/)?.[1] ?? "";
      if (/role="(?:button|tab)"/.test(match[2]!) || [...allowed].some(name => className.includes(name))) continue;
      plain.push(`${file}: <${match[1]} ${className}>`);
    }
  }
  assert.deepEqual(plain, []);
});

test("Given a cause icon on the map When it is tapped Then the hit target is at least 44px across and the nearest icon wins", () => {
  assert.ok(CAUSE_MARKER_HIT_RADIUS_PX * 2 >= MIN_TARGET_PX);
  const markers = [
    { x: 0, y: 0, buildingIds: ["a"], causeId: "water", risk: false },
    { x: 30, y: 0, buildingIds: ["b"], causeId: "bread", risk: false },
  ];
  assert.equal(hitCauseMarker(markers, { x: 21, y: 0 }, 1)?.buildingIds[0], "b", "nearest");
  assert.equal(hitCauseMarker(markers, { x: 0, y: 21 }, 1)?.buildingIds[0], "a", "21px off the icon centre still hits");
  assert.equal(hitCauseMarker(markers, { x: 0, y: 23 }, 1), null);
  assert.equal(hitCauseMarker(markers, { x: 0, y: 36 }, 0.6)?.buildingIds[0], "a", "screen px at zoom 0.6");
});
