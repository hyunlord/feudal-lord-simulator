/**
 * BUDGET-1b chapter-scoped startup art (src/render/chapterArt.ts): a chapter-1 campaign start leaves out the war props
 * (chapter 2, with the Wave 12 quay) and the plague-shut houses (chapter 3); entering a chapter adds its art; the
 * sandbox takes everything. The last tests run the runtime's own preload through scripts/checks/startupArtList.ts: any
 * url CHAPTER_ART declares for chapter N must be out of the startup set before chapter N and in it from chapter N on.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { GameState } from "../src/engine/engine.types";
import { artChapterLimit, artForChapter, CHAPTER_ART, chapterOfArt } from "../src/render/chapterArt";
import { historicalFacilityManifest } from "../src/render/historicalFacilityManifest";
import { WAVE9_IMAGES } from "../src/render/wave9ArtManifest.generated";
import { WAVE17_WORLD_IMAGES } from "../src/render/wave17WorldManifest.generated";
import { WAVE21_IMAGES } from "../src/ui/wave21ArtManifest.generated";
import { WAVE31_IMAGES } from "../src/ui/wave31ArtManifest.generated";
import { WAVE33_IMAGES } from "../src/ui/wave33ArtManifest.generated";
import { WAVE12_GUILDHALL_IMAGES } from "../src/render/wave12GuildhallManifest.generated";
import { WAVE17_WALKER_IMAGES } from "../src/render/wave17WalkerManifest.generated";

const WAR = Object.values(WAVE17_WORLD_IMAGES).map(image => image.url);
const PLAGUE = [WAVE9_IMAGES.event_plague_shut_l1.url, WAVE9_IMAGES.event_plague_shut_l2.url, WAVE9_IMAGES.event_plague_shut_l3.url];
// UI-9: Wave 21 split into chapter 3 (ch3_*, with PLAGUE-b's Wave 31 opening painting) and chapter 4 (ch4_*).
const WAVE21_CH3 = [...(Object.keys(WAVE21_IMAGES) as (keyof typeof WAVE21_IMAGES)[]).filter(k => k.startsWith("ch3_")).map(k => WAVE21_IMAGES[k].url),
  ...Object.values(WAVE31_IMAGES).filter(image => image.chapter === 3).map(image => image.url)];
const WAVE21_CH4 = [...(Object.keys(WAVE21_IMAGES) as (keyof typeof WAVE21_IMAGES)[]).filter(k => k.startsWith("ch4_")).map(k => WAVE21_IMAGES[k].url),
  ...Object.values(WAVE31_IMAGES).filter(image => image.chapter === 4).map(image => image.url)];
const WAVE21 = [...WAVE21_CH3, ...WAVE21_CH4];
const GUILDHALL = Object.values(WAVE12_GUILDHALL_IMAGES).map(image => image.url); // UI-9: chapter 4 guildhall prop
// UI-9b: the lord's collector (chapter 4, the 1381 chase) and chapter 5's opening painting.
const COLLECTOR = Object.values(WAVE17_WALKER_IMAGES).map(image => image.url);
const CH5_INTRO = Object.values(WAVE31_IMAGES).filter(image => image.chapter === 5).map(image => image.url);
// UI-10: chapter 5's Wave 21 art (ch5_*) and its Wave 33 interlude events (1384–1400).
const WAVE21_CH5 = (Object.keys(WAVE21_IMAGES) as (keyof typeof WAVE21_IMAGES)[]).filter(k => k.startsWith("ch5_")).map(k => WAVE21_IMAGES[k].url);
const INTERLUDE = Object.values(WAVE33_IMAGES).map(image => image.url);
const CHAPTER_5 = [...WAVE21_CH5, ...INTERLUDE];
const EVERY_CHAPTER = [...historicalFacilityManifest.map(meta => meta.url), WAVE9_IMAGES.event_burnt_l2.url, WAVE9_IMAGES.event_crowd_manor_gate.url];
const URLS = [...EVERY_CHAPTER, ...WAR, ...PLAGUE, ...WAVE21, ...GUILDHALL, ...CHAPTER_5];

type ChapterState = Pick<GameState, "scenarioId" | "politics">;
const SANDBOX: ChapterState = { scenarioId: "core:sandbox" };
const campaign = (chapter: number | null): ChapterState => chapter === null ? { scenarioId: "core:campaign_market_town" } : { scenarioId: "core:campaign_market_town",
  politics: { chapter: { number: chapter, startTick: 0, populationStart: 0, peakPopulation: 0 } } as NonNullable<GameState["politics"]> };

test("each image's chapter: war props 2, plague-shut houses 3, guildhall 4, chapter-5 art 5, the rest 1", () => {
  assert.ok(WAR.includes("assets/wave12/world/quay-v1.png"));
  for (const url of WAR) assert.equal(chapterOfArt(url), 2, url);
  for (const url of PLAGUE) assert.equal(chapterOfArt(url), 3, url);
  for (const url of GUILDHALL) assert.equal(chapterOfArt(url), 4, url); // UI-9: chapter 4 guildhall prop
  assert.deepEqual([WAVE21_CH5.length, INTERLUDE.length], [20, 5]); // UI-10
  for (const url of CHAPTER_5) assert.equal(chapterOfArt(url), 5, url); // UI-10: ch5_* and the interlude
  for (const url of EVERY_CHAPTER) assert.equal(chapterOfArt(url), 1, url);
  assert.equal(chapterOfArt(`/${WAR[0]}`), 2, "a base-prefixed url is the same image");
});

test("a chapter-1 start leaves out later chapters' art; entering chapter N adds its art", () => {
  assert.deepEqual(artForChapter(URLS, 1), EVERY_CHAPTER);
  assert.deepEqual(artForChapter(URLS, 2), [...EVERY_CHAPTER, ...WAR]);
  assert.deepEqual(artForChapter(URLS, 3), [...EVERY_CHAPTER, ...WAR, ...PLAGUE, ...WAVE21_CH3]);
  assert.deepEqual(artForChapter(URLS, 4), [...EVERY_CHAPTER, ...WAR, ...PLAGUE, ...WAVE21, ...GUILDHALL]);
  assert.deepEqual(artForChapter(URLS, 5), URLS);
});

test("the limit: the campaign's chapter being played (1 before politics), the sandbox every chapter", () => {
  assert.equal(artChapterLimit(campaign(null)), 1);
  assert.equal(artChapterLimit(campaign(1)), 1);
  assert.equal(artChapterLimit(campaign(2)), 2);
  assert.equal(artChapterLimit(campaign(4)), 4);
  assert.equal(artChapterLimit(SANDBOX), Number.POSITIVE_INFINITY);
  assert.deepEqual(artForChapter(URLS, artChapterLimit(SANDBOX)), URLS);
});

const lists = (() => {
  const script = fileURLToPath(new URL("../scripts/checks/startupArtList.ts", import.meta.url));
  const tsx = fileURLToPath(new URL("../node_modules/.bin/tsx", import.meta.url));
  return JSON.parse(execFileSync(tsx, [script], { encoding: "utf8" })) as { chapters: { chapter: number; paths: string[] }[]; all: string[] };
})();
const chapter = (n: number) => new Set(lists.chapters.find(entry => entry.chapter === n)!.paths);
const all = new Set(lists.all);

test("no art CHAPTER_ART declares for a later chapter is in the startup set before that chapter", () => {
  assert.ok(CHAPTER_ART.length > 0);
  for (const entry of CHAPTER_ART) {
    assert.ok(entry.chapter >= 2 && entry.urls.length > 0, entry.what);
    for (const url of entry.urls) {
      // A declared url no startup loader requests would be a typo or an art the preload never reaches.
      assert.ok(all.has(url), `${entry.what}: ${url} is in the whole (sandbox) preload`);
      for (const { chapter: n, paths } of lists.chapters) {
        assert.equal(paths.includes(url), n >= entry.chapter, `${entry.what}: ${url} ${n >= entry.chapter ? "in" : "out of"} the chapter-${n} startup set`);
      }
    }
  }
});

test("the runtime's startup preload requests later chapters' art only once the game is in them", () => {
  for (const url of [...WAR, ...PLAGUE, ...WAVE21, ...GUILDHALL, ...COLLECTOR, ...CH5_INTRO, ...CHAPTER_5]) {
    assert.ok(all.has(url), `the sandbox preloads ${url}`);
    assert.ok(!chapter(1).has(url), `a chapter-1 start leaves out ${url}`);
  }
  for (const url of WAR) assert.ok(chapter(2).has(url), `chapter 2 adds ${url}`);
  for (const url of PLAGUE) assert.ok(!chapter(2).has(url) && chapter(3).has(url), `chapter 3 adds ${url}`);
  // UI-9: ch3_* wave21 art is chapter 3; ch4_* wave21 art and the guildhall are chapter 4.
  for (const url of WAVE21_CH3) assert.ok(!chapter(2).has(url) && chapter(3).has(url), `chapter 3 adds wave21 ch3 ${url}`);
  for (const url of WAVE21_CH4) assert.ok(!chapter(3).has(url) && chapter(4).has(url), `chapter 4 adds wave21 ch4 ${url}`);
  for (const url of GUILDHALL) assert.ok(!chapter(3).has(url) && chapter(4).has(url), `chapter 4 adds guildhall ${url}`);
  for (const url of COLLECTOR) assert.ok(!chapter(3).has(url) && chapter(4).has(url), `chapter 4 adds the collector ${url}`);
  assert.equal(CH5_INTRO.length, 1);
  for (const url of CH5_INTRO) assert.ok(!chapter(4).has(url) && chapter(5).has(url), `chapter 5 adds its opening ${url}`);
  // UI-10: ch5_* wave21 art and the Wave 33 interlude are chapter 5.
  for (const url of CHAPTER_5) assert.ok(!chapter(4).has(url) && chapter(5).has(url), `chapter 5 adds ${url}`);
  assert.deepEqual([...all].filter(url => !chapter(1).has(url)).sort(), [...WAR, ...PLAGUE, ...WAVE21, ...GUILDHALL, ...COLLECTOR, ...CH5_INTRO, ...CHAPTER_5].sort(), "only chapter-bound art is deferred");
  for (const url of historicalFacilityManifest.map(meta => meta.url)) assert.ok(chapter(1).has(url), `stage-gated ${url} stays at startup`);
});
