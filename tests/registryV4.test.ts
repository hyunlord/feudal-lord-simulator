/**
 * LM-E9b (spec docs/design/registry.md ER-13…ER-18): the content canon v4 in the registry — what runs and why not, the
 * expression language's missing rule and operations, binding by the first combination that holds (R2), commands applied
 * whole, and an offer answered on its bound targets.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { V4_COPY } from "../src/content/registry/v4Copy.generated";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD, raiseClaim } from "../src/engine/estates";
import { addSuitEvidence, fileSuit } from "../src/engine/estateSuits";
import { advanceRegistry, answerRegistryOffer, initialRegistry, offerChoices, openRegistryOffers, registryOf } from "../src/engine/registry";
import { evaluate, MISSING } from "../src/engine/registryDsl";
import { bindEntry, registryV4Support, runCommands, v4Candidates, v4Entry } from "../src/engine/registryV4";
import { initialAgency } from "../src/engine/townAgency";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { decodeSave } from "../src/save/saveCodec";

const load = (name: string): GameState => decodeSave(new Uint8Array(readFileSync(`fixtures/saves/v49/${name}.save.json`))).envelope.state as GameState;
function funded(state: GameState, amount: number): GameState {
  const posted = postLedgerEntries(state, [{ account: "cash", category: "rent", amount: amount - treasuryBalance(state), sourceRefs: [{ type: "actor", id: "test" }] }]);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}
/** A lord's town of chapter two with a funded treasury and the lord's suits on the given claims. */
function suing(claims: number): GameState {
  let state: GameState = funded({ ...load("chapter-two-town"), agency: initialAgency(), registry: initialRegistry() }, 500);
  const neighbour = estatesOf(state).estates.find(estate => estate.id !== "estate-home")!;
  for (let index = 0; index < claims; index += 1) {
    const piece = neighbour.pieces[index]!;
    state = raiseClaim(state, { claimant: LORD, estateId: neighbour.id, pieceId: piece.id, basis: "purchase_deed" });
  }
  for (const claim of estatesOf(state).claims.filter(entry => entry.claimant === LORD && entry.status === "open")) state = fileSuit(state, claim.id);
  return state;
}

test("ER-13, ER-18 the canon v4 loads: 200 entries, each running or blocked with its reason; every new event has its words", () => {
  const support = registryV4Support();
  assert.equal(support.length, 200);
  assert.ok(support.every(entry => entry.runs ? entry.reason === null : entry.reason !== null), "a blocked entry says why");
  assert.equal(support.filter(entry => entry.reason?.startsWith("unsupported filter") === true).length, 111, "the canon's own blocks (R5)");
  assert.ok(support.filter(entry => entry.runs).length >= 60);
  for (const entry of support.filter(item => item.runs)) {
    assert.ok(V4_COPY[entry.id] !== undefined, `${entry.id} has its words`);
    for (const choice of entry.choices.filter(item => item.supported)) assert.ok(V4_COPY[entry.id]!.choices[choice.id] !== undefined, `${entry.id}:${choice.id}`);
  }
});

test("ER-14 missing is not null: every comparison with it fails (neq too); exists sees it; the operations and derived values", () => {
  const state = funded({ ...load("chapter-two-town"), agency: initialAgency() }, 400);
  const scope = { state, bound: {}, vars: {} };
  assert.equal(evaluate({ field: "state.nothing" }, scope), MISSING);
  assert.equal(evaluate({ compare: { left: { field: "state.nothing" }, op: "neq", right: { literal: 1 } } }, scope), false);
  assert.equal(evaluate({ exists: { field: "state.nothing" } }, scope), false);
  assert.equal(evaluate({ exists: { field: "state.tick" } }, scope), true);
  assert.equal(evaluate({ operation: "coalesce", args: [{ field: "state.timberOrder" }, { literal: 0 }] }, scope), state.timberOrder ?? 0);
  assert.equal(evaluate({ call: "treasuryBalance", args: [{ field: "state" }] }, scope), 400);
  // SUBSIDY_REMAINING: a quarter of the treasury less the subsidies in force.
  assert.equal(evaluate({ derived: "SUBSIDY_REMAINING", args: [] }, scope), 100);
  assert.equal(evaluate({ compare: { left: { call: "stateCalendar", args: [{ field: "state" }] }, op: "has_year_inclusive", right: { literal: [1300, 1450] } } }, scope), true);
  assert.equal(evaluate({ operation: "count", args: [{ filter: { from: { field: "state.buildings" }, as: "b", where: { compare: { left: { field: "b.kind" }, op: "eq", right: { literal: "house" } } } } }] }, scope),
    state.buildings.filter(building => building.kind === "house").length);
});

test("ER-15 (R2) the binding takes the first combination that holds — a later suit when the first has no evidence left to add", () => {
  let state = suing(2);
  const suits = estatesOf(state).suits.filter(suit => suit.plaintiff === LORD && (suit.stage === "filed" || suit.stage === "evidence")).sort((a, b) => (a.id < b.id ? -1 : 1));
  assert.ok(suits.length >= 2);
  // Every suit but the last has all three papers: only the last can still take evidence.
  for (const suit of suits.slice(0, -1)) for (const kind of ["charter", "deed", "court_roll"] as const) state = addSuitEvidence(state, suit.id, kind);
  const entry = v4Entry("ck_evt_009")!;
  const bound = bindEntry(state, entry);
  assert.ok(bound !== null, "bound");
  assert.equal((bound.suit as { id: string }).id, suits.at(-1)!.id, "the last suit, which can still take evidence (not the first by id)");
});

test("ER-16 a choice's commands run whole or not at all, each checked to have done what it was asked", () => {
  const state = suing(1);
  const suit = estatesOf(state).suits.find(entry => entry.plaintiff === LORD)!;
  const scope = { state, bound: { suit }, vars: {} };
  const good = runCommands(state, [{ type: "add_suit_evidence", args: { suitId: { binding: "bound.suit.id" }, evidence: "charter" } }], scope);
  assert.ok(good !== null);
  // The same evidence twice: the second is refused, so the first is not kept.
  assert.equal(runCommands(state, [{ type: "add_suit_evidence", args: { suitId: suit.id, evidence: "deed" } }, { type: "add_suit_evidence", args: { suitId: suit.id, evidence: "deed" } }], scope), null);
  assert.equal(runCommands(state, [{ type: "add_suit_evidence", args: { suitId: { binding: "bound.missing.id" }, evidence: "deed" } }], scope), null, "a missing binding");
});

test("ER-3, ER-4 a v4 offer: drawn in a season, answered on its bound suit, a second answer refused", () => {
  let state = suing(1);
  let offered: GameState | null = null;
  for (let season = 1; season < 80 && offered === null; season += 1) {
    const at = { ...state, tick: state.tick - (state.tick % 1000) + season * 1000 };
    if (v4Candidates(at, []).some(candidate => candidate.entry.id === "ck_evt_009")) {
      const next = advanceRegistry(at);
      if (openRegistryOffers(next).some(offer => offer.entryId === "ck_evt_009")) offered = next;
    }
  }
  assert.ok(offered !== null, "ck_evt_009 offered");
  const offer = openRegistryOffers(offered).find(entry => entry.entryId === "ck_evt_009")!;
  assert.equal(offer.source, "v4");
  const choices = offerChoices(offered, offer);
  assert.ok(choices.length >= 2 && choices.includes("a"));
  const answered = answerRegistryOffer(offered, offer.id, "a");
  const suit = estatesOf(answered).suits.find(entry => entry.id === offer.bound!.suit)!;
  assert.ok(estatesOf(answered).claims.find(claim => claim.id === suit.claimId)!.evidence.some(entry => entry.kind === "charter"));
  assert.equal(registryOf(answered).occurrences.find(entry => entry.id === offer.id)!.status, "answered");
  assert.equal(answerRegistryOffer(answered, offer.id, "b"), answered, "a second answer is refused");
  state = answered;
});
