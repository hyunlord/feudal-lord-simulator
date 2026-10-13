/**
 * GB2A-7 with save v56 (the user's rulings 2026-10-12/13): growthBlock's `since` is the last season's close at which the
 * town's houses or population stood above the close before (`agency.seasonGrowth`) — counted by the season, so a town
 * recovering from a great loss has grown at each close it gains, not only once it passes its old height; null on a save
 * from before v56 until the town next grows. The state: seed 20 (lord slice) at 1316, its charter asked (a v55 save).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { PRESSURE_BALANCE } from "../src/content/balanceConfig";
import type { GameState } from "../src/engine/engine.types";
import { growthBlock } from "../src/engine/growthBlock";
import { recordSeasonGrowth } from "../src/engine/townAgency";
import { decodeSave } from "../src/save/saveCodec";

const asked = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/charter/seed20-1316-asked.save.json.gz")))).envelope.state as GameState;
const SEASON = PRESSURE_BALANCE.seasonTicks;
const close = (state: GameState, season: number, population: number): GameState =>
  recordSeasonGrowth({ ...state, tick: (Math.floor(asked.tick / SEASON) + season) * SEASON, population });

test("since: none before the record, then each season's close the town grew at — a recovery after a great loss included", () => {
  assert.equal(asked.agency?.seasonGrowth, undefined, "a v55 save has no record");
  assert.equal(growthBlock(asked)?.since, null);
  const peak = asked.population;
  // The first close records the town; there is nothing before it to have grown from.
  const first = close(asked, 1, peak);
  assert.deepEqual(first.agency?.seasonGrowth, { houses: asked.houses.length, population: peak });
  assert.equal(growthBlock(first)?.since, null);
  // A season it grew: that close.
  const grown = close(first, 2, peak + 40);
  assert.equal(grown.agency?.seasonGrowth?.lastGrowthTick, grown.tick);
  assert.equal(growthBlock(grown)?.since, grown.tick);
  // A great loss (the Black Death): no growth, the record stays.
  const loss = close(grown, 3, Math.round(peak / 2));
  assert.equal(growthBlock(loss)?.since, grown.tick);
  // The recovery, still far below the old height: each close it gains is growth.
  const recovering = close(loss, 4, Math.round(peak * 0.6));
  assert.equal(growthBlock(recovering)?.since, recovering.tick);
  const again = close(recovering, 5, Math.round(peak * 0.7));
  assert.equal(growthBlock(again)?.since, again.tick);
  // A tick between closes changes nothing.
  assert.equal(recordSeasonGrowth({ ...again, tick: again.tick + 1, population: peak * 2 }).agency, again.agency);
});
