import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { FRAME_TOKEN_FILES, renderFrameTokens } from "../scripts/frameTokens";
import { frameArtSpaceStyle, frameBoxStyle, frameLayerStyle, frameSafe } from "../src/ui/frameBox";
import { FRAME_GAP, FRAME_TOKENS } from "../src/ui/frameTokens.generated";
import { WAVE8_FRAMES } from "../src/ui/wave8ArtManifest.generated";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");
const files = (dir: string, ext: string): string[] => readdirSync(join(ROOT, dir), { recursive: true, encoding: "utf8" })
  .filter(file => file.endsWith(ext)).map(file => join(dir, file));

test("UI-AUDIT-1: the committed frame token files are the generator's output (npx tsx scripts/frameTokens.ts)", () => {
  const out = renderFrameTokens();
  assert.equal(read(FRAME_TOKEN_FILES.css), out.css);
  assert.equal(read(FRAME_TOKEN_FILES.ts), out.ts);
});

test("UI-AUDIT-1: no stylesheet keeps its own 9-slice, slice width or old art variable — every frame reads the tokens", () => {
  const sheets = files("src/styles", ".css").filter(file => !file.endsWith("frameTokens.generated.css"));
  const offenders = sheets.flatMap(file => read(file).split("\n").map((line, index) => ({ file, line: index + 1, text: line }))
    .filter(({ text }) => /border-image:\s*url\(|--slice-|--art-(?:frame|button|tab|chip)\b/.test(text)).map(({ file, line }) => `${file}:${line}`));
  assert.deepEqual(offenders, []);
  assert.match(read("src/styles/uiSkin.css"), /^@import "\.\/frameTokens\.generated\.css";/, "the tokens load with the skin");
});

test("UI-AUDIT-1: every data-frame in the markup is a token kind or flat, and every kind has its box rule", () => {
  const kinds = new Set<string>([...Object.keys(FRAME_TOKENS), "flat"]);
  const sources = [...files("src/ui", ".tsx"), ...files("src/render", ".tsx"), "src/App.tsx"];
  const used = sources.flatMap(file => [...read(file).matchAll(/data-frame"?[=:] ?"([a-z0-9-]+)"/g)].map(match => ({ file, kind: match[1]! })));
  assert.ok(used.length >= 50, `${used.length} framed roots`);
  assert.deepEqual(used.filter(entry => !kinds.has(entry.kind)), []);
  const css = read(FRAME_TOKEN_FILES.css);
  for (const kind of Object.keys(FRAME_TOKENS)) {
    assert.match(css, new RegExp(`\\[data-frame="${kind}"\\] \\{ border-style: solid; border-color: transparent; border-width: var\\(--frame-${kind}-safe\\); padding: var\\(--frame-gap\\);`), kind);
  }
  assert.match(css, /--frame-gap: 8px;/);
  assert.equal(FRAME_GAP, 8);
});

test("UI-AUDIT-1: a Wave 8 frame's safe inset is its content rect, and a layer covers the border box it frames", () => {
  for (const [id, kind] of [["frame_chronicle_page", "chapter-page"], ["frame_petition", "petition"], ["frame_season_ledger", "season-ledger"]] as const) {
    const frame = WAVE8_FRAMES[id]; const rect = frame.content[0];
    assert.deepEqual(FRAME_TOKENS[kind].safeSource, { top: rect.y, right: frame.width - rect.x - rect.width, bottom: frame.height - rect.y - rect.height, left: rect.x }, kind);
  }
  const safe = frameSafe("record-event", 0.7);
  assert.deepEqual(safe, FRAME_TOKENS["record-event"].safe);
  const layer = frameLayerStyle("record-event", 0.7);
  assert.deepEqual([layer.top, layer.right, layer.bottom, layer.left], [-safe.top, -safe.right, -safe.bottom, -safe.left]);
  assert.deepEqual(frameArtSpaceStyle("biography", 0.5), { position: "absolute", top: -15, right: -13, bottom: -14, left: -13 });
  assert.deepEqual(frameBoxStyle("biography", 0.5), { borderStyle: "solid", borderColor: "transparent", borderWidth: "15px 13px 14px 13px", padding: 8, backgroundOrigin: "border-box" });
});
