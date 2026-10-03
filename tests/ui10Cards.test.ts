/**
 * UI-10 chapter 5 decision cards (F5-A LG-2…LG-6, FIX-9 LG-13): the four chapter-5 cards and the interlude's two, their
 * own art (no petition kind falls back to the market's picture), the answers the record allows, each answer's sums and
 * relation moves in the engine's numbers, the treasury forecast, the heir candidates beside the heir's answers, the
 * ledger's labels for chapter 5's money, and the Crown's new head on the faction tab after 1399. The town is the
 * chapter-4 town run into chapter 5 (`tests/helpers/legacyTown.ts`); between the steps only the calendar moves.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MARKET_CHARTER_PETITION_ID, PETITION_DEFS, RESTORE_RIGHT_PETITION_ID } from "../src/content/chapterConfig";
import {
  BOROUGH_AUTONOMY_PETITION_ID,
  CHURCH_REBUILDING_PETITION_ID,
  GUILD_DISPUTE_PETITION_ID,
  HEIR_CHOICE_PETITION_ID,
  LEGACY_BALANCE as B,
  LEGACY_CARD_PETITION_IDS,
  LEGACY_CHOICE_PETITION_ID,
  LEGACY_DECISION_ART,
  LEGACY_PETITION_IDS,
  ROYAL_TAX_PETITION_ID,
} from "../src/content/legacyConfig";
import { PLAGUE_PETITION_IDS } from "../src/content/plagueConfig";
import { REORGANISATION_PETITION_IDS } from "../src/content/reorganisationConfig";
import { WAR_PETITION_IDS } from "../src/content/warConfig";
import type { GameState } from "../src/engine/engine.types";
import { heirCandidates, legacyDecisionForecast } from "../src/engine/legacy";
import { personDisplayName } from "../src/engine/persons";
import { treasuryBalance } from "../src/ledger/ledger";
import { LEDGER_ACTOR_LABELS, LEDGER_CATEGORY_LABELS } from "../src/ledger/ledgerCopy.ko";
import { factionPageView, factionRows } from "../src/ui/chronicle/factionTabModel";
import { DECISION_COPY } from "../src/ui/decisionCopy.ko";
import { petitionDecisionView } from "../src/ui/decisionModels";
import { PetitionModal } from "../src/ui/hud/StoryModals";
import { isPetitionDefId, petitionArtOf, petitionPresentation, type PetitionDefId } from "../src/ui/petitionPresentation";
import { at, legacyTown } from "./helpers/legacyTown";
import { answer, ui10Course } from "./helpers/ui10Course";
import { moneyFull, moneyObject, moneyShort } from "../src/ui/money.ko";

const states = ui10Course;
const view = (state: GameState) => petitionDecisionView(state)!;
const LATIN = /[A-Za-z]{2,}|undefined|NaN/;

test("UI-10: every petition kind the engine can raise has its own card; chapter 5's and the interlude's each their own picture, none the market's", () => {
  const raised: readonly PetitionDefId[] = [MARKET_CHARTER_PETITION_ID, RESTORE_RIGHT_PETITION_ID, ...WAR_PETITION_IDS, ...PLAGUE_PETITION_IDS, ...REORGANISATION_PETITION_IDS, ...LEGACY_PETITION_IDS];
  assert.deepEqual([...PETITION_DEFS.map(def => def.id)].sort(), [...raised].sort(), "the id lists are every def");
  for (const id of PETITION_DEFS.map(def => def.id)) assert.ok(isPetitionDefId(id), `${id} has a presentation`);
  const arts = LEGACY_PETITION_IDS.map(id => petitionArtOf(id));
  assert.equal(new Set(arts.map(art => `${art.sheet}:${art.id}`)).size, LEGACY_PETITION_IDS.length, "no two share a picture");
  assert.ok(arts.every(art => art.id !== "event_market_petition"));
  for (const id of LEGACY_CARD_PETITION_IDS) assert.deepEqual(petitionArtOf(id), { sheet: "wave21", id: LEGACY_DECISION_ART[id] }, id);
  assert.deepEqual(petitionArtOf(GUILD_DISPUTE_PETITION_ID), { sheet: "wave33", id: "interlude_guild_dispute" });
  assert.deepEqual(petitionArtOf(CHURCH_REBUILDING_PETITION_ID), { sheet: "wave33", id: "interlude_church_rebuilding" });
  // A kind the table does not know (only a hand-edited save) has no picture — never the market's.
  const unknown = petitionPresentation(legacyTown(), { id: "x@1", defId: "no_such_petition", petitioner: "townsfolk", arrivedTick: 1 });
  assert.equal(unknown.art, null);
  assert.equal(isPetitionDefId("toString"), false);
});

test("UI-10 (LG-4): the Crown's tax card — two answers, the tenth in pence, the confirmation it may cost, the relations, the forecast", () => {
  const { envoy } = states();
  const card = view(envoy);
  assert.equal(card.presentation.defId, ROYAL_TAX_PETITION_ID);
  assert.deepEqual(card.options.map(option => option.choice), ["accept", "refuse"]);
  const due = Math.max(B.subsidyMin, Math.min(B.subsidyMax, Math.floor(treasuryBalance(envoy) * B.subsidyPermille / 1000)));
  // COPY-1r (CA-005, CA-052): the sums asked in full, the ratio written "10%".
  assert.ok(card.presentation.demand.includes(moneyFull(due)) && card.presentation.demand.includes("10%"), card.presentation.demand);
  const [pay, plead] = card.options;
  assert.match(pay!.line, new RegExp(`금고에서 ${moneyFull(due)} · 관계 국왕 \\+10 · 도시 −5$`));
  assert.match(plead!.line, new RegExp(`국왕 확인금 ${moneyFull(B.confirmationFine)} · 관계 국왕 −15 · 도시 \\+5$`));
  for (const option of card.options) {
    assert.equal(option.predicted, DECISION_COPY.predicted({ treasury: treasuryBalance(envoy) }, { treasury: legacyDecisionForecast(envoy, ROYAL_TAX_PETITION_ID, option.choice) }));
    assert.doesNotMatch(option.line, LATIN);
  }
  assert.equal(card.presentation.from?.writ, true, "the Crown's writ");
});

test("UI-10 (LG-13): the interlude's two cards — the Wave 33 pictures, the guild's side or the merchants', the nave's 300d (£1 5s)", () => {
  const { quarrel, nave } = states();
  const quarrelCard = view(quarrel);
  assert.equal(quarrelCard.presentation.defId, GUILD_DISPUTE_PETITION_ID);
  assert.deepEqual(quarrelCard.presentation.art, { sheet: "wave33", id: "interlude_guild_dispute" });
  assert.deepEqual(quarrelCard.options.map(option => option.choice), ["accept", "refuse"]);
  assert.deepEqual(quarrelCard.options.map(option => option.line), ["길드 편을 듭니다 · 돈은 들지 않음 · 관계 도시 +10 · 상인 −10", "상인 편을 듭니다 · 돈은 들지 않음 · 관계 상인 +10 · 도시 −10"]);
  assert.equal(quarrelCard.options[0]!.predicted, DECISION_COPY.predicted({ treasury: treasuryBalance(quarrel) }, { treasury: treasuryBalance(quarrel) }));
  const card = view(nave);
  assert.equal(card.presentation.defId, CHURCH_REBUILDING_PETITION_ID);
  assert.deepEqual(card.presentation.art, { sheet: "wave33", id: "interlude_church_rebuilding" });
  assert.ok(card.presentation.demand.includes(moneyShort(B.churchRebuildingCost)));
  assert.match(card.options[0]!.line, new RegExp(`금고에서 ${moneyShort(B.churchRebuildingCost)} · 교회 유산 점수 \\+${B.score.church.rebuilt} · 관계 주교 \\+10$`));
  assert.match(card.options[1]!.line, /증축을 미룹니다 · 돈은 들지 않음 · 관계 주교 −10$/);
  assert.equal(card.options[0]!.predicted, DECISION_COPY.predicted({ treasury: treasuryBalance(nave) }, { treasury: treasuryBalance(nave) - B.churchRebuildingCost }));
  for (const option of card.options) assert.doesNotMatch(option.line, LATIN);
});

test("UI-10 (LG-3): the heir's card — only the answers the record allows, each with its candidate's portrait, relation, age, lineage, likeness and records", () => {
  const { heir, ownHeir } = states();
  const card = view(heir);
  assert.equal(card.presentation.defId, HEIR_CHOICE_PETITION_ID);
  assert.deepEqual(card.options.map(option => option.choice), ["accept", "accept_with_price", "refuse"]);
  const candidates = heirCandidates(heir);
  for (const option of card.options) {
    const candidate = candidates.find(entry => entry.response === option.choice)!;
    assert.equal(option.heir?.personId, candidate.personId, option.choice);
    assert.equal(option.heir?.name, candidate.name);
    assert.ok(option.heir!.who.includes(`${candidate.age}살`), option.heir!.who);
    assert.ok(option.heir!.records.startsWith(`${candidate.birthYear}년생`) && option.heir!.records.endsWith(`원장 기록 ${candidate.records}건`), option.heir!.records);
    assert.ok(option.heir!.portraitId.length > 0);
    assert.match(option.line, new RegExp(`상속세 ${moneyShort(B.relief[({ accept: "eldest_son", accept_with_price: "daughter_husband", refuse: "nephew" } as const)[option.choice]])}`));
    assert.equal(option.predicted, DECISION_COPY.predicted({ treasury: treasuryBalance(heir) }, { treasury: legacyDecisionForecast(heir, HEIR_CHOICE_PETITION_ID, option.choice) }));
    for (const line of [option.line, option.heir!.who, option.heir!.lineage, option.heir!.resemblance, option.heir!.records]) assert.doesNotMatch(line, LATIN);
  }
  const [son, husband, nephew] = card.options.map(option => option.heir!);
  // COPY-1r (CA-012): the candidates are described by the lord, whatever his age.
  assert.equal(son!.lineage, "영주의 아들");
  // The son was made in the old lord's likeness (the fixture's lord copied): the face, the hair and the eyes.
  assert.match(son!.resemblance, /^닮은 점: 영주의 얼굴 생김, .+ 머리|^닮은 점: 영주의 얼굴 생김, .+ 금발/);
  const agnes = personDisplayName(heir.persons!.past.find(person => person.id === "m-900003") ?? heir.persons!.people.find(person => person.id === "m-900003")!);
  assert.equal(husband!.lineage, `영주의 딸 ${agnes}의 남편`);
  assert.ok(husband!.records.includes("이번에 영지에 옴"));
  const walter = personDisplayName(heir.persons!.past.find(person => person.id === "m-900004")!);
  assert.equal(nephew!.lineage, `영주의 형제 ${walter}의 아들`);
  assert.equal(card.options[1]!.label, "딸의 남편에게 잇게 한다");
  // The fixture's own house: a widower without children or siblings — one answer, a distant kinsman in the nephew's place.
  const own = view(ownHeir);
  assert.deepEqual(own.options.map(option => option.choice), ["refuse"]);
  assert.equal(own.options[0]!.label, "먼 친척에게 잇게 한다");
  assert.equal(own.options[0]!.heir?.lineage, "가문의 먼 친척");
  assert.match(own.options[0]!.line, /^가문의 먼 친척이 가장이 됩니다/);
});

test("UI-10 (LG-2): the charter's card — the rights, the fine, the fee farm, the Crown's confirmation after the petition, the backlash of a refusal", () => {
  const { charter } = states();
  const card = view(charter);
  assert.equal(card.presentation.defId, BOROUGH_AUTONOMY_PETITION_ID);
  assert.deepEqual(card.presentation.art, { sheet: "wave21", id: "ch5_decision_autonomy" });
  assert.deepEqual(card.options.map(option => option.choice), ["accept", "refuse"]);
  const [seal, refuse] = card.options;
  assert.match(seal!.line, new RegExp(`특허값 ${moneyObject(B.charterFine)} 냄 · 도시의 연납금 해마다 ${moneyShort(B.feeFarm)} · 영주가 국왕 확인금 ${moneyObject(B.confirmationFine)} 냄`));
  assert.match(seal!.line, /관계 도시 \+25 · 상인 \+15 · 백작 −15 · 국왕 \+5$/);
  assert.match(refuse!.line, /도시의 반발 \d+ · 연납금은 그대로 · 가문은 영주관에 남음 · 관계 도시 −25 · 상인 −15 · 평민 −5 · 백작 \+10$/);
  const backlash = Number(/도시의 반발 (\d+)/.exec(refuse!.line)![1]);
  assert.equal(backlash, answer(charter, BOROUGH_AUTONOMY_PETITION_ID, "refuse").legacy!.backlash, "the refusal's backlash as the engine sets it");
  const mayor = charter.legacy!.mayorCandidateId;
  if (mayor !== null) assert.ok(card.presentation.demand.includes("시장 후보는"));
  for (const option of card.options) {
    assert.equal(option.predicted, DECISION_COPY.predicted({ treasury: treasuryBalance(charter) }, { treasury: legacyDecisionForecast(charter, BOROUGH_AUTONOMY_PETITION_ID, option.choice) }));
    assert.doesNotMatch(option.line, LATIN);
  }
});

test("UI-10 (LG-5): the legacy's card — three answers, the endowment the treasury can pay, +25 to its axis, the relations", () => {
  const { legacy } = states();
  const card = view(legacy);
  assert.equal(card.presentation.defId, LEGACY_CHOICE_PETITION_ID);
  assert.deepEqual(card.options.map(option => option.choice), ["accept", "accept_with_price", "refuse"]);
  const spent = Math.min(B.endowment, Math.max(0, treasuryBalance(legacy)));
  assert.deepEqual(card.options.map(option => option.line), [
    `길드홀과 시청을 남깁니다 · 금고에서 ${moneyShort(spent)} · 도시 유산 점수 +${B.legacyPoints} · 관계 도시 +10`,
    `영주관·문장·혈통 기록을 남깁니다 · 금고에서 ${moneyShort(spent)} · 가문 유산 점수 +${B.legacyPoints} · 관계 백작 +5`,
    `교회 증축과 기도처를 남깁니다 · 금고에서 ${moneyShort(spent)} · 교회 유산 점수 +${B.legacyPoints} · 관계 주교 +15`,
  ]);
  for (const option of card.options) assert.equal(option.predicted, DECISION_COPY.predicted({ treasury: treasuryBalance(legacy) }, { treasury: legacyDecisionForecast(legacy, LEGACY_CHOICE_PETITION_ID, option.choice) }));
});

test("UI-10: chapter 5's money has its ledger labels (the categories and who pays)", () => {
  for (const category of ["royal_subsidy", "succession_relief", "legacy_endowment", "church_rebuilding", "charter_fee", "fee_farm"] as const) {
    assert.match(LEDGER_CATEGORY_LABELS[category], /[가-힣]/, category);
  }
  for (const actor of ["town", "overlord", "bishop", "crown"]) assert.match(LEDGER_ACTOR_LABELS[actor] ?? "", /[가-힣]/, actor);
});

test("UI-10 (LG-13): after the 1399 deposition the faction tab's Crown shows Henry IV, the new king's line and the deposition's records", () => {
  const { deposed } = states();
  const crown = factionPageView(deposed, "crown")!;
  assert.equal(crown.leader?.name, "헨리 4세");
  assert.equal(factionRows(deposed).find(row => row.id === "crown")?.leader?.name, "헨리 4세");
  assert.ok(crown.timeline.some(line => line.line === "새 왕이 왕위에 올랐다 — 헨리 4세"), JSON.stringify(crown.timeline.slice(0, 4)));
  assert.ok(!crown.timeline.some(line => line.line.startsWith("수장이 죽고")), "a deposed king is not said to have died");
  assert.ok(crown.timeline.some(line => line.line === "리처드 2세가 폐위되고 헨리 4세가 즉위했다"));
  assert.ok(crown.memory.some(record => record.line === "리처드 2세가 폐위되고 헨리 4세가 즉위했다"), JSON.stringify(crown.memory.slice(0, 3)));
  const moved = crown.memory.find(record => record.line.includes("치세가 시작됨"));
  assert.ok(moved !== undefined && /국왕과 왕실의 마음이 (누그러졌다|돌아섰다)\([+−-]?\d+, 이제 -?\d+\) — 리처드 2세가 폐위되고 헨리 4세의 치세가 시작됨/.test(moved.line), moved?.line);
  assert.ok(deposed.tick >= at(...B.deposition));
});

test("UI-10: the cards render — the heir's answers each with its candidate, the Wave 33 picture on the interlude's", () => {
  const { heir, nave } = states();
  const noop = () => undefined;
  const card = view(heir);
  const markup = renderToStaticMarkup(createElement(PetitionModal, { view: card, onRespond: noop, onLater: noop }));
  assert.equal((markup.match(/class="petition-heir"/g) ?? []).length, 3);
  for (const option of card.options) assert.ok(markup.includes(`data-person="${option.heir!.personId}"`) && markup.includes(option.heir!.resemblance));
  assert.ok(markup.includes("ch5_decision_heir_choice"), "the Wave 21 card");
  assert.doesNotMatch(markup, / title="/);
  const interlude = renderToStaticMarkup(createElement(PetitionModal, { view: view(nave), onRespond: noop, onLater: noop }));
  assert.ok(interlude.includes("interlude_church_rebuilding") && !interlude.includes("event_market_petition"));
  assert.doesNotMatch(interlude, /petition-heir/);
});
