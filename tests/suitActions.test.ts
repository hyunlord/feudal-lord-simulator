/**
 * LM-R2-E ② (render request §2): what the lord can do in a suit now and why not — the read agrees with the commands
 * (evidence, patron, enforcement) and gives the tick of the next stage.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { addSuitEvidence, fileSuit, seekSuitPatron, suitActions } from "../src/engine/estateSuits";
import { estatesOf, LORD } from "../src/engine/estates";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { newGameState } from "../src/state/newGame";

const SEASON = PRESSURE_BALANCE.seasonTicks;

/** The lord's slice with the lord's open claim filed as a suit (the treasury given enough for its fees). */
function withLordSuit(): { readonly state: GameState; readonly suitId: string } {
  const opening = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 }) as GameState;
  const funded = postLedgerEntries(opening, [{ account: "cash", category: "opening_balance", amount: 2_000, sourceRefs: [{ type: "actor", id: "test" }] }]);
  const rich = { ...opening, ledger: funded.ledger, treasuryCoin: funded.treasuryCoin };
  const claim = estatesOf(rich).claims.find(entry => entry.claimant === LORD && entry.status === "open");
  assert.ok(claim !== undefined, "the lord's slice opens with a claim of the lord's");
  const state = fileSuit(rich, claim.id);
  const suit = estatesOf(state).suits.find(entry => entry.claimId === claim.id);
  assert.ok(suit !== undefined);
  return { state, suitId: suit.id };
}

test("evidence: each kind's cost and weight; refused out of its stage, once given, or with the treasury short — as the command", () => {
  const { state, suitId } = withLordSuit();
  const actions = suitActions(state, suitId)!;
  assert.ok(actions.evidence.length >= 3);
  for (const option of actions.evidence) {
    const after = addSuitEvidence(state, suitId, option.kind);
    assert.equal(after !== state, option.refusal === null, `${option.kind}: ${option.refusal}`);
    if (option.refusal === null) assert.equal(suitActions(after, suitId)!.evidence.find(entry => entry.kind === option.kind)!.refusal, "given");
  }
  const broke = postLedgerEntries(state, [{ account: "cash", category: "lawsuit", amount: -treasuryBalance(state), sourceRefs: [{ type: "actor", id: "test" }] }]);
  const poor = { ...state, ledger: broke.ledger, treasuryCoin: broke.treasuryCoin };
  for (const option of suitActions(poor, suitId)!.evidence) if (option.cost > 0 && option.refusal !== "given" && option.refusal !== "stage") assert.equal(option.refusal, "treasury");
});

test("patrons, enforcement and the next stage: the stage refuses them until it comes; the next stage is the season after a season", () => {
  const { state, suitId } = withLordSuit();
  const actions = suitActions(state, suitId)!;
  const suit = estatesOf(state).suits.find(entry => entry.id === suitId)!;
  for (const patron of actions.patrons) {
    if (suit.stage !== "patronage") assert.equal(patron.refusal, "stage");
    assert.equal(seekSuitPatron(state, suitId, patron.factionId) !== state, patron.refusal === null);
  }
  if (suit.stage !== "enforcing" && suit.stage !== "closed") assert.equal(actions.enforce!.refusal, "stage");
  assert.equal(actions.nextStageTick, Math.ceil((suit.stageSince + SEASON) / SEASON) * SEASON);
  // In the patronage stage a faction under the relation threshold is refused for its relation.
  const patronage: GameState = { ...state, estates: { ...estatesOf(state), suits: estatesOf(state).suits.map(entry => entry.id === suitId ? { ...entry, stage: "patronage" as const } : entry) } };
  for (const patron of suitActions(patronage, suitId)!.patrons) {
    assert.notEqual(patron.refusal, "stage");
    assert.equal(seekSuitPatron(patronage, suitId, patron.factionId) !== patronage, patron.refusal === null, `${patron.factionId}: ${patron.refusal}`);
  }
  assert.equal(suitActions(state, "suit-none"), null);
  // A suit brought against the lord (a neighbour's recovery, ER-21): no action of his, the screen shows it only.
  const against: GameState = { ...state, estates: { ...estatesOf(state), suits: estatesOf(state).suits.map(entry => entry.id === suitId ? { ...entry, plaintiff: "neighbour_1", defendant: LORD } : entry) } };
  assert.equal(suitActions(against, suitId), null);
});
