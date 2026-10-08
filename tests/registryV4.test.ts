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
  // DTR-21: a stage costs a share of the stake's year in lord mode — the treasury given enough for the suits and their papers.
  let state: GameState = funded({ ...load("chapter-two-town"), agency: initialAgency(), registry: initialRegistry() }, 2_000);
  const neighbour = estatesOf(state).estates.find(estate => estate.id !== "estate-home")!;
  for (let index = 0; index < claims; index += 1) {
    const piece = neighbour.pieces[index]!;
    state = raiseClaim(state, { claimant: LORD, estateId: neighbour.id, pieceId: piece.id, basis: "purchase_deed" });
  }
  for (const claim of estatesOf(state).claims.filter(entry => entry.claimant === LORD && entry.status === "open")) state = fileSuit(state, claim.id);
  return state;
}

test("ER-13, ER-18 the canon v4 + v4.1 loads: 215 entries, each running or blocked with its reason; every new event has its words", () => {
  const support = registryV4Support();
  assert.equal(support.length, 215);
  assert.ok(support.every(entry => entry.runs ? entry.reason === null : entry.reason !== null), "a blocked entry says why");
  assert.equal(support.filter(entry => entry.reason?.startsWith("unsupported filter") === true).length, 106, "the canon's own blocks (R5)");
  // DEC-TRACE (the user's decision 2026-10-06): the v4.2 audit's 38 held, and 3 more held whole when their indirect
  // choices were held (102, 123, 138) — 45 of the 86 that ran before stay on; the first Engine B batch adds five.
  assert.equal(support.filter(entry => entry.reason?.startsWith("held") === true).length, 41, "the held events, each with its reason");
  assert.equal(support.filter(entry => entry.runs).length, 50);
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

test("ER-19 (R3) a hold is a choice only when time costs it: a held suit's claim weakens; a sender's relation falls through the ledger; no cost, no hold", async () => {
  const { applyHold, holdCost } = await import("../src/engine/registryV4");
  const { HOLD_CLAIM_WEAKEN, HOLD_RELATION_DELTA } = await import("../src/content/registry/registryHoldConfig");
  // A suit held: its claim weakens.
  const state = suing(1);
  const suit = estatesOf(state).suits.find(entry => entry.plaintiff === LORD)!;
  const claim = estatesOf(state).claims.find(entry => entry.id === suit.claimId)!;
  const held = applyHold(state, v4Entry("ck_evt_009")!, { suit, claim })!;
  assert.equal(estatesOf(held.state).claims.find(entry => entry.id === claim.id)!.strength, Math.max(0, claim.strength - HOLD_CLAIM_WEAKEN));
  // ck_evt_005's merchants: holding moves the first merchant house's relation, answered through the game's command.
  assert.deepEqual(holdCost(v4Entry("ck_evt_005")!), { kind: "relation", faction: "merchant_house_1" });
  // The lord's own house as the sender: no cost, so the hold is not offered.
  assert.equal(holdCost(v4Entry("ck_evt_046")!), null);
  assert.equal(registryV4Support().find(entry => entry.id === "ck_evt_046")!.choices.find(choice => choice.id === "stock")!.supported, false);
  // A v4 hold answered: the occurrence keeps its cost and the ledger (the game's command record) moves the relation.
  const { recordDecision } = await import("../src/engine/history");
  const offer = { id: "registry:ck_evt_005:test:1", entryId: "ck_evt_005", boundId: "", offeredTick: state.tick, deadline: state.tick + 1000,
    status: "offered" as const, receipt: { draw: 0, chancePermille: 1000, conditions: [] }, source: "v4" as const, bound: {}, key: "market_dues|", context: "" };
  const offered: GameState = { ...state, registry: { ...registryOf(state), occurrences: [offer] } };
  const answered: GameState = { ...offered, registry: { ...registryOf(offered), occurrences: [{ ...offer, status: "answered", choiceId: "c", settledTick: state.tick,
    hold: { faction: "merchant_house_1", delta: HOLD_RELATION_DELTA } }] } };
  const before = offered.factions!.factions.find(faction => faction.id === "merchant_house_1")!.relation;
  const recorded = recordDecision(offered, answered, { type: "answer_registry_offer", occurrenceId: offer.id, choiceId: "c" });
  assert.equal(recorded.factions!.factions.find(faction => faction.id === "merchant_house_1")!.relation, Math.max(-100, before + HOLD_RELATION_DELTA));
});

test("R4 a compound choice runs whole: a suit filed and its deed added to that suit (the second reads the first's result); a refused second step keeps no suit", () => {
  let state = funded({ ...load("chapter-two-town"), agency: initialAgency(), registry: initialRegistry() }, 500);
  const neighbour = estatesOf(state).estates.find(estate => estate.id !== "estate-home")!;
  state = raiseClaim(state, { claimant: LORD, estateId: neighbour.id, pieceId: neighbour.pieces[0]!.id, basis: "purchase_deed" });
  const claim = estatesOf(state).claims.at(-1)!;
  const choice = v4Entry("ck_evt_051")!.choices.find(entry => entry.id === "file_with_deed")!;
  const scope = { state, bound: { claim }, vars: {} };
  const done = runCommands(state, choice.commands, scope)!;
  const suit = estatesOf(done).suits.find(entry => entry.claimId === claim.id)!;
  assert.ok(suit !== undefined, "the suit is filed");
  assert.ok(estatesOf(done).claims.find(entry => entry.id === claim.id)!.evidence.some(entry => entry.kind === "deed"), "and its deed added");
  // The deed already on the claim: the second step is refused, so the filing is not kept either.
  const filedOnly = runCommands(state, [choice.commands[0]!], scope)!;
  const withDeed = addSuitEvidence(filedOnly, estatesOf(filedOnly).suits.find(entry => entry.claimId === claim.id)!.id, "deed");
  const unfiled: GameState = { ...state, estates: { ...estatesOf(state), claims: estatesOf(withDeed).claims.map(entry => entry.id === claim.id ? { ...entry, status: "open" as const } : entry) } };
  assert.equal(runCommands(unfiled, choice.commands, { ...scope, state: unfiled }), null);
});

test("ER-22 one-shot entries are paced: the chance is the ones left over the seasons left, and falls as they are used", async () => {
  const { oneShotPacePermille, v4Entries } = await import("../src/engine/registryV4");
  const state = suing(1);
  const full = oneShotPacePermille(state, []);
  assert.ok(full > 0 && full < 1000, `${full}‰ at the start`);
  const oneShots = v4Entries().filter(entry => entry.recurrence.mode === "once_per_campaign").map(entry => entry.id);
  const used = oneShotPacePermille(state, oneShots.slice(0, Math.floor(oneShots.length / 2)).map(entryId => ({ entryId, offeredTick: 0, status: "answered" })));
  assert.ok(used < full, "fewer left, a smaller chance");
  // A season whose pace draw fails offers no one-shot entry.
  const candidates = v4Candidates(state, []);
  const pace = oneShotPacePermille(state, []);
  const { hashSeed } = await import("../src/engine/prng");
  const open = hashSeed(state.seed, "registry-pace", Math.floor(state.tick / 1000)) % 1000 < pace;
  if (!open) assert.ok(candidates.every(candidate => candidate.entry.recurrence.mode !== "once_per_campaign"));
});
