/**
 * EVENT-ART (wave40): Astra's Wave 40 lord-mode moment pictures (spec docs/ops/install-plan-20261003/SPECS/wave40.md) on the
 * ledger records the engine writes for each state transition — the marriage's stages, the suit's, the wardship's — as a story
 * beat per history record (lord mode only) and as the record's picture in the chronicle. The records come from the engine's
 * own transitions (the reducer's commands, advanceDiplomacy / advanceSuits / advanceLordship, written by advanceHistory).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { buildKeyartDerivative, KEYART_DERIVATIVE_BY_URL, sha256, WAVE40_DERIVATIVES } from "../scripts/keyartDerivatives";
import { createGrowthOpening } from "../scripts/phase21OpeningTranslation";
import { MARRIAGE_TIMES } from "../src/content/diplomacyConfig";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import { advanceSuits } from "../src/engine/estateSuits";
import { advanceHistory } from "../src/engine/history";
import type { HistoryRecord } from "../src/engine/history.types";
import { advanceLordship } from "../src/engine/lordship";
import { lordHouse } from "../src/engine/lordshipState";
import { advanceDiplomacy, MARRIAGE_ESTATE_ID } from "../src/engine/marriage";
import { diplomacyOf } from "../src/engine/negotiation";
import { currentYear, manorLord } from "../src/engine/persons";
import { advanceTick } from "../src/engine/tick";
import { initialAgency } from "../src/engine/townAgency";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { gameReducer } from "../src/state/gameStore";
import { recordArt } from "../src/ui/chronicle/chronicleScreenModel";
import { storyBeats } from "../src/ui/eventStory";
import { houseRecordIds } from "../src/ui/results/houseChange";
import { LORD_MOMENT_COPY } from "../src/ui/lordMomentCopy.ko";
import { lordMomentBeats, lordMoments } from "../src/ui/lordMomentBeats";
import { storyArtStyle } from "../src/ui/storyArt";
import { wave40RecordArt, type Wave40ImageId } from "../src/ui/wave40Art";
import { WAVE40_IMAGES } from "../src/ui/wave40ArtManifest.generated";
import { marriageDecisionHead } from "../src/ui/lord/decisions/decisionCardsModel";

const SEASON = 1_000;
const YEAR = 4_000;
const inbox = readFileSync("assets-inbox/INBOX_LEDGER.csv", "utf8");
const provenance = readFileSync("docs/provenance/assets.csv", "utf8");
function jpegSize(bytes: Buffer): readonly [number, number] {
  for (let at = 2; at + 9 < bytes.length;) {
    const marker = bytes[at + 1]!;
    if (marker >= 0xc0 && marker <= 0xc2) return [bytes.readUInt16BE(at + 7), bytes.readUInt16BE(at + 5)];
    at += 2 + bytes.readUInt16BE(at + 2);
  }
  return [0, 0];
}

/** A lord-mode town (opening `seed`) `wait` ticks on, its heir 15 (of age to marry), the treasury `coin`. */
function lordTown(seed: number, wait: number, coin = 20_000): GameState {
  let state: GameState = { ...(createGrowthOpening(seed).state as GameState), agency: initialAgency() };
  while (state.persons === undefined) state = advanceTick(state);
  for (let tick = 0; tick < wait; tick += 1) state = advanceTick(state);
  const persons = { ...state.persons!, people: state.persons!.people.map(person => person.householdId === "manor" && person.role === "child" && person.sex === "male"
    ? { ...person, birthYear: 1300 - 15 } : person) };
  const posted = postLedgerEntries(state, [{ account: "cash", category: "opening_balance", amount: coin - treasuryBalance(state), sourceRefs: [{ type: "scenario", id: "test" }] }]);
  return { ...state, persons, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}
const OFFER = [{ kind: "cash", giver: "proposer", amount: 200 }, { kind: "inheritance_non_infringement", giver: "counterpart" },
  { kind: "residence", giver: "counterpart" }] as const;
/** The engine's step `advance` at `tick`, its ledger lines written (advanceHistory, as the tick writes them). */
const step = (state: GameState, advance: (state: GameState) => GameState, tick: number) => advanceHistory(state, advance({ ...state, tick }));
const since = (state: GameState, ticks: number) => diplomacyOf(state).marriage!.contractedTick + ticks;
/** FIX-13: the old lord dies by the death table — here at the old fixed time (tests/negotiation.test.ts does the same). */
function oldLordDies(state: GameState): GameState {
  const estates = estatesOf(state);
  const lordId = estates.estates.find(estate => estate.id === MARRIAGE_ESTATE_ID)?.house?.lordId;
  return { ...state, estates: { ...estates, people: estates.people.map(person => person.id === lordId ? { ...person, alive: false, deathYear: currentYear(state) } : person) } };
}
const momentsOf = (state: GameState, from: number) => (state.history?.records ?? []).slice(from)
  .map(record => ({ record, art: wave40RecordArt(record) })).filter((entry): entry is { record: HistoryRecord; art: Wave40ImageId } => entry.art !== null);

/**
 * Seed 1 offered 1 tick on, the counter taken 3 ticks later: the old lord tries a new will (the seed's draw), the lord lets it stand, the nephew holds the
 * estate; the lord sues, brings the deed, witnesses and the charter, is judged for, enforces until the possession gives,
 * and the estate comes to him. Every state after a record, kept for the beats.
 */
const contested = (() => {
  let state = lordTown(1, 1);
  const from = state.history!.records.length;
  const states: GameState[] = [];
  const keep = () => states.push(state);
  state = gameReducer(state, { type: "propose_marriage", terms: OFFER }); keep();
  const offered = diplomacyOf(state).negotiations[0]!;
  // The counter answered three ticks later (not the same tick: two moments, the offer weighed and the contract sealed).
  for (let tick = 0; tick < 3; tick += 1) state = advanceTick(state);
  state = gameReducer(state, { type: "answer_counter", negotiationId: offered.id, accept: true }); keep();
  for (const at of [MARRIAGE_TIMES.brideArrives, MARRIAGE_TIMES.childBorn, MARRIAGE_TIMES.brotherInLaw, MARRIAGE_TIMES.fatherIll, MARRIAGE_TIMES.willChange]) {
    state = step(state, advanceDiplomacy, since(state, at)); keep();
  }
  state = gameReducer(state, { type: "answer_will_change", choice: "let_it_be" }); keep();
  state = step(oldLordDies(state), advanceDiplomacy, since(state, MARRIAGE_TIMES.fatherDies)); keep();
  const plan = diplomacyOf(state).marriage!;
  state = gameReducer(state, { type: "file_suit", claimId: plan.claimId }); keep();
  const suitId = () => estatesOf(state).suits.find(entry => entry.claimId === plan.claimId)!.id;
  for (const evidence of ["deed", "witnesses", "charter"] as const) state = gameReducer(state, { type: "add_suit_evidence", suitId: suitId(), evidence });
  for (let guard = 0; guard < 12 && estatesOf(state).suits.find(entry => entry.id === suitId())!.stage !== "enforcing"; guard += 1) {
    state = step(state, advanceSuits, (Math.floor(state.tick / SEASON) + 1) * SEASON); keep();
    const suit = estatesOf(state).suits.find(entry => entry.id === suitId())!;
    if (suit.stage === "patronage" && suit.patron === undefined) state = gameReducer(state, { type: "seek_suit_patron", suitId: suit.id, factionId: "bishop" });
  }
  for (let guard = 0; guard < 8 && estatesOf(state).suits.find(entry => entry.id === suitId())!.stage === "enforcing"; guard += 1) {
    state = gameReducer(state, { type: "enforce_possession", suitId: suitId() }); keep();
  }
  state = step(state, advanceDiplomacy, state.tick + 1); keep();
  return { states, moments: momentsOf(state, from), final: state };
})();

/** Seed 1 offered 3 ticks on: the old lord has a son (the seed's draw) — the brother-in-law. */
const brotherInLaw = (() => {
  let state = gameReducer(lordTown(1, 3), { type: "propose_marriage", terms: OFFER });
  state = gameReducer(state, { type: "answer_counter", negotiationId: diplomacyOf(state).negotiations[0]!.id, accept: true });
  const from = state.history!.records.length;
  for (const at of [MARRIAGE_TIMES.brideArrives, MARRIAGE_TIMES.childBorn, MARRIAGE_TIMES.brotherInLaw]) state = step(state, advanceDiplomacy, since(state, at));
  return { state, moments: momentsOf(state, from) };
})();

/** A lord made a minor at the year's turn (FIX-11 wardship begins), then of age at the next (it ends). */
const wardship = (() => {
  const base = lordTown(2, 0);
  const turn = (Math.floor(base.tick / YEAR) + 1) * YEAR;
  const year = currentYear({ ...base, tick: turn });
  const lord = manorLord(base.persons!.people, lordHouse(base).order, year)!;
  let state: GameState = { ...base, persons: { ...base.persons!, people: base.persons!.people.map(person => person.id === lord.id ? { ...person, birthYear: year - 20 } : person) } };
  const from = state.history!.records.length;
  state = step(state, advanceLordship, turn);
  const begun = state;
  state = step(state, advanceLordship, turn + YEAR);
  return { begun, ended: state, moments: momentsOf(state, from) };
})();

test("Wave 40: fourteen confirmed received JPEGs, 960×540, provenance rows, re-encoded at build (EVA-D2: the received files unchanged)", () => {
  assert.equal(WAVE40_DERIVATIVES.length, 14);
  for (const item of WAVE40_DERIVATIVES) {
    const bytes = readFileSync(item.source);
    assert.ok(inbox.includes(`${sha256(bytes)},confirmed`), `${item.id}: confirmed in INBOX_LEDGER by its sha256`);
    assert.ok(provenance.includes(item.source), `${item.id}: provenance row`);
    assert.equal(KEYART_DERIVATIVE_BY_URL.get(item.url), item, `${item.id}: in WEB_ART_DERIVATIVES`);
    assert.equal(item.format, "jpeg-reencoded");
    const built = buildKeyartDerivative(item);
    assert.ok(built.length < bytes.length, `${item.id}: the build output is smaller than the received file`);
    assert.deepEqual(jpegSize(built), [960, 540], `${item.id}: the build output keeps the size`);
    assert.deepEqual(jpegSize(bytes), [960, 540], item.id);
  }
});

test("Wave 40: each moment's picture by its ledger record — the brief's fourteen, and nothing for the transitions without one", () => {
  const cases: readonly [string, Record<string, string | number>, string | null][] = [
    ["negotiation.offered", {}, "01_"], ["marriage.contracted", {}, "02_"], ["marriage.bride_arrived", {}, "03_"], ["marriage.child_born", {}, "04_"],
    ["marriage.brother_in_law_born", {}, "05_"], ["marriage.father_ill", {}, "06_"], ["marriage.will_change", {}, "07_"], ["marriage.inherited", {}, "08_"],
    ["estate.suit_filed", {}, "09_"], ["estate.suit_stage", { stage: "evidence" }, "10_"], ["estate.possession_enforced", { succeeded: 0 }, "11_"],
    ["estate.possession_enforced", { succeeded: 1 }, "12_"], ["lord.wardship_begun", {}, "13_"], ["lord.wardship_ended", {}, "14_"],
    // No picture of their own: no other picture stands in.
    ["negotiation.countered", {}, null], ["negotiation.accepted", {}, null], ["negotiation.rejected", {}, null], ["marriage.father_died", {}, null],
    ["marriage.lost", {}, null], ["marriage.contested", {}, null], ["marriage.will_dropped", {}, null], ["estate.suit_stage", { stage: "patronage" }, null],
    ["estate.suit_stage", { stage: "hearing" }, null], ["estate.suit_judged", { verdict: "plaintiff" }, null], ["estate.claim_raised", {}, null], ["legacy.succession", {}, null],
  ];
  for (const [template, params, prefix] of cases) {
    const art = wave40RecordArt({ template, params });
    if (prefix === null) assert.equal(art, null, template);
    else assert.ok(art !== null && WAVE40_IMAGES[art].assetId.startsWith(prefix), `${template} ${JSON.stringify(params)} → ${art}`);
  }
  // Every installed picture is some moment's; every one has its words.
  const chosen = new Set(cases.map(([template, params]) => wave40RecordArt({ template, params })).filter(art => art !== null));
  assert.deepEqual([...chosen].sort(), Object.keys(WAVE40_IMAGES).sort());
  assert.deepEqual(Object.keys(LORD_MOMENT_COPY).sort(), Object.keys(WAVE40_IMAGES).sort());
});

test("Wave 40: the engine's own records — a contested marriage to its inheritance, a brother-in-law, a wardship — find their pictures in order", () => {
  assert.deepEqual(contested.moments.map(entry => WAVE40_IMAGES[entry.art].assetId.slice(0, 2)),
    ["01", "02", "03", "04", "06", "07", "09", "10", ...contested.moments.filter(entry => entry.record.template === "estate.possession_enforced").map(entry => entry.art === "moment_possession_taken" ? "12" : "11"), "08"]);
  const enforced = contested.moments.filter(entry => entry.record.template === "estate.possession_enforced");
  assert.ok(enforced.length >= 1 && enforced.at(-1)!.art === "moment_possession_taken", "the possession given at last");
  assert.equal(diplomacyOf(contested.final).marriage!.stage, "inherited");
  assert.equal(estatesOf(contested.final).estates.find(estate => estate.id === MARRIAGE_ESTATE_ID)!.possessor, LORD);
  assert.deepEqual(brotherInLaw.moments.map(entry => entry.art), ["moment_bride_arrival", "moment_first_child", "moment_brother_in_law_born"]);
  assert.deepEqual(wardship.moments.map(entry => entry.art), ["moment_child_lord_guardian", "moment_end_of_wardship"]);
});

test("Wave 40: one story beat per history record — its id the record's, the same across every state of its season, gone after it", () => {
  // Each path is its own town (its own ledger and record ids).
  for (const path of [{ states: contested.states, moments: contested.moments }, { states: [brotherInLaw.state], moments: brotherInLaw.moments },
    { states: [wardship.begun, wardship.ended], moments: wardship.moments }]) {
    const seen = new Map<string, string>();
    for (const state of path.states) {
      const beats = lordMomentBeats(state, null);
      assert.equal(new Set(beats.map(beat => beat.id)).size, beats.length, "no beat twice in one state");
      for (const beat of beats) {
        const record = state.history!.records.find(entry => entry.id === beat.id.slice("lord-moment:".length))!;
        assert.ok(record !== undefined && state.tick - record.tick < SEASON, `${beat.id}: a record of this season`);
        assert.equal(beat.illustration, wave40RecordArt(record));
        const known = seen.get(beat.id);
        assert.ok(known === undefined || known === beat.illustration, `${beat.id}: the same picture whenever it is offered`);
        seen.set(beat.id, beat.illustration as string);
        assert.equal(beat.decision, null);
        assert.equal(beat.kind, "lord_moment");
        assert.ok(String(storyArtStyle(beat.illustration as Wave40ImageId, 64).backgroundImage).includes(WAVE40_IMAGES[beat.illustration as Wave40ImageId].url));
      }
      // The story's beats hold each moment once (lordBeats → storyBeats). LM-R2: while the father's will waits for
      // the lord's answer, its decision chip wears the will's moment and stands for it (one chip, not two).
      // DEC-CARD (A3): a change in the lord's house (the inheritance, the wardship) is its house card's chip, wearing the moment.
      const story = storyBeats(state);
      const willDue = marriageDecisionHead(state)?.kind === "will_change";
      const house = houseRecordIds(state);
      assert.deepEqual(story.map(beat => beat.id).filter(id => id.startsWith("lord-moment:")),
        beats.filter(beat => (!willDue || beat.illustration !== "moment_attempted_will_change") && !house.has(beat.id.slice("lord-moment:".length))).map(beat => beat.id));
      if (willDue) assert.equal(story.find(beat => beat.decision === "marriage_decision")?.illustration, "moment_attempted_will_change");
      for (const beat of beats.filter(entry => house.has(entry.id.slice("lord-moment:".length)))) {
        assert.ok(story.some(entry => entry.kind === "house_change" && entry.illustration === beat.illustration), `${beat.id}: its house card's chip wears it`);
      }
    }
    // Every moment of the path that was offered at all was one beat, by its record's id.
    for (const id of seen.keys()) assert.ok(path.moments.some(entry => `lord-moment:${entry.record.id}` === id), id);
  }
  // The contested path offered every one of its moments (each kept state is just after its record).
  const offered = new Set(contested.states.flatMap(state => lordMomentBeats(state, null).map(beat => beat.id)));
  assert.deepEqual(contested.moments.map(entry => `lord-moment:${entry.record.id}`).filter(id => !offered.has(id)), []);
  // A season after its record the moment is no longer offered.
  const later = { ...wardship.ended, tick: wardship.ended.tick + SEASON };
  assert.deepEqual(lordMomentBeats(later, null), []);
});

test("Wave 40: an offer taken at once is one moment with its contract (the sealing), not two", () => {
  let state = lordTown(1, 1);
  state = gameReducer(state, { type: "propose_marriage", terms: OFFER });
  state = gameReducer(state, { type: "answer_counter", negotiationId: diplomacyOf(state).negotiations[0]!.id, accept: true });
  const offered = state.history!.records.find(record => record.template === "negotiation.offered")!;
  const sealed = state.history!.records.find(record => record.template === "marriage.contracted")!;
  assert.equal(offered.tick, sealed.tick);
  assert.deepEqual(lordMoments(state).map(entry => entry.art), ["moment_marriage_sealing"]);
  // Answered later, the offer was its own moment (the contested path above shows both).
  assert.deepEqual(contested.moments.slice(0, 2).map(entry => entry.art), ["moment_marriage_negotiation", "moment_marriage_sealing"]);
});

test("Wave 40: a suit's enforcement attempts one after another are one moment — where the last one left the possession", () => {
  const attempts = contested.moments.filter(entry => entry.record.template === "estate.possession_enforced");
  assert.ok(attempts.length >= 2 && attempts.slice(0, -1).every(entry => entry.art === "moment_possession_refused"), "the holder resisted first");
  /** The first kept state that holds the record (the state just after it). */
  const at = (id: string) => contested.states.find(state => state.history!.records.some(record => record.id === id))!;
  const after = at(attempts.at(-1)!.record.id);
  const shown = lordMoments(after).filter(entry => entry.record.template === "estate.possession_enforced");
  assert.deepEqual(shown.map(entry => [entry.record.id, entry.art]), [[attempts.at(-1)!.record.id, "moment_possession_taken"]]);
  // Before the last attempt, the refusal was the moment on offer.
  const refused = at(attempts[0]!.record.id);
  assert.deepEqual(lordMoments(refused).filter(entry => entry.record.template === "estate.possession_enforced").map(entry => entry.art), ["moment_possession_refused"]);
});

test("Wave 40: lord mode only — a campaign town's same records keep their chronicle art and give no beat", () => {
  const { agency: _agency, ...campaign } = wardship.ended;
  assert.deepEqual(lordMomentBeats(campaign as GameState, null), []);
  assert.equal(storyBeats(campaign as GameState).filter(beat => beat.kind === "lord_moment").length, 0);
  const record = wardship.moments[0]!.record;
  assert.deepEqual(recordArt(wardship.ended, record), { kind: "wave40", id: "moment_child_lord_guardian" });
  const before = recordArt(campaign as GameState, record);
  assert.ok(before === null || before.kind !== "wave40", JSON.stringify(before));
  // The seat's moments look at the manor, the others (the neighbour's house, the court) nowhere in particular.
  const seat = { tx: 3, ty: 4 };
  const tiles = new Map(lordMomentBeats(wardship.begun, seat).map(beat => [beat.illustration, beat.tile]));
  assert.deepEqual(tiles.get("moment_child_lord_guardian"), seat);
  const suit = contested.states.find(state => lordMoments(state).some(entry => entry.art === "moment_lawsuit_filed"))!;
  assert.equal(lordMomentBeats(suit, seat).find(beat => beat.illustration === "moment_lawsuit_filed")!.tile, null);
});
