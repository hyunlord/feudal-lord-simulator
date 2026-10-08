import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { BRAND_ART_FILES, BRAND_DIR, FAVICON_SOURCE, kitSums, parseSvg, renderBrandArt } from "../scripts/brandArt";
import { BRAND_SOURCES } from "../src/ui/brand/brandArt.generated";
import { BRAND_COPY } from "../src/ui/brand/brandCopy.ko";
import { GameLogo, type GameLogoLanguage, type GameLogoLayout } from "../src/ui/brand/GameLogo";
import { SealMark, type SealDetail } from "../src/ui/brand/SealMark";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");
const sha256 = (text: string): string => createHash("sha256").update(text).digest("hex");
const TONES = ["on-light", "on-dark"] as const;

type Shape = { tag: string; attrs: Record<string, string>; children: Shape[] };
/** An SVG's drawing (below the root) for comparison: no title/metadata/labels, ids without the instance prefix, colours upper-case. */
function drawing(svg: string, idPrefix = ""): Shape[] {
  const strip = (node: ReturnType<typeof parseSvg>): Shape => ({
    tag: node.tag,
    attrs: Object.fromEntries(node.attrs.filter(([name]) => name !== "aria-label").map(([name, value]) => [name,
      name === "id" ? value.slice(idPrefix.length) : /^#[0-9a-f]+$/i.test(value) ? value.toUpperCase() : value])),
    children: node.children.filter(child => child.tag !== "title" && child.tag !== "metadata").map(strip),
  });
  return strip(parseSvg(svg)).children;
}
const prefixOf = (markup: string): string => /id="(brand[\w-]*?-)wax-seal"/.exec(markup)?.[1] ?? "";

test("LM-R3: the committed brand art and index.html are the generator's output (npx tsx scripts/brandArt.ts)", () => {
  const out = renderBrandArt();
  assert.equal(read(BRAND_ART_FILES.ts), out.ts);
  assert.equal(read(BRAND_ART_FILES.html), out.html);
});

test("LM-R3: every kit file the art was drawn from is recorded with the kit's SHA-256 (docs/design/brand/SHA256SUMS)", () => {
  const sums = kitSums();
  assert.equal(BRAND_SOURCES.length, 8 + 6 + 1, "8 outlined logos, 6 seal icons, the favicon's file");
  for (const source of BRAND_SOURCES) {
    const path = source.path.slice(`${BRAND_DIR}/`.length);
    assert.equal(source.sha256, sums.get(path), path);
    assert.equal(sha256(read(source.path)), source.sha256, `${path} on disk`);
  }
});

test("LM-R3: GameLogo draws each outlined logo exactly as the kit's file, in both tones", () => {
  for (const language of ["ko", "en"] as const satisfies readonly GameLogoLanguage[]) {
    for (const layout of ["horizontal", "vertical"] as const satisfies readonly GameLogoLayout[]) {
      for (const tone of TONES) {
        const markup = renderToStaticMarkup(createElement(GameLogo, { language, layout, tone, width: 400 }));
        const kit = read(`${BRAND_DIR}/logos/charter-kin-${language}-${layout}-${tone}-outlined.svg`);
        assert.deepEqual(drawing(markup, prefixOf(markup)), drawing(kit), `${language}-${layout}-${tone}`);
        assert.match(markup, new RegExp(`^<svg[^>]* viewBox="${/viewBox="([^"]+)"/.exec(kit)![1]}"`));
        assert.match(markup, / role="img" aria-label="인장과 가문 \(Charter &amp; Kin\)"/);
      }
    }
  }
  const markup = renderToStaticMarkup(createElement(GameLogo, { tone: "on-dark", width: 300 }));
  assert.match(markup, /width="300" height="70"/, "size by width, the kit's 1200×280 proportion");
  assert.match(markup, /data-logo="ko-horizontal-on-dark"/, "default Korean, horizontal");
});

test("LM-R3: SealMark draws the kit's 32/64/256 seal icons; decoration unless labelled", () => {
  for (const detail of [32, 64, 256] as const satisfies readonly SealDetail[]) {
    for (const tone of TONES) {
      const markup = renderToStaticMarkup(createElement(SealMark, { size: 40, detail, tone }));
      assert.deepEqual(drawing(markup, prefixOf(markup)), drawing(read(`${BRAND_DIR}/icons/seal-${detail}-${tone}.svg`)), `${detail}-${tone}`);
      assert.match(markup, /aria-hidden="true"/);
    }
  }
  assert.match(renderToStaticMarkup(createElement(SealMark, { size: 24 })), /data-seal="32"/, "small sizes take the optical-small form");
  assert.match(renderToStaticMarkup(createElement(SealMark, { size: 96 })), /data-seal="64"/);
  const labelled = renderToStaticMarkup(createElement(SealMark, { size: 64, label: BRAND_COPY.name }));
  assert.match(labelled, /role="img" aria-label="인장과 가문"/);
  assert.doesNotMatch(labelled, /aria-hidden/);
});

test("LM-R3: two logos and a seal on one page have no id in common (the kit repeats its ids in every file)", () => {
  const markup = renderToStaticMarkup(createElement(Fragment, null,
    createElement(GameLogo, { tone: "on-light", width: 200 }), createElement(GameLogo, { tone: "on-light", width: 200 }),
    createElement(GameLogo, { language: "en", layout: "vertical", tone: "on-dark", width: 200 }), createElement(SealMark, { size: 24 })));
  const ids = [...markup.matchAll(/ id="([^"]+)"/g)].map(match => match[1]!);
  assert.ok(ids.length > 30, `${ids.length} ids`);
  assert.equal(new Set(ids).size, ids.length);
});

test("LM-R3: index.html is the game's — Korean description, the window title, the 32 px seal as the favicon", () => {
  const html = read("index.html");
  assert.match(html, /<title>인장과 가문 · Charter &amp; Kin<\/title>/);
  assert.equal(BRAND_COPY.windowTitle, "인장과 가문 · Charter & Kin");
  assert.ok(html.includes(`<meta name="description" content="${BRAND_COPY.description}" />`));
  assert.match(BRAND_COPY.description, /[가-힯]/);
  assert.match(html, /<meta name="theme-color" content="#11150f" \/>/, "theme colour unchanged");
  const href = /<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,([^"]+)" \/>/.exec(html)?.[1];
  assert.ok(href !== undefined, "an inline SVG data URI");
  const icon = decodeURIComponent(href);
  assert.equal(sha256(icon), kitSums().get(FAVICON_SOURCE), "the kit's seal-32-on-light.svg, unchanged");
  assert.doesNotMatch(html, /봉건 영주 시뮬레이터|Feudal Lord Simulator/);
  assert.match(read("src/main.tsx"), /document\.title = BRAND_COPY\.windowTitle;/);
});
