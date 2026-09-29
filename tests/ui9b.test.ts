import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { COLLECTOR_SCALE } from "../src/render/collectorWalker";
import { WALKER_FIGURE_PX } from "../src/render/walkerComposer";
import { WAVE17_WALKER_IMAGES } from "../src/render/wave17WalkerManifest.generated";
import { FACTION_PAGE_SLOTS, FactionPage } from "../src/ui/chronicle/FactionPage";
import { CHRONICLE_COPY } from "../src/ui/chronicleCopy.ko";
import { armsKey, armsRecipe, heraldryArms, looksRoyal, ROYAL_LOOKALIKES } from "../src/ui/heraldry/heraldry";
import { chapterIntro } from "../src/ui/wave31Art";

// UI-9b: the short fixes after UI-9 — royal-looking arms banned, the revolt pressure a cell on the faction page, the
// lord's collector from Wave 17, chapter 5's opening painting.

test("UI-9b arms: no house or faction bears a golden lily on blue or a golden lion on red", () => {
  assert.deepEqual(ROYAL_LOOKALIKES.map(rule => `${rule.charge}.${rule.tincture}.${rule.colour}`), ["fleur_de_lis.or.azure", "lion_passant.or.gules"]);
  let royal = 0;
  for (let seed = 0; seed < 2000; seed++) {
    for (const household of ["heraldry", "manor", "household-3"]) {
      const recipe = armsRecipe(seed, household);
      if (looksRoyal(recipe)) royal++;
    }
  }
  assert.equal(royal, 0);
  // The two seeds that bore France's colours before: the blue gives way, the lily and the rest stay.
  assert.equal(armsKey(heraldryArms(3)), "knightly.sable.barry.vert...fleur_de_lis.or");
  assert.equal(armsKey(heraldryArms(40)), "rounded.gules.per_bend.vert...fleur_de_lis.or");
  // Every other shield is the one it was (the picks keep their order): three pinned from before the change.
  assert.equal(armsKey(heraldryArms(0)), "rounded.gules.per_pale.sable...cartwheel.or");
  assert.equal(armsKey(heraldryArms(1)), "knightly.gules.paly.azure...stag_head.or");
  assert.equal(armsKey(heraldryArms(2)), "heater.sable.per_saltire.gules...boar.or");
});

const pressure = { total: 50, totalLabel: "압력 합계: 50", thresholdLine: "50 이상이면 징수원을 쫓는다",
  causes: [{ key: "direct", line: "직접 징수 +40" }, { key: "cloth", line: "직물 전문화 +10" }], outcome: "소문 결과: 징수원을 쫓았습니다" };
const commons = (revoltPressure: typeof pressure | null) => renderToStaticMarkup(createElement(FactionPage, { scale: 0.75, onRecord: () => undefined,
  view: { id: "commons", name: "농민 공동체", kind: "평민", emblem: { kind: "none" }, emblemLabel: "문장", leader: null,
    relation: 10, relationX: 0.55, relationText: "우호 +10", demands: [], promises: [], memory: [], timeline: [], revoltPressure } as never }));

test("UI-9b faction page: the revolt pressure is a cell inside the page, under their timeline, scrolling in its own box", () => {
  const markup = commons(pressure);
  const article = markup.slice(markup.indexOf("<article"), markup.indexOf("</article>"));
  assert.match(article, /class="chronicle-faction-box chronicle-faction-pressure"/, "inside the page");
  assert.equal(markup.slice(markup.indexOf("</article>")).includes("chronicle-faction-pressure"), false, "nothing after the page");
  assert.match(article, /chronicle-faction-pressure-body" tabindex="0"/, "its reading scrolls (keyboard reachable)");
  for (const line of ["압력 합계: 50", "직접 징수 +40", "직물 전문화 +10", "소문 결과: 징수원을 쫓았습니다"]) assert.ok(article.includes(line), line);
  // The foot box's right half: the timeline above, the pressure below, inside the box the art prints (326..594, 528..746).
  const top = (slot: { readonly top?: unknown; readonly height?: unknown }): [number, number] => [parseFloat(String(slot.top)) * 8, parseFloat(String(slot.height)) * 8];
  const [timelineTop, timelineHeight] = top(FACTION_PAGE_SLOTS.theirEventsAbovePressure);
  const [pressureTop, pressureHeight] = top(FACTION_PAGE_SLOTS.pressure);
  assert.ok(timelineTop === 528 && timelineTop + timelineHeight <= pressureTop && pressureTop + pressureHeight <= 746);
  // Without pressure (every other faction, and the commons before chapter 4) the timeline keeps the whole half.
  assert.equal(commons(null).includes("chronicle-faction-pressure"), false);
  assert.match(readFileSync(new URL("../src/styles/chronicle.css", import.meta.url), "utf8"), /\.chronicle-faction-pressure-body \{ min-height: 0; overflow-y: auto;/);
});

test("UI-9b collector: Wave 17 wk_tax_collector with each cell's foot from the batch's frame_pivots.csv", () => {
  const meta = WAVE17_WALKER_IMAGES.wk_tax_collector;
  assert.deepEqual(meta.frames, { width: 74, height: 74, count: 4, rows: 2 });
  assert.deepEqual(meta.directions, ["NE", "SE", "SW", "NW"]);
  const csv = readFileSync(new URL("../assets-inbox/wave17/candidates-20260926/records/frame_pivots.csv", import.meta.url), "utf8").split(/\r?\n/)
    .filter(line => line.startsWith('"assets/wk/wk_tax_collector-v1.png"')).map(line => line.split(",").map(cell => cell.replaceAll('"', "")));
  assert.equal(csv.length, 8);
  for (const [, direction, frame, x, y] of csv) {
    assert.deepEqual(meta.feet[direction as "NE"][Number(frame)], { x: Math.round(Number(x) * 100) / 100, y: Number(y) });
  }
  assert.equal(COLLECTOR_SCALE, WALKER_FIGURE_PX / meta.figureHeight);
  const chase = readFileSync(new URL("../src/render/reorgWorldProps.ts", import.meta.url), "utf8");
  assert.match(chase, /\{ key: "wk_tax_collector", lag: 0, side: 0 \}/, "the collector leads the chase");
  assert.equal(chase.includes('key: "wk_royal_messenger"'), false, "no stand-in");
});

test("UI-9b chapter 5 opens over its Wave 31 painting (the opening screen and the chronicle's chapter start)", () => {
  assert.equal(chapterIntro(3), "chapter3_intro");
  assert.equal(chapterIntro(4), "chapter4_intro");
  assert.equal(chapterIntro(5), "chapter5_intro");
  assert.equal(CHRONICLE_COPY.chapterOpening[5]?.title, "제5장 · 자치와 유산 · 1400–1450");
  assert.equal(CHRONICLE_COPY.chapterOpening[5]?.start, "제5장 시작");
});

test("UI-9b pastoral farm: the pen's diamond cut from the Wave 2 paintings fills the 2 x 1 plot (R0-2 width, no wider)", async () => {
  const { historicalFacilityManifest } = await import("../src/render/historicalFacilityManifest");
  const farms = historicalFacilityManifest.filter(entry => entry.kind === "pastoral_farm");
  assert.deepEqual(farms.map(entry => entry.url), ["spring", "summer", "winter"].map(season => `assets/wave2/bld/farm_pastoral_${season}_fit.png`));
  for (const farm of farms) {
    assert.deepEqual([farm.width, farm.height], [272, 136]);
    // The pen drawn about 1.4 x its UI-9 size (the full painting was 384 px wide at about 106 px).
    assert.ok(farm.displayWidth / farm.width > 1.35 * (106 / 384), `${farm.id} ${farm.displayWidth}`);
  }
});
