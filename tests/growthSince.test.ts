/**
 * GB2A-7 with save v56 (the user's rulings 2026-10-12/13): growthBlock's `since` is the week the town last grew — its
 * population first past its highest yet (`agency.lastGrowth`) — and null on a save from before v56 until the town next
 * grows. The state: seed 20 (lord slice) at 1316, its charter asked (fixtures/charter, a v55 save without the record).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import type { GameState } from "../src/engine/engine.types";
import { growthBlock } from "../src/engine/growthBlock";
import { AGENCY_WEEK_TICKS } from "../src/content/townAgencyConfig";
import { advanceTownAgency } from "../src/engine/townAgency";
import { decodeSave } from "../src/save/saveCodec";

const asked = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/charter/seed20-1316-asked.save.json.gz")))).envelope.state as GameState;

test("growthBlock's since: null before the record, then the week the population passed its highest", () => {
  assert.equal(asked.agency?.lastGrowth, undefined, "a v55 save has no record");
  assert.equal(growthBlock(asked)?.since, null);
  const week = Math.ceil((asked.tick + 1) / AGENCY_WEEK_TICKS) * AGENCY_WEEK_TICKS;
  const walked = advanceTownAgency({ ...asked, tick: week });
  assert.deepEqual(walked.agency?.lastGrowth, { tick: week, population: asked.population });
  assert.equal(growthBlock(walked)?.since, week);
  // The same population a week on is no growth: the record stays.
  const later = advanceTownAgency({ ...walked, tick: week + AGENCY_WEEK_TICKS });
  assert.deepEqual(later.agency?.lastGrowth, { tick: week, population: asked.population });
});
