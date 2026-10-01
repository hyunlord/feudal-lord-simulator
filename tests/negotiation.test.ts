/** LM-E3 negotiation, promises and the marriage contract (spec docs/design/negotiation.md NG-1…NG-9): the scenarios. */
import assert from "node:assert/strict";
import test from "node:test";

import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import { ACCEPT_THETA, COUNTER_MARGIN, GREED_MAX, MATERIAL_CAP, MARRIAGE_TIMES, PROMISE_STAKE } from "../src/content/diplomacyConfig";
import type { GameState } from "../src/engine/engine.types";
import { estateById, estatesOf, LORD } from "../src/engine/estates";
import {
  advanceDiplomacy, answerCounter, answerWillChange, keepPromise, lordBotMarriageCommands, marriageCandidates, marriageRefusal, MARRIAGE_ESTATE_ID, proposeMarriage,
} from "../src/engine/marriage";
import { counterOffer, diplomacyOf, evaluateOffer, materialCeiling } from "../src/engine/negotiation";
import type { Term } from "../src/engine/diplomacy.types";
import { advanceTick } from "../src/engine/tick";
import { initialAgency } from "../src/engine/townAgency";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";

const COUNTERPART = `estate:${MARRIAGE_ESTATE_ID}`;
/** A lord-mode town a few weeks in, its heir grown to 15 (the opening's boy aged on paper), its treasury `coin`. */
function town(coin = 2_000, seed = 1): GameState {
  let state: GameState = { ...(createGrowthOpening(seed).state as GameState), agency: initialAgency() };
  while (state.persons === undefined) state = advanceTick(state);
  const year = 1300;
  const persons = { ...state.persons, people: state.persons.people.map(person => person.householdId === "manor" && person.role === "child" && person.sex === "male"
    ? { ...person, birthYear: year - 15 } : person) };
  const posted = postLedgerEntries(state, [{ account: "cash", category: "opening_balance", amount: coin - treasuryBalance(state), sourceRefs: [{ type: "scenario", id: "test" }] }]);
  return { ...state, persons, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}
const OFFER: readonly Term[] = [{ kind: "cash", giver: "proposer", amount: 200 }, { kind: "inheritance_non_infringement", giver: "counterpart" },
  { kind: "residence", giver: "counterpart" }, { kind: "consent", giver: "counterpart" }];
const base = town();

test("NG-3 the acceptance is a sum of named reasons, read as five tiers by σ((A − θ) / s), with its three to five largest reasons", () => {
  const acceptance = evaluateOffer(base, LORD, COUNTERPART, OFFER);
  assert.equal(acceptance.score, acceptance.reasons.reduce((sum, reason) => sum + reason.value, 0));
  assert.deepEqual(acceptance.reasons.map(reason => reason.name).sort(), ["base", "concession", "inheritance_risk", "material", "urgency"].sort());
  assert.ok(acceptance.top.length >= 3 && acceptance.top.length <= 5);
  assert.ok(acceptance.permille > 0 && acceptance.permille < 1000);
  // More cash moves the tier up the five (until money stops counting).
  const tiers = [0, 400, 800, 2_000].map(cash => evaluateOffer(base, LORD, COUNTERPART, OFFER.map(term => term.kind === "cash" ? { ...term, amount: cash } : term)).tier);
  const order = ["impossible", "unlikely", "close", "likely", "almost_certain"];
  for (let index = 1; index < tiers.length; index += 1) assert.ok(order.indexOf(tiers[index]!) >= order.indexOf(tiers[index - 1]!), tiers.join(" "));
});

test("NG-4 money cannot buy everything: the material reason stops at its cap, so floors below the line stay below it", () => {
  const rich = OFFER.map(term => term.kind === "cash" ? { ...term, amount: 100_000 } : term);
  assert.equal(evaluateOffer(base, LORD, COUNTERPART, rich).reasons.find(reason => reason.name === "material")!.value, MATERIAL_CAP);
  // A lord who broke three promises to this house and was demoted: no sum of money reaches the line.
  const broken = { ...base, lordship: { house: { order: 1, name: "x", heraldrySeed: 1, since: 0 }, pastHouses: [], titleDemoted: true, decline: null },
    diplomacy: { ...diplomacyOf(base), promises: [1, 2, 3].map(index => ({ id: `promise-${index}`, promisor: LORD, promisee: COUNTERPART, term: "pension" as const,
      amount: 10, deadline: 0, witnesses: [], stake: PROMISE_STAKE, status: "broken" as const, negotiationId: "n" })) } };
  assert.ok(materialCeiling(broken, LORD, COUNTERPART, rich) < ACCEPT_THETA);
  const floored = evaluateOffer(broken, LORD, COUNTERPART, rich);
  assert.ok(floored.score < ACCEPT_THETA && (floored.tier === "impossible" || floored.tier === "unlikely"));
  assert.ok(floored.reasons.some(reason => reason.name === "broken_promises" && reason.value === -45));
  assert.ok(floored.reasons.some(reason => reason.name === "rank"));
  assert.equal(counterOffer(broken, LORD, COUNTERPART, rich, "k"), null, "no bundle lifts it: no counter");
});

test("NG-4 a red line makes the offer impossible whatever else it holds; the counter leaves it out", () => {
  const ward = [...OFFER, { kind: "wardship" as const, giver: "counterpart" as const }];
  const acceptance = evaluateOffer(base, LORD, COUNTERPART, ward);
  assert.equal(acceptance.tier, "impossible");
  assert.ok(acceptance.reasons.some(reason => reason.name === "red_line"));
  const counter = counterOffer(base, LORD, COUNTERPART, ward, "k")!;
  assert.ok(!counter.terms.some(term => term.kind === "wardship"));
  assert.deepEqual(counter.changes.find(change => change.kind === "wardship"), { kind: "wardship", change: "removed" });
});

test("NG-5 the counter is the smallest bundle just over the line: its desires in order, only what lifts the score, the changes marked", () => {
  const counter = counterOffer(base, LORD, COUNTERPART, OFFER, "k")!;
  const target = counter.acceptance.score;
  assert.ok(target >= ACCEPT_THETA + COUNTER_MARGIN && target <= ACCEPT_THETA + COUNTER_MARGIN + GREED_MAX + 1, `${target}`);
  const debt = counter.terms.find(term => term.kind === "debt_assumption")!;
  assert.ok(debt.amount! > 0, "the debt taken on first (its most wanted)");
  assert.deepEqual(counter.changes, [{ kind: "debt_assumption", change: "added", to: debt.amount }], "only what changed");
  // A little less of it falls short of what the counterpart asked.
  const less = counter.terms.map(term => term.kind === "debt_assumption" ? { ...term, amount: debt.amount! - 30 } : term);
  assert.ok(evaluateOffer(base, LORD, COUNTERPART, less).score < target);
});

test("NG-7 an offer: refused without a groom, a bride or the money; under way while one waits", () => {
  const young = { ...base, persons: { ...base.persons!, people: base.persons!.people.map(person => person.householdId === "manor" && person.role === "child" ? { ...person, birthYear: 1295 } : person) } };
  assert.equal(marriageRefusal(young, OFFER), "no_groom");
  assert.equal(marriageRefusal(town(50), OFFER), "treasury");
  const offered = proposeMarriage(base, OFFER);
  assert.notEqual(offered, base);
  if (diplomacyOf(offered).negotiations[0]!.status === "countered") assert.equal(marriageRefusal(offered, OFFER), "under_way");
  assert.ok(marriageCandidates(base).bride !== null && marriageCandidates(base).groom !== null);
});

test("NG-7 the contract: the portion paid, the promises written, the relation raised, the inheritance expected (a claim by marriage)", () => {
  let state = proposeMarriage(base, OFFER);
  const negotiation = diplomacyOf(state).negotiations[0]!;
  if (negotiation.status === "countered") state = answerCounter(state, negotiation.id, true);
  const diplomacy = diplomacyOf(state);
  assert.ok(diplomacy.marriage !== undefined);
  assert.ok(treasuryBalance(state) <= treasuryBalance(base) - 200);
  assert.ok(diplomacy.promises.some(entry => entry.promisor === COUNTERPART && entry.term === "inheritance_non_infringement"));
  assert.equal(diplomacy.relations[COUNTERPART], 10);
  const claim = estatesOf(state).claims.find(entry => entry.id === diplomacy.marriage!.claimId)!;
  assert.deepEqual([claim.claimant, claim.estateId, claim.basis], [LORD, MARRIAGE_ESTATE_ID, "marriage"]);
});

test("NG-6 a promise kept is trust in the next offer; a promise broken at its deadline costs the relation and stays as a floor", () => {
  let state = proposeMarriage(base, OFFER);
  const negotiation = diplomacyOf(state).negotiations[0]!;
  if (negotiation.status === "countered") state = answerCounter(state, negotiation.id, true);
  const ours = diplomacyOf(state).promises.filter(entry => entry.promisor === LORD);
  assert.ok(ours.length > 0, "the counter's debt is a promise");
  const kept = keepPromise(state, ours[0]!.id);
  assert.equal(diplomacyOf(kept).promises.find(entry => entry.id === ours[0]!.id)!.status, "kept");
  assert.ok(evaluateOffer(kept, LORD, COUNTERPART, OFFER).reasons.some(reason => reason.name === "trust" && reason.value > 0));
  // Not kept: past its deadline it is broken — the relation falls by its stake, the next offer carries the floor.
  const late = advanceDiplomacy({ ...state, tick: ours[0]!.deadline + 1 });
  assert.equal(diplomacyOf(late).promises.find(entry => entry.id === ours[0]!.id)!.status, "broken");
  assert.equal(diplomacyOf(late).relations[COUNTERPART], 10 - PROMISE_STAKE.relation);
  const after = evaluateOffer(late, LORD, COUNTERPART, OFFER);
  assert.ok(after.reasons.some(reason => reason.name === "broken_promises" && reason.value < 0));
  assert.ok(after.score < evaluateOffer(kept, LORD, COUNTERPART, OFFER).score);
  assert.equal(keepPromise(late, ours[0]!.id), late, "no keeping it after the deadline");
});

test("NG-6 a broken promise is remembered by its witnesses (their relation moves through the ledger)", () => {
  let state = proposeMarriage(base, OFFER);
  const negotiation = diplomacyOf(state).negotiations[0]!;
  if (negotiation.status === "countered") state = answerCounter(state, negotiation.id, true);
  const ours = diplomacyOf(state).promises.find(entry => entry.promisor === LORD)!;
  if (state.factions === undefined) return;
  const bishop = state.factions.factions.find(faction => faction.id === "bishop")!.relation;
  const late = advanceTick({ ...state, tick: ours.deadline });
  const record = late.history!.records.find(entry => entry.template === "faction.relation" && entry.params?.reason === `promise_broken:${ours.id}`);
  assert.ok(record !== undefined);
  assert.equal(late.factions!.factions.find(faction => faction.id === "bishop")!.relation, bishop - 5);
});

test("NG-5 a counter not answered within its season lapses", () => {
  const offered = proposeMarriage(base, [{ kind: "cash", giver: "proposer", amount: 10 }]);
  const negotiation = diplomacyOf(offered).negotiations[0]!;
  if (negotiation.status !== "countered") return;
  const lapsed = advanceDiplomacy({ ...offered, tick: negotiation.deadline + 1 });
  assert.equal(diplomacyOf(lapsed).negotiations[0]!.status, "withdrawn");
  assert.equal(answerCounter(lapsed, negotiation.id, true), lapsed);
});

/** A contract made, then the marriage moved to `since` ticks after it. */
function married(seed = 1): GameState {
  let state = proposeMarriage(town(2_000, seed), OFFER);
  const negotiation = diplomacyOf(state).negotiations[0];
  if (negotiation?.status === "countered") state = answerCounter(state, negotiation.id, true);
  return state;
}
function moveTo(state: GameState, since: number): GameState {
  let next = state;
  const contracted = diplomacyOf(state).marriage!.contractedTick;
  for (const at of [MARRIAGE_TIMES.brideArrives, MARRIAGE_TIMES.childBorn, MARRIAGE_TIMES.brotherInLaw, MARRIAGE_TIMES.fatherIll, MARRIAGE_TIMES.willChange,
    MARRIAGE_TIMES.willChange + MARRIAGE_TIMES.willAnswer, MARRIAGE_TIMES.fatherDies].filter(at => at <= since)) {
    next = advanceDiplomacy({ ...next, tick: contracted + at });
  }
  return next;
}

test("NG-8 the middle events in order: the bride comes to the manor, a first child is born to the couple", () => {
  const state = moveTo(married(), MARRIAGE_TIMES.childBorn);
  const plan = diplomacyOf(state).marriage!;
  const bride = state.persons!.people.find(person => person.id === plan.brideId)!;
  assert.equal(bride.householdId, "manor");
  assert.ok(bride.tags.includes(`spouse-of:${plan.groomId}`));
  const child = state.persons!.people.find(person => person.motherId === plan.brideId && person.fatherId === plan.groomId);
  assert.ok(child !== undefined);
  assert.ok(plan.events.bride_arrived! < plan.events.child_born!);
});

test("NG-8 the inheritance: with no son and the will unchanged (or talked out of it), the estate becomes the lord's", () => {
  let state = moveTo(married(), MARRIAGE_TIMES.willChange);
  if (diplomacyOf(state).marriage!.stage === "will_change") state = answerWillChange(state, "favour");
  state = moveTo(state, MARRIAGE_TIMES.fatherDies);
  const plan = diplomacyOf(state).marriage!;
  if (plan.brotherInLawId !== undefined) return;
  assert.equal(plan.stage, "inherited");
  const estate = estateById(state, MARRIAGE_ESTATE_ID)!;
  assert.deepEqual([estate.titleHolder, estate.possessor], [LORD, LORD]);
  assert.ok(estate.pieces.every(piece => piece.titleHolder === LORD && piece.possessor === LORD));
});

test("NG-8 a new will let stand: a nephew holds the estate, the counterpart's word is broken, the lord's claim is stronger and open", () => {
  let state = moveTo(married(), MARRIAGE_TIMES.willChange);
  const plan = diplomacyOf(state).marriage!;
  if (plan.brotherInLawId !== undefined) return;
  // Whether the old lord tried (the seed) or not, letting a will stand is the lord's answer when he does.
  if (plan.stage !== "will_change") state = { ...state, diplomacy: { ...diplomacyOf(state), marriage: { ...plan, stage: "will_change" } } };
  const before = estatesOf(state).claims.find(claim => claim.id === plan.claimId)!.strength;
  state = answerWillChange(state, "let_it_be");
  state = moveTo(state, MARRIAGE_TIMES.fatherDies);
  const after = diplomacyOf(state).marriage!;
  assert.equal(after.stage, "contested");
  const estate = estateById(state, MARRIAGE_ESTATE_ID)!;
  assert.deepEqual([estate.titleHolder, estate.possessor], [after.rival, after.rival]);
  assert.equal(diplomacyOf(state).promises.find(entry => entry.promisor === COUNTERPART)!.status, "broken");
  const claim = estatesOf(state).claims.find(entry => entry.id === plan.claimId)!;
  assert.equal(claim.status, "open");
  assert.equal(claim.strength, before + 15);
});

test("NG-8 a brother-in-law born: the expectation falls, and at the old lord's death the estate is his son's", () => {
  // The seed's draw is made at the contract's tick: the contracts of the coming weeks, the first that draws a son.
  const wed = married();
  const plan = diplomacyOf(wed).marriage!;
  for (let week = 0; week < 60; week += 1) {
    const shifted = { ...wed, diplomacy: { ...diplomacyOf(wed), marriage: { ...plan, contractedTick: plan.contractedTick + week * 78 } } };
    let state = moveTo(shifted, MARRIAGE_TIMES.brotherInLaw);
    const after = diplomacyOf(state).marriage!;
    if (after.brotherInLawId === undefined) continue;
    assert.equal(estatesOf(state).claims.find(claim => claim.id === plan.claimId)!.strength, 20);
    assert.ok(evaluateOffer(state, LORD, COUNTERPART, OFFER).reasons.every(reason => reason.name !== "inheritance_risk"), "a son: no heiress risk now");
    state = moveTo(state, MARRIAGE_TIMES.fatherDies);
    assert.equal(diplomacyOf(state).marriage!.stage, "lost");
    assert.equal(estateById(state, MARRIAGE_ESTATE_ID)!.titleHolder, `person:${after.brotherInLawId}`);
    assert.equal(estatesOf(state).claims.find(claim => claim.id === plan.claimId)!.status, "lapsed");
    return;
  }
  assert.fail("no contract week of sixty drew a brother-in-law");
});

test("NG-9 the lord-mode bot offers once when the heir is of age and takes a counter it can pay; never twice", () => {
  const commands = lordBotMarriageCommands(base);
  assert.equal(commands.length, 1);
  assert.equal(commands[0]!.type, "propose_marriage");
  const offered = proposeMarriage(base, (commands[0] as { terms: readonly Term[] }).terms);
  const next = lordBotMarriageCommands(offered);
  if (diplomacyOf(offered).negotiations[0]!.status === "countered") assert.equal(next[0]!.type, "answer_counter");
  else assert.deepEqual(next, []);
});
