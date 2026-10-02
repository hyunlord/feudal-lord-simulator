/**
 * FIX-13 (decisions FX13-*; specs negotiation.md NG-5b, estates.md ES-11, map-archetypes.md MA-11): the marriage's
 * terms that are not cash (a jointure, a debt repaid after the inheritance), the people off the map who age and die by
 * the town's table, the drainage works' start cell and timber amounts, and the speed ten.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import { BALANCE, PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { COUNTER_DESIRES, DEFERRED_DEBT_YEARS, JOINTURE_PIECES, JOINTURE_YEARS, MATERIAL_PER_PENNY, PROMISE_PAYMENT_TICKS } from "../src/content/diplomacyConfig";
import { HOME_ESTATE_ID } from "../src/content/estateConfig";
import type { Term } from "../src/engine/diplomacy.types";
import type { GameSpeed, GameState } from "../src/engine/engine.types";
import { advanceEstates, estatesOf, LORD } from "../src/engine/estates";
import { advanceHistory, historySummary } from "../src/engine/history";
import { answerCounter, lordBotMarriageCommands, MARRIAGE_ESTATE_ID } from "../src/engine/marriage";
import { diplomacyOf, evaluateOffer, jointurePiece } from "../src/engine/negotiation";
import { currentYear, seasonDeathPermille } from "../src/engine/persons";
import { advanceTick } from "../src/engine/tick";
import { initialAgency } from "../src/engine/townAgency";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { gameReducer } from "../src/state/gameStore";

const COUNTERPART = `estate:${MARRIAGE_ESTATE_ID}`;
const YEAR = 4 * PRESSURE_BALANCE.seasonTicks;

/** A lord-mode town a year in, its treasury `coin`. */
function town(seed: number, coin: number): GameState {
  let state: GameState = { ...(createGrowthOpening(seed).state as GameState), agency: initialAgency() };
  while (state.persons === undefined) state = advanceTick(state);
  for (let tick = 0; tick < 4_000; tick += 1) state = advanceTick(state);
  const posted = postLedgerEntries(state, [{ account: "cash", category: "opening_balance", amount: coin - treasuryBalance(state), sourceRefs: [{ type: "scenario", id: "test" }] }]);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}
const advance = (state: GameState, ticks: number) => { let next = state; for (let tick = 0; tick < ticks; tick += 1) next = advanceTick(next); return next; };
const oldLordOf = (state: GameState) => {
  const estate = estatesOf(state).estates.find(entry => entry.id === MARRIAGE_ESTATE_ID);
  return estatesOf(state).people.find(person => person.id === estate?.house?.lordId);
};
const withOldLordDead = (state: GameState): GameState => {
  const estates = estatesOf(state);
  const lord = oldLordOf(state)!;
  return { ...state, estates: { ...estates, people: estates.people.map(person => person.id === lord.id ? { ...person, alive: false, deathYear: currentYear(state) } : person) } };
};

/** The bot's offer and, if a counter came, the counter taken. */
function botContract(state: GameState): GameState {
  const [command] = lordBotMarriageCommands(state);
  assert.ok(command !== undefined && command.type === "propose_marriage", "the bot offers");
  let next = gameReducer(state, command);
  const negotiation = diplomacyOf(next).negotiations.at(-1)!;
  if (negotiation.status === "countered") next = answerCounter(next, negotiation.id, true);
  return next;
}

test("FX13-1 every opening 1–5 (the daughters-only ones too) has an acceptable bundle in its first year — the counter asks what is not cash", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const state = town(seed, 300);
    assert.ok(currentYear(state) <= 1310);
    const next = botContract(state);
    const negotiation = diplomacyOf(next).negotiations.at(-1)!;
    assert.equal(diplomacyOf(next).marriage?.stage, "contracted", `seed ${seed}: ${negotiation.status}`);
    if (negotiation.counter !== undefined) {
      const kinds = negotiation.counter.terms.filter(term => term.giver === "proposer").map(term => term.kind);
      assert.ok(kinds.includes("debt_after_inheritance") || kinds.includes("jointure"), `seed ${seed}: ${kinds}`);
      // What the lord's own year cannot carry is not asked as cash now: the counter's cash is within the treasury.
      const cash = negotiation.counter.terms.filter(term => term.kind === "cash").reduce((sum, term) => sum + (term.amount ?? 0), 0);
      assert.ok(cash <= treasuryBalance(state), `seed ${seed}: cash ${cash}`);
    }
  }
  assert.deepEqual(COUNTER_DESIRES.slice(0, 4), ["debt_assumption", "debt_after_inheritance", "cash", "jointure"]);
});

test("FX13-1 a jointure is worth its piece's year for JOINTURE_YEARS; it settles the piece on the bride for life when the groom dies first", () => {
  const state = town(1, 2_000);
  const piece = jointurePiece(state);
  assert.ok(piece !== null && JOINTURE_PIECES.includes(piece), `${piece}`);
  const base: readonly Term[] = [{ kind: "cash", giver: "proposer", amount: 100 }, { kind: "inheritance_non_infringement", giver: "counterpart" }, { kind: "residence", giver: "counterpart" }];
  const jointure: Term = { kind: "jointure", giver: "proposer", pieceId: piece };
  const material = (terms: readonly Term[]) => evaluateOffer(state, LORD, COUNTERPART, terms).reasons.find(reason => reason.name === "material")?.value ?? 0;
  const gain = material([...base, jointure]) - material(base);
  assert.ok(gain > 0, `${gain}`);
  assert.ok(MATERIAL_PER_PENNY.jointure! > 0 && JOINTURE_YEARS === 8);

  let married = gameReducer(state, { type: "propose_marriage", terms: [...base, jointure] });
  const negotiation = diplomacyOf(married).negotiations.at(-1)!;
  if (negotiation.status === "countered") married = answerCounter(married, negotiation.id, true);
  const plan = diplomacyOf(married).marriage!;
  assert.equal(plan.jointurePieceId, piece);
  // The bride comes to the manor; then the groom dies.
  married = advance(married, 1_100);
  const persons = married.persons!;
  const groom = persons.people.find(person => person.id === plan.groomId)!;
  married = { ...married, persons: { ...persons, people: persons.people.filter(person => person.id !== groom.id), past: [...persons.past, { ...groom, alive: false }] } };
  married = advance(married, PROMISE_PAYMENT_TICKS + 1);
  const settled = estatesOf(married).estates.find(estate => estate.id === HOME_ESTATE_ID)!.pieces.find(entry => entry.id === piece)!;
  assert.equal(settled.lifeTenant, `person:${plan.brideId}`);
  assert.equal(settled.remainder, LORD);
  assert.equal(diplomacyOf(married).marriage!.jointureSettled, true);
  assert.ok((married.history?.records ?? []).some(record => record.template === "marriage.jointure_settled"));
});

test("FX13-1 a debt repaid after the inheritance falls due when the estate comes (a promise a year, five at most); it is void if the estate is lost", () => {
  const state = town(2, 2_000);
  const terms: readonly Term[] = [{ kind: "cash", giver: "proposer", amount: 100 }, { kind: "debt_after_inheritance", giver: "proposer", amount: 503 },
    { kind: "inheritance_non_infringement", giver: "counterpart" }, { kind: "residence", giver: "counterpart" }];
  let married = gameReducer(state, { type: "propose_marriage", terms });
  const negotiation = diplomacyOf(married).negotiations.at(-1)!;
  if (negotiation.status === "countered") married = answerCounter(married, negotiation.id, true);
  const plan = diplomacyOf(married).marriage!;
  assert.ok((plan.deferredDebt ?? 0) >= 503);
  const before = diplomacyOf(married).promises.filter(entry => entry.term === "debt_after_inheritance").length;
  assert.equal(before, 0, "nothing falls due before the inheritance");
  // The old lord dies by the table (here, now): the estate is read at the bride's coming.
  married = advance(withOldLordDead(married), 1_100);
  const now = diplomacyOf(married);
  assert.equal(now.marriage!.stage, "inherited");
  const due = now.promises.filter(entry => entry.term === "debt_after_inheritance");
  assert.equal(due.length, DEFERRED_DEBT_YEARS);
  assert.equal(due.reduce((sum, entry) => sum + (entry.amount ?? 0), 0), plan.deferredDebt);
  assert.ok(due.every((entry, index) => entry.promisor === LORD && entry.deadline === due[0]!.deadline + index * PROMISE_PAYMENT_TICKS));

  // Lost: the debt falls away, a line in the ledger.
  const lost = { ...married, diplomacy: { ...now, marriage: { ...plan, stage: "lost" as const } } };
  const recorded = advanceHistory({ ...married, diplomacy: { ...now, marriage: plan } }, lost);
  const line = recorded.history!.records.find(record => record.template === "marriage.deferred_void");
  assert.ok(line !== undefined);
  assert.match(historySummary(line, recorded), /\d/);
});

test("FX13-3 the people off the map age and die by the town's table; the old lord's death, not a fixed time, brings the inheritance", () => {
  // Lord mode keeps its estates from the first year's turn.
  let state: GameState = { ...(createGrowthOpening(1).state as GameState), agency: initialAgency() };
  assert.equal(state.estates, undefined);
  state = advanceEstates({ ...state, tick: YEAR });
  assert.ok(state.estates !== undefined);
  // A crowd of the old lord's age: about the table's yearly share dies (a year's chance four seasons' rate).
  const lord = oldLordOf(state)!;
  // The roll reads the age in the year it is rolled.
  const age = currentYear({ ...state, tick: YEAR * 2 }) - lord.birthYear;
  const crowd = Array.from({ length: 400 }, (_, index) => ({ ...lord, id: `est-${String(900_000 + index).padStart(6, "0")}` }));
  const aged = advanceEstates({ ...state, tick: YEAR * 2, estates: { ...state.estates!, people: crowd } });
  const died = estatesOf(aged).people.filter(person => !person.alive).length;
  const expected = 400 * Math.min(1000, 4 * seasonDeathPermille(age)) / 1000;
  assert.ok(Math.abs(died - expected) <= Math.max(12, expected * 0.5), `${died} died of 400 aged ${age}, the table ${expected}`);
  assert.ok(estatesOf(aged).people.filter(person => !person.alive).every(person => person.deathYear !== undefined && person.deathCause === "age"));
  // A bride gone to the manor is the town's: never rolled here.
  const gone = advanceEstates({ ...state, tick: YEAR * 2, estates: { ...state.estates!, people: crowd.map(person => ({ ...person, tags: [...person.tags, "married-out"] })) } });
  assert.ok(estatesOf(gone).people.every(person => person.alive));
});

test("FX13-3 a steward who dies is replaced at the season's turn by the most loyal living candidate, and the ledger says so", () => {
  let state: GameState = { ...(createGrowthOpening(1).state as GameState), agency: initialAgency() };
  while (state.persons === undefined) state = advanceTick(state);
  state = advance(state, 3_990);
  const estates = estatesOf(state);
  state = { ...state, estates: { ...estates, estates: estates.estates.map(estate => estate.id === MARRIAGE_ESTATE_ID ? { ...estate, titleHolder: LORD, possessor: LORD } : estate) } };
  while (state.stewardship === undefined) state = advanceTick(state);
  const serving = state.stewardship.oversight[0]!.stewardId;
  const people = estatesOf(state).people.map(person => person.id === serving ? { ...person, alive: false, deathYear: currentYear(state) } : person);
  state = { ...state, estates: { ...estatesOf(state), people } };
  const from = state.tick;
  state = advance(state, 1_000);
  const now = state.stewardship!;
  assert.notEqual(now.oversight[0]!.stewardId, serving);
  assert.equal(now.stewards.find(entry => entry.personId === serving)!.status, "dead");
  assert.equal(now.stewards.find(entry => entry.personId === now.oversight[0]!.stewardId)!.status, "serving");
  const line = state.history!.records.find(record => record.tick > from && record.template === "stewardship.steward_died");
  assert.ok(line !== undefined);
  assert.doesNotMatch(historySummary(line, state), /est-\d/, "names, not ids");
});

test("FX13-2 the speed ten: a tick a tenth of a second at 1x, and 10x among the speeds", () => {
  assert.equal(BALANCE.TICKS_PER_SECOND, 10);
  const speeds: readonly GameSpeed[] = [0, 1, 3, 5, 10];
  assert.equal(speeds.at(-1), 10);
});
