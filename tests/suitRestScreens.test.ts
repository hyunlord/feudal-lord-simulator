/**
 * SUIT-THREAD, renderer A's "suit-rest" part (docs/requests/render-suit-defence-lordplay2.md §3, §6–9): the unanswered
 * list read from the engine's `lordMattersDue` (the will to the 혼인 page with its deadline, a suit against the lord, an
 * entry forewarned; the will's lapse on the marriage's timeline), the preparedness heads ("○○년 결정이 남긴 대비"), the
 * biography's parents and the household's kin words, the standing policy's note (the famine's levers: play2Screens.test.ts).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";

import { MARRIAGE_TIMES } from "../src/content/diplomacyConfig";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/lordSliceConfig";
import type { GameState } from "../src/engine/engine.types";
import { estatesOf, LORD, raiseClaim } from "../src/engine/estates";
import { fileSuit } from "../src/engine/estateSuits";
import type { HistoryRecord } from "../src/engine/history.types";
import { lordMattersDue } from "../src/engine/lordDue";
import { personDisplayName } from "../src/engine/persons";
import { threatenEntry } from "../src/engine/suitDefence";
import { advanceTick } from "../src/engine/tick";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { decodeSave } from "../src/save/saveCodec";
import { newGameState } from "../src/state/newGame";
import { becauseLine, biographyView } from "../src/ui/chronicle/chronicleScreenModel";
import { decisionThread } from "../src/ui/chronicle/decisionThreadModel";
import { dateWord } from "../src/ui/decisionCard/answerWords";
import { storyBeats } from "../src/ui/eventStory";
import { LORD_MATTERS_COPY } from "../src/ui/lord/decisions/lordMattersCopy.ko";
import { LORD_MATTER_CHIP, lordMatterChipIds } from "../src/ui/lord/decisions/lordMattersDue";
import { NEGOTIATION_COPY } from "../src/ui/lord/negotiation/negotiationCopy.ko";
import { negotiationScreen, EMPTY_DRAFT } from "../src/ui/lord/negotiation/negotiationModel";
import { decidingId } from "../src/ui/lord/screen/DecideButton";
import { STEWARD_COPY } from "../src/ui/lord/steward/stewardCopy.ko";
import { lordHouseholdRows } from "../src/ui/persons/personModels";
import { preparedOnly, preparedThen } from "../src/ui/results/decisionThread";
import { RESULTS_COPY } from "../src/ui/results/resultsCopy.ko";

const run = (state: GameState, ticks: number): GameState => { let next = state; for (let tick = 0; tick < ticks; tick += 1) next = advanceTick(next); return next; };
const lordGame = (): GameState => run(newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed: 1 })!, 10);
function funded(state: GameState, amount: number): GameState {
  const posted = postLedgerEntries(state, [{ account: "cash", category: "rent", amount: amount - treasuryBalance(state), sourceRefs: [{ type: "actor", id: "test" }] }]);
  return { ...state, ledger: posted.ledger, treasuryCoin: posted.treasuryCoin };
}
/** Neighbour 1's piece the lord holds by a judgment (as tests/suitDefence.test.ts). */
function taken(state: GameState): { readonly state: GameState; readonly estateId: string; readonly pieceId: string } {
  const estates = estatesOf(state);
  const estate = estates.estates.find(entry => entry.id === "estate-neighbour-1")!;
  const piece = estate.pieces.find(entry => entry.annualValue > 0)!;
  const held = { ...piece, possessor: LORD, possessedSince: state.tick, titleHolder: LORD, former: estate.titleHolder };
  return { state: { ...state, estates: { ...estates, estates: estates.estates.map(entry => entry.id !== estate.id ? entry
    : { ...entry, pieces: entry.pieces.map(other => other.id === piece.id ? held : other) }) } }, estateId: estate.id, pieceId: piece.id };
}
function astraSave(name: "manual-final.savebin" | "indexedDB-1306-recovery-source.json"): GameState {
  const raw = gunzipSync(readFileSync(`docs/qa/lordplay2-20261008/saves/${name}.gz`));
  const bytes = name.endsWith(".json")
    ? new Uint8Array(Buffer.from((JSON.parse(raw.toString("utf8")) as { stores: { name: string; records: { value: { data: string } }[] }[] }).stores.find(store => store.name === "slots")!.records[0]!.value.data, "base64"))
    : new Uint8Array(raw);
  return decodeSave(bytes).envelope.state as GameState;
}
/** The Astra final save with the will's change as it came (its answer not given yet). */
function willDue(): GameState {
  const save = astraSave("manual-final.savebin");
  const { willAnswer: _answer, rival: _rival, willLapsed: _lapsed, ...rest } = save.diplomacy!.marriage!;
  return { ...save, tick: rest.contractedTick + MARRIAGE_TIMES.willChange + 10, diplomacy: { ...save.diplomacy!, marriage: { ...rest, stage: "will_change" } } };
}

test("SUIT-THREAD §3: the will's chip says the engine's deadline as a season, opens the 혼인 page, and stays until answered; there it opens the will's card", () => {
  const state = willDue();
  const plan = state.diplomacy!.marriage!;
  const due = lordMattersDue(state).find(entry => entry.kind === "will_change")!;
  const chip = storyBeats(state).find(beat => beat.id === LORD_MATTER_CHIP.marriage("will_change", plan.claimId))!;
  assert.deepEqual(chip.screen, { screen: "marriage", focus: null });
  assert.equal(chip.openLabel, LORD_MATTERS_COPY.willOpen);
  assert.deepEqual(chip.facts, [LORD_MATTERS_COPY.willDue(dateWord(state, due.dueTick!))]);
  assert.ok(lordMatterChipIds(state).has(chip.id), "kept among the chips until answered");
  const page = negotiationScreen(state, EMPTY_DRAFT);
  assert.ok(page.phase === "contract" && page.due === "will_change" && page.dueText!.includes(dateWord(state, due.dueTick!).slice(0, 4)), page.phase === "contract" ? page.dueText ?? "" : "");
  assert.equal(decidingId(state, "marriage_decision"), plan.claimId, "the page's [결정하기] opens the will's card");
  // Past its deadline the will stands as a lapse: off the list, and the timeline says the deadline answered it.
  const lapsed = advanceTick({ ...state, tick: due.dueTick! - 1 });
  assert.ok(!lordMatterChipIds(lapsed).has(chip.id));
  const timeline = negotiationScreen(lapsed, EMPTY_DRAFT);
  assert.ok(timeline.phase === "contract" && timeline.details.includes(NEGOTIATION_COPY.willAnswer(NEGOTIATION_COPY.willLapsed)), JSON.stringify(timeline.phase === "contract" ? timeline.details : []));
  assert.equal(NEGOTIATION_COPY.willAnswer(NEGOTIATION_COPY.willLapsed), "유언 변경에 한 답: 기한이 지나 그대로 두었다");
});

test("SUIT-THREAD §3: a suit against the lord and an entry forewarned are chips in the engine's words, kept until answered, opening the 약속·소송 page on them", () => {
  const { state: owned, estateId, pieceId } = taken(funded(lordGame(), 50_000));
  const claimed = raiseClaim(owned, { claimant: "neighbour_1", estateId, pieceId, basis: "inheritance" });
  const claim = estatesOf(claimed).claims.find(entry => entry.claimant === "neighbour_1" && entry.pieceId === pieceId)!;
  const filed = fileSuit(claimed, claim.id);
  const suit = estatesOf(filed).suits.find(entry => entry.claimId === claim.id)!;
  assert.equal(storyBeats(filed).find(beat => beat.id === LORD_MATTER_CHIP.suit(suit.id))!.line, LORD_MATTERS_COPY.suitLine, "no filing record: the plain line");
  // The filing's record as the engine writes it (history.ts: a suit new in a tick), its moment beside it.
  const record = { id: "h-filed", tick: filed.tick, kind: "estate", template: "estate.suit_filed", severity: 1, subject: "town",
    params: { suit: suit.id, claim: claim.id, plaintiff: suit.plaintiff, defendant: suit.defendant, piece: suit.pieceId ?? "" } } as unknown as HistoryRecord;
  const sued = { ...filed, history: { ...filed.history!, records: [...filed.history!.records, record] } } as GameState;
  const chip = storyBeats(sued).find(beat => beat.id === LORD_MATTER_CHIP.suit(suit.id))!;
  assert.deepEqual(chip.screen, { screen: "ledger", focus: suit.id });
  assert.match(chip.line, /상대로 .*소송을 냈다/, "the engine's sentence of the filing");
  const next = lordMattersDue(sued).find(entry => entry.kind === "suit_defence" && entry.id === suit.id)!;
  assert.equal(chip.facts[1], next.dueTick === null ? LORD_MATTERS_COPY.suitWaits : LORD_MATTERS_COPY.suitNext(dateWord(sued, next.dueTick)));
  assert.ok(lordMatterChipIds(sued).has(chip.id));
  assert.ok(!storyBeats(sued).some(beat => beat.illustration === "moment_lawsuit_filed" && beat.id.startsWith("lord-moment:")), "the chip stands for its filing's moment");
  const threatened = threatenEntry(owned, "neighbour_1", estateId)!;
  const warned = storyBeats(threatened.state).find(beat => beat.id === LORD_MATTER_CHIP.entry(threatened.threat.id))!;
  assert.deepEqual(warned.screen, { screen: "ledger", focus: threatened.threat.id });
  assert.deepEqual(warned.facts, [LORD_MATTERS_COPY.entryComes(dateWord(threatened.state, threatened.threat.due))]);
  assert.ok(lordMatterChipIds(threatened.state).has(warned.id));
});

test("SUIT-THREAD §6: a decision that prepared for a dearth heads its line '○○년 결정이 남긴 대비', and the bad harvest's news says what it left", () => {
  const state = lordGame();
  const decision = { id: "h-prep", tick: 100, kind: "decision", template: "decision.subsidy", severity: 1, subject: "town", params: { chosen: "granary" },
    decision: { chosen: "granary", alternatives: [], predicted: {} } } as unknown as HistoryRecord;
  const arrived = { id: "h-arrived", tick: 200, kind: "event", template: "crisis.arrived", severity: 2, subject: "town",
    params: { eventId: "dearth-1", foodDays: 84, granaries: 1, markets: 0, shortHouseholds: 0, weakPoints: "no_market", policy: "", prepared: 1 },
    because: [{ decisionId: "h-prep", key: "crisis_prepared", relation: "preparedness" }] } as unknown as HistoryRecord;
  const withRecords = { ...state, history: { ...state.history!, records: [...state.history!.records, decision, arrived] } } as GameState;
  const year = RESULTS_COPY.trace.prepared(1300);
  assert.ok(becauseLine(withRecords, arrived, "문장").startsWith(`${year} — `), becauseLine(withRecords, arrived, "문장"));
  assert.doesNotMatch(becauseLine(withRecords, arrived, "문장"), /때문에/);
  assert.ok(decisionThread(withRecords, arrived)!.because[0]!.line.startsWith(year));
  assert.equal(preparedOnly([{ key: "crisis_prepared" }, { key: "relation" }]), true);
  assert.equal(preparedOnly([{ key: "crisis_prepared" }, { key: "households_left" }]), false);
  const [then] = preparedThen(withRecords, "dearth-1");
  assert.ok(then!.startsWith("그때 이 결정이 남긴 대비 — "), then);
});

test("SUIT-THREAD §7 (Astra 1306 save): the kin child's biography names its parents (the groom and the bride), and the household list says what it is to the lord", () => {
  const save = astraSave("indexedDB-1306-recovery-source.json");
  const plan = save.diplomacy!.marriage!;
  const child = save.persons!.people.find(person => person.motherId === plan.brideId && person.fatherId === plan.groomId)!;
  const view = biographyView(save, child.id)!;
  const name = (id: string) => personDisplayName(save.persons!.people.find(person => person.id === id)!);
  assert.equal(view.relations[0]!.line, `아버지 ${name(plan.groomId)}`);
  assert.equal(view.relations[1]!.line, `어머니 ${name(plan.brideId)}`);
  assert.ok(!view.relations.some(relation => relation.line.startsWith("부모 ")), "no one else called its parent");
  assert.ok(child.tags.includes("lord-kin:cousin_child"), "the save's child: the lord's cousin's");
  const rows = lordHouseholdRows(save);
  assert.match(rows.find(entry => entry.id === child.id)!.line, new RegExp(`^영주의 사촌의 ${child.sex === "male" ? "아들" : "딸"} · `));
  assert.match(rows.find(entry => entry.id === plan.brideId)!.line, /^영주의 사촌의 아내 · /);
  assert.match(rows.find(entry => entry.id === plan.groomId)!.line, /^영주의 사촌 · /);
  // The groom's biography calls the child his and the bride his wife.
  const groom = biographyView(save, plan.groomId)!.relations;
  assert.ok(groom.some(relation => relation.id === child.id && relation.line.startsWith("자녀 ")));
  assert.ok(groom.some(relation => relation.id === plan.brideId && relation.line.startsWith("배우자 ")));
});

test("SUIT-THREAD §8: the standing policy screen notes that lasting tax-rate changes come to the lord", () => {
  assert.match(STEWARD_COPY.screenIntro, /지속 세율 변경은 영주에게 옵니다/);
});
