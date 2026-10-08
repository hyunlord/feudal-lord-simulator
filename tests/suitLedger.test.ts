/**
 * SUIT-THREAD (renderer A; the engine's request docs/requests/render-suit-defence-lordplay2.md §1, §2, §4, §5, §9): the
 * ledger's defence row in a house's suit against the lord, the forcible entries forewarned, the hearing's verdict now and
 * reach, the stages still ahead and their costs, the subject of a possession gained or lost, and the inheritance card
 * after a lost suit. Every number and refusal is the engine's read; every press is its named command. In-process states:
 * the lord slice with a piece of the first neighbour's estate in the lord's hands (as the engine's own tests take it), and
 * Astra's lordplay2 final save (docs/qa/lordplay2-20261008/saves/). SUIT_LEDGER_STATES=<dir> (scripts/suitLedgerStates.ts)
 * also reads the states played on from lord2 neighbour-suit.
 */
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD, raiseClaim } from "../src/engine/estates";
import { fileSuit, suitActions, suitHearing } from "../src/engine/estateSuits";
import { entryDefenceCosts, entryThreats, suitDefenceActions, threatenEntry } from "../src/engine/suitDefence";
import { advanceTick } from "../src/engine/tick";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";
import { marriageDecisionHead } from "../src/ui/lord/decisions/decisionCardsModel";
import { DECISION_CARDS_COPY } from "../src/ui/lord/decisions/decisionCardsCopy.ko";
import { LORD_LEDGER_COPY } from "../src/ui/lord/ledger/ledgerCopy.ko";
import { ledgerView, type LedgerView } from "../src/ui/lord/ledger/ledgerModel";
import { LedgerPanel } from "../src/ui/lord/ledger/LedgerPanel";
import { SUIT_DEFENCE_COPY } from "../src/ui/lord/ledger/suitDefenceCopy.ko";
import { LORD_MOMENT_COPY, lordMomentWords } from "../src/ui/lordMomentCopy.ko";
import { lordMomentBeats } from "../src/ui/lordMomentBeats";
import { moneyShort } from "../src/ui/money.ko";
import { wave40RecordSide } from "../src/ui/wave40Art";

const run = (state: GameState, ticks: number): GameState => { let next = state; for (let tick = 0; tick < ticks; tick += 1) next = advanceTick(next); return next; };
let lordMemo: GameState | null = null;
const lordGame = (): GameState => (lordMemo ??= run(newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!, 10));
function funded(state: GameState, amount: number): GameState {
  const posted = postLedgerEntries(state, [{ account: "cash", category: "rent", amount: amount - treasuryBalance(state), sourceRefs: [{ type: "actor", id: "test" }] }]);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}
/** The first neighbour's richest piece in the lord's hands (title and possession), as a judgment would leave it. */
function taken(state: GameState): { readonly state: GameState; readonly estateId: string; readonly pieceId: string } {
  const estates = estatesOf(state);
  const estate = estates.estates.find(entry => entry.id === "estate-neighbour-1")!;
  const piece = estate.pieces.find(entry => entry.annualValue > 0)!;
  const held = { ...piece, possessor: LORD, possessedSince: state.tick, titleHolder: LORD, former: estate.titleHolder };
  return { state: { ...state, estates: { ...estates, estates: estates.estates.map(entry => entry.id !== estate.id ? entry
    : { ...entry, pieces: entry.pieces.map(other => other.id === piece.id ? held : other) }) } }, estateId: estate.id, pieceId: piece.id };
}
/** The house sues the lord for the piece back. */
function sued(state: GameState, estateId: string, pieceId: string): { readonly state: GameState; readonly suitId: string } {
  const claimed = raiseClaim(state, { claimant: "neighbour_1", estateId, pieceId, basis: "inheritance" });
  const claim = estatesOf(claimed).claims.find(entry => entry.claimant === "neighbour_1" && entry.pieceId === pieceId)!;
  const filed = fileSuit(claimed, claim.id);
  return { state: filed, suitId: estatesOf(filed).suits.find(entry => entry.claimId === claim.id)!.id };
}
const withStage = (state: GameState, suitId: string, stage: "patronage" | "enforcing"): GameState => {
  const estates = estatesOf(state);
  return { ...state, estates: { ...estates, suits: estates.suits.map(entry => entry.id === suitId ? { ...entry, stage, ...(stage === "enforcing" ? { verdict: "plaintiff" as const, hold: 10 } : {}) } : entry) } };
};
const view = (state: GameState, focus: string | null = null): LedgerView => { const built = ledgerView(state, focus); assert.ok(built !== null); return built; };
const html = (state: GameState, focus: string | null = null) =>
  renderToStaticMarkup(createElement(LedgerPanel, { state, dispatch: () => undefined, focus, onOpen: () => undefined, onPerson: undefined }));
function astraFinal(): GameState {
  return decodeSave(new Uint8Array(gunzipSync(readFileSync("docs/qa/lordplay2-20261008/saves/manual-final.savebin.gz")))).envelope.state as GameState;
}

test("§1 the defence row: a house's suit against the lord carries his four commands, with the engine's costs, weights and refusals", () => {
  const { state: owned, estateId, pieceId } = taken(funded(lordGame(), 5_000));
  const { state, suitId } = sued(owned, estateId, pieceId);
  const actions = suitDefenceActions(state, suitId)!;
  const row = view(state).neighbourSuits.find(entry => entry.id === suitId)!;
  assert.ok(row.defence !== null && row.neighbour);
  // Evidence: each kind's cost and weight as the engine gives them, open while filed.
  for (const entry of actions.evidence) {
    const shown: { readonly note: string; readonly bring: { readonly enabled: boolean } | null } = row.defence.evidence.find(item => item.kind === entry.kind)!;
    assert.equal(shown.note, LORD_LEDGER_COPY.evidenceNote(entry.cost > 0 ? moneyShort(entry.cost) : null, entry.weight));
    assert.equal(shown.bring?.enabled, entry.refusal === null, entry.kind);
  }
  assert.equal(row.defence.evidenceShut, null);
  // Not yet the patronage stage, not yet judged: the engine's reasons as sentences.
  assert.equal(row.defence.patron.shut, SUIT_DEFENCE_COPY.patronRefusals.stage);
  assert.equal(row.defence.hold.button.reason, SUIT_DEFENCE_COPY.holdRefusals.stage);
  assert.equal(row.defence.concord.price, moneyShort(actions.concord.price));
  assert.ok(row.defence.concord.pay.enabled);
  // The press is the engine's command: the defence side rises by the kind's weight.
  const deed = actions.evidence.find(entry => entry.kind === "deed")!;
  const brought = gameReducer(state, { type: "add_defence_evidence", suitId, evidence: "deed" });
  assert.equal(suitHearing(brought, suitId)!.defence, suitHearing(state, suitId)!.defence + deed.weight);
  assert.equal(view(brought).neighbourSuits.find(entry => entry.id === suitId)!.defence!.evidence.find(item => item.kind === "deed")!.given, LORD_LEDGER_COPY.evidenceGiven(deed.weight));
  // The page: the four commands' buttons, all secondary (equal choices); no 'no command' line any more.
  const page = html(state);
  const part = page.slice(page.indexOf('data-section="neighbour-suits"'));
  for (const marker of ['data-bring="deed"', 'data-concord="pay"', 'data-concord="yield"', `data-hold="${suitId}"`]) assert.ok(part.includes(marker), marker);
  assert.doesNotMatch(part, /ui-btn--primary/);
  assert.doesNotMatch(page, /영주가 막을 명령은 없습니다/);
  assert.doesNotMatch(page, /\stitle="|<input|<select/);
});

test("§1 the defence row at the patronage stage and the enforcement: a patron to win, the hold with its cost — and the treasury short", () => {
  const { state: owned, estateId, pieceId } = taken(funded(lordGame(), 5_000));
  const { state: filed, suitId } = sued(owned, estateId, pieceId);
  const bishop = { ...filed, factions: { ...filed.factions!, factions: filed.factions!.factions.map(entry => entry.id === "bishop" ? { ...entry, relation: 30 } : entry) } };
  const patronage = withStage(bishop, suitId, "patronage");
  const row = view(patronage).neighbourSuits.find(entry => entry.id === suitId)!.defence!;
  assert.equal(row.evidenceShut, SUIT_DEFENCE_COPY.evidenceRefusals.stage, "evidence only while filed or gathering it");
  assert.deepEqual(row.patron.options.map(option => option.factionId), suitDefenceActions(patronage, suitId)!.patrons.filter(entry => entry.refusal === null).map(entry => entry.factionId));
  assert.ok(row.patron.options.some(option => option.factionId === "bishop"));
  const enforcing = withStage(filed, suitId, "enforcing");
  const hold = view(enforcing).neighbourSuits.find(entry => entry.id === suitId)!.defence!.hold;
  const actions = suitDefenceActions(enforcing, suitId)!;
  assert.deepEqual([hold.button.enabled, hold.cost, hold.line], [true, moneyShort(actions.hold.cost), SUIT_DEFENCE_COPY.holdLine(actions.hold.hold, actions.hold.boost)]);
  const held = gameReducer(enforcing, { type: "hold_possession", suitId });
  assert.equal(view(held).neighbourSuits.find(entry => entry.id === suitId)!.defence!.hold.button.reason, SUIT_DEFENCE_COPY.holdRefusals.held);
  const poor = funded(enforcing, 0);
  const shut = view(poor).neighbourSuits.find(entry => entry.id === suitId)!.defence!;
  assert.equal(shut.hold.button.reason, SUIT_DEFENCE_COPY.holdRefusals.treasury);
  assert.equal(shut.concord.pay.reason, SUIT_DEFENCE_COPY.concordRefusals.treasury);
});

test("§1 a final concord ends the suit: the row says it in the engine's sentence, and no defence row is left", () => {
  const { state: owned, estateId, pieceId } = taken(funded(lordGame(), 50_000));
  const { state, suitId } = sued(owned, estateId, pieceId);
  const paid = gameReducer(state, { type: "settle_suit", suitId, terms: "pay" });
  const row = view(paid).neighbourSuits.find(entry => entry.id === suitId)!;
  assert.equal(row.defence, null);
  assert.match(row.settled!, /^합의로 끝났다: 영주가 .+ 주고 .+ 지켰다 · \d+년 /);
  const yielded = view(gameReducer(state, { type: "settle_suit", suitId, terms: "yield" })).neighbourSuits.find(entry => entry.id === suitId)!;
  assert.match(yielded.settled!, /내주었다/);
});

test("§9 the hearing line: verdict now and reach (the user's words), the house's side when the lord is sued", () => {
  const { state: owned, estateId, pieceId } = taken(funded(lordGame(), 5_000));
  const { state, suitId } = sued(owned, estateId, pieceId);
  const sides = suitHearing(state, suitId)!;
  const row = view(state).neighbourSuits.find(entry => entry.id === suitId)!;
  assert.equal(row.hearing, LORD_LEDGER_COPY.hearingAgainst(sides.plaintiff, sides.defence, sides.verdictNow, sides.reachable, true));
  assert.equal(LORD_LEDGER_COPY.hearingAgainst(40, 50, "defendant", false, true), "청구 쪽(원고) 40 · 방어 쪽(영주) 50. 지금 판결하면 방어 쪽이 이깁니다 · 원고가 남은 증거와 후원을 다 더해도 넘기 어렵습니다");
  assert.equal(LORD_LEDGER_COPY.hearingAgainst(60, 50, "plaintiff", true, false), "청구 쪽(원고) 60 · 방어 쪽(영주) 50. 지금 판결하면 청구 쪽이 이깁니다 · 합의로 끝낼 수 있습니다");
});

test("§9 the lord's own suit: each stage still ahead with what it takes (suitActions.stageCosts), each evidence kind's cost and weight", () => {
  const state = funded(lordGame(), 5_000);
  const claim = estatesOf(state).claims.find(entry => entry.claimant === LORD && entry.status === "open")!;
  const filed = gameReducer(state, { type: "file_suit", claimId: claim.id });
  const suit = estatesOf(filed).suits.find(entry => entry.claimId === claim.id)!;
  const actions = suitActions(filed, suit.id)!;
  const row = view(filed).suits.find(entry => entry.id === suit.id)!;
  const parts = actions.stageCosts.filter(entry => entry.cost > 0)
    .map(entry => (entry.stage === "enforcing" ? LORD_LEDGER_COPY.stageCostEach : LORD_LEDGER_COPY.stageCost)(LORD_LEDGER_COPY.stages[entry.stage], moneyShort(entry.cost)));
  assert.ok(parts.length > 0);
  assert.equal(row.stageCosts, LORD_LEDGER_COPY.stageCosts(parts.join(" · ")));
  for (const entry of actions.evidence) assert.equal(row.evidence!.find(item => item.kind === entry.kind)!.note, LORD_LEDGER_COPY.evidenceNote(entry.cost > 0 ? moneyShort(entry.cost) : null, entry.weight));
});

test("§2 a forcible entry forewarned: the guard and the gift at the engine's costs, each its command; left alone, a novel claim the lord files straight to the hearing", () => {
  const { state: owned, estateId } = taken(funded(lordGame(), 5_000));
  const threatened = threatenEntry(owned, "neighbour_1", estateId)!;
  const state = threatened.state;
  const threat = threatened.threat;
  const costs = entryDefenceCosts(state, threat);
  const rows = view(state, threat.id).threats!;
  const row = rows.threats.find(entry => entry.id === threat.id)!;
  assert.deepEqual([row.guard?.cost, row.appease.cost, row.focused], [moneyShort(costs.guard), moneyShort(costs.appease), true]);
  assert.ok(row.guard!.button.enabled && row.appease.button.enabled);
  const page = html(state);
  const part = page.slice(page.indexOf('data-section="entry-threats"'));
  assert.ok(part.includes(`data-guard="${threat.id}"`) && part.includes(`data-appease="${threat.id}"`));
  assert.doesNotMatch(part, /ui-btn--primary/);
  const guarded = gameReducer(state, { type: "guard_possession", threatId: threat.id });
  const after = view(guarded).threats!.threats.find(entry => entry.id === threat.id)!;
  assert.deepEqual([after.guarded, after.guard], [true, null]);
  assert.equal(entryThreats(gameReducer(state, { type: "appease_neighbour", threatId: threat.id })).length, 0);
  // Left alone past its season: the house comes in, the lord has a novel claim; filed, its track skips evidence and patronage.
  const entered = run(state, threat.due - state.tick + 1);
  const claim = view(entered).claims.find(entry => entry.novel !== null);
  assert.ok(claim !== undefined, "a novel claim after the entry");
  assert.equal(claim.novel, LORD_LEDGER_COPY.novelLine);
  const past = view(entered).threats!.past;
  assert.ok(past.some(entry => /힘으로 .+에 들어왔다/.test(entry.line)), "the engine's sentence for the entry");
  const filed = gameReducer(entered, { type: "file_suit", claimId: claim.id });
  const suit = view(filed).suits.find(entry => entry.claimId === claim.id)!;
  assert.deepEqual(suit.track.map(step => step.stage), ["filed", "hearing", "judged", "enforcing", "closed"]);
});

test("§4 the subject: a house's enforcement against the lord reads as his loss (or his hold) — the ledger line and the moment's words", () => {
  const record = { template: "estate.possession_enforced", params: { suit: "suit-3", attempt: 2, succeeded: 1, piece: "estate-neighbour-1:hunting", plaintiff: "neighbour_1", defendant: "lord" } };
  assert.equal(wave40RecordSide(record), "against");
  assert.equal(wave40RecordSide({ ...record, params: { ...record.params, plaintiff: "lord", defendant: "neighbour_1" } }), "lord");
  assert.equal(wave40RecordSide({ template: record.template, params: { succeeded: 1 } }), "lord", "older records are the lord's");
  assert.equal(lordMomentWords("moment_possession_taken", "against").title, "이웃이 점유를 가져갔다");
  assert.equal(lordMomentWords("moment_possession_refused", "against").title, "영주가 버텼다");
  assert.equal(lordMomentWords("moment_possession_taken", "lord"), LORD_MOMENT_COPY.moment_possession_taken);
  assert.equal(LORD_LEDGER_COPY.enforcedBy("첫째 이웃 영주"), "첫째 이웃 영주가 점유를 가져갔습니다");
  // Astra's final save: the house's suit against the lord, judged for it — the row names who won.
  const save = astraFinal();
  const against = view(save).neighbourSuits.find(entry => entry.id === "suit-3")!;
  assert.match(against.verdict!, /이겼습니다 — 영주가 권원을 잃었습니다/);
  // Played: the house's enforcement against a lord with no hold left takes the piece — the moment is his loss.
  const { state: owned, estateId, pieceId } = taken(funded(lordGame(), 5_000));
  const { state: filed, suitId } = sued(owned, estateId, pieceId);
  const estates = estatesOf(filed);
  const judged: GameState = { ...filed, tick: 4 * 4_000 - 1, estates: { ...estates, suits: estates.suits.map(entry => entry.id === suitId ? { ...entry, stage: "enforcing" as const, verdict: "plaintiff" as const, hold: 0 } : entry) } };
  const lost = run(judged, 2);
  const beat = lordMomentBeats(lost, null).find(entry => entry.illustration === "moment_possession_taken");
  assert.ok(beat !== undefined, "the enforcement's moment");
  assert.deepEqual([beat.title, beat.advice], [lordMomentWords("moment_possession_taken", "against").title, lordMomentWords("moment_possession_taken", "against").advice]);
  assert.match(beat.line, /영주가 잃었다/);
  assert.equal(view(lost).neighbourSuits.find(entry => entry.id === suitId)!.enforce!.lines.at(-1), LORD_LEDGER_COPY.enforcedBy(view(lost).neighbourSuits.find(entry => entry.id === suitId)!.party.replace(/^원고 /, "")));
});

test("§5 the inheritance card after a lost suit (Astra's final save): the suit's verdict and date, not 'no suit yet'", () => {
  const save = astraFinal();
  const head = marriageDecisionHead(save);
  assert.ok(head !== null && head.kind === "contested");
  assert.notEqual(head.suit, DECISION_CARDS_COPY.contestNoSuit);
  assert.match(head.suit, /^영주의 소송: 끝남 · 판결: 영주가 졌습니다 · \d+년 /);
  const suit = estatesOf(save).suits.find(entry => entry.claimId === save.diplomacy!.marriage!.claimId)!;
  assert.equal(head.focus, suit.id, "the card opens the ended suit on the ledger");
});

test("states played on from lord2 neighbour-suit (SUIT_LEDGER_STATES): the defence at patronage and enforcement, the entries", t => {
  const dir = process.env.SUIT_LEDGER_STATES;
  if (dir === undefined || !existsSync(dir)) { t.skip("SUIT_LEDGER_STATES not set: scripts/suitLedgerStates.ts writes them on the DGX"); return; }
  for (const name of readdirSync(dir).filter(file => file.endsWith(".json") && !file.startsWith("suit-ledger"))) {
    const state = JSON.parse(readFileSync(join(dir, name), "utf8")) as GameState;
    const built = view(state);
    if (name.startsWith("defence-")) assert.ok(built.neighbourSuits.some(row => row.defence !== null), name);
    if (name === "entry-threat.json") assert.ok((built.threats?.threats.length ?? 0) > 0, name);
    if (name === "entry-forced.json") assert.ok(built.claims.some(row => row.novel !== null), name);
    assert.doesNotMatch(html(state), /\stitle="|<input|<select/, name);
  }
});
