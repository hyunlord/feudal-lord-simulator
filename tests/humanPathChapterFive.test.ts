/**
 * F5-A human path (LG-1, LG-4): chapter 5 to its first decision as a player meets it — in the town that came through
 * chapters 1–4 (fixture `chapter-five-town`, the bot's seed 1 at chapter 5's first tick), no command until then: the
 * merchants ask for a mayor, the Crown's envoy comes and asks for the tax — the first decision, answered by one command
 * (paid). No state is edited.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CHAPTER_FIVE } from "../src/content/chapterConfig";
import { LEGACY_BALANCE, ROYAL_TAX_PETITION_ID } from "../src/content/legacyConfig";
import type { GameState } from "../src/engine/engine.types";
import { legacyDecisionForecast, legacyForecast } from "../src/engine/legacy";
import { openPetitions } from "../src/engine/politics";
import { advanceTick } from "../src/engine/tick";
import { treasuryBalance } from "../src/ledger/ledger";
import { decodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { gameReducer } from "../src/state/gameStore";

test("humanPath chapter 5: the merchants' mayor and the Crown's envoy come on their own; the tax — the first decision — within three years, answered by one command", () => {
  let state = decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v${SAVE_SCHEMA_VERSION}/chapter-five-town.save.json`))).envelope.state as GameState;
  assert.equal(state.politics?.chapter.number, CHAPTER_FIVE.chapter);
  const start = state.tick;
  const seen: Record<string, number> = {};
  for (let step = 0; step < 12_000 && !openPetitions(state).some(petition => petition.defId === ROYAL_TAX_PETITION_ID); step += 1) {
    state = advanceTick(state);
    for (const entry of legacyForecast(state)) if (entry.state === "done" && seen[entry.id] === undefined) seen[entry.id] = state.tick;
  }
  const envoy = openPetitions(state).find(petition => petition.defId === ROYAL_TAX_PETITION_ID);
  assert.ok(envoy !== undefined, "the Crown asked");
  assert.deepEqual(Object.keys(seen), ["mayor_demand", "royal_tax_envoy"]);
  assert.ok(seen.mayor_demand! < seen.royal_tax_envoy!);
  assert.ok(state.tick - start <= (LEGACY_BALANCE.mayorAfter + LEGACY_BALANCE.envoyAfterMayor + 1) * 1000, `${state.tick - start} ticks`);
  const forecast = legacyDecisionForecast(state, ROYAL_TAX_PETITION_ID, "accept");
  const paid = gameReducer(state, { type: "petition_response", petitionId: envoy.id, response: "accept" });
  assert.equal(treasuryBalance(paid), forecast);
  assert.ok(paid.legacy!.royalSubsidy >= LEGACY_BALANCE.subsidyMin);
  assert.ok(paid.history!.records.some(record => record.template === "legacy.royal_subsidy"), "the ledger remembers");
});
