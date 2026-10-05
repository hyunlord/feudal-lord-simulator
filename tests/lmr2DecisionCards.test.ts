import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { DEFAULT_SCENARIO_ID, LORD_SLICE_SCENARIO_ID, SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import type { GameState } from "../src/engine/engine.types";
import { answerWillChange } from "../src/engine/marriage";
import { diplomacyOf } from "../src/engine/negotiation";
import { answerAudit, answerEstatePetition, pendingAudits } from "../src/engine/stewardship";
import { advanceTick } from "../src/engine/tick";
import { treasuryBalance } from "../src/ledger/ledger";
import { newGameState } from "../src/state/newGame";
import { decisionModal } from "../src/ui/eventStory";
import { auditDecisionView, marriageDecisionView, offMapPetitionView, openOffMapPetitions } from "../src/ui/lord/decisions/decisionCardsModel";
import { lordBeats } from "../src/ui/lordStoryBeats";

// LM-R2: the lord's decision cards (the father's will, the contested inheritance, an audit's finding, an off-map
// petition) on real lord2 states (scripts/lmr2States.ts; LMR2_STATES=<dir>), and nothing of them outside lord mode.

function lord2(name: string): GameState | null {
  const dir = process.env.LMR2_STATES;
  const file = dir === undefined ? "" : join(dir, `${name}.json`);
  return dir === undefined || !existsSync(file) ? null : JSON.parse(readFileSync(file, "utf8")) as GameState;
}
const NO_STATES = "LMR2_STATES not set (the lord2 states come from scripts/lmr2States.ts on the DGX)";

test("outside lord mode there is no decision card and no decision beat", () => {
  for (const scenarioId of [SANDBOX_SCENARIO_ID, DEFAULT_SCENARIO_ID]) {
    let town = newGameState({ scenarioId })!;
    for (let tick = 0; tick < 200; tick += 1) town = advanceTick(town);
    assert.equal(marriageDecisionView(town), null, scenarioId);
    assert.equal(auditDecisionView(town), null, scenarioId);
    assert.equal(offMapPetitionView(town), null, scenarioId);
    assert.deepEqual(lordBeats(town), [], scenarioId);
  }
  let slice = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID })!;
  for (let tick = 0; tick < 200; tick += 1) slice = advanceTick(slice);
  assert.equal(marriageDecisionView(slice), null, "a new lord has no marriage decision");
});

test("the will's card: three equal answers with the engine's own numbers, and one chip that stands for the will's moment", t => {
  const state = lord2("will-change");
  if (state === null) { t.skip(NO_STATES); return; }
  const view = marriageDecisionView(state);
  assert.ok(view !== null && view.kind === "will_change");
  assert.deepEqual(view.options.map(option => option.choice), ["favour", "support_promise", "let_it_be"]);
  const favour = view.options[0]!;
  const paid = treasuryBalance(answerWillChange(state, "favour")) - treasuryBalance(state);
  assert.equal(favour.refusal === null, paid !== 0, "the favour is refused exactly when the engine refuses it");
  const beats = lordBeats(state).filter(beat => beat.decision === "marriage_decision");
  assert.equal(beats.length, 1);
  assert.equal(decisionModal(beats[0]!.decision!), "marriage_decision");
  assert.ok(!lordBeats(state).some(beat => beat.kind === "lord_moment" && beat.illustration === beats[0]!.illustration), "no second chip for the will");
  assert.equal(marriageDecisionView(answerWillChange(state, "let_it_be")), null, "answered: the card goes");
});

test("the contested inheritance's card opens the lord's suit on the ledger screen", t => {
  const state = lord2("contested");
  if (state === null) { t.skip(NO_STATES); return; }
  const view = marriageDecisionView(state);
  assert.ok(view !== null && view.kind === "contested");
  const plan = diplomacyOf(state).marriage!;
  const suit = state.estates?.suits.find(entry => entry.claimId === plan.claimId && entry.plaintiff === "lord");
  assert.equal(view.focus, suit?.id ?? plan.claimId);
});

test("the audit's card: punish, replace, tolerate with the engine's numbers; answered, it goes", t => {
  const state = lord2("audit-pending");
  if (state === null) { t.skip(NO_STATES); return; }
  const view = auditDecisionView(state);
  assert.ok(view !== null);
  assert.equal(view.auditId, pendingAudits(state)[0]!.id);
  assert.deepEqual(view.options.map(option => option.choice), ["punish", "replace", "tolerate"]);
  for (const option of view.options) {
    assert.equal(option.refusal === null, answerAudit(state, view.auditId, option.choice) !== state, option.choice);
  }
  assert.equal(auditDecisionView(answerAudit(state, view.auditId, "tolerate")), null);
});

test("an off-map estate's petition gets its card; the home estate's keep LM-R1's", t => {
  const names = ["inherited", "audit-pending", "attention-overloaded", "promises", "neighbour-suit"];
  const found = names.map(name => ({ name, state: lord2(name) })).filter((entry): entry is { name: string; state: GameState } => entry.state !== null);
  if (found.length === 0) { t.skip(NO_STATES); return; }
  let seen = 0;
  for (const { name, state } of found) {
    const view = offMapPetitionView(state);
    assert.equal(view === null, openOffMapPetitions(state).length === 0, name);
    if (view === null) continue;
    seen += 1;
    assert.notEqual(view.estateId, "estate-home", name);
    assert.deepEqual(view.options.map(option => option.grant), [true, false]);
    assert.notEqual(offMapPetitionView(answerEstatePetition(state, view.petitionId, true))?.petitionId, view.petitionId, `${name}: answered, it goes`);
  }
  t.diagnostic(`${seen} of ${found.length} lord2 states hold an off-map petition`);
});
