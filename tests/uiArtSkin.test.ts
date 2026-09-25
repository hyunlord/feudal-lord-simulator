import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { UI_ART_MANIFEST } from "../src/ui/uiArtManifest.generated";
import { UI_ICON_SHEETS, uiIconStyle } from "../src/ui/uiArt";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { StewardAdvisor } from "../src/ui/tutorial/TutorialShell";
import { TUTORIAL_COPY } from "../src/ui/tutorial/tutorialCopy.ko";

const ROOT = new URL("..", import.meta.url).pathname;
const read = (path: string): string => readFileSync(join(ROOT, path), "utf8");

test("Given the UI art manifest When its files are listed Then every url exists and every icon sheet has its 24/32/48/64/96 copies", () => {
  const urls: string[] = [];
  const collect = (value: unknown): void => {
    if (value === null || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      if (key === "url" && typeof entry === "string") urls.push(entry);
      else collect(entry);
    }
  };
  collect(UI_ART_MANIFEST);
  assert.equal(urls.length, 97);
  assert.deepEqual(urls.filter(url => !existsSync(join(ROOT, "public", url))), []);
  for (const [name, sheet] of Object.entries(UI_ART_MANIFEST.iconSheets)) {
    assert.deepEqual(Object.keys(sheet.sizes).sort(), ["24", "32", "48", "64", "96"], name);
  }
  const icons = Object.values(UI_ART_MANIFEST.iconSheets).reduce((total, sheet) => total + sheet.cells.length, 0);
  assert.equal(icons, 57, "the 57 P0 icons");
});

test("Given an icon at 24, 32 and 48 CSS px When styled Then the 1x and 2x copies are the size and its double (no run-time scaling)", () => {
  for (const [size, x1, x2] of [[24, 24, 48], [32, 32, 64], [48, 48, 96]] as const) {
    const style = uiIconStyle("time", "play", size);
    assert.equal(style.width, `${size}px`);
    assert.match(String(style.backgroundImage), new RegExp(`icon_time_sheet${x1 === 96 ? "" : `-${x1}`}\\.png"\\) 1x, url\\("[^"]*icon_time_sheet${x2 === 96 ? "" : `-${x2}`}\\.png"\\) 2x`));
    assert.equal(style.backgroundSize, `${4 * size}px ${size}px`);
    assert.equal(style.backgroundPosition, `${-size}px 0`);
  }
  assert.ok(Object.values(UI_ICON_SHEETS).every(sheet => sheet in UI_ART_MANIFEST.iconSheets));
});

test("Given the skin stylesheet When its urls are read Then each is an installed P0 file", () => {
  const css = read("src/styles/uiSkin.css");
  const urls = [...css.matchAll(/url\("\/(assets\/ui-p0\/[^"]+)"\)/g)].map(match => match[1]!);
  assert.ok(urls.length >= 30);
  assert.deepEqual([...new Set(urls)].filter(url => !existsSync(join(ROOT, "public", url))), []);
});

test("Given the UI components When their markup source is scanned Then no emoji or symbol stands in for an icon (UX-2 gate 1)", () => {
  const files = [...readdirSync(join(ROOT, "src/ui")).filter(file => file.endsWith(".tsx")).map(file => `src/ui/${file}`),
    ...readdirSync(join(ROOT, "src/ui/tutorial")).filter(file => file.endsWith(".tsx")).map(file => `src/ui/tutorial/${file}`)];
  const offenders = files.flatMap(file => read(file).split("\n").map((line, index) => ({ file, line: index + 1, text: line }))
    .filter(({ text }) => !text.trim().startsWith("//") && !text.trim().startsWith("*") && /[🔒▲◆✓✗⌂⌫⌁≡△⌄]/u.test(text)))
    .map(({ file, line }) => `${file}:${line}`);
  assert.deepEqual(offenders, []);
  assert.doesNotMatch(read("src/ui/tutorial/tutorialCopy.ko.ts"), /stewardMonogram|✓/);
});

test("Given a steward line When it shows Then the portrait wears the tone's expression and the frame follows the tone", () => {
  const markup = renderToStaticMarkup(createElement(StewardAdvisor, { advisor: { text: "좋습니다.", key: "well_done", tone: "success" }, onDismiss: () => undefined }));
  assert.match(markup, /steward-advisor--success/);
  assert.match(markup, /advisor_steward_portrait_success-96\.png&quot;\) 1x, url\(&quot;[^&]*advisor_steward_portrait_success\.png&quot;\) 2x/);
  assert.doesNotMatch(markup, />청</);
  const controller = read("src/ui/tutorial/useTutorialController.ts");
  const tones = controller.match(/const ADVISOR_TONE[^{]*\{([^}]*)\}/)?.[1] ?? "";
  const advisorKeys = Object.keys(TUTORIAL_COPY.advisor);
  for (const key of advisorKeys) assert.match(tones, new RegExp(`\\b${key}: "(neutral|concern|success)"`), key);
});
