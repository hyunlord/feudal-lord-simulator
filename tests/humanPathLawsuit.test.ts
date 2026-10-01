/**
 * LM-E2 human path (ES-7): a suit over one piece against a neighbour, as a player plays it — in the town of chapter 2
 * (fixture `chapter-two-town`, the bot's seed 1 at chapter 2's first tick). The lord has an old claim to the first
 * neighbour's fishery (an earl's grant). Commands only, the calendar running between them: file the suit, bring the
 * charter, the court roll and witnesses, win the bishop as patron, wait for the hearing and the judgment (the title
 * moves, the neighbour keeps fishing), enforce the possession until it gives. No state is edited.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { GameState } from "../src/engine/engine.types";
import { estateById, estatesOf, LORD } from "../src/engine/estates";
import { historySummary } from "../src/engine/history";
import { advanceTick } from "../src/engine/tick";
import { decodeSave } from "../src/save/saveCodec";
import { SAVE_SCHEMA_VERSION } from "../src/save/saveTypes";
import { gameReducer } from "../src/state/gameStore";

const FISHERY = "estate-neighbour-1:fishery";

test("humanPath lawsuit: a claim filed, evidence and a patron brought, judged for the lord, the possession enforced after one resistance", () => {
  let state = decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v${SAVE_SCHEMA_VERSION}/chapter-two-town.save.json`))).envelope.state as GameState;
  const fishery = () => estateById(state, "estate-neighbour-1")!.pieces.find(piece => piece.id === FISHERY)!;
  const suit = () => estatesOf(state).suits[0]!;
  const until = (done: () => boolean, ticks: number) => { for (let step = 0; step < ticks && !done(); step += 1) state = advanceTick(state); };
  assert.deepEqual([fishery().titleHolder, fishery().possessor], ["neighbour_1", "neighbour_1"]);
  const claim = estatesOf(state).claims.find(entry => entry.pieceId === FISHERY && entry.claimant === LORD)!;

  state = gameReducer(state, { type: "file_suit", claimId: claim.id });
  for (const evidence of ["charter", "court_roll", "witnesses"] as const) state = gameReducer(state, { type: "add_suit_evidence", suitId: suit().id, evidence });
  until(() => suit().stage === "patronage", 3_000);
  assert.equal(suit().stage, "patronage");
  state = gameReducer(state, { type: "seek_suit_patron", suitId: suit().id, factionId: "bishop" });
  assert.equal(suit().patron, "bishop");
  until(() => suit().verdict !== undefined, 3_000);
  assert.deepEqual([suit().verdict, suit().stage], ["plaintiff", "enforcing"]);
  assert.deepEqual([fishery().titleHolder, fishery().possessor], [LORD, "neighbour_1"], "the judgment gave the title; the neighbour still fishes");

  state = gameReducer(state, { type: "enforce_possession", suitId: suit().id });
  assert.deepEqual([suit().enforced, fishery().possessor], [false, "neighbour_1"], "the neighbour's men hold the weirs");
  state = gameReducer(state, { type: "enforce_possession", suitId: suit().id });
  assert.deepEqual([suit().enforced, suit().enforcements], [true, 2]);
  assert.deepEqual([fishery().titleHolder, fishery().possessor], [LORD, LORD]);

  const lines = state.history!.records.filter(record => record.template.startsWith("estate.")).map(record => record.template);
  assert.deepEqual(lines, ["estate.suit_filed", "estate.suit_stage", "estate.suit_stage", "estate.suit_patron", "estate.suit_stage",
    "estate.suit_judged", "estate.title_changed", "estate.possession_enforced", "estate.possession_enforced", "estate.possession_changed"]);
  const costs = (state.ledger?.entries ?? []).filter(entry => entry.category === "lawsuit");
  assert.equal(-costs.reduce((sum, entry) => sum + entry.amount, 0), suit().costs);
  assert.ok(state.history!.records.filter(record => record.template.startsWith("estate.")).every(record => historySummary(record).length > 0));
});
