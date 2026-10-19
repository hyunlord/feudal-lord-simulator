import assert from "node:assert/strict";
import test from "node:test";

import { EVIDENCE_COST, EVIDENCE_WEIGHT } from "../src/content/estateConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import type { Evidence, Suit, SuitStage } from "../src/engine/estates.types";
import { initialFactions } from "../src/engine/factions";
import { estatesOf, LORD } from "../src/engine/estates";
import { advanceSuits, fileSuit, suitActions, suitAwaitsLord, suitStageCost, suitVerdictTick, withSuit } from "../src/engine/estateSuits";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { newGameState } from "../src/state/newGame";

function fixture(fast = false): { readonly state: GameState; readonly suit: Suit } {
  const opening = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 });
  assert.ok(opening);
  const posted = postLedgerEntries(opening, [{ account: "cash", category: "opening_balance", amount: 2_000, sourceRefs: [{ type: "actor", id: "test" }] }]);
  const rich: GameState = { ...opening, tick: 123, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
  const claim = estatesOf(rich).claims.find(entry => entry.claimant === LORD && entry.status === "open");
  assert.ok(claim);
  const state = fileSuit(rich, claim.id);
  const filed = estatesOf(state).suits.find(entry => entry.claimId === claim.id);
  assert.ok(filed);
  const suit = { ...filed, ...(fast ? { fast: true as const } : {}) };
  return { state: withSuit(state, suit), suit };
}

for (const fast of [false, true]) test(`verdict tick stays fixed through actual ${fast ? "fast" : "ordinary"} seasonal transitions`, () => {
  let { state, suit } = fixture(fast);
  const expected = fast ? 3_000 : 5_000;
  const stages: readonly SuitStage[] = fast ? ["filed", "hearing"] : ["filed", "evidence", "patronage", "hearing"];
  for (const [index, stage] of stages.entries()) {
    assert.equal(suit.stage, stage);
    assert.equal(suitVerdictTick(state, suit), expected);
    const snapshot = JSON.stringify(state);
    suitAwaitsLord(state, suit);
    assert.equal(JSON.stringify(state), snapshot, "both reads preserve every state path");
    const remaining: readonly SuitStage[] = [...stages.slice(index + 1), "enforcing"];
    assert.deepEqual(suitActions(state, suit.id)?.stageCosts,
      remaining.map(next => ({ stage: next, cost: suitStageCost(state, suit, next) })));
    state = advanceSuits({ ...state, tick: (index + 2) * 1_000 });
    const advanced = estatesOf(state).suits.find(entry => entry.id === suit.id);
    assert.ok(advanced);
    suit = advanced;
  }
  assert.ok(suit.verdict);
  assert.equal(suit.stageSince, expected);
  assert.equal(suitVerdictTick(state, suit), null);
});

test("a missed plaintiff fee postpones the earliest verdict without a past deadline", () => {
  const { state, suit } = fixture();
  const posted = postLedgerEntries(state, [{ account: "cash", category: "lawsuit", amount: -treasuryBalance(state), sourceRefs: [{ type: "actor", id: "test" }] }]);
  const hearingNext = { ...suit, stage: "patronage" as const };
  const stalled = advanceSuits(withSuit({ ...state, tick: 2_000, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin }, hearingNext));
  assert.equal(estatesOf(stalled).suits.find(entry => entry.id === suit.id)?.stage, "patronage");
  assert.equal(suitVerdictTick(stalled, hearingNext), 4_000);
  assert.equal(suitVerdictTick({ ...stalled, tick: 2_999 }, hearingNext), 4_000);
});

test("awaiting is a stage-specific available response, never hearing or closed", () => {
  const { state, suit } = fixture();
  const factions = initialFactions(state);
  const friendly = { ...state, factions: { ...factions, factions: factions.factions.map(entry => ({ ...entry, relation: 100 })) } };
  for (const defendant of [false, true]) {
    const base: Suit = defendant ? { ...suit, plaintiff: "neighbour_1", defendant: LORD } : suit;
    for (const stage of ["filed", "evidence", "patronage", "hearing", "judged", "closed"] as const) {
      const staged = { ...base, stage };
      assert.equal(suitAwaitsLord(withSuit(friendly, staged), staged), ["filed", "evidence", "patronage"].includes(stage), `${defendant}/${stage}`);
    }
    const answered = { ...base, stage: "patronage" as const, patron: "church", defencePatron: "church" };
    assert.equal(suitAwaitsLord(withSuit(friendly, answered), answered), false);
    const poorRelations: GameState = { ...friendly, factions: { ...factions, factions: factions.factions.map(entry => ({ ...entry, relation: -100 })) } };
    const patronage = { ...base, stage: "patronage" as const };
    assert.equal(suitAwaitsLord(withSuit(poorRelations, patronage), patronage), false);
  }
  const allEvidence = Object.keys(EVIDENCE_COST).map((kind): Evidence => {
    assert.ok(kind === "charter" || kind === "deed" || kind === "court_roll" || kind === "witnesses" || kind === "possession_years");
    return { kind, weight: EVIDENCE_WEIGHT[kind], tick: state.tick };
  });
  const defendant = { ...suit, plaintiff: "neighbour_1", defendant: LORD, defenceEvidence: allEvidence };
  assert.equal(suitAwaitsLord(withSuit(state, defendant), defendant), false);
  const unrelated = { ...suit, plaintiff: "neighbour_1", defendant: "neighbour_2" };
  assert.equal(suitAwaitsLord(withSuit(state, unrelated), unrelated), false);
});


test("a suit against the lord keeps its verdict date through all automatic stages", () => {
  const initial = fixture();
  let suit: Suit = { ...initial.suit, plaintiff: "neighbour_1", defendant: LORD };
  let state = withSuit(initial.state, suit);
  for (const [index, stage] of (["filed", "evidence", "patronage", "hearing"] as const).entries()) {
    assert.equal(suit.stage, stage);
    assert.equal(suitVerdictTick(state, suit), 5_000);
    state = advanceSuits({ ...state, tick: (index + 2) * 1_000 });
    const advanced = estatesOf(state).suits.find(entry => entry.id === suit.id);
    assert.ok(advanced);
    suit = advanced;
  }
  assert.ok(suit.verdict);
  for (const stage of ["judged", "enforcing", "closed"] as const) {
    assert.equal(suitVerdictTick(state, { ...suit, stage }), null);
  }
});

test("possession response follows enforcement and defence hold availability", () => {
  const { state, suit } = fixture();
  const enforcing: Suit = { ...suit, stage: "enforcing", verdict: "plaintiff", hold: 50 };
  assert.equal(suitAwaitsLord(withSuit(state, enforcing), enforcing), true);
  const posted = postLedgerEntries(state, [{ account: "cash", category: "lawsuit", amount: -treasuryBalance(state), sourceRefs: [{ type: "actor", id: "test" }] }]);
  const poor = { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
  assert.equal(suitAwaitsLord(withSuit(poor, enforcing), enforcing), false);
  const defendant = { ...enforcing, plaintiff: "neighbour_1", defendant: LORD };
  const estates = estatesOf(state);
  const holding = { ...state, estates: { ...estates, estates: estates.estates.map(estate => estate.id === suit.estateId
    ? { ...estate, possessor: LORD, pieces: estate.pieces.map(piece => piece.id === suit.pieceId ? { ...piece, possessor: LORD } : piece) } : estate) } };
  assert.equal(suitAwaitsLord(withSuit(holding, defendant), defendant), true);
  const held = { ...defendant, heldTick: state.tick };
  assert.equal(suitAwaitsLord(withSuit(holding, held), held), false);
});
