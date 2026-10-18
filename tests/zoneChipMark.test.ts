/**
 * LS1-15 (the user's ruling 2026-10-18: the 1280 x 800 zone state with held decisions at 10.2 % of its 10.0 %): while the
 * zone tools are open a rail chip is a colour mark and its time left — its picture and name hidden by the stylesheet, its
 * whole name still its accessible name; the near look stays and a press still opens its card. The tools closed, as before.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { StoryBeat } from "../src/ui/eventStory";
import { EventCards } from "../src/ui/hud/EventCards";

const beat = (id: string, title: string, chip?: string): StoryBeat => ({ id, kind: "home_petition", illustration: null, tile: null, title, chip,
  line: "", facts: [], advice: "", decision: "estate_petition" });

test("every chip carries its mark; a held one says so (data-due), its name stays in its accessible name", () => {
  const due = new Map([["held:audit", { left: "이번 철까지", short: "이번 철", near: true }]]);
  const markup = renderToStaticMarkup(createElement(EventCards, { beats: [beat("held:audit", "빠진 돈과 회계 담당자", "감사"), beat("family:1", "아들이 태어났다")],
    due, openId: null, onOpen: () => undefined, onDismiss: () => undefined, onDecide: () => undefined }));
  const chips = [...markup.matchAll(/<button[^>]*class="[^"]*event-chip[^"]*"[^>]*>.*?<\/button>/g)].map(match => match[0]);
  assert.equal(chips.length, 2);
  for (const chip of chips) assert.match(chip, /<span class="event-chip-mark" aria-hidden="true"><\/span>/);
  assert.match(chips[0]!, /data-near="true" data-due="true"/);
  assert.match(chips[0]!, /aria-label="[^"]*빠진 돈과 회계 담당자 · 이번 철까지/);
  assert.match(chips[0]!, /event-chip-due">이번 철</);
  assert.doesNotMatch(chips[1]!, /data-due/);
  assert.match(chips[1]!, /aria-label="[^"]*아들이 태어났다/);
});

test("the short form holds only while the zone tools are open, in palette colours; the mark is hidden otherwise", () => {
  const css = readFileSync(new URL("../src/styles/hudShell.css", import.meta.url), "utf8");
  const zone = ".app-shell:has(.zone-toolbar:not([hidden]))";
  assert.match(css, /\.app-shell \.event-chip-mark \{ display: none; \}/);
  assert.ok(css.includes(`${zone} .event-chip :is(.event-chip-art, .event-chip-name) { display: none; }`));
  for (const rule of [`${zone} .event-chip-mark {`, `${zone} .event-chip[data-due="true"] .event-chip-mark {`, `${zone} .event-chip[data-near="true"] .event-chip-mark {`]) {
    const at = css.indexOf(rule); assert.ok(at >= 0, rule);
    assert.match(css.slice(at, css.indexOf("}", at)), /background-color: var\(--palette-[a-z-]+\)/);
  }
  assert.ok(css.includes(`${zone} .event-chip { justify-content: center; min-width: 44px;`), "a 44 px target");
});
