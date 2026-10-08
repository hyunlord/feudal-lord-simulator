/**
 * SUIT-THREAD's balance and defence (decisions DTR-22, DTR-23; the user's judgement 2026-10-08) and the Astra lordplay2
 * engine items (docs/qa/lordplay2-20261008/, reproduced on its saves where the save holds the case).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { HISTORY_TEMPLATES } from "../src/content/historyCopy.ko";
import { MARRIAGE_TIMES } from "../src/content/diplomacyConfig";
import { POSSESSION_RENT } from "../src/content/possessionConfig";
import { FACTION_ACTS } from "../src/content/factionActConfig";
import { RECOVERY_CLAIM_PERMILLE } from "../src/content/neighbourRulesConfig";
import { EVIDENCE_WEIGHT, SUIT_DEFENCE } from "../src/content/estateConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import { weighOffer } from "../src/engine/decisionLayer";
import { advanceDiplomacy, marriageDecisionDue } from "../src/engine/marriage";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD, raiseClaim } from "../src/engine/estates";
import { advanceSuits, fileSuit, suitHearing } from "../src/engine/estateSuits";
import { lordMattersDue } from "../src/engine/lordDue";
import { advanceNeighbourRules } from "../src/engine/neighbourRules";
import { advanceTick } from "../src/engine/tick";
import { concordPrice, entryThreats, suitDefenceActions, threatenEntry } from "../src/engine/suitDefence";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { decodeSave } from "../src/save/saveCodec";
import { gameReducer } from "../src/state/gameStore";
import { newGameState } from "../src/state/newGame";

const SEASON = 1_000;
const YEAR = 4_000;
const run = (state: GameState, ticks: number): GameState => { let next = state; for (let tick = 0; tick < ticks; tick += 1) next = advanceTick(next); return next; };
const lordGame = (): GameState => run(newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!, 10);
function funded(state: GameState, amount: number): GameState {
  const posted = postLedgerEntries(state, [{ account: "cash", category: "rent", amount: amount - treasuryBalance(state), sourceRefs: [{ type: "actor", id: "test" }] }]);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}
const relation = (state: GameState, id: string) => state.factions?.factions.find(faction => faction.id === id)?.relation ?? 0;
const withRelation = (state: GameState, id: string, value: number): GameState => ({ ...state, factions: { ...state.factions!,
  factions: state.factions!.factions.map(faction => faction.id === id ? { ...faction, relation: value } : faction) } });

/** Neighbour 1's estate with a piece the lord took by a judgment (title and possession his; the house remembers it). */
function taken(state: GameState, opts: { readonly titleToLord: boolean } = { titleToLord: true }): { readonly state: GameState; readonly estateId: string; readonly pieceId: string } {
  const estates = estatesOf(state);
  const estate = estates.estates.find(entry => entry.id === "estate-neighbour-1")!;
  const piece = estate.pieces.find(entry => entry.annualValue > 0)!;
  const held = { ...piece, possessor: LORD, possessedSince: state.tick, ...(opts.titleToLord ? { titleHolder: LORD, former: estate.titleHolder } : {}) };
  return { state: { ...state, estates: { ...estates, estates: estates.estates.map(entry => entry.id !== estate.id ? entry
    : { ...entry, pieces: entry.pieces.map(other => other.id === piece.id ? held : other) }) } }, estateId: estate.id, pieceId: piece.id };
}
/** The house sues the lord for the piece back (a suit against him, filed). */
function sued(state: GameState, estateId: string, pieceId: string): { readonly state: GameState; readonly suitId: string } {
  const claimed = raiseClaim(state, { claimant: "neighbour_1", estateId, pieceId, basis: "inheritance" });
  const claim = estatesOf(claimed).claims.find(entry => entry.claimant === "neighbour_1" && entry.pieceId === pieceId)!;
  const filed = fileSuit(claimed, claim.id);
  return { state: filed, suitId: estatesOf(filed).suits.find(entry => entry.claimId === claim.id)!.id };
}
/** An Astra lordplay2 save, migrated to the current version. */
function astraSave(name: "manual-final.savebin" | "indexedDB-1306-recovery-source.json"): GameState {
  const raw = gunzipSync(readFileSync(`docs/qa/lordplay2-20261008/saves/${name}.gz`));
  const bytes = name.endsWith(".json")
    ? new Uint8Array(Buffer.from((JSON.parse(raw.toString("utf8")) as { stores: { name: string; records: { value: { data: string } }[] }[] }).stores.find(store => store.name === "slots")!.records[0]!.value.data, "base64"))
    : new Uint8Array(raw);
  return decodeSave(bytes).envelope.state as GameState;
}

// --- DTR-22 -----------------------------------------------------------------------------------------------------------

test("DTR-22 (S1): a title the lord wins from a house leaves it a remembered right; its heir claims at once in the year after its head died", () => {
  const base = lordGame();
  const { state, estateId, pieceId } = taken(base);
  const estate = estatesOf(state).estates.find(entry => entry.id === estateId)!;
  const headId = estate.house!.lordId;
  // The house's head is among the factions' people (FX-2).
  const died = (next: GameState, year: number): GameState => ({ ...next, factions: { ...next.factions!,
    people: next.factions!.people.map(person => person.id === headId ? { ...person, alive: false, deathYear: year } : person) } });
  // Year 20 (1320): the head died in 1319.
  const turn = advanceNeighbourRules({ ...died(state, 1319), tick: 20 * YEAR });
  const claim = estatesOf(turn).claims.find(entry => entry.claimant === "neighbour_1" && entry.pieceId === pieceId);
  assert.ok(claim !== undefined, "the heir claims the remembered piece");
  assert.ok(estatesOf(turn).suits.some(suit => suit.claimId === claim!.id && suit.defendant === LORD), "and sues");
  // Without a succession, by chance only (no more often than the Paston rate over many years).
  let claims = 0;
  for (let year = 15; year < 55; year += 1) {
    const next = advanceNeighbourRules({ ...state, tick: year * YEAR });
    if (estatesOf(next).claims.length > estatesOf(state).claims.length) claims += 1;
  }
  assert.ok(claims > 0 && claims <= 40 * RECOVERY_CLAIM_PERMILLE / 1000 * 2.5, `${claims} claims in 40 years`);
});

test("DTR-22 (S1): a house's grudge claim not taken to court is sued on at the next year's turn — it never stands open for ever", () => {
  const { state, estateId, pieceId } = taken(lordGame());
  const claimed = raiseClaim(state, { claimant: "neighbour_1", estateId, pieceId, basis: "old_possession" });
  const claim = estatesOf(claimed).claims.at(-1)!;
  assert.equal(claim.status, "open");
  const turn = advanceNeighbourRules({ ...claimed, tick: (Math.floor(claimed.tick / YEAR) + 1) * YEAR + YEAR });
  assert.equal(estatesOf(turn).claims.find(entry => entry.id === claim.id)!.status, "suing");
});

test("DTR-22 (S2): a keeper takes a quarter of a possession's rent (an eighth while the lord oversees an estate himself)", () => {
  assert.deepEqual([POSSESSION_RENT.keeperPermille, POSSESSION_RENT.keeperDirectPermille], [250, 125]);
});

// --- DTR-23: the defence ------------------------------------------------------------------------------------------------

test("DTR-23: sued, the lord brings evidence and a patron to his side of the hearing; the screen reads what he can do", () => {
  const { state: owned, estateId, pieceId } = taken(funded(lordGame(), 5_000));
  const { state, suitId } = sued(withRelation(owned, "bishop", 30), estateId, pieceId);
  const before = suitHearing(state, suitId)!;
  const actions = suitDefenceActions(state, suitId)!;
  assert.ok(actions.evidence.some(entry => entry.kind === "deed" && entry.refusal === null));
  assert.equal(actions.hold.refusal, "stage");
  const evidenced = gameReducer(state, { type: "add_defence_evidence", suitId, evidence: "deed" });
  assert.equal(suitHearing(evidenced, suitId)!.defence, before.defence + EVIDENCE_WEIGHT.deed);
  assert.equal(gameReducer(evidenced, { type: "add_defence_evidence", suitId, evidence: "deed" }), evidenced, "once per kind");
  // The patronage stage: the bishop on his side.
  const estates = estatesOf(evidenced);
  const later: GameState = { ...evidenced, estates: { ...estates, suits: estates.suits.map(entry => entry.id === suitId ? { ...entry, stage: "patronage" as const } : entry) } };
  const patron = gameReducer(later, { type: "seek_defence_patron", suitId, factionId: "bishop" });
  assert.equal(suitHearing(patron, suitId)!.defence, suitHearing(later, suitId)!.defence + 30);
  // Not his suit to defend: the lord's own suits refuse these.
  assert.equal(suitDefenceActions(lordGame(), "suit-none"), null);
});

test("DTR-23: a final concord — paid off at the house's odds the lord keeps the piece and the house's remembered right ends; yielded, it goes back", () => {
  const { state: owned, estateId, pieceId } = taken(funded(lordGame(), 50_000));
  const { state, suitId } = sued(owned, estateId, pieceId);
  const suit = estatesOf(state).suits.find(entry => entry.id === suitId)!;
  const hearing = suitHearing(state, suitId)!;
  const price = concordPrice(state, suit);
  const piece = estatesOf(state).estates.find(entry => entry.id === estateId)!.pieces.find(entry => entry.id === pieceId)!;
  assert.equal(price, Math.max(SUIT_DEFENCE.floor, Math.round(piece.annualValue * SUIT_DEFENCE.concordPermille / 1000 * hearing.plaintiff / (hearing.plaintiff + hearing.defence))));
  const paid = gameReducer(state, { type: "settle_suit", suitId, terms: "pay" });
  assert.equal(treasuryBalance(state) - treasuryBalance(paid), price);
  const kept = estatesOf(paid).estates.find(entry => entry.id === estateId)!.pieces.find(entry => entry.id === pieceId)!;
  assert.deepEqual([kept.titleHolder, kept.possessor, kept.former], [LORD, LORD, undefined]);
  assert.equal(estatesOf(paid).suits.find(entry => entry.id === suitId)!.settled, "pay");
  assert.equal(relation(paid, "neighbour_1"), relation(state, "neighbour_1") + 5);
  const record = paid.history!.records.find(entry => entry.template === "estate.suit_settled")!;
  assert.match(HISTORY_TEMPLATES["estate.suit_settled"]!(record.params!), /^합의로 끝났다: 영주가 첫째 이웃 영주에게 .+ 주고 .+ 지켰다$/);
  const yielded = gameReducer(state, { type: "settle_suit", suitId, terms: "yield" });
  const given = estatesOf(yielded).estates.find(entry => entry.id === estateId)!.pieces.find(entry => entry.id === pieceId)!;
  assert.deepEqual([given.titleHolder, given.possessor], ["neighbour_1", "neighbour_1"]);
  assert.equal(relation(yielded, "neighbour_1"), relation(state, "neighbour_1") + 10);
  // Past −60 the house asks double.
  assert.ok(Math.abs(concordPrice(withRelation(state, "neighbour_1", -70), suit) - 2 * price) <= 1);
});

test("DTR-23: after a judgment against him the lord puts men in to hold — the hold rises, once a year, and the house minds it", () => {
  const { state: owned, estateId, pieceId } = taken(funded(lordGame(), 50_000));
  const { state, suitId } = sued(owned, estateId, pieceId);
  const estates = estatesOf(state);
  const enforcing: GameState = { ...state, estates: { ...estates, suits: estates.suits.map(entry => entry.id === suitId ? { ...entry, stage: "enforcing" as const, verdict: "plaintiff" as const, hold: 30 } : entry) } };
  const held = gameReducer(enforcing, { type: "hold_possession", suitId });
  assert.equal(estatesOf(held).suits.find(entry => entry.id === suitId)!.hold, 30 + SUIT_DEFENCE.holdBoost);
  assert.equal(relation(held, "neighbour_1"), relation(enforcing, "neighbour_1") - 5);
  assert.equal(gameReducer(held, { type: "hold_possession", suitId }), held, "once a year");
  assert.equal(suitDefenceActions(held, suitId)!.hold.refusal, "held");
});

// --- DTR-23: the forcible entry -----------------------------------------------------------------------------------------

test("DTR-23 (S3): past −60 a neighbour house's large act is a forcible entry forewarned; guarded it fails, appeased it is called off, else the house enters and the lord has a novel disseisin", () => {
  assert.equal(FACTION_ACTS.neighbour.grudgeLarge.effects[0]!.effect, "forcible_entry");
  const { state: owned, estateId, pieceId } = taken(funded(lordGame(), 50_000));
  const threatened = threatenEntry(owned, "neighbour_1", estateId)!;
  assert.equal(threatened.threat.pieceId, pieceId);
  assert.equal(threatenEntry(threatened.state, "neighbour_1", estateId), null, "one at a time");
  const state = threatened.state;
  const threatId = threatened.threat.id;
  assert.ok(lordMattersDue(state).some(entry => entry.kind === "entry_threat" && entry.id === threatId && entry.dueTick === threatened.threat.due));
  const at = (next: GameState) => advanceTick({ ...next, tick: threatened.threat.due - 1 });
  // Guarded: the house's men find it held.
  const guarded = at(gameReducer(state, { type: "guard_possession", threatId }));
  assert.equal(estatesOf(guarded).estates.find(entry => entry.id === estateId)!.pieces.find(entry => entry.id === pieceId)!.possessor, LORD);
  assert.ok(guarded.history!.records.some(entry => entry.template === "estate.entry_repelled") || entryThreats(guarded).length === 0);
  // Appeased: the threat ends at once, the house's relation rises.
  const appeased = gameReducer(state, { type: "appease_neighbour", threatId });
  assert.equal(entryThreats(appeased).length, 0);
  assert.equal(relation(appeased, "neighbour_1"), relation(state, "neighbour_1") + SUIT_DEFENCE.appeaseRelation);
  // Left alone: the house enters; the lord's novel disseisin goes from its filing straight to the hearing.
  const entered = at(state);
  const piece = estatesOf(entered).estates.find(entry => entry.id === estateId)!.pieces.find(entry => entry.id === pieceId)!;
  assert.deepEqual([piece.possessor, piece.loss], ["neighbour_1", "forced"]);
  assert.ok(entered.history!.records.some(entry => entry.template === "estate.entry_forced"));
  const novel = estatesOf(entered).claims.find(entry => entry.claimant === LORD && entry.pieceId === pieceId && entry.status === "open")!;
  assert.deepEqual([novel.novel, novel.strength, novel.basis], [true, SUIT_DEFENCE.novelStrength, "old_possession"]);
  const filed = gameReducer(entered, { type: "file_suit", claimId: novel.id });
  const suit = estatesOf(filed).suits.find(entry => entry.claimId === novel.id)!;
  assert.equal(suit.fast, true);
  const next = advanceSuits({ ...filed, tick: (Math.floor(filed.tick / SEASON) + 2) * SEASON });
  assert.equal(estatesOf(next).suits.find(entry => entry.id === suit.id)!.stage, "hearing", "filing, then the hearing");
});

// --- Astra lordplay2 ------------------------------------------------------------------------------------------------------

test("Astra lordplay2 ②: an enforcement and a judgment name who won and who lost — the house taking the lord's piece reads as his loss", () => {
  const lost = HISTORY_TEMPLATES["estate.possession_enforced"]!({ suit: "suit-3", attempt: 3, succeeded: 1, piece: "estate-neighbour-1:fishery", plaintiff: "neighbour_1", defendant: "lord" });
  assert.equal(lost, "첫째 이웃 영주가 판결대로 영주에게서 어업권의 점유를 가져갔다 — 영주가 잃었다(3번째)");
  const won = HISTORY_TEMPLATES["estate.possession_enforced"]!({ suit: "suit-1", attempt: 3, succeeded: 1, piece: "estate-neighbour-1:fishery", plaintiff: "lord", defendant: "neighbour_1" });
  assert.equal(won, "판결대로 영주가 어업권의 점유를 넘겨받았다(3번째)");
  assert.equal(HISTORY_TEMPLATES["estate.possession_enforced"]!({ attempt: 1, succeeded: 0, piece: "estate-neighbour-1:fishery", plaintiff: "neighbour_1" }), "영주가 버텼다: 첫째 이웃 영주의 어업권 점유 집행을 막았다(1번째)");
  assert.match(HISTORY_TEMPLATES["estate.suit_judged"]!({ verdict: "plaintiff", piece: "estate-neighbour-1:fishery", plaintiff: "neighbour_1" }), /첫째 이웃 영주가 이겼다 — 영주가 어업권의 권원을 잃었다/);
});

test("Astra lordplay2 ③ (its final save): the inheritance's suit lost, the marriage's estate is lost — not a suit still to file", () => {
  const save = astraSave("manual-final.savebin");
  assert.equal(save.diplomacy!.marriage!.stage, "contested");
  assert.equal(estatesOf(save).claims.find(claim => claim.id === save.diplomacy!.marriage!.claimId)!.status, "lost");
  const after = advanceDiplomacy(save);
  assert.equal(after.diplomacy!.marriage!.stage, "lost");
  assert.equal(marriageDecisionDue(after), null);
});

test("Astra lordplay2 ④: a dearth under a decision that prepared for it reads as what that decision left ready, not as its doing", () => {
  const params = { foodDays: 84, granaries: 2, weakPoints: "", prepared: 1 };
  assert.equal(HISTORY_TEMPLATES["crisis.arrived"]!(params), "흉년이 닥쳤을 때 이 결정이 남긴 대비: 쌓인 식량 84일분, 곡창 2채");
  assert.doesNotMatch(HISTORY_TEMPLATES["crisis.arrived"]!({ ...params, prepared: 0 }), /결정/);
});

test("Astra lordplay2 ⑤ (P-D5): a lasting stall-dues change is the lord's — a merchant house's first share weighs as rights, so the steward leaves it", () => {
  const save = astraSave("indexedDB-1306-recovery-source.json");
  // The save's own merchant-share offer (ck_evt_211) when it comes: the steward answered it in the play (1306 summer).
  let state = save;
  let offer: NonNullable<GameState["registry"]>["occurrences"][number] | undefined;
  for (let tick = 0; tick < 2 * SEASON && offer === undefined; tick += 1) {
    state = advanceTick(state);
    offer = state.registry?.occurrences.find(entry => entry.entryId === "ck_evt_211");
  }
  assert.ok(offer !== undefined, "the merchant share comes within half a year of the save");
  assert.notEqual(offer!.decidedBy, "steward");
  const weighed = weighOffer(state, offer!);
  assert.ok(weighed === null || weighed.weights.includes("rights"));
});

test("Astra lordplay2 ⑥ (its 1306 save): the couple's child is kin of the house, its parents the groom and the bride — not the lord's son", () => {
  const save = astraSave("indexedDB-1306-recovery-source.json");
  const plan = save.diplomacy!.marriage!;
  const child = save.persons!.people.find(person => person.motherId === plan.brideId && person.fatherId === plan.groomId)!;
  assert.ok(child !== undefined);
  assert.equal(child.role, "kin");
  assert.ok(child.tags.some(tag => tag.startsWith("lord-kin:") && tag.endsWith("_child")));
});

test("Astra lordplay2 ⑦: the will waits two seasons in the lord's matters due; unanswered, it stands as a lapse, not his choice", () => {
  const save = astraSave("manual-final.savebin");
  const plan = save.diplomacy!.marriage!;
  const contracted = plan.contractedTick;
  // The will's change as it came (its answer not yet given).
  const { willAnswer: _answer, rival: _rival, ...rest } = plan;
  const willDue: GameState = { ...save, tick: contracted + MARRIAGE_TIMES.willChange + 10, diplomacy: { ...save.diplomacy!, marriage: { ...rest, stage: "will_change" } } };
  assert.deepEqual(lordMattersDue(willDue).filter(entry => entry.kind === "will_change").map(entry => entry.dueTick), [contracted + MARRIAGE_TIMES.willChange + MARRIAGE_TIMES.willAnswer]);
  assert.equal(MARRIAGE_TIMES.willAnswer, 2 * SEASON);
  const lapsed = advanceTick({ ...willDue, tick: contracted + MARRIAGE_TIMES.willChange + MARRIAGE_TIMES.willAnswer - 1 });
  assert.equal(lapsed.diplomacy!.marriage!.willAnswer, "let_it_be");
  assert.equal(lapsed.diplomacy!.marriage!.willLapsed, true);
  assert.ok(lapsed.history!.records.some(entry => entry.template === "decision.lapsed" && entry.params?.source === "answer_will_change:lapsed"));
});

// --- PLAY-2 reads (renderer A's request, docs/requests/engine-play2-reads.md) ----------------------------------------------

test("PLAY-2: a filing's outlook shows its cost even when refused, and the hearing it would open — who leads now, and whether the claim can still pass the defence", async () => {
  const { suitFilingOutlook, suitActions } = await import("../src/engine/estateSuits");
  const poor = funded(lordGame(), 10);
  const claim = estatesOf(poor).claims.find(entry => entry.claimant === LORD && entry.status === "open")!;
  const refused = suitFilingOutlook(poor, claim.id);
  assert.equal(refused.refusal, "treasury");
  assert.ok(refused.cost > 10, "the cost though refused");
  const hearing = refused.hearing!;
  assert.equal(hearing.verdictNow, hearing.plaintiff > hearing.defence ? "plaintiff" : "defendant");
  // Reachable: what the claim has plus every kind of evidence still to bring (and a patron) against the defence.
  const evidence = Object.values(EVIDENCE_WEIGHT).reduce((sum, weight) => sum + weight, 0);
  assert.equal(hearing.reachable, hearing.plaintiff + evidence + Math.max(0, ...poor.factions!.factions.filter(faction => faction.relation >= 10).map(faction => Math.min(30, faction.relation))) > hearing.defence);
  // Filed, the suit's track lists what each stage still ahead costs, the enforcement's attempt last.
  const rich = funded(lordGame(), 50_000);
  const filed = gameReducer(rich, { type: "file_suit", claimId: claim.id });
  const suit = estatesOf(filed).suits.find(entry => entry.claimId === claim.id)!;
  const costs = suitActions(filed, suit.id)!.stageCosts;
  assert.deepEqual(costs.map(entry => entry.stage), ["evidence", "patronage", "hearing", "enforcing"]);
  assert.ok(costs.find(entry => entry.stage === "hearing")!.cost >= 120);
  assert.equal(suitHearing(filed, suit.id)!.verdictNow, suitHearing(filed, suit.id)!.plaintiff > suitHearing(filed, suit.id)!.defence ? "plaintiff" : "defendant");
});

test("PLAY-2: each weak point after a dearth names the town project that answers it; the dearth's tie to a preparing decision is marked as preparedness", async () => {
  const { preparedness } = await import("../src/engine/crisisReads");
  const { WEAK_POINTS } = await import("../src/content/historyCopy.ko");
  const prep = preparedness(lordGame());
  assert.deepEqual(prep.levers.map(entry => entry.point), prep.weakPoints);
  const project = Object.fromEntries(prep.levers.map(entry => [entry.point, entry.project]));
  if ("no_granary" in project) assert.equal(project.no_granary, "granary");
  if ("households_short" in project) assert.equal(project.households_short, null);
  assert.equal(WEAK_POINTS.no_market, "곡식을 살 장터 없음");
});

test("DTR-23 / LP2-E ⑤: a concord the lord paid is followed by the kept piece's rent; an answer on the stall dues by the dues as they come", async () => {
  const { advanceTrace } = await import("../src/engine/decisionTrace");
  const { possessionRentSeason } = await import("../src/engine/possessionRent");
  const { state: owned, estateId, pieceId } = taken(funded(lordGame(), 50_000));
  const { state, suitId } = sued(owned, estateId, pieceId);
  const paid = gameReducer(state, { type: "settle_suit", suitId, terms: "pay" });
  const decision = paid.trace!.decisions.at(-1)!;
  assert.ok(decision.targets.includes(`rent:${estateId}|${pieceId}|concord`));
  const traced = advanceTrace(paid, possessionRentSeason({ ...paid, tick: paid.tick + 1 }));
  const record = traced.history!.records.find(entry => entry.template === "consequence" && entry.params?.key === "suit_rent")!;
  assert.equal(record.because?.[0]?.decisionId, decision.id);
  assert.match(HISTORY_TEMPLATES.consequence!(record.params!), /^\d+년 합의로 지킨 땅에서 지대 .+ 들어왔다$/);
});
