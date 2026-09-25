import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// No hover-only information (B9, design master 13.1 rule 1 / AGENTS rule 4): anything a mouse hover reveals must also
// be reachable by selecting or tapping. The audit and its before/after list: docs/verification/b9-input/hover-audit.md.
const ROOT = new URL("../", import.meta.url).pathname;

function files(dir: string, pattern: RegExp): string[] {
  return readdirSync(join(ROOT, dir)).flatMap(name => {
    const path = join(dir, name);
    return statSync(join(ROOT, path)).isDirectory() ? files(path, pattern) : pattern.test(name) ? [path] : [];
  });
}
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");
const TSX_FILES = [...files("src/ui", /\.tsx$/), ...files("src/render", /\.tsx$/), "src/App.tsx"];
const CSS_FILES = [...files("src/styles", /\.css$/), ...files("src/ui", /\.css$/)];

/** Hover handlers kept on purpose, with the tap path that shows the same thing. */
const HOVER_ALLOWLIST: Readonly<Record<string, string>> = {
  "src/ui/BuildMenu.tsx:onMouseEnter": "desktop preview of the build summary; a tap on an unbuildable card pins the same lines, a selected card shows them in the summary and the detail panel",
};

test("Given the UI components When their attributes are read Then no title tooltip carries information", () => {
  const titles = TSX_FILES.flatMap(file => [...read(file).matchAll(/\btitle=\{?["'`]?/g)].map(() => file));
  assert.deepEqual(titles, []);
});

test("Given the UI components When hover handlers are listed Then only allowlisted ones remain, each with a tap path", () => {
  const found: string[] = [];
  for (const file of TSX_FILES) {
    for (const match of read(file).matchAll(/\b(onMouseEnter|onMouseOver|onPointerEnter|onPointerOver)=/g)) found.push(`${file}:${match[1]}`);
  }
  const unexplained = found.filter(entry => HOVER_ALLOWLIST[entry] === undefined);
  assert.deepEqual(unexplained, []);
  for (const entry of Object.keys(HOVER_ALLOWLIST)) assert.ok(found.includes(entry), `stale allowlist entry ${entry}`);
});

test("Given the canvas runtime When the pointer moves Then it sets no hover-only canvas tooltip", () => {
  const assignments = files("src/render", /\.ts$/).flatMap(file => [...read(file).matchAll(/\bcanvas\.title\s*=\s*([^;]+);/g)]
    .filter(match => match[1]!.trim() !== "''" && match[1]!.trim() !== '""').map(match => `${file}: canvas.title = ${match[1]!.trim()}`));
  assert.deepEqual(assignments, []);
});

test("Given the stylesheets When a hover rule reveals content Then the same content is revealed by a pressed, selected or open state", () => {
  const css = CSS_FILES.map(read).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const unmatched: string[] = [];
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1]!.split(",").map(item => item.trim()).filter(Boolean);
    const reveals = /\b(display\s*:\s*(?!none)|visibility\s*:\s*visible|opacity\s*:\s*[1-9])/.test(match[2]!);
    for (const selector of selectors.filter(item => item.includes(":hover"))) {
      if (!reveals) continue;
      const tapped = ['[aria-pressed="true"]', '[aria-expanded="true"]', '[aria-selected="true"]', "[open]", ".is-open"]
        .some(state => selectors.includes(selector.replace(":hover", state)));
      if (!tapped) unmatched.push(selector);
    }
  }
  assert.deepEqual(unmatched, []);
});
