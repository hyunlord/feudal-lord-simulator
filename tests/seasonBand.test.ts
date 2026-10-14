/**
 * LS1-2 (lord-screen-v1.md): the season-turn band — what changed in the town in the season that closed, each a difference
 * of two season-end states (P-D4): the people and the treasury from the engine's closed season, the houses, their levels,
 * the other buildings, the fields and the town's dead from two snapshots, the steward's small matters; only what is not
 * zero, in the design's order, at most five; a quiet season says so. LS1-1: one completion toast a season in lord mode.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { SeasonLedger } from "../src/engine/season.types";
import { SEASON_BAND_COPY } from "../src/ui/lord/seasonBand/seasonBandCopy.ko";
import { SEASON_BAND_MAX, seasonBand, seasonDeathCauses, townSnapshot, type TownSnapshot } from "../src/ui/lord/seasonBand/seasonBandModel";
import { toastLetThrough } from "../src/ui/lord/seasonBand/toastLimit";
import { clearTownCloses, recordTownClose, townYearEnds } from "../src/ui/lord/seasonBand/townCloses";
import { lordTownYear } from "../src/ui/results/lordYearReview";
import { RESULTS_COPY } from "../src/ui/results/resultsCopy.ko";
import { moneyFull } from "../src/ui/money.ko";

const season = (popDelta: number, income: number, expense: number): SeasonLedger => ({ season: 1, year: 1300, startTick: 1_000, endTick: 2_000, income, expense,
  stockDelta: { bread: 0, wheat: 0, timber: 0, stone: 0 }, popDelta, notableEvents: [], nextObjectiveHint: null } as unknown as SeasonLedger);
const snap = (levels: Record<string, number>, buildings: number, fields: number, dead: number): TownSnapshot => ({ levels, buildings, fields, dead, population: 0, coin: 0 });

test("the band's lines in the design's order, only what is not zero: people, built, levels, fields, the treasury, the dead, the steward", () => {
  const band = seasonBand({ season: season(16, 500, 220), before: snap({ h1: 1, h2: 1 }, 5, 1, 3), after: snap({ h1: 2, h2: 1, h3: 0, h4: 0 }, 6, 1, 4), stewardHandled: 2 });
  assert.deepEqual(band.items.map(item => item.key), ["population", "built", "levels", "money", "deaths"], "fields unchanged: no line; five at most (the steward's fell off)");
  assert.equal(band.items.length, SEASON_BAND_MAX);
  assert.deepEqual(band.items.map(item => item.text), ["인구 +16", "새 집 2 · 새 건물 1", "집 단계 오름 1", SEASON_BAND_COPY.money(280), "사망 1"]);
  assert.equal(band.quiet, false);
  assert.equal(band.key, "1300:1");
});

test("a season that fell: the numbers with their minus, the fields counted by field (not by strip or tile)", () => {
  const band = seasonBand({ season: season(-4, 100, 340), before: snap({ h1: 2 }, 5, 1, 0), after: snap({ h1: 2 }, 5, 2, 0), stewardHandled: 1 });
  assert.deepEqual(band.items.map(item => item.text), ["인구 −4", "밭 +1", SEASON_BAND_COPY.money(-240), "청지기가 작은 일 1건 처리"]);
  assert.match(SEASON_BAND_COPY.money(-240), /^금고 −/);
  assert.match(SEASON_BAND_COPY.money(280), /^금고 \+/);
});

test("a quiet season says it was quiet; after a load (no season-start snapshot) only the engine's own season numbers", () => {
  const quiet = seasonBand({ season: season(0, 0, 0), before: snap({ h1: 2 }, 5, 1, 0), after: snap({ h1: 2 }, 5, 1, 0), stewardHandled: 0 });
  assert.equal(quiet.quiet, true);
  assert.equal(quiet.items.length, 0);
  assert.equal(SEASON_BAND_COPY.quiet, "조용한 철 — 마을은 그대로입니다");
  const loaded = seasonBand({ season: season(3, 10, 0), before: null, after: snap({ h1: 2, h2: 0 }, 9, 3, 7), stewardHandled: 0 });
  assert.deepEqual(loaded.items.map(item => item.key), ["population", "money"], "no houses, levels, fields or dead without the season's start");
});

test("the snapshot: a house's level by its building, the buildings that are not houses, the fields, the dead (not those who left) but the gentry", () => {
  const state = {
    houses: [{ buildingId: "house-1", level: 2 }, { buildingId: "house-2", level: 1 }],
    buildings: [{ kind: "house" }, { kind: "house" }, { kind: "mill" }, { kind: "granary" }],
    arableFields: [{ zoneId: "z1", strips: [{}, {}, {}] }, { zoneId: "z2", strips: [{}] }],
    persons: { people: [{ alive: false, classBand: "labour" }, { alive: false, classBand: "gentry" }, { alive: true, classBand: "labour" }],
      past: [{ alive: false, classBand: "labour" }, { alive: true, leftYear: 1301, classBand: "labour" }, { alive: false, classBand: "gentry" }] },
    population: 56, treasuryCoin: 340,
  } as unknown as Parameters<typeof townSnapshot>[0];
  assert.deepEqual(townSnapshot(state), { levels: { "house-1": 2, "house-2": 1 }, buildings: 2, fields: 2, dead: 2, population: 56, coin: 340 });
});

test("LS1-1: one completion toast a season in lord mode — the first shows, the season's later ones are the band's", () => {
  assert.equal(toastLetThrough(null, { firstAtMs: 100 }, 4), true, "the first");
  assert.equal(toastLetThrough({ firstAtMs: 100, season: 4 }, { firstAtMs: 100 }, 4), true, "the same toast while it shows");
  assert.equal(toastLetThrough({ firstAtMs: 100, season: 4 }, { firstAtMs: 900 }, 4), false, "a second in the same season");
  assert.equal(toastLetThrough({ firstAtMs: 100, season: 4 }, { firstAtMs: 900 }, 5), true, "the next season's first");
  assert.equal(toastLetThrough(null, null, 4), false);
});

test("LS1-5: the year card's 마을의 한 해 — people, houses, fields, the treasury at the year's start and end, from the closes the screen saw", () => {
  clearTownCloses();
  assert.equal(lordTownYear(1300), null, "no closes seen: the engine's seasons' sums stand instead");
  recordTownClose(1299, 3, { ...snap({ h1: 0, h2: 0, h3: 0, h4: 0 }, 5, 0, 0), population: 12, coin: 60 });
  recordTownClose(1300, 1, { ...snap({ h1: 1 }, 6, 1, 0), population: 28, coin: 0 });
  assert.equal(townYearEnds(1300), null, "the year's own winter not closed yet");
  recordTownClose(1300, 3, { ...snap({ h1: 2, h2: 2, h3: 2, h4: 2, h5: 0 }, 8, 1, 1), population: 56, coin: 34 });
  assert.deepEqual(lordTownYear(1300), ["인구 12명 → 56명", "집 4채 → 5채", "밭 0곳 → 1곳", `금고 ${moneyFull(60)} → ${moneyFull(34)}`]);
  assert.equal(RESULTS_COPY.year.townYear, "마을의 한 해");
  clearTownCloses();
});

test("v1.1 b: a season whose deaths pass a tenth of the town says their main cause, from the engine's person.died records", () => {
  const died = (id: string, tick: number, subject: string, cause: string) => ({ id, tick, template: "person.died", subject: { type: "person", id: subject }, params: { cause, age: 30 } });
  const state = { persons: { people: [], past: [{ id: "lord", classBand: "gentry" }] }, history: { records: [
    ...Array.from({ length: 9 }, (_, index) => died(`f${index}`, 1_200 + index, `p${index}`, "famine")), died("a1", 1_500, "q1", "age"), died("a2", 1_600, "q2", "age"),
    died("g1", 1_700, "lord", "fire"), died("x1", 900, "q3", "fire"), died("x2", 2_100, "q4", "fire")] } } as unknown as Parameters<typeof seasonDeathCauses>[0];
  const causes = seasonDeathCauses(state, 1_000, 2_000);
  assert.deepEqual(causes, { famine: 9, age: 2 }, "the season's span only; the gentry are the chips'");
  const heavy = seasonBand({ season: season(-11, 0, 0), before: { ...snap({ h1: 2 }, 5, 1, 0), population: 100 }, after: snap({ h1: 2 }, 5, 1, 11), stewardHandled: 0, deathCauses: causes });
  assert.equal(heavy.items.find(item => item.key === "deaths")?.text, "사망 11 — 굶주림");
  const light = seasonBand({ season: season(-10, 0, 0), before: { ...snap({ h1: 2 }, 5, 1, 0), population: 100 }, after: snap({ h1: 2 }, 5, 1, 10), stewardHandled: 0, deathCauses: causes });
  assert.equal(light.items.find(item => item.key === "deaths")?.text, "사망 10", "a tenth is not over a tenth");
  const unknown = seasonBand({ season: season(-30, 0, 0), before: { ...snap({ h1: 2 }, 5, 1, 0), population: 100 }, after: snap({ h1: 2 }, 5, 1, 30), stewardHandled: 0, deathCauses: {} });
  assert.equal(unknown.items.find(item => item.key === "deaths")?.text, "사망 30", "no recorded cause: none made up");
  const tied = seasonBand({ season: season(-30, 0, 0), before: { ...snap({ h1: 2 }, 5, 1, 0), population: 100 }, after: snap({ h1: 2 }, 5, 1, 30), stewardHandled: 0, deathCauses: { age: 15, fire: 15 } });
  assert.equal(tied.items.find(item => item.key === "deaths")?.text, "사망 30 — 불", "equal counts: the order (fire before age)");
});
