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
import { SEASON_BAND_MAX, seasonBand, townSnapshot, type TownSnapshot } from "../src/ui/lord/seasonBand/seasonBandModel";
import { toastLetThrough } from "../src/ui/lord/seasonBand/toastLimit";

const season = (popDelta: number, income: number, expense: number): SeasonLedger => ({ season: 1, year: 1300, startTick: 1_000, endTick: 2_000, income, expense,
  stockDelta: { bread: 0, wheat: 0, timber: 0, stone: 0 }, popDelta, notableEvents: [], nextObjectiveHint: null } as unknown as SeasonLedger);
const snap = (levels: Record<string, number>, buildings: number, fields: number, dead: number): TownSnapshot => ({ levels, buildings, fields, dead });

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

test("the snapshot: a house's level by its building, the buildings that are not houses, the fields, the dead but the gentry", () => {
  const state = {
    houses: [{ buildingId: "house-1", level: 2 }, { buildingId: "house-2", level: 1 }],
    buildings: [{ kind: "house" }, { kind: "house" }, { kind: "mill" }, { kind: "granary" }],
    arableFields: [{ zoneId: "z1", strips: [{}, {}, {}] }, { zoneId: "z2", strips: [{}] }],
    persons: { people: [{ alive: false, classBand: "labour" }, { alive: false, classBand: "gentry" }, { alive: true, classBand: "labour" }],
      past: [{ classBand: "labour" }, { classBand: "gentry" }] },
  } as unknown as Parameters<typeof townSnapshot>[0];
  assert.deepEqual(townSnapshot(state), { levels: { "house-1": 2, "house-2": 1 }, buildings: 2, fields: 2, dead: 2 });
});

test("LS1-1: one completion toast a season in lord mode — the first shows, the season's later ones are the band's", () => {
  assert.equal(toastLetThrough(null, { firstAtMs: 100 }, 4), true, "the first");
  assert.equal(toastLetThrough({ firstAtMs: 100, season: 4 }, { firstAtMs: 100 }, 4), true, "the same toast while it shows");
  assert.equal(toastLetThrough({ firstAtMs: 100, season: 4 }, { firstAtMs: 900 }, 4), false, "a second in the same season");
  assert.equal(toastLetThrough({ firstAtMs: 100, season: 4 }, { firstAtMs: 900 }, 5), true, "the next season's first");
  assert.equal(toastLetThrough(null, null, 4), false);
});
