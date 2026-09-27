import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PRESSURE_BALANCE } from "../src/content/balanceConfig";
import { CHAPTER_TWO, type PetitionResponse } from "../src/content/chapterConfig";
import { PETITION_SUBJECTS, WAR_CHOICES } from "../src/content/historyCopy.ko";
import { WAR_PETITION_IDS } from "../src/content/warConfig";
import type { GameState } from "../src/engine/engine.types";
import { advanceFactions } from "../src/engine/factions";
import { endChapterTwo, initialPolitics, openPetitions, respondToPetition } from "../src/engine/politics";
import { advanceWar, beaconLit } from "../src/engine/war";
import { postLedgerEntries, treasuryBalance } from "../src/ledger/ledger";
import { decodeSave } from "../src/save/saveCodec";
import { petitionDecisionView } from "../src/ui/decisionModels";
import { storyBeats } from "../src/ui/eventStory";
import { PetitionModal } from "../src/ui/hud/StoryModals";
import { lordshipView, menAwayLine } from "../src/ui/lordshipModel";
import { chronicleIllustration, chronicleView, latestChapterEnd } from "../src/ui/chronicleModel";
import { advanceHistory } from "../src/engine/history";

// UI-6: chapter 2's screens read from the engine's war (F2-A), factions (FACTION-0) and lordship (FAIL-3) — a
// 24-house walled town (the v19 fixture) run season by season from the War era's messenger, as tests/chapterTwoWar does.
const SEASON = PRESSURE_BALANCE.seasonTicks;
const M = 148_000;
function warTown(): GameState {
  const state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v19/palisade-construction.save.json"))).envelope.state as GameState;
  const palisade = state.palisade === null ? null : { ...state.palisade, segments: state.palisade.segments.map(segment => ({ ...segment, completed: true, material: "timber" as const })) };
  const funded = postLedgerEntries({ ...state, tick: M }, [{ account: "cash", category: "opening_balance", amount: 5000 - treasuryBalance(state),
    sourceRefs: [{ type: "scenario", id: "ui6-test" }] }]);
  const politics = initialPolitics(state);
  const town: GameState = { ...state, tick: M, palisade, treasuryCoin: funded.treasuryCoin, ledger: funded.ledger,
    historicalEras: [...(state.historicalEras ?? []), { id: "war", enteredTick: M, forced: false }],
    politics: { ...politics, chapter: { number: CHAPTER_TWO.chapter, startTick: 80_000, populationStart: state.population, peakPopulation: state.population } } };
  return advanceFactions({ ...town, factions: undefined } as unknown as GameState);
}
/** Season starts from 0 to `to`, calling `seen` on each open war petition before answering it `accept_with_price`. */
function run(to: number, seen: (state: GameState, defId: string) => void = () => undefined, answer: PetitionResponse = "accept_with_price"): GameState {
  let state = warTown();
  for (let offset = 0; offset <= to; offset += 1) {
    state = advanceWar({ ...state, tick: M + offset * SEASON }, endChapterTwo);
    for (const petition of openPetitions(state)) {
      seen(state, petition.defId);
      state = respondToPetition(state, petition.id, answer);
    }
  }
  return state;
}

test("UI-6 the war's five demands each open their own card: Wave 17 scene, title, the ledger's answers, the rules' numbers", () => {
  const cards = new Map<string, ReturnType<typeof petitionDecisionView>>();
  run(15, (state, defId) => { if (!cards.has(defId)) cards.set(defId, petitionDecisionView(state)); });
  assert.deepEqual([...cards.keys()].sort(), [...WAR_PETITION_IDS].sort());
  for (const [defId, view] of cards) {
    assert.ok(view !== null, defId);
    assert.deepEqual(view.presentation.art, { sheet: "wave17", id: `decision_${defId}` }, defId);
    assert.equal(view.presentation.title, PETITION_SUBJECTS[defId], defId);
    assert.deepEqual(view.options.map(option => option.label), ["accept", "accept_with_price", "refuse"].map(response => WAR_CHOICES[defId]![response]), defId);
    // The market charter's copy is gone from the war's cards.
    assert.doesNotMatch(JSON.stringify(view), /시장권|상인 무리가/, defId);
    assert.ok(view.options.every(option => /금고 \d+d/.test(option.predicted)), defId);
  }
  const wool = cards.get("wool_payment")!;
  assert.equal(wool.presentation.from?.writ, true);
  assert.equal(wool.presentation.from?.name, "국왕과 왕실");
  assert.equal(wool.presentation.from?.leader?.name, "에드워드 3세");
  assert.match(wool.presentation.demand, /20d = \d+d/);
  const markup = renderToStaticMarkup(createElement(PetitionModal, { view: wool, onRespond: () => undefined, onLater: () => undefined, onPerson: () => undefined }));
  assert.match(markup, /data-def="wool_payment"/);
  assert.match(markup, /wave17\/[^"]*wool_payment[^"]*\.jpg/);
  assert.match(markup, /wax_seal_hanging/);
  assert.doesNotMatch(markup, /Edward/);
});

test("UI-6 the war's story beats come in the world's order: messenger, beacon, raid, aftermath", () => {
  const kinds: string[][] = [];
  let state = warTown();
  for (let offset = 0; offset <= 15; offset += 1) {
    state = advanceWar({ ...state, tick: M + offset * SEASON }, endChapterTwo);
    for (const petition of openPetitions(state)) state = respondToPetition(state, petition.id, "accept_with_price");
    kinds.push(storyBeats(state).map(beat => beat.kind).filter(kind => kind !== "petition"));
    if (offset === 0) assert.ok(kinds[0]!.includes("war_messenger"));
  }
  const first = (kind: string) => kinds.findIndex(list => list.includes(kind));
  assert.ok(first("war_messenger") === 0);
  assert.ok(first("beacon") > 0 && first("raid") === first("beacon") + 1 && first("raid_aftermath") === first("raid") + 1, JSON.stringify(kinds));
  assert.equal(beaconLit({ ...state, tick: M }), false);
});

test("UI-6 the rights register: house, arms, title, the three rights, the war's favour; the men away line", () => {
  const view = lordshipView(run(1));
  assert.equal(view.rights.length, 3);
  assert.deepEqual(view.rights.map(right => right.id), ["market", "tolls", "mill"]);
  assert.ok(view.war.some(line => line.startsWith("왕실의 신임")));
  assert.match(view.house, /^.+ 가문 · 1대째 가문 · \d{4}년부터$/);
  assert.equal(view.arms.kind, "arms");
  const levied = run(5, () => undefined, "accept");
  assert.match(menAwayLine(levied) ?? "", /^징집되어 떠난 사람 \d+명 · \d+년 .+에 돌아옵니다$/);
});

test("UI-6 the war's ledger records take the Wave 17 chronicle scenes", () => {
  assert.equal(chronicleIllustration({ template: "war.raid", params: {} }), "chronicle_raid");
  assert.equal(chronicleIllustration({ template: "war.beacon", params: {} }), "chronicle_beacon");
  assert.equal(chronicleIllustration({ template: "decision.petition_response", params: { defId: "wool_payment", chosen: "accept" } }), "chronicle_wool_levy");
  assert.equal(chronicleIllustration({ template: "decision.petition_response", params: { chosen: "refuse" } }), "chronicle_petition");
});

test("UI-6 chapter 2's page: its own range, the war's decisions quoted with their answers, the war's stats, no famine line", () => {
  let state = warTown();
  for (let offset = 0; offset <= 15; offset += 1) {
    const before = state;
    state = advanceWar({ ...state, tick: M + offset * SEASON }, endChapterTwo);
    // The market chosen over the stone wall: the chapter ends the season after (WR-9).
    for (const petition of openPetitions(state)) state = respondToPetition(state, petition.id, petition.defId === "wall_or_market" ? "refuse" : "accept_with_price");
    state = advanceHistory(before, state);
  }
  const end = latestChapterEnd(state)!;
  assert.equal(end.chapter, 2);
  // The engine quotes the decisions the player made through the game's dispatch; here one is written as it would be.
  const record = { ...state.history!.records.at(-1)!, id: "rec-wool", template: "decision.petition_response", kind: "decision" as const,
    params: { defId: "wool_payment", chosen: "accept_with_price" } };
  const quote = { recordId: "rec-wool", kind: "petition_response", tick: M + SEASON, chosen: "accept_with_price", alternatives: ["accept", "refuse"], predicted: {} };
  const quoted: GameState = { ...state, history: { ...state.history!, records: [...state.history!.records, record] },
    politics: { ...state.politics!, chapterEnds: state.politics!.chapterEnds.map(entry => entry === end ? { ...entry, chronicle: { ...entry.chronicle, decisions: [quote] } } : entry) } };
  const view = chronicleView(quoted)!;
  assert.equal(view.chapter, 2);
  assert.match(view.title, /^제2장 연대기/);
  assert.ok(view.entries.some(entry => entry.illustration === "chronicle_raid" && /해안 습격/.test(entry.sentence)));
  assert.ok(view.entries.some(entry => entry.illustration === "chronicle_beacon"));
  assert.ok(view.stats.some(line => /^해안 습격\(1339\) 불탄 집 \d+/.test(line)), view.stats.join(" | "));
  assert.ok(view.stats.some(line => /시장을 넓힘$/.test(line)));
  assert.ok(view.stats.every(line => !line.startsWith("대기근")));
  const [decision] = view.decisions;
  assert.ok(decision!.sentence.includes(PETITION_SUBJECTS.wool_payment!) && decision!.sentence.includes(WAR_CHOICES.wool_payment!.accept_with_price!), decision!.sentence);
  assert.doesNotMatch(decision!.sentence, /상인 청원/);
  assert.ok(decision!.alternatives.includes(WAR_CHOICES.wool_payment!.refuse!));
  // Chapter 2's page opens from chapter 1's end, not from the first record.
  const withOne: GameState = { ...quoted, politics: { ...quoted.politics!, chapterEnds: [{ ...end, chapter: 1, tick: M + 3 * SEASON }, ...quoted.politics!.chapterEnds] } };
  const ranged = chronicleView(withOne)!;
  assert.ok(ranged.entries.every(entry => !/전령/.test(entry.sentence)), "the messenger came before chapter 1's (moved) end");
});
