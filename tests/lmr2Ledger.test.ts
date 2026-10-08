import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DEFAULT_SCENARIO_ID, LORD_SLICE_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import type { PromiseRecord } from "../src/engine/diplomacy.types";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD } from "../src/engine/estates";
import { EMPTY_DIPLOMACY, diplomacyOf } from "../src/engine/negotiation";
import { advanceTick } from "../src/engine/tick";
import { treasuryBalance } from "../src/ledger/ledger";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { LORD_LEDGER_COPY } from "../src/ui/lord/ledger/ledgerCopy.ko";
import { DUE_WITHIN_TICKS, ledgerView, PROMISE_MARK, SUIT_TRACK, type LedgerView } from "../src/ui/lord/ledger/ledgerModel";
import { ledgerGate, LedgerPanel } from "../src/ui/lord/ledger/LedgerPanel";
import { LEDGER_SURFACES } from "../src/ui/lord/ledger/surfaces";

// LM-R2 (ledger area): the lord screen's promises and suits. The rows come from the engine's read models only; a
// button is open exactly when the game's reducer would take its command now; the same promise changes once when kept;
// the neighbours' suits against the lord carry no command. In-process states: the lord slice (its own claims), with a
// promise ledger written into its diplomacy for the four states (a fixture: the real ones are the lord2 states).
// LMR2_STATES=<dir> (scripts/lmr2States.ts) also reads the lord2 states; LMR2_LEDGER_STATES=<dir>
// (scripts/lmr2LedgerStates.ts) the due-promise and suit-stage states played on from them.

const noop = () => undefined;
let sliceMemo: GameState | null = null;
/** The lord slice 300 ticks in (its claims raised; a treasury). */
function slice(): GameState {
  if (sliceMemo !== null) return sliceMemo;
  let state = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID })!;
  for (let tick = 0; tick < 300; tick += 1) state = advanceTick(state);
  sliceMemo = state;
  return state;
}
const promise = (state: GameState, fields: Partial<PromiseRecord> & Pick<PromiseRecord, "id">): PromiseRecord => ({
  promisor: LORD, promisee: "neighbour_1", term: "debt_after_inheritance", amount: 12, deadline: state.tick + 3 * DUE_WITHIN_TICKS,
  witnesses: ["bishop", "overlord"], stake: { trust: 15, relation: 20 }, status: "open", negotiationId: "negotiation-1", ...fields,
});
const withoutAmount = ({ amount: _amount, ...rest }: PromiseRecord): PromiseRecord => rest;
/** The slice with a written ledger: an open promise a year off, one due this season, one kept, one broken, the counterpart's word. */
function withPromises(base: GameState = slice()): GameState {
  const promises = [
    withoutAmount(promise(base, { id: "promise-1", promisor: "neighbour_1", promisee: LORD, term: "inheritance_non_infringement", deadline: base.tick + 5000 })),
    promise(base, { id: "promise-2", status: "kept", deadline: base.tick - 10, settledTick: base.tick - 40 }),
    promise(base, { id: "promise-3", status: "broken", deadline: base.tick - 2, settledTick: base.tick - 1 }),
    promise(base, { id: "promise-4", deadline: base.tick + 200 }),
    promise(base, { id: "promise-5", deadline: base.tick + 4000 }),
  ];
  return { ...base, diplomacy: { ...EMPTY_DIPLOMACY, promises, nextPromise: 6 } };
}
const html = (state: GameState, focus: string | null = null) =>
  renderToStaticMarkup(createElement(LedgerPanel, { state, dispatch: noop, focus, onOpen: noop, onPerson: undefined }));
const view = (state: GameState, focus: string | null = null): LedgerView => { const built = ledgerView(state, focus); assert.ok(built !== null); return built; };
const states = (variable: string): readonly { readonly name: string; readonly state: GameState }[] => {
  const dir = process.env[variable];
  if (dir === undefined || !existsSync(dir)) return [];
  return readdirSync(dir).filter(name => name.endsWith(".json") && !name.startsWith("lord2") && !name.startsWith("ledger2"))
    .map(name => ({ name: name.replace(/\.json$/, ""), state: JSON.parse(readFileSync(join(dir, name), "utf8")) as GameState }));
};

test("lord mode only: the screen opens in lord mode and nowhere else (no rows, no panel outside it)", () => {
  assert.equal(ledgerGate(slice()), null);
  const campaign = newGameState({ scenarioId: DEFAULT_SCENARIO_ID })!;
  assert.equal(ledgerGate(campaign), LORD_LEDGER_COPY.closed);
  assert.equal(ledgerView(campaign, null), null);
  assert.equal(html(campaign), "");
  // Nothing outside the lord screen host (and the registry's row spread) imports this area.
  const area = resolve("src/ui/lord/ledger");
  const importers = readdirSync("src", { recursive: true, encoding: "utf8" }).filter(name => /\.(tsx?)$/.test(name) && !resolve("src", name).startsWith(area))
    .filter(name => [...readFileSync(`src/${name}`, "utf8").matchAll(/from "(\.[^"]+)"/g)].some(match => resolve(dirname(resolve("src", name)), match[1]!).startsWith(area)));
  const allowed = new Set(["ui/lord/screen/LordScreen.tsx", "ui/surfaces.registry.ts"]);
  for (const name of importers) assert.ok(allowed.has(name), `${name} imports the ledger area`);
  assert.ok(importers.includes("ui/lord/screen/LordScreen.tsx"));
});

test("an empty ledger says so: no promises, no terms; the lord slice's own claims with the engine's filing answer", () => {
  const state = slice();
  const built = view(state);
  assert.equal(built.promises.none, true);
  assert.deepEqual(built.terms, []);
  const claims = estatesOf(state).claims.filter(claim => claim.claimant === LORD && claim.status === "open");
  assert.deepEqual(built.claims.map(row => row.id), claims.map(claim => claim.id));
  const page = html(state);
  assert.ok(page.includes(LORD_LEDGER_COPY.noPromises) && page.includes(LORD_LEDGER_COPY.noTerms));
  assert.doesNotMatch(page, /\stitle="|<input|<select|<button(?![^>]*class="[^"]*ui-btn)/);
});

test("the four promise states are mutually exclusive, each with its one mark; the deadline only on open ones", () => {
  const state = withPromises();
  const built = view(state);
  const rows = [...built.promises.open, ...built.promises.past];
  const byId = Object.fromEntries(rows.map(row => [row.id, row]));
  assert.deepEqual(Object.fromEntries(rows.map(row => [row.id, row.state])),
    { "promise-1": "open", "promise-2": "kept", "promise-3": "broken", "promise-4": "due", "promise-5": "open" });
  for (const row of rows) assert.equal(row.mark, PROMISE_MARK[row.state], row.id);
  assert.deepEqual(built.promises.open.map(row => row.id), ["promise-4", "promise-5", "promise-1"], "nearest deadline first");
  assert.deepEqual(built.promises.past.map(row => row.id), ["promise-3", "promise-2"], "newest settled first");
  for (const row of built.promises.past) assert.equal(row.deadline, null, `${row.id}: a settled promise has no deadline marker`);
  for (const row of built.promises.open) assert.ok(row.deadline !== null, row.id);
  assert.equal(byId["promise-1"]!.keep, null, "the counterpart's word has no button");
  assert.ok(byId["promise-4"]!.debt !== null && byId["promise-1"]!.debt === null, "the debt note only on a debt instalment");
  assert.ok(byId["promise-4"]!.witnesses !== null);
  const page = html(state);
  for (const id of ["promise-1", "promise-2", "promise-3", "promise-4", "promise-5"]) assert.equal(page.split(`data-promise="${id}"`).length, 2, id);
  assert.equal((page.match(/data-keep="/g) ?? []).length, 2, "a keep button on the lord's two open promises only");
});

test("keep_promise: the button opens when the game would take it, and the same promise changes exactly once", () => {
  const state = withPromises();
  assert.ok(treasuryBalance(state) >= 12, "the slice's treasury carries a 12d instalment");
  const before = view(state).promises.open.find(row => row.id === "promise-4")!;
  assert.deepEqual(before.keep, { enabled: true, reason: null });
  const kept = gameReducer(state, { type: "keep_promise", promiseId: "promise-4" });
  const status = (at: GameState) => Object.fromEntries(diplomacyOf(at).promises.map(entry => [entry.id, entry.status]));
  assert.deepEqual(status(kept), { ...status(state), "promise-4": "kept" }, "only that promise moved");
  assert.equal(treasuryBalance(kept), treasuryBalance(state) - 12);
  assert.equal(gameReducer(kept, { type: "keep_promise", promiseId: "promise-4" }), kept, "a second press changes nothing");
  const after = view(kept);
  assert.equal(after.promises.past.find(row => row.id === "promise-4")?.state, "kept");
  assert.equal(after.promises.open.some(row => row.id === "promise-4"), false);
  // A promise the treasury cannot carry: shut with the neutral line (the engine exposes no reason yet).
  const dear = { ...state, diplomacy: { ...diplomacyOf(state), promises: diplomacyOf(state).promises.map(entry => entry.id === "promise-5" ? { ...entry, amount: treasuryBalance(state) + 1 } : entry) } };
  assert.deepEqual(view(dear).promises.open.find(row => row.id === "promise-5")!.keep, { enabled: false, reason: LORD_LEDGER_COPY.keepShut });
});

test("the suit track: file a claim, bring evidence; each press is the game's command and the view follows the engine", () => {
  const state = slice();
  const open = view(state).claims.find(row => row.refusal === null);
  assert.ok(open !== undefined, "the slice has a claim the lord can file");
  const filed = gameReducer(state, { type: "file_suit", claimId: open.id });
  assert.notEqual(filed, state);
  const suit = view(filed).suits.find(row => row.claimId === open.id)!;
  assert.equal(suit.stage, "filed");
  assert.deepEqual(suit.track.map(step => step.at), SUIT_TRACK.map((_, index) => index === 0 ? "now" : "ahead"));
  assert.ok(suit.hearing !== null, "the hearing's two sides from suitHearing");
  assert.equal(suit.patron, null, "no patron block before the patronage stage");
  const bring = suit.evidence!.find(row => row.bring?.enabled === true);
  assert.ok(bring !== undefined, "evidence can be brought while filed");
  const brought = gameReducer(filed, { type: "add_suit_evidence", suitId: suit.id, evidence: bring.kind });
  const again = view(brought).suits.find(row => row.id === suit.id)!;
  const given = estatesOf(brought).claims.find(claim => claim.id === open.id)!.evidence.find(entry => entry.kind === bring.kind)!;
  assert.equal(again.evidence!.find(row => row.kind === bring.kind)!.given, LORD_LEDGER_COPY.evidenceGiven(given.weight), "the weight read from the claim");
  assert.equal(again.evidence!.find(row => row.kind === bring.kind)!.bring, null, "once per kind");
  assert.ok(!view(filed).claims.some(row => row.id === open.id), "a filed claim leaves the claims list");
});

test("a deep link selects its row: a suit by its id or its claim's, a claim not yet filed by its own", () => {
  const state = slice();
  const claim = view(state).claims.find(row => row.refusal === null)!;
  assert.equal(view(state, claim.id).claims.find(row => row.id === claim.id)?.focused, true, "an unfiled claim's id");
  assert.match(html(state, claim.id), new RegExp(`data-claim="${claim.id}" data-focused="true"`));
  const filed = gameReducer(state, { type: "file_suit", claimId: claim.id });
  const suit = view(filed).suits.find(row => row.claimId === claim.id)!;
  for (const focus of [suit.id, claim.id]) {
    const rows = view(filed, focus);
    assert.deepEqual(rows.suits.filter(row => row.focused).map(row => row.id), [suit.id], `focus ${focus}`);
    assert.equal(rows.promises.open.some(row => row.focused) || rows.claims.some(row => row.focused), false);
  }
  assert.equal(view(filed, "suit-none").suits.some(row => row.focused), false);
});

test("estates read in Korean (GENTRY_NAMES_KO), never the engine's Latin name", () => {
  const state = slice();
  for (const row of [...view(state).claims, ...view(gameReducer(state, { type: "file_suit", claimId: view(state).claims[0]!.id })).suits]) {
    assert.doesNotMatch(row.what, /\bde [A-Z]|[A-Za-z]{3,}/, row.what);
    assert.match(row.what, / 영지 · /, row.what);
  }
});

test("no engine rule is copied: the ledger reads no cost, weight or threshold from the configs", () => {
  for (const file of readdirSync("src/ui/lord/ledger").filter(name => /\.tsx?$/.test(name)).map(name => `src/ui/lord/ledger/${name}`)) {
    const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text, /estateConfig|marriageConfig|negotiationConfig|EVIDENCE_COST|EVIDENCE_WEIGHT|SUIT_STAGE_COST|PATRON_MIN_RELATION|ENFORCEMENT_BASE|PROMISE_PAYMENT_TICKS/, file);
  }
});

test("geometry rows: on lord2 states, through the lord screen's own open steps", () => {
  assert.ok(LEDGER_SURFACES.length >= 3);
  for (const row of LEDGER_SURFACES) {
    assert.ok(row.id.startsWith("lord.ledger"), row.id);
    assert.equal(row.scene.kind === "state" ? row.scene.set : null, "lord2", row.id);
    assert.ok(row.open.some(step => "click" in step && step.click === "[data-lord-nav='ledger']"), row.id);
  }
});

test("lord2 states (LMR2_STATES): promises kept, broken and open; the contested suit; the neighbour's suit with the lord's defence only", t => {
  const found = states("LMR2_STATES");
  if (found.length === 0) { t.skip("LMR2_STATES not set: the lord2 states are on the DGX (~/fls-lmr2-states)"); return; }
  const by = Object.fromEntries(found.map(entry => [entry.name, entry.state]));
  for (const { name, state } of found) {
    const built = view(state);
    for (const row of [...built.promises.open, ...built.promises.past]) assert.equal(row.mark, PROMISE_MARK[row.state], `${name} ${row.id}`);
    assert.doesNotMatch(html(state), /\stitle="|<input|<select/, name);
  }
  assert.equal(view(by["offer-countered"]!).promises.none, true, "offer-countered: no promise yet");
  const promises = view(by["promises"]!);
  assert.ok(promises.promises.past.some(row => row.state === "kept") && promises.promises.past.some(row => row.state === "broken") && promises.promises.open.length > 0);
  const contested = view(by["contested"]!).suits.find(row => row.stage === "filed");
  assert.ok(contested !== undefined && contested.hearing !== null && contested.evidence !== null);
  const neighbour = view(by["neighbour-suit"]!).neighbourSuits;
  assert.ok(neighbour.length > 0);
  for (const row of neighbour) {
    assert.equal(row.evidence, null); assert.equal(row.patron, null); assert.equal(row.enforce?.button ?? null, null);
    assert.equal(row.neighbour, true);
    assert.equal(row.defence !== null, row.stage !== "closed", `${row.id}: the lord's defence while the suit stands (SUIT-THREAD)`);
  }
  const page = html(by["neighbour-suit"]!);
  const neighbourPart = page.slice(page.indexOf('data-section="neighbour-suits"'));
  // SUIT-THREAD (DTR-23): the lord's own moves only — evidence, a patron, the concord, the hold; never the house's.
  assert.doesNotMatch(neighbourPart, /data-enforce=|data-file=|lord-ledger-bring" data-bring="[^"]*"[^>]*data-suit/, "no plaintiff's command on a suit against the lord");
  assert.match(neighbourPart, /data-concord="pay"/);
});

test("played-on states (LMR2_LEDGER_STATES): a promise due within the season, due today; the suit at each stage", t => {
  const found = states("LMR2_LEDGER_STATES");
  if (found.length === 0) { t.skip("LMR2_LEDGER_STATES not set: scripts/lmr2LedgerStates.ts writes them on the DGX"); return; }
  const by = Object.fromEntries(found.map(entry => [entry.name, entry.state]));
  for (const name of ["promise-due", "promise-due-today"]) {
    const state = by[name];
    if (state === undefined) continue;
    const due = view(state).promises.open.find(row => row.state === "due");
    assert.ok(due !== undefined, name);
    if (name === "promise-due-today") assert.equal(due.dueToday, true);
    const kept = gameReducer(state, { type: "keep_promise", promiseId: due.id });
    if (due.keep?.enabled === true) {
      assert.equal(diplomacyOf(kept).promises.find(entry => entry.id === due.id)?.status, "kept");
      assert.equal(gameReducer(kept, { type: "keep_promise", promiseId: due.id }), kept);
    } else assert.equal(kept, state);
  }
  for (const [name, stage] of [["suit-patronage", "patronage"], ["suit-hearing", "hearing"], ["suit-enforcing", "enforcing"]] as const) {
    const state = by[name];
    if (state === undefined) continue;
    const suit = view(state).suits.find(row => row.stage === stage);
    assert.ok(suit !== undefined, name);
    if (stage === "patronage") assert.ok(suit.patron !== null);
    if (stage === "enforcing") assert.ok(suit.enforce !== null && suit.verdict !== null);
  }
});
