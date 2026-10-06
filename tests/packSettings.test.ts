import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { BALANCE, PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { CHAPTER_FIVE, CHAPTER_FOUR, CHAPTER_ONE, CHAPTER_THREE, CHAPTER_TWO } from "../src/content/chapterConfig";
import { LEGACY_BALANCE } from "../src/content/legacyConfig";
import {
  CORE_PACK_SETTINGS, currencyUnitValue, DAYS_PER_SEASON, packChapter, packEraYear, SEASON_TICKS, tickOfSeason, yearIndexOf,
} from "../src/content/packSettings";
import { PLAGUE_BALANCE } from "../src/content/plagueConfig";
import { REORGANISATION_BALANCE } from "../src/content/reorganisationConfig";
import { CORE_SCENARIOS } from "../src/content/scenario/coreScenarios";
import { WAR_BALANCE } from "../src/content/warConfig";
import { calendar } from "../src/engine/scenarioState";
import { moneyWordsFull } from "../src/ledger/moneyWords.ko";

// EXT-2 (docs/design/ext-2-plan.md): the core pack's time and money are settings, and the rules read them from there.

test("the calendar is the pack's: the year's ticks, its seasons and days, and the date of a tick", () => {
  const { calendar: settings } = CORE_PACK_SETTINGS;
  assert.equal(BALANCE.TICKS_PER_YEAR, settings.ticksPerYear);
  assert.equal(PRESSURE_BALANCE.seasonTicks, SEASON_TICKS);
  assert.equal(SEASON_TICKS * settings.seasonsPerYear, settings.ticksPerYear);
  assert.equal(DAYS_PER_SEASON * settings.seasonsPerYear, settings.daysPerYear);
  const lastSeason = settings.seasonsPerYear - 1;
  const tick = tickOfSeason(settings.startYear + 2, lastSeason, settings.startYear) + 1;
  assert.deepEqual(calendar(tick, settings.startYear), { year: settings.startYear + 2, season: lastSeason, dayOfYear: lastSeason * DAYS_PER_SEASON + 1 });
  assert.equal(yearIndexOf(tick), 2);
});

test("every core scenario starts in the pack's start year, and the campaign ends on the pack's last market day", () => {
  for (const scenario of CORE_SCENARIOS) assert.equal(scenario.startYear, CORE_PACK_SETTINGS.calendar.startYear, scenario.id);
  assert.equal(LEGACY_BALANCE.lastMarketYear, CORE_PACK_SETTINGS.calendar.end.year);
  assert.equal(LEGACY_BALANCE.lastMarketSeason, CORE_PACK_SETTINGS.calendar.end.season);
});

test("the chapters' years and the years the chapter rules end on are the pack's chapters", () => {
  assert.deepEqual([CHAPTER_ONE, CHAPTER_TWO, CHAPTER_THREE, CHAPTER_FOUR, CHAPTER_FIVE].map(({ chapter, fromYear, toYear }) => ({ chapter, fromYear, toYear })),
    CORE_PACK_SETTINGS.chapters);
  assert.equal(WAR_BALANCE.chapterEndYear, packChapter(3).fromYear);
  assert.equal(PLAGUE_BALANCE.chapterEndFromYear, packChapter(4).fromYear);
  assert.equal(PLAGUE_BALANCE.chapterEndYear, packChapter(3).toYear);
  assert.equal(REORGANISATION_BALANCE.chapterEndYear, packChapter(4).toYear);
  assert.throws(() => packChapter(9), /no chapter 9/);
});

test("the historical eras begin in the pack's years, in the pack's order", () => {
  for (const scenario of CORE_SCENARIOS) {
    assert.deepEqual(scenario.eras.map(era => era.id), CORE_PACK_SETTINGS.eras.map(era => era.id), scenario.id);
    for (const era of scenario.eras) assert.equal(era.enterWhen.yearAtLeast, packEraYear(era.id), `${scenario.id} ${era.id}`);
  }
  assert.throws(() => packEraYear("ice_age"), /no era "ice_age"/);
});

test("money is written in the pack's units", () => {
  const pound = currencyUnitValue("pound");
  const shilling = currencyUnitValue("shilling");
  assert.equal(moneyWordsFull(3 * pound + 4 * shilling + 5), "£3 4s 5d");
  assert.deepEqual(CORE_PACK_SETTINGS.currency.units.map(unit => unit.value), [...CORE_PACK_SETTINGS.currency.units.map(unit => unit.value)].sort((a, b) => b - a));
  assert.throws(() => currencyUnitValue("florin"), /no money unit "florin"/);
});

test("the engine keeps no tick counts of its own for a year or a season (it reads the pack's)", () => {
  const root = resolve(import.meta.dirname, "../src");
  const own = /const (?:SEASON|YEAR|SEASON_TICKS|YEAR_TICKS|DAYS_PER_YEAR|DAYS_PER_SEASON) = [\d_]+;/;
  const found: string[] = [];
  for (const folder of ["engine", "population", "save", "ledger", "economy", "zones", "agents"]) {
    let names: string[];
    try { names = readdirSync(join(root, folder), { recursive: true }) as string[]; } catch { continue; }
    for (const name of names.filter(entry => entry.endsWith(".ts"))) {
      const text = readFileSync(join(root, folder, name), "utf8");
      if (own.test(text)) found.push(`${folder}/${name}`);
    }
  }
  assert.deepEqual(found, []);
});
