/**
 * UI-9 chapter 4 screens: chapter art deferred to chapter 4, chronicle stats, chapter copy, and season strip marks.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { WAVE21_IMAGES } from "../src/ui/wave21ArtManifest.generated";
import { chapterOfArt } from "../src/render/chapterArt";
import { CHAPTER_COPY } from "../src/ui/chapterCopy.ko";
import { CHRONICLE_COPY } from "../src/ui/chronicleCopy.ko";
import { reorgRecordArt } from "../src/ui/chronicleModel";
import { SEASON_STRIP_COPY } from "../src/ui/seasonStripCopy.ko";
import type { ChronicleEntry } from "../src/engine/politics.types";

// ---------------------------------------------------------------------------------------------------------------
// Art chapter bindings.

test("ch4_* Wave 21 art is bound to chapter 4", () => {
  const ch4Keys = (Object.keys(WAVE21_IMAGES) as (keyof typeof WAVE21_IMAGES)[]).filter(k => k.startsWith("ch4_"));
  assert.ok(ch4Keys.length > 0, "must have at least one ch4_ image");
  for (const key of ch4Keys) {
    const url = WAVE21_IMAGES[key].url;
    assert.equal(chapterOfArt(url), 4, `${key} (${url}) must be chapter 4`);
  }
});

test("ch3_* Wave 21 art remains bound to chapter 3", () => {
  const ch3Keys = (Object.keys(WAVE21_IMAGES) as (keyof typeof WAVE21_IMAGES)[]).filter(k => k.startsWith("ch3_"));
  assert.ok(ch3Keys.length > 0, "must have at least one ch3_ image");
  for (const key of ch3Keys) {
    const url = WAVE21_IMAGES[key].url;
    assert.equal(chapterOfArt(url), 3, `${key} must still be chapter 3`);
  }
});

// ---------------------------------------------------------------------------------------------------------------
// Chapter copy.

test("CHAPTER_COPY has title and goal for chapter 4", () => {
  assert.ok(typeof CHAPTER_COPY.titles[4] === "string" && CHAPTER_COPY.titles[4].includes("재편"), "chapter 4 title");
  assert.ok(typeof CHAPTER_COPY.goals["charter"] === "string" && CHAPTER_COPY.goals["charter"].length > 0, "charter goal");
});

// ---------------------------------------------------------------------------------------------------------------
// Chronicle copy stats — chapter 4 reorganisation lines.

function makeStats(overrides: Partial<ChronicleEntry["stats"]> = {}): ChronicleEntry["stats"] {
  return {
    populationStart: 120, populationEnd: 135, peakPopulation: 140,
    houses: 40, burntHouses: 0, departures: 2, harvestLost: 0, treasury: 300,
    famine: null,
    ...overrides,
  };
}

test("CHRONICLE_COPY.stats produces reorganisation lines when reorganisation is present", () => {
  const statsWithReorg = makeStats({
    reorganisation: {
      startYear: 1362, wageLeavers: 3, weaverLeavers: 1,
      clothSold: 45, clothIncome: 180, guild: true,
      pollTax: 24, rebellion: "quiet", charter: "partial",
      townInfluence: 62, merchantInfluence: 38,
    },
  });
  const lines = CHRONICLE_COPY.stats(statsWithReorg, 4);
  const joined = lines.join("\n");
  assert.ok(joined.includes("재편 시작"), "must include start year label");
  assert.ok(joined.includes("1362"), "must include start year");
  assert.ok(joined.includes("길드"), "must include guild label");
  assert.ok(joined.includes("있음"), "guild=true must say 있음");
  assert.ok(joined.includes("특허"), "must include charter label");
  assert.ok(joined.includes("조용히"), "quiet rebellion label");
});

test("CHRONICLE_COPY.stats produces no reorganisation lines when reorganisation is absent", () => {
  const lines = CHRONICLE_COPY.stats(makeStats(), 4);
  const joined = lines.join("\n");
  assert.ok(!joined.includes("재편"), "no reorg label without reorganisation field");
});

// ---------------------------------------------------------------------------------------------------------------
// Season strip copy — reorganisation step labels.

test("SEASON_STRIP_COPY.reorg covers all ReorganisationStepIds", () => {
  const expected = [
    "wage_competition", "textile_street", "alehouse_boom", "petitions_surge",
    "guild_demand", "cloth_or_grain", "overlord_warning", "poll_tax",
    "rebellion_rumour", "autonomy_request", "end",
  ] as const;
  for (const id of expected) {
    assert.ok(typeof SEASON_STRIP_COPY.reorg[id] === "string" && SEASON_STRIP_COPY.reorg[id].length > 0,
      `SEASON_STRIP_COPY.reorg.${id} must be a non-empty string`);
  }
});

test("UI-9: each reorganisation line has its Wave 21 chapter-4 picture; the chase only when the collectors were chased", () => {
  const art = (template: string, params: Record<string, unknown> = {}) => reorgRecordArt({ template, params } as never);
  for (const template of ["reorg.wage_competition", "reorg.textile_street", "reorg.alehouse_boom", "reorg.petitions_surge", "reorg.guild_founded",
    "reorg.overlord_warning", "reorg.poll_tax", "reorg.rebellion_rumour", "reorg.autonomy_request", "reorg.charter"]) {
    const id = art(template);
    assert.ok(id !== null && id in WAVE21_IMAGES && id.startsWith("ch4_"), `${template}: ${id}`);
  }
  assert.equal(art("reorg.rebellion_rumour", { outcome: "chased" }), "ch4_chronicle_rebellion_rumour");
  assert.equal(art("reorg.rebellion_rumour", { outcome: "quiet" }), "ch4_chronicle_petitions");
  assert.equal(art("plague.rumour"), null);
});
