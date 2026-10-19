/**
 * LS1-3 (lord-screen-v1.md; GB2A-7; the user's rulings 2026-10-13): the engine's growthBlock on the screen — the pill's mark
 * after a stop held past two season closes (a stop: neither the houses nor the people above what they were when the town
 * last grew, while growthBlock stands — LS1-6: growthBlock stands while the town grows, and that is no stop, A4), "정체 N년" only when the screen saw it begin (a new game, or growth seen first),
 * "정체 중" after a load (no number: a load's "1년" may be the eighth, A4 / P-C4), the engine's `since` instead when it has
 * one; the lever's button to its command's existing screen, none for lord mode's `draw_wall` (A1) or none at all; the
 * band's first line, the chip when a stop begins, the year card's line.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { BALANCE } from "../src/content/balanceConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GrowthBlock } from "../src/engine/growthBlock";
import { newGameState } from "../src/state/newGame";
import { storyBeats } from "../src/ui/eventStory";
import { GROWTH_COPY } from "../src/ui/lord/growth/growthCopy.ko";
import { growthMarkOf, growthView } from "../src/ui/lord/growth/growthMark";
import { growthRun, growthYear, markLastClose, noteGrowthClose, startGrowthTrack } from "../src/ui/lord/growth/growthTrack";
import { seasonBand, type TownSnapshot } from "../src/ui/lord/seasonBand/seasonBandModel";
import { growthYearLine } from "../src/ui/results/lordYearReview";
import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import type { SeasonLedger } from "../src/engine/season.types";

const YEAR = BALANCE.TICKS_PER_YEAR;
const lord = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!;
const block = (over: Partial<GrowthBlock> = {}): GrowthBlock => ({ reason: "no_lots", detail: null, since: null, lever: null, ...over });
const town = (houses = 10, population = 40) => ({ houses, population });
/** `count` closes in a row from `from`'s spring, the town's size the same (no growth) unless `grow` adds a house each. */
const closes = (count: number, read: GrowthBlock | null, from = 1300, grow = false) => {
  for (let index = 0; index < count; index += 1) noteGrowthClose(from + Math.floor(index / 4), index % 4, read, town(grow ? 11 + index : 10));
};

test("a stop the screen saw begin: no mark until it held past two closes, then 정체 N년 (whole years, at least one)", () => {
  startGrowthTrack(true, town());
  closes(2, block());
  assert.equal(growthView(lord, growthRun(), block())?.mark, null, "two closes: not yet");
  closes(1, block());
  assert.deepEqual(growthView(lord, growthRun(), block())?.mark, { years: 1, text: "정체 1년", label: "마을이 1년째 자라지 않습니다" });
  closes(6, block());
  assert.equal(growthView(lord, growthRun(), block())?.mark?.text, "정체 2년", "nine closes in a row");
  noteGrowthClose(1303, 0, block(), town(10, 41));
  assert.equal(growthRun().closes, 0, "one more person: the town grew, the count ends");
  closes(3, block(), 1303);
  noteGrowthClose(1304, 0, null, town());
  assert.equal(growthRun().closes, 0, "nothing holds the town: no stop");
});

test("LS1-6 (A4): a town that grows under a standing growthBlock shows no stop — the panel says what holds its next step", () => {
  startGrowthTrack(true, town());
  closes(12, block({ reason: "era_condition", detail: "timber", lever: { kind: "order_timber" } }), 1300, true);
  const view = growthView(lord, growthRun(), block({ reason: "era_condition", detail: "timber", lever: { kind: "order_timber" } }))!;
  assert.equal(growthRun().closes, 0);
  assert.equal(view.mark, null, "no 정체 in the pill");
  assert.equal(view.since, null, "no since");
  assert.equal(view.reason, "시장도시 선포의 조건이 모자랍니다(목재)", "the next step's hold, for the panel");
  assert.equal(growthMarkOf(lord), null);
  assert.equal(storyBeats(lord).some(beat => beat.kind === "growth_block"), false, "no chip");
  assert.deepEqual(growthYearLine(1301), [], "no year line");
  // People falling and coming back below the top is no growth: the stop holds.
  startGrowthTrack(true, town(10, 40));
  noteGrowthClose(1300, 0, block(), town(10, 30)); noteGrowthClose(1300, 1, block(), town(10, 38)); noteGrowthClose(1300, 2, block(), town(10, 40));
  assert.equal(growthRun().closes, 3);
});

test("after a load: the first close takes the size; then 정체 중, no number — until growth is seen and a new stop begins", () => {
  startGrowthTrack(false, town());
  closes(3, block());
  assert.equal(growthView(lord, growthRun(), block())?.mark, null, "the first close only took the size: two held, not yet");
  closes(1, block(), 1301);
  assert.deepEqual(growthView(lord, growthRun(), block())?.mark, { years: null, text: "정체 중", label: "마을이 자라지 않고 있습니다" });
  assert.equal(growthView(lord, growthRun(), block())?.since, GROWTH_COPY.panel.sinceUnknown);
  noteGrowthClose(1302, 1, block(), town(11));
  for (let index = 0; index < 3; index += 1) noteGrowthClose(1303, index, block(), town(11));
  assert.equal(growthView(lord, growthRun(), block())?.mark?.text, "정체 1년", "seen to begin this session: counted");
  assert.equal(growthView(lord, growthRun(), block())?.since, GROWTH_COPY.panel.since(1303, "봄"));
});

test("the audit's growth-held: a loaded state counted as a stop already held (its mark and chip without waiting seasons)", () => {
  startGrowthTrack(false, town(), 3);
  assert.deepEqual(growthView(lord, growthRun(), block())?.mark, { years: null, text: "정체 중", label: "마을이 자라지 않고 있습니다" });
  noteGrowthClose(1300, 0, block(), town());
  assert.equal(growthRun().closes, 4, "the next close compares with the loaded size");
});

test("the engine's since, when it has one, stands for the screen's count", () => {
  startGrowthTrack(false);
  const state = { ...lord, tick: 5 * YEAR };
  assert.equal(growthView(state, growthRun(), block({ since: 2 * YEAR }))?.mark?.text, "정체 3년", "a load, no close seen: the engine knows");
  assert.equal(growthView(state, growthRun(), block({ since: 5 * YEAR - 100 }))?.mark, null, "held less than two seasons");
});

test("LS1-9: with the engine's since, 정체 only after three whole closes without growth — a band read a tick late counts the same", () => {
  startGrowthTrack(false);
  const at = (tick: number) => growthView({ ...lord, tick }, growthRun(), block({ since: 15_000 }))?.mark ?? null;
  assert.equal(at(16_000), null, "one close without growth");
  assert.equal(at(17_000), null, "two closes");
  assert.equal(at(17_001), null, "render-VIS-ls17's 1304 summer: two closes, read a tick late — still not a stop");
  assert.notEqual(at(18_000), null, "three closes: the stop is said");
  assert.notEqual(at(18_001), null, "three closes, read a tick late: the same");
  assert.equal(growthView({ ...lord, tick: 17_001 }, growthRun(), block({ since: 17_000 }))?.mark ?? null, null, "the town grew at the close just past: no stop");
});

test("LS1-9: the year card's line counts the closes the screen said the town held at (the engine's since as the band says it)", () => {
  startGrowthTrack(true, town());
  noteGrowthClose(1300, 0, block(), town()); markLastClose(false);
  noteGrowthClose(1300, 1, block(), town()); markLastClose(true);
  assert.equal(growthYear(1300).seasons, 1, "only the close the band said 정체 at");
});

test("the lever: a button to the command's existing screen; none for lord mode's draw_wall (A1) or no lever", () => {
  startGrowthTrack(true, town());
  const subsidy = growthView(lord, growthRun(), block({ reason: "food", lever: { kind: "subsidy", building: "farmstead" } }))!;
  assert.deepEqual(subsidy.lever, { line: "헛간 공사를 장려금으로 도우면 풀립니다", button: "장려금 정하기", action: "policy" });
  assert.equal(growthView(lord, growthRun(), block({ reason: "wall_building", lever: { kind: "wall_priority" } }))!.lever.action, "wall");
  const drawn = growthView(lord, growthRun(), block({ reason: "wall_not_found", lever: { kind: "draw_wall" } }))!;
  assert.deepEqual(drawn.lever, { line: "지금은 영주가 직접 풀 길이 없습니다 — 마을이 목책 자리를 찾지 못하고 있습니다", button: null, action: null });
  assert.equal(growthView(lord, growthRun(), block({ reason: "town_full" }))!.lever.button, null);
  // The timber order and the request lead to the town's request card only while one waits (none in a new game).
  assert.equal(growthView(lord, growthRun(), block({ reason: "era_condition", detail: "timber", lever: { kind: "order_timber" } }))!.lever.button, null);
});

test("the cause's particle follows the name's last syllable (교회가, not 교회이)", () => {
  assert.equal(GROWTH_COPY.reason("service_missing", "church"), "집이 다음 단계로 가려면 교회가 있어야 합니다");
  assert.equal(GROWTH_COPY.reason("service_outside", "market"), "시장이 너무 멀어 집이 다음 단계로 가지 못합니다");
});

test("outside lord mode or with no block: no view, no mark", () => {
  assert.equal(growthView(DEFAULT_GAME_STATE, growthRun(), block()), null);
  assert.equal(growthView(lord, growthRun(), null), null);
  assert.equal(growthMarkOf(DEFAULT_GAME_STATE), null);
});

test("the band's first line, the chip once the stop is said, the year card's line (its marked seasons)", () => {
  const ledger = { season: 1, year: 1301, startTick: 0, endTick: 1, income: 0, expense: 0, popDelta: 4, notableEvents: [], nextObjectiveHint: null } as unknown as SeasonLedger;
  const snap: TownSnapshot = { levels: {}, buildings: 0, fields: 0, dead: 0, population: 0, coin: 0, wallLeft: 0, wallKind: null };
  const band = seasonBand({ season: ledger, before: snap, after: snap, stewardHandled: 0, growth: GROWTH_COPY.band(2, "성 안에 집을 지을 자리가 없습니다") });
  assert.deepEqual(band.items.map(item => item.key), ["growth", "population"]);
  assert.equal(band.items[0]!.text, "마을이 2년째 자라지 않습니다 — 성 안에 집을 지을 자리가 없습니다");
  startGrowthTrack(true, town());
  assert.equal(storyBeats(lord).some(beat => beat.kind === "growth_block"), false, "no close seen yet: no chip");
  closes(2, block({ reason: "food" }));
  assert.equal(storyBeats(lord).some(beat => beat.kind === "growth_block"), false, "held two closes: not said yet");
  noteGrowthClose(1300, 2, block({ reason: "food" }), town());
  const chip = storyBeats(lord).find(beat => beat.kind === "growth_block")!;
  assert.equal(chip.id, "growth:1300:0", "keyed by the stop's first held close");
  assert.equal(chip.slot, "population");
  assert.equal(chip.title, GROWTH_COPY.chip.title(GROWTH_COPY.reason("food", null)), "the cause on the rail");
  assert.equal(chip.line, GROWTH_COPY.panel.since(1300, "봄"));
  noteGrowthClose(1300, 3, block(), town());
  assert.equal(growthYear(1300).seasons, 2, "the closes at which the stop was said (the third and the fourth)");
  assert.deepEqual(growthYearLine(1300), ["자라지 못한 철 2 — 성 안에 집을 지을 자리가 없습니다"]);
  assert.deepEqual(growthYearLine(1299), []);
});
