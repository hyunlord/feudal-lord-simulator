/** LM-E4 delegation, attention and the yearly audit (spec docs/design/stewardship.md SW-1…SW-9): the scenarios. */
import assert from "node:assert/strict";
import test from "node:test";

import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import { AUDIT_FIND, DISPOSITION_RATES, MICHAELMAS_IN_YEAR, OVERLOAD_PETITION_DELAY, SUMMARIES_KEPT, TOLERATE_LOYALTY } from "../src/content/stewardshipConfig";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import { historySummary } from "../src/engine/history";
import { MARRIAGE_ESTATE_ID } from "../src/engine/marriage";
import {
  answerAudit, attention, exceptionMatch, lordEstatePetitions, nextMichaelmas, oversightViews, pendingAudits, stewardCandidates, stewardshipOf,
} from "../src/engine/stewardship";
import type { StewardDisposition } from "../src/engine/stewardship.types";
import { advanceTick } from "../src/engine/tick";
import { initialAgency } from "../src/engine/townAgency";
import { migrateV41ToV42 } from "../src/save/migrations/v41ToV42";
import { gameReducer } from "../src/state/gameStore";

const ESTATE = MARRIAGE_ESTATE_ID;
let opened: GameState | undefined;
/** A lord-mode town a year in that has just come to hold the third neighbour's estate (as the marriage's inheritance leaves it). */
function held(): GameState {
  if (opened !== undefined) return opened;
  let state: GameState = { ...(createGrowthOpening(1).state as GameState), agency: initialAgency() };
  while (state.persons === undefined) state = advanceTick(state);
  for (let tick = 0; tick < 3_990; tick += 1) state = advanceTick(state);
  const estates = estatesOf(state);
  state = { ...state, estates: { ...estates, estates: estates.estates.map(estate => estate.id === ESTATE ? { ...estate, titleHolder: LORD, possessor: LORD } : estate) } };
  while (state.stewardship === undefined) state = advanceTick(state);
  opened = state;
  return state;
}
const advance = (state: GameState, ticks: number) => { let next = state; for (let tick = 0; tick < ticks; tick += 1) next = advanceTick(next); return next; };
const candidate = (state: GameState, disposition: StewardDisposition) => stewardCandidates(state, ESTATE).find(entry => entry.record.disposition === disposition)!.record;
const delegate = (state: GameState, disposition: StewardDisposition) =>
  gameReducer(state, { type: "set_estate_oversight", estateId: ESTATE, mode: "steward", stewardId: candidate(state, disposition).personId });
const ledgerLines = (state: GameState, from: number) => (state.history?.records ?? []).filter(record => record.tick >= from).map(record => ({ template: record.template, line: historySummary(record, state) }));

test("SW-2 an estate held off the map gets its oversight at the next season: three candidates (one of each disposition), the lord direct, the most loyal keeping the books", () => {
  const state = held();
  const own = stewardshipOf(state);
  assert.equal(own.oversight.length, 1);
  assert.equal(own.oversight[0]!.mode, "direct");
  const candidates = stewardCandidates(state, ESTATE);
  assert.deepEqual(candidates.map(entry => entry.record.disposition).sort(), ["greedy", "merchant", "peasant"]);
  const receiver = candidates.find(entry => entry.record.status === "serving")!;
  assert.equal(receiver.record.personId, own.oversight[0]!.stewardId);
  assert.equal(receiver.record.loyalty, Math.max(...candidates.map(entry => entry.record.loyalty)));
  assert.ok(candidates.every(entry => entry.person !== undefined && entry.person.occupation === "steward"), "each a person (PERSON data)");
  assert.ok(ledgerLines(state, state.tick - 1).some(entry => entry.template === "stewardship.began"));
});

test("SW-2 no estate held off the map, no stewardship: the sandbox and the campaign never have one", () => {
  let state: GameState = createGrowthOpening(1).state as GameState;
  state = advance(state, 4_100);
  assert.equal(state.stewardship, undefined);
});

test("SW-1 attention: two estates by himself; an old lord one; a visit's year one less; a grown heir one more — over it, a direct estate waits and errs", () => {
  const state = held();
  const now = attention(state);
  assert.deepEqual([now.capacity, now.load, now.overloaded], [2, 2, false]);
  const lordId = state.persons!.people.find(person => person.role === "head" && person.householdId === "manor")!.id;
  const old = { ...state, persons: { ...state.persons!, people: state.persons!.people.map(person => person.id === lordId ? { ...person, birthYear: 1235 } : person) } };
  assert.deepEqual([attention(old).capacity, attention(old).overloaded], [1, true]);
  const visited = { ...state, stewardship: { ...stewardshipOf(state), visitTick: state.tick - 100 } };
  assert.equal(attention(visited).capacity, 1);
  assert.ok(attention(visited).reasons.some(reason => reason.name === "visit"));
  const heir = { ...state, persons: { ...state.persons!, people: state.persons!.people.map(person => person.householdId === "manor" && person.role === "child" ? { ...person, birthYear: 1270 } : person) } };
  assert.equal(attention(heir).capacity, 3);
  // Overloaded and direct: the season's petition reaches the lord a season late, and the summary says so.
  const season = advance(old, 1_000);
  const summary = stewardshipOf(season).summaries.at(-1)!;
  assert.equal(summary.overloaded, true);
  const waiting = stewardshipOf(season).petitions.at(-1)!;
  assert.equal(waiting.reachesLord, waiting.tick + OVERLOAD_PETITION_DELAY);
  assert.ok(!lordEstatePetitions(season).some(entry => entry.id === waiting.id), "not yet before him");
});

test("SW-3 a delegated estate goes by its steward's disposition: his rates, his answers (the table), his goodwill", () => {
  const rows = (["merchant", "peasant", "greedy"] as const).map(disposition => {
    const run = advance(delegate(held(), disposition), 4_000);
    const own = stewardshipOf(run);
    const decided = own.petitions.filter(petition => petition.decidedBy === "steward");
    assert.ok(decided.length >= 3, `${disposition}: ${decided.length}`);
    const summary = own.summaries.at(-1)!;
    assert.deepEqual([summary.rentPermille, summary.duesPermille], [DISPOSITION_RATES[disposition].rent, DISPOSITION_RATES[disposition].dues]);
    const lines = ledgerLines(run, held().tick).filter(entry => entry.template === "stewardship.steward_decided");
    assert.ok(lines.length >= 3 && lines.every(entry => entry.line.startsWith("청지기 ")), lines.map(entry => entry.line).join(" / "));
    return { disposition, income: own.summaries.reduce((sum, entry) => sum + entry.income, 0), tenants: own.oversight[0]!.tenants, merchants: own.oversight[0]!.merchants,
      answers: decided.map(petition => `${petition.kind}:${petition.status}`).join(",") };
  });
  // The same seed and petitions: the three stewards answer them differently and the estate goes three ways.
  assert.equal(new Set(rows.map(row => row.answers)).size, 3, JSON.stringify(rows));
  assert.equal(new Set(rows.map(row => row.income)).size, 3, JSON.stringify(rows));
  const peasant = rows.find(row => row.disposition === "peasant")!, merchant = rows.find(row => row.disposition === "merchant")!;
  assert.ok(peasant.tenants > merchant.tenants && merchant.merchants > peasant.merchants, JSON.stringify(rows));
});

test("SW-5 the exceptions bring a petition to the lord (here: 1d or more, a right, a marriage); it waits for him, he answers it, or it lapses", () => {
  let state = gameReducer(delegate(held(), "merchant"), { type: "set_exception_rules", rules: { amountAtLeast: 1, rights: true, marriage: true } });
  assert.equal(exceptionMatch(stewardshipOf(state).rules, { amount: 0, rights: true, marriage: false }), "rights");
  state = advance(state, 1_000);
  // (the first season's petition, from when the lord oversaw it himself, may still wait for him as well)
  const waiting = lordEstatePetitions(state).filter(entry => entry.escalated !== "direct");
  assert.equal(waiting.length, 1);
  assert.ok(waiting[0]!.escalated !== undefined && waiting[0]!.escalated !== "direct");
  assert.ok(ledgerLines(state, state.tick - 1).some(entry => entry.template === "stewardship.escalated" && entry.line.includes("영주에게 올렸다")));
  const answered = gameReducer(state, { type: "answer_estate_petition", petitionId: waiting[0]!.id, grant: false });
  assert.equal(stewardshipOf(answered).petitions.find(entry => entry.id === waiting[0]!.id)?.decidedBy, "lord");
  assert.ok(ledgerLines(answered, answered.tick).some(entry => entry.template === "stewardship.lord_decided" || entry.template.startsWith("decision")) || answered.history!.records.length > state.history!.records.length);
  // Unanswered within its season, it lapses (refused, the wait remembered).
  const lapsed = advance(state, 2_000);
  assert.equal(stewardshipOf(lapsed).petitions.find(entry => entry.id === waiting[0]!.id)?.status, "lapsed");
});

test("SW-6 Michaelmas: a visit finds what a greedy steward kept back; punished, he goes, half comes back, his faction remembers", () => {
  let state = gameReducer(delegate(held(), "greedy"), { type: "set_audit_mode", estateId: ESTATE, mode: "visit" });
  const greedy = candidate(state, "greedy");
  state = advance(state, nextMichaelmas(state.tick) - state.tick);
  assert.equal(state.tick % 4_000, MICHAELMAS_IN_YEAR);
  const audit = stewardshipOf(state).audits.at(-1)!;
  assert.equal(audit.stewardId, greedy.personId);
  assert.ok(AUDIT_FIND.visit + (100 - greedy.ability) * 3 >= 850);
  assert.ok(audit.revealedKept > 0, JSON.stringify(audit));
  assert.equal(audit.status, "pending");
  assert.equal(stewardshipOf(state).visitTick, state.tick, "the visit costs the lord's attention for a year");
  assert.ok(ledgerLines(state, state.tick).some(entry => entry.template === "stewardship.audit_found" && entry.line.includes("빼돌림")));
  const treasury = state.ledger!.entries.length;
  const punished = gameReducer(state, { type: "answer_audit", auditId: audit.id, choice: "punish" });
  const own = stewardshipOf(punished);
  assert.equal(own.stewards.find(entry => entry.personId === greedy.personId)?.status, "dismissed");
  assert.notEqual(own.oversight[0]!.stewardId, greedy.personId);
  assert.equal(own.stewards.find(entry => entry.personId === own.oversight[0]!.stewardId)?.status, "serving");
  assert.ok(punished.ledger!.entries.slice(treasury).some(entry => entry.category === "audit_recovery" && entry.amount === Math.round(audit.revealedKept / 2)));
  if (greedy.connection !== null) assert.ok(punished.history!.records.some(record => record.template === "faction.relation" && String(record.params?.reason).startsWith("steward_punished")));
  assert.ok(!stewardCandidates(punished, ESTATE).some(entry => entry.record.personId === greedy.personId), "a dismissed steward is not offered again");
});

test("SW-6 by the accounts alone, what was kept may stay hidden; tolerated, the steward stays more loyal; unanswered, tolerated", () => {
  let state = delegate(held(), "greedy");
  state = advance(state, nextMichaelmas(state.tick) - state.tick);
  const audit = stewardshipOf(state).audits.at(-1)!;
  assert.equal(audit.mode, "accounts");
  assert.equal(audit.revealedKept + audit.hidden > 0, true, "he kept something");
  const before = stewardshipOf(state).stewards.find(entry => entry.personId === audit.stewardId)!;
  if (audit.status === "pending") {
    const tolerated = answerAudit(state, audit.id, "tolerate");
    assert.equal(stewardshipOf(tolerated).stewards.find(entry => entry.personId === audit.stewardId)!.loyalty, Math.min(100, before.loyalty + TOLERATE_LOYALTY));
    const lapsed = advance(state, 1_100);
    assert.equal(stewardshipOf(lapsed).audits.find(entry => entry.id === audit.id)?.status, "tolerated");
  }
  if (audit.hidden > 0) assert.equal(stewardshipOf(state).oversight[0]!.undetected, audit.hidden);
  assert.equal(pendingAudits(state).length, audit.status === "pending" ? 1 : 0);
});

test("SW-7 each season's accounts: the treasury gets what the books show; the summaries kept are the last eight; the portfolio view", () => {
  const state = advance(delegate(held(), "merchant"), 9 * 1_000);
  const own = stewardshipOf(state);
  assert.ok(own.summaries.length <= SUMMARIES_KEPT);
  const last = own.summaries.at(-1)!;
  assert.equal(last.reported, last.income - last.kept - last.error);
  const paid = state.ledger!.entries.filter(entry => entry.tick === last.tick && entry.category === "estate_income" && entry.amount > 0);
  assert.equal(paid.reduce((sum, entry) => sum + entry.amount, 0), last.reported);
  const view = oversightViews(state)[0]!;
  assert.deepEqual([view.estateId, view.oversight.mode, view.lastSummary?.tick, view.steward?.status], [ESTATE, "steward", last.tick, "serving"]);
});

test("SW-9 v42: a v41 save moves only its version (it holds no stewardship yet)", () => {
  const migrated = migrateV41ToV42({ schemaVersion: 41, state: { tick: 1 } }) as { schemaVersion: number; state: unknown };
  assert.deepEqual(migrated, { schemaVersion: 42, state: { tick: 1 } });
});
