/** LM-E1 town agency (spec docs/design/town-agency.md TA-1…TA-8). */
import assert from "node:assert/strict";
import test from "node:test";

import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import { AGENCY_WEEK_TICKS } from "../src/content/townAgencyConfig";
import type { GameState } from "../src/engine/engine.types";
import { advanceTick } from "../src/engine/tick";
import { advanceTownAgency, initialAgency, townProposals, whyHere } from "../src/engine/townAgency";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const lordTown = (): GameState => ({ ...(createGrowthOpening(1).state as GameState), agency: initialAgency() });

function toWeek(state: GameState, weeks: number): GameState {
  let next = state;
  const until = (Math.floor(state.tick / AGENCY_WEEK_TICKS) + weeks) * AGENCY_WEEK_TICKS;
  while (next.tick < until) next = advanceTick(next);
  return next;
}

test("TA-1 a new game in lord mode has its actors; the default and sandbox have none", () => {
  const lord = newGameState({ scenarioId: "core:campaign_market_town", mode: "lord" })!;
  assert.deepEqual(lord.agency?.actors.map(actor => actor.kind), ["community", "households", "merchants", "guild", "church"]);
  assert.equal(newGameState({ scenarioId: "core:campaign_market_town" })!.agency, undefined);
  assert.equal(newGameState({ scenarioId: "core:campaign_market_town", mode: "sandbox" })!.agency, undefined);
  assert.equal(gameReducer(lord, { type: "start_new_game", scenarioId: "core:sandbox", mode: "lord" }).agency !== undefined, true);
});

test("TA-1 in lord mode the player's ordinary building is closed; the lord's public works and the sandbox are open", () => {
  const lord = lordTown();
  const house = lord.buildings.find(building => building.kind === "house")!;
  const place = { type: "place_building" as const, kind: "well" as const, tx: house.tx + 3, ty: house.ty + 3 };
  assert.equal(gameReducer(lord, place), lord);
  const { agency: _agency, ...sandbox } = lord;
  assert.notEqual(gameReducer(sandbox as GameState, place), sandbox);
});

test("TA-1 without an agency nothing runs: the week's step returns the very state", () => {
  const { agency: _agency, ...sandbox } = lordTown();
  const atWeek = { ...(sandbox as GameState), tick: AGENCY_WEEK_TICKS * 3 };
  assert.equal(advanceTownAgency(atWeek), atWeek);
});

test("TA-6 each of the lord's conditions is a ledger decision with an id; the same answer again changes nothing", () => {
  let state = lordTown();
  state = gameReducer(state, { type: "set_estate_policy", policy: "revenue" });
  state = gameReducer(state, { type: "set_project_subsidy", kind: "mill", amount: 120 });
  state = gameReducer(state, { type: "set_market_dues", permille: 600 });
  assert.equal(state.agency!.policy, "revenue");
  assert.deepEqual(state.agency!.subsidies.map(subsidy => [subsidy.kind, subsidy.amount]), [["mill", 120]]);
  assert.equal(state.agency!.duesPermille, 600);
  const decisions = state.history!.records.filter(record => record.kind === "decision").map(record => record.params?.decisionKind);
  assert.deepEqual(decisions, ["estate_policy", "project_subsidy", "market_dues"]);
  assert.equal(gameReducer(state, { type: "set_estate_policy", policy: "revenue" }), state);
  assert.equal(gameReducer(state, { type: "set_market_dues", permille: 100 }), state, "dues below 250‰ are refused");
});

test("TA-3 TA-4 a proposal's score is the sum of its named reasons; the needs come from the bot's planning", () => {
  const proposals = townProposals(toWeek(lordTown(), 1));
  assert.ok(proposals.length > 0);
  for (const proposal of proposals) {
    assert.equal(proposal.score, proposal.reasons.reduce((sum, reason) => sum + reason.value, 0));
    assert.ok(proposal.planner.length > 0);
  }
  assert.ok(proposals.some(proposal => proposal.reasons.some(reason => reason.name === "need")));
});

test("TA-5 every project started leaves a receipt and a ledger line; whyHere finds a construction site's receipt", () => {
  const state = toWeek(lordTown(), 12);
  const receipts = state.agency!.receipts;
  assert.ok(receipts.length > 0, "the town started projects");
  const lines = state.history!.records.filter(record => record.template === "agency.project_started");
  assert.deepEqual(lines.map(line => line.params?.receipt), receipts.map(receipt => receipt.id));
  for (const receipt of receipts) {
    assert.ok(receipt.reasons.length > 0 && receipt.reasons.length <= 5);
    assert.ok(receipt.score >= 40);
  }
  const built = receipts.find(receipt => receipt.siteId !== null)!;
  assert.equal(whyHere(state, built.siteId!), built);
});

test("TA-6 a subsidy raises its kind's score, pays from the treasury, and the receipt names the subsidy's decision", () => {
  let state = lordTown();
  state = gameReducer(state, { type: "set_project_subsidy", kind: "granary", amount: 100 });
  const decision = state.history!.records.find(record => record.params?.decisionKind === "project_subsidy")!;
  const plain = townProposals(toWeek(lordTown(), 2)).find(proposal => proposal.what === "granary");
  const backed = townProposals(toWeek(state, 2)).find(proposal => proposal.what === "granary");
  assert.ok(backed !== undefined, "a subsidised granary is proposed");
  assert.ok(backed.reasons.some(reason => reason.name === "subsidy" && reason.value > 0));
  if (plain !== undefined) assert.ok(backed.score > plain.score);
  const later = toWeek(state, 20);
  const receipt = later.agency!.receipts.find(entry => entry.what === "granary" && entry.subsidy > 0);
  if (receipt !== undefined) assert.ok(receipt.decisionIds.includes(decision.id));
});

test("TA-9 every receipt's reasons match the state the week started from (auditReceipt)", async () => {
  const { auditReceipt } = await import("../src/engine/townAgency");
  let state = gameReducer(lordTown(), { type: "set_estate_policy", policy: "stability" });
  let audited = 0;
  while (state.tick < AGENCY_WEEK_TICKS * 16) {
    const before = state;
    state = advanceTick(state);
    for (const receipt of (state.agency?.receipts ?? []).filter(entry => Number(entry.id.slice(8)) >= (before.agency?.nextReceipt ?? 1))) {
      assert.deepEqual(auditReceipt(before, receipt), [], `${receipt.id} ${receipt.what}`);
      audited += 1;
    }
  }
  assert.ok(audited > 0);
});

test("TA-8 a lord-mode town saves and loads with its agency (save v36); a v35 save loads as a sandbox town", async () => {
  const { decodeSave, encodeSave } = await import("../src/save/saveCodec");
  const { readFileSync } = await import("node:fs");
  const town = toWeek(gameReducer(lordTown(), { type: "set_market_dues", permille: 800 }), 6);
  const at = "2026-10-01T00:00:00.000Z";
  const loaded = decodeSave(encodeSave({ state: town, createdAt: at, savedAt: at }).bytes).envelope.state as GameState;
  assert.deepEqual(loaded.agency, town.agency);
  const old = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v35/chapter-five-town.save.json")));
  assert.equal(old.migratedFrom, 35);
  assert.equal((old.envelope.state as GameState).agency, undefined);
});
