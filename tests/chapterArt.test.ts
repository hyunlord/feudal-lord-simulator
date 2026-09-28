/**
 * BUDGET-1b chapter-scoped startup art (src/render/chapterArt.ts): a chapter-1 campaign start leaves out the war props
 * (chapter 2, with the Wave 12 quay) and the plague-shut houses (chapter 3); entering a chapter adds its art; the
 * sandbox takes everything. The last test runs the runtime's own preload through scripts/checks/startupArtList.ts.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { GameState } from "../src/engine/engine.types";
import { artChapterLimit, artForChapter, chapterOfArt } from "../src/render/chapterArt";
import { historicalFacilityManifest } from "../src/render/historicalFacilityManifest";
import { WAVE9_IMAGES } from "../src/render/wave9ArtManifest.generated";
import { WAVE17_WORLD_IMAGES } from "../src/render/wave17WorldManifest.generated";

const WAR = Object.values(WAVE17_WORLD_IMAGES).map(image => image.url);
const PLAGUE = [WAVE9_IMAGES.event_plague_shut_l1.url, WAVE9_IMAGES.event_plague_shut_l2.url, WAVE9_IMAGES.event_plague_shut_l3.url];
const EVERY_CHAPTER = [...historicalFacilityManifest.map(meta => meta.url), WAVE9_IMAGES.event_burnt_l2.url, WAVE9_IMAGES.event_crowd_manor_gate.url];
const URLS = [...EVERY_CHAPTER, ...WAR, ...PLAGUE];

type ChapterState = Pick<GameState, "scenarioId" | "politics">;
const SANDBOX: ChapterState = { scenarioId: "core:sandbox" };
const campaign = (chapter: number | null): ChapterState => chapter === null ? { scenarioId: "core:campaign_market_town" } : { scenarioId: "core:campaign_market_town",
  politics: { chapter: { number: chapter, startTick: 0, populationStart: 0, peakPopulation: 0 } } as NonNullable<GameState["politics"]> };

test("each image's chapter: the war props (with the Wave 12 quay) 2, the plague-shut houses 3, the rest 1", () => {
  assert.ok(WAR.includes("assets/wave12/world/quay-v1.png"));
  for (const url of WAR) assert.equal(chapterOfArt(url), 2, url);
  for (const url of PLAGUE) assert.equal(chapterOfArt(url), 3, url);
  for (const url of EVERY_CHAPTER) assert.equal(chapterOfArt(url), 1, url);
  assert.equal(chapterOfArt(`/${WAR[0]}`), 2, "a base-prefixed url is the same image");
});

test("a chapter-1 start leaves out later chapters' art; entering chapter N adds its art", () => {
  assert.deepEqual(artForChapter(URLS, 1), EVERY_CHAPTER);
  assert.deepEqual(artForChapter(URLS, 2), [...EVERY_CHAPTER, ...WAR]);
  assert.deepEqual(artForChapter(URLS, 3), URLS);
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

test("the runtime's startup preload requests later chapters' art only once the game is in them", () => {
  const script = fileURLToPath(new URL("../scripts/checks/startupArtList.ts", import.meta.url));
  const tsx = fileURLToPath(new URL("../node_modules/.bin/tsx", import.meta.url));
  const lists = JSON.parse(execFileSync(tsx, [script], { encoding: "utf8" })) as { chapters: { chapter: number; paths: string[] }[]; all: string[] };
  const chapter = (n: number) => new Set(lists.chapters.find(entry => entry.chapter === n)!.paths);
  const all = new Set(lists.all);
  for (const url of [...WAR, ...PLAGUE]) {
    assert.ok(all.has(url), `the sandbox preloads ${url}`);
    assert.ok(!chapter(1).has(url), `a chapter-1 start leaves out ${url}`);
  }
  for (const url of WAR) assert.ok(chapter(2).has(url), `chapter 2 adds ${url}`);
  for (const url of PLAGUE) assert.ok(!chapter(2).has(url) && chapter(3).has(url), `chapter 3 adds ${url}`);
  assert.deepEqual([...all].filter(url => !chapter(1).has(url)).sort(), [...WAR, ...PLAGUE].sort(), "only chapter-bound art is deferred");
  for (const url of historicalFacilityManifest.map(meta => meta.url)) assert.ok(chapter(1).has(url), `stage-gated ${url} stays at startup`);
});
