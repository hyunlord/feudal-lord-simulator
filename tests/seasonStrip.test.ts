import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_GAME_STATE } from "../src/state/gameStore";
import { stateCalendar } from "../src/engine/scenarioState";
import { arrivalOf, seasonMarks, yearFraction } from "../src/ui/seasonStrip";
import { SEASON_STRIP_COPY } from "../src/ui/seasonStripCopy.ko";
import { isMarketDay } from "../src/ui/residentTrips";
import { LEDGER_PERIOD_TICKS } from "../src/ledger/ledger";

const at = (tick: number) => ({ ...DEFAULT_GAME_STATE, tick });

test("UI-3 gate 2: the pin sits where the calendar is (day of year / 360) through a year", () => {
  for (const tick of [0, 250, 999, 1000, 2600, 3999, 4000, 6100]) {
    const date = stateCalendar(at(tick));
    assert.ok(Math.abs(yearFraction(tick) - (date.dayOfYear - 1) / 360) < 1 / 360, `tick ${tick}`);
  }
});

test("UI-3 gate 2: the marks are the engine's dates — sowing late winter, harvest mid summer, the period close, the market day", () => {
  const marks = seasonMarks(at(100));
  const byKind = Object.fromEntries(marks.map(mark => [mark.kind, mark]));
  assert.equal(byKind.sow?.tick, 3500);
  assert.equal(byKind.harvest?.tick, 1500);
  assert.equal(byKind.period_end?.tick, LEDGER_PERIOD_TICKS);
  assert.equal(byKind.market_day, undefined, "no market, no market day");
  assert.deepEqual(marks.map(mark => mark.tick), [...marks.map(mark => mark.tick)].sort((a, b) => a - b), "soonest first");
  const withMarket = { ...at(100), buildings: [...DEFAULT_GAME_STATE.buildings, { ...DEFAULT_GAME_STATE.buildings[0]!, id: "m", kind: "market" as const }] };
  const market = seasonMarks(withMarket).find(mark => mark.kind === "market_day");
  assert.ok(market !== undefined && market.tick >= 100 && isMarketDay(market.tick) && !isMarketDay(market.tick - 1));
  assert.deepEqual(new Set(seasonMarks(withMarket).map(mark => mark.kind)), new Set(["sow", "harvest", "period_end", "market_day"]));
});

test("UI-3: arrivals are calendar words, never ticks", () => {
  assert.equal(SEASON_STRIP_COPY.arrival(...Object.values(arrivalOf(100, 3500)) as [0 | 1 | 2 | 3, 0 | 1 | 2, boolean]), "겨울 중순쯤");
  assert.equal(SEASON_STRIP_COPY.arrival(...Object.values(arrivalOf(3600, 5500)) as [0 | 1 | 2 | 3, 0 | 1 | 2, boolean]), "내년 여름 중순쯤");
  assert.equal(SEASON_STRIP_COPY.arrival(...Object.values(arrivalOf(0, 2000)) as [0 | 1 | 2 | 3, 0 | 1 | 2, boolean]), "가을 초쯤");
});
