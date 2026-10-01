/** FIX-12 (docs/design/negotiation.md NG-5a·NG-7a, decisions FX12-*): the scenarios of the short fixes before LM-E4. */
import assert from "node:assert/strict";
import test from "node:test";

import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import { DEBT_INSTALMENT_MAX_YEARS, PROMISE_PAYMENT_TICKS } from "../src/content/diplomacyConfig";
import type { Term } from "../src/engine/diplomacy.types";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import {
  answerCounter, lordBotMarriageCommands, lordHouseKin, marriageCandidates, marriageGrooms, marriageRefusal, MARRIAGE_ESTATE_ID, proposeMarriage,
} from "../src/engine/marriage";
import { counterOffer, debtInstalmentCap, diplomacyOf } from "../src/engine/negotiation";
import { computeReachablePalisadeProposalForState, palisadeProposalForPlacement } from "../src/engine/palisadeRouteAccess";
import { advanceTick } from "../src/engine/tick";
import { initialAgency } from "../src/engine/townAgency";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { gameReducer } from "../src/state/gameStore";

const COUNTERPART = `estate:${MARRIAGE_ESTATE_ID}`;
const OFFER: readonly Term[] = [{ kind: "cash", giver: "proposer", amount: 200 }, { kind: "inheritance_non_infringement", giver: "counterpart" },
  { kind: "residence", giver: "counterpart" }, { kind: "consent", giver: "counterpart" }];

/** A lord-mode town a year in (the home estate has a ledger year), its treasury `coin`. */
function town(seed: number, coin = 2_000): GameState {
  let state: GameState = { ...(createGrowthOpening(seed).state as GameState), agency: initialAgency() };
  while (state.persons === undefined) state = advanceTick(state);
  for (let tick = 0; tick < 4_000; tick += 1) state = advanceTick(state);
  const posted = postLedgerEntries(state, [{ account: "cash", category: "opening_balance", amount: coin - treasuryBalance(state), sourceRefs: [{ type: "scenario", id: "test" }] }]);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}
const towns = new Map<number, GameState>();
const at = (seed: number) => { if (!towns.has(seed)) towns.set(seed, town(seed)); return towns.get(seed)!; };

/** The contract made on the first offer, its counter taken if one came. */
function contracted(state: GameState, groomId?: string): GameState {
  let next = gameReducer(state, { type: "propose_marriage", terms: OFFER, ...(groomId === undefined ? {} : { groomId }) });
  const negotiation = diplomacyOf(next).negotiations.at(-1)!;
  if (negotiation.status === "countered") next = answerCounter(next, negotiation.id, true);
  return next;
}

test("FX12-1 the counter asks the debt by instalments: a year's share at most a quarter of the lord's estates' year, five years at most", () => {
  const state = at(1);
  const cap = debtInstalmentCap(state);
  assert.ok(cap > 0, `${cap}`);
  const counter = counterOffer(state, LORD, COUNTERPART, OFFER, "k")!;
  const debt = counter.terms.find(term => term.kind === "debt_assumption" && term.giver === "proposer")!;
  assert.ok(debt.years! >= 1 && debt.years! <= DEBT_INSTALMENT_MAX_YEARS, `${debt.years}`);
  assert.ok(Math.ceil(debt.amount! / debt.years!) <= cap, `${debt.amount}/${debt.years} over ${cap}`);
  assert.ok(debt.amount! <= cap * DEBT_INSTALMENT_MAX_YEARS);
});

test("FX12-1 a debt the lord's year cannot carry is not asked: the counter turns to the next desire (cash)", () => {
  const state = at(1);
  // The lord holds no estate in possession (its possession lost, LM-E2): his year carries no instalment.
  const estates = estatesOf(state);
  const poor = { ...state, estates: { ...estates, estates: estates.estates.map(estate => estate.possessor === LORD ? { ...estate, possessor: "crown" } : estate) } };
  assert.equal(debtInstalmentCap(poor), 0);
  const counter = counterOffer(poor, LORD, COUNTERPART, OFFER, "k");
  assert.ok(counter === null || !counter.terms.some(term => term.kind === "debt_assumption"), JSON.stringify(counter?.terms));
  if (counter !== null) assert.ok(counter.terms.some(term => term.kind === "cash" && (term.amount ?? 0) > 200), "cash raised instead");
});

test("FX12-1 the instalments are a promise a year in the ledger, their sum the debt, each due a year after the last", () => {
  const state = at(1);
  const counter = counterOffer(state, LORD, COUNTERPART, OFFER, "k")!;
  const debt = counter.terms.find(term => term.kind === "debt_assumption")!;
  // Take the counter as an offer of its own terms so the contract writes them (the draw may still counter: answer it).
  let next = proposeMarriage(state, counter.terms);
  const negotiation = diplomacyOf(next).negotiations.at(-1)!;
  if (negotiation.status === "countered") next = answerCounter(next, negotiation.id, true);
  const terms = negotiation.status === "countered" ? negotiation.counter!.terms : counter.terms;
  const asked = terms.find(term => term.kind === "debt_assumption")!;
  const instalments = diplomacyOf(next).promises.filter(promise => promise.term === "debt_assumption");
  assert.equal(instalments.length, asked.years);
  assert.equal(instalments.reduce((sum, promise) => sum + (promise.amount ?? 0), 0), asked.amount);
  instalments.forEach((promise, index) => assert.equal(promise.deadline, state.tick + (index + 1) * PROMISE_PAYMENT_TICKS));
  assert.ok(debt.amount! > 0);
});

test("FX12-1 the lord-mode bot keeps each promise once the treasury carries it", () => {
  const made = contracted(at(1));
  const open = diplomacyOf(made).promises.filter(promise => promise.promisor === LORD && promise.status === "open");
  assert.ok(open.length > 0);
  const commands = lordBotMarriageCommands(made);
  assert.deepEqual(commands, [{ type: "keep_promise", promiseId: open.find(promise => (promise.amount ?? 0) <= treasuryBalance(made))!.id }]);
  const kept = gameReducer(made, commands[0]!);
  assert.equal(diplomacyOf(kept).promises.find(promise => promise.id === open[0]!.id)?.status, "kept");
});

test("FX12-2 the openings with daughters only (3, 5) can offer a marriage: a man of the house off the map is the groom", () => {
  let married = 0;
  for (const seed of [3, 5]) {
    const state = at(seed);
    const grooms = marriageGrooms(state);
    assert.ok(grooms.length > 0, `seed ${seed}`);
    assert.ok(grooms.every(entry => entry.relation !== "son"), "no son of age");
    assert.ok(["brother", "nephew", "cousin"].includes(grooms[0]!.relation));
    assert.equal(marriageRefusal(state, OFFER), null, `seed ${seed}`);
    const made = contracted(state);
    if (diplomacyOf(made).marriage === undefined) continue;
    married += 1;
    // The groom comes to the manor (a manor person of the house); he is no longer offered.
    const plan = diplomacyOf(made).marriage!;
    const groom = made.persons!.people.find(person => person.id === plan.groomId)!;
    assert.ok(groom.id.startsWith("m-") && groom.householdId === "manor" && groom.tags.includes(`kin-of:${grooms[0]!.person.id}`));
    assert.ok(!marriageGrooms(made).some(entry => entry.person.id === grooms[0]!.person.id));
  }
  assert.ok(married >= 1, "at least one of the two contracts made");
});

test("FX12-2 the grooms in order: sons of age, the lord himself when widowed, then the brother, a nephew, a cousin; one can be chosen", () => {
  const state = at(3);
  const lord = state.persons!.people.find(person => person.role === "head" && person.householdId === "manor")!;
  const widowed = { ...state, persons: { ...state.persons!, people: state.persons!.people.filter(person => !(person.householdId === "manor" && person.role === "spouse")) } };
  const grooms = marriageGrooms(widowed);
  if (lord.sex === "male") {
    assert.equal(grooms[0]!.relation, "widowed_lord");
    assert.equal(grooms[0]!.person.id, lord.id);
  }
  const kin = lordHouseKin(state).filter(entry => !entry.person.tags.includes("married"));
  const last = kin.at(-1)!;
  assert.equal(marriageCandidates(widowed, last.person.id).groom?.id, last.person.id, "a groom asked for by id");
  assert.equal(marriageCandidates(widowed, "m-nobody").groom, null);
  assert.equal(marriageRefusal(widowed, OFFER, "m-nobody"), "no_groom");
});

test("FX12-5 the placement's proposal: the same placement gives the same result without recomputing; the exact one is unchanged", () => {
  const state = at(1);
  const first = palisadeProposalForPlacement(state);
  assert.deepEqual(first, computeReachablePalisadeProposalForState(state));
  // Only where timber lies and the next ordinal differ: the same placement, the same (kept) result.
  const timber = { ...state, treasuryTimber: state.treasuryTimber > 0 ? 0 : 5, nextConstructionOrdinal: state.nextConstructionOrdinal + 1 };
  assert.equal(palisadeProposalForPlacement(timber), first);
  // A building moved is another placement.
  const moved = { ...state, buildings: state.buildings.map((building, index) => index === 0 ? { ...building, tx: building.tx + 1 } : building) };
  assert.notEqual(palisadeProposalForPlacement(moved), first);
});
