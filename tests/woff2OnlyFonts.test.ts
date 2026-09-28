/** BUDGET-1b (judgement 2026-09-28): the fonts ship as woff2 only (scripts/woff2OnlyFonts.ts, a Vite `pre` plugin). */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { stripWoffFallback, woff2OnlyFontsPlugin } from "../scripts/woff2OnlyFonts";

const FONT_CSS = ["@fontsource/noto-sans-kr/400.css", "@fontsource/noto-sans-kr/700.css", "@fontsource/noto-serif-kr/600.css"];

test("the @fontsource CSS the game imports keeps every woff2 face and no woff url", () => {
  for (const name of FONT_CSS) {
    const css = readFileSync(new URL(`../node_modules/${name}`, import.meta.url), "utf8");
    const stripped = stripWoffFallback(css);
    const faces = (css.match(/@font-face/g) ?? []).length;
    assert.ok(faces > 0, name);
    assert.equal((stripped.match(/format\('woff2'\)/g) ?? []).length, faces, `${name}: one woff2 per face`);
    assert.doesNotMatch(stripped, /\.woff\)|format\('woff'\)/, `${name}: no woff fallback`);
    assert.equal((stripped.match(/unicode-range:/g) ?? []).length, faces, `${name}: the faces are otherwise unchanged`);
  }
});

test("the plugin runs before Vite's CSS plugin and touches only @fontsource CSS", () => {
  const plugin = woff2OnlyFontsPlugin();
  assert.equal(plugin.enforce, "pre");
  const transform = plugin.transform as (code: string, id: string) => { code: string } | null;
  const css = "src: url(./files/a.woff2) format('woff2'), url(./files/a.woff) format('woff');";
  assert.equal(transform(css, "/repo/node_modules/@fontsource/noto-sans-kr/400.css")?.code, "src: url(./files/a.woff2) format('woff2');");
  assert.equal(transform(css, "/repo/src/styles/uiSkin.css"), null);
});
