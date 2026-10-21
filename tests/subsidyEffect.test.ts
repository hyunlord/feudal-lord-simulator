/**
 * SUBSIDY-CLOTH (the user's ruling 2026-10-21): `subsidyEffect` says whether a subsidy on a kind does anything now —
 * before the cloth's time (1364 in lord mode, CL7) the four cloth buildings are no opportunity (CLOTH1-1), so a subsidy
 * on one starts and pays nothing. The state: seed 25 (lord slice) at the first tick of 1321 (DGX
 * engine-CAP-save25-b9bd1f4).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { BALANCE } from "../src/content/balanceConfig";
import { CLOTH_OPPORTUNITY_KINDS, OPPORTUNITY_KINDS } from "../src/content/townAgencyConfig";
import type { GameState } from "../src/engine/engine.types";
import { scenarioOf } from "../src/engine/scenarioState";
import { subsidyEffect } from "../src/engine/subsidyEffect";
import { setProjectSubsidy, townProposals } from "../src/engine/townAgency";
import { decodeSave } from "../src/save/saveCodec";
import { newGameState } from "../src/state/newGame";

const town = decodeSave(new Uint8Array(gunzipSync(readFileSync("fixtures/church/seed25-1321.save.json.gz")))).envelope.state as GameState;
const at1364 = { ...town, tick: (1364 - scenarioOf(town).startYear) * BALANCE.TICKS_PER_YEAR } as GameState;

test("SUBSIDY-CLOTH: before 1364 the four cloth kinds are 'not yet, from 1364'; every other subsidy kind is effective", () => {
  for (const kind of OPPORTUNITY_KINDS) {
    const effect = subsidyEffect(town, kind);
    if (CLOTH_OPPORTUNITY_KINDS.includes(kind)) assert.deepEqual(effect, { effect: "not_yet", reason: "cloth_time", from: { year: 1364 } }, kind);
    else assert.deepEqual(effect, { effect: "effective" }, kind);
  }
});

test("SUBSIDY-CLOTH: from 1364 the cloth kinds are effective", () => {
  for (const kind of CLOTH_OPPORTUNITY_KINDS) assert.deepEqual(subsidyEffect(at1364, kind), { effect: "effective" }, kind);
});

test("SUBSIDY-CLOTH: 'not yet' matches the town — a cloth subsidy before 1364 brings no cloth proposal", () => {
  const subsidised = setProjectSubsidy(town, "weaver_house", 10);
  assert.ok(subsidised.agency?.subsidies.some(subsidy => subsidy.kind === "weaver_house"), "the subsidy is set");
  assert.equal(townProposals(subsidised).some(proposal => proposal.what === "weaver_house"), false);
});

test("SUBSIDY-CLOTH: in the campaign, before chapter 4 the cloth kinds are not yet, from chapter 4", () => {
  const campaign = newGameState({ scenarioId: "core:campaign_market_town" }) as GameState;
  assert.equal(scenarioOf(campaign).mode, "campaign");
  assert.ok((campaign.politics?.chapter.number ?? 1) < 4, "the campaign starts before chapter 4");
  for (const kind of CLOTH_OPPORTUNITY_KINDS) {
    const effect = subsidyEffect(campaign, kind);
    assert.equal(effect.effect, "not_yet", kind);
    assert.ok(effect.effect === "not_yet" && "chapter" in effect.from && effect.from.chapter === 4, kind);
  }
  assert.deepEqual(subsidyEffect(campaign, "granary"), { effect: "effective" });
});
