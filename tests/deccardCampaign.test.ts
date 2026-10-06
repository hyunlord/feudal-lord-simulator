/**
 * DEC-CARD, the campaign's heavy cards: the Great Famine and every political petition kind (chapters 1–5 and the
 * interlude). Each card says what is happening, what is at stake, until when (and what silence does), and for each
 * answer what happens now, later and who remembers it — all read off the answer run on the state, so each line is the
 * engine's own (P-D4): the treasury as the reducer posts it, the forecast and its actual's date as the decision record
 * writes them, the faction moves as the factions move. Equal answers, all secondary (LR1-D2, P-D3).
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PETITION_DEFS, type FamineResponseChoice, type PetitionResponse } from "../src/content/chapterConfig";
import type { GameState } from "../src/engine/engine.types";
import { openPetitions } from "../src/engine/politics";
import { calendarLabel } from "../src/engine/scenarioState";
import { treasuryBalance } from "../src/ledger/ledger";
import { gameReducer } from "../src/state/gameStore";
import { famineCard } from "../src/ui/decisionCard/families/famineCard";
import { FAMINE_CARD_COPY } from "../src/ui/decisionCard/families/famineCardCopy.ko";
import { petitionCard } from "../src/ui/decisionCard/families/petitionCard";
import { PETITION_CARD_COPY } from "../src/ui/decisionCard/families/petitionCardCopy.ko";
import { FamineDecisionModal, PetitionModal } from "../src/ui/hud/StoryModals";
import { WAR_CHOICES } from "../src/content/historyCopy.ko";
import { famineState, petitionStates } from "./helpers/deccardCampaignStates";

const noop = () => undefined;
const HEADINGS = ["무슨 일인가", "걸린 것", "지금", "나중에", "기억하는 이"];
const LATIN = /[A-Za-z]{2,}|undefined|NaN/;
const steward = { id: "p-1", name: "청지기", line: "청지기", portraitId: "steward", exact: true };

/** The relation moves an answer makes (the factions after it, against before), smallest first. */
function moved(before: GameState, after: GameState): number[] {
  return (after.factions?.factions ?? []).map(faction => faction.relation - (before.factions?.factions.find(entry => entry.id === faction.id)?.relation ?? faction.relation))
    .filter(delta => delta !== 0).sort((a, b) => a - b);
}
const decisionOf = (before: GameState, after: GameState) => {
  const known = new Set((before.history?.records ?? []).map(record => record.id));
  return (after.history?.records ?? []).find(record => !known.has(record.id) && record.kind === "decision")!.decision!;
};

test("DEC-CARD famine: who suffers, the stake, until when, and each answer's forecast, leavers, actual's date and who remembers — the engine's own", () => {
  const state = famineState();
  const view = famineCard(state)!;
  assert.deepEqual(view.card.choices.map(choice => choice.id), ["relief", "price_control", "laissez_faire", "speculation"]);
  assert.ok(view.card.situation.length > 0 && view.card.stake.length > 0 && view.card.deadline !== null);
  for (const choice of view.card.choices) {
    const after = gameReducer(state, { type: "famine_response", choice: choice.id as FamineResponseChoice });
    const decision = decisionOf(state, after);
    assert.equal(choice.refusal, null);
    assert.equal(choice.now.length, 1, `${choice.id}: what it does, in words`);
    assert.ok(choice.later.includes(FAMINE_CARD_COPY.forecast(decision.predicted.population!, state.population, decision.predicted.treasury!, treasuryBalance(state))), choice.id);
    const leaving = state.population - decision.predicted.population!;
    assert.ok(choice.later.includes(leaving > 0 ? FAMINE_CARD_COPY.leaving(leaving) : FAMINE_CARD_COPY.nobodyLeaves), `${choice.id}: who may leave`);
    assert.ok(choice.later.includes(FAMINE_CARD_COPY.actualDue(calendarLabel({ ...state, tick: decision.actualDueTick! }))), `${choice.id}: the actual's date`);
    assert.deepEqual(choice.remembers.map(entry => entry.delta).sort((a, b) => a - b), moved(state, after), `${choice.id}: the commons and the bishop as they move`);
    assert.ok(choice.remembers.length > 0);
  }
  assert.ok(view.card.choices.find(choice => choice.id === "laissez_faire")!.later.some(line => /떠날 것으로/.test(line)), "laissez-faire loses households");
  const markup = renderToStaticMarkup(createElement(FamineDecisionModal, { view, onChoose: noop, onLater: noop, steward, onPerson: noop }));
  for (const part of HEADINGS) assert.ok(markup.includes(part), part);
  assert.match(markup, /class="story-modal petition-card decision-card famine-decision"/);
  assert.match(markup, /data-steward="p-1"/, "the steward who brings it");
  assert.doesNotMatch(markup, /ui-btn--primary/, "equal answers, all secondary (LR1-D2)");
  assert.doesNotMatch(markup, / title="/);
});

test("DEC-CARD petitions: every kind's card (chapters 1–5, the interlude) — each answer's now, later and who remembers are the engine's", () => {
  const states = petitionStates();
  assert.deepEqual([...states.keys()].sort(), PETITION_DEFS.map(def => def.id).sort(), "every petition kind");
  for (const [defId, state] of states) {
    const view = petitionCard(state)!;
    assert.ok(view !== null, defId);
    assert.equal(view.defId, defId);
    const { card } = view;
    assert.ok(card.title.length > 0 && card.situation.length > 0 && /걸려 있습니다\.$/.test(card.stake) && card.deadline !== null, defId);
    const petition = openPetitions(state)[0]!;
    for (const choice of card.choices) {
      const after = gameReducer(state, { type: "petition_response", petitionId: petition.id, response: choice.id as PetitionResponse });
      assert.notEqual(after, state, `${defId}:${choice.id}: an answer the engine takes`);
      assert.equal(choice.refusal, null);
      const money = treasuryBalance(after) - treasuryBalance(state);
      const treasuryLine = money > 0 ? PETITION_CARD_COPY.treasuryIn(money) : money < 0 ? PETITION_CARD_COPY.treasuryOut(-money) : PETITION_CARD_COPY.treasurySame;
      assert.ok(choice.now.includes(treasuryLine), `${defId}:${choice.id}: ${choice.now.join(" | ")}`);
      const decision = decisionOf(state, after);
      assert.ok(choice.later.includes(PETITION_CARD_COPY.forecast(decision.predicted.treasury!, treasuryBalance(state))), `${defId}:${choice.id}: the forecast`);
      assert.ok(choice.later.includes(PETITION_CARD_COPY.actualDue(calendarLabel({ ...state, tick: decision.actualDueTick! }))), `${defId}:${choice.id}: the actual's date`);
      assert.deepEqual(choice.remembers.map(entry => entry.delta).sort((a, b) => a - b), moved(state, after), `${defId}:${choice.id}: who remembers`);
      for (const line of [...choice.now, ...choice.later]) assert.doesNotMatch(line, LATIN, `${defId}:${choice.id}`);
    }
    const markup = renderToStaticMarkup(createElement(PetitionModal, { view, onRespond: noop, onLater: noop, onPerson: noop }));
    for (const part of HEADINGS) assert.ok(markup.includes(part), `${defId}: ${part}`);
    assert.match(markup, new RegExp(`data-def="${defId}"`));
    assert.match(markup, /class="story-modal petition-card decision-card petition-decision"/);
    assert.doesNotMatch(markup, /ui-btn--primary/, `${defId}: equal answers, all secondary (LR1-D2)`);
    assert.doesNotMatch(markup, / title="/);
  }
});

test("DEC-CARD petitions: silence as the engine runs it — the Crown's demands count as refused; a buy-back offer waits", () => {
  const states = petitionStates();
  for (const defId of ["wool_payment", "levy_response", "war_funding"] as const) {
    const card = petitionCard(states.get(defId)!)!.card;
    assert.match(card.deadline!, /가기 전에 답해야 합니다/);
    assert.ok(card.deadline!.includes(PETITION_CARD_COPY.silenceSame(WAR_CHOICES[defId]!.refuse!)), card.deadline!);
  }
  assert.equal(petitionCard(states.get("restore_right")!)!.card.deadline, PETITION_CARD_COPY.noDeadline);
  // The calendar's charter expires at its last year's end: the merchants' relation and gauge both move.
  const charter = petitionCard(states.get("market_charter")!)!.card.deadline!;
  assert.match(charter, /^1308년이 끝나기 전에 답해야 합니다\. 답하지 않으면 청원은 그대로 끝나고, .+\(관계 -10\)\. 상인 게이지가 50에서 40까지 내려갑니다\.$/);
});

test("DEC-CARD petitions: what an answer leaves for later — the instalments and men away, chapter 3's answers carried into chapter 4's revolt", () => {
  const states = petitionStates();
  const later = (defId: string, response: string) => petitionCard(states.get(defId as never)!)!.card.choices.find(choice => choice.id === response)!.later.join(" ");
  assert.match(later("war_funding", "accept"), /앞으로 8계절 동안 계절마다 .+씩 상인에게 갚습니다/);
  assert.match(later("levy_response", "accept"), /명이 .+쯤 돌아옵니다/);
  assert.match(later("wages", "refuse"), /4장의 반란 압력이 10 오릅니다 \(까닭: 묶인 임금\)/);
  assert.match(later("cash_rent", "refuse"), /4장의 반란 압력이 20 오릅니다 \(까닭: 지켜진 부역\)/);
  assert.doesNotMatch(later("cash_rent", "accept"), /반란 압력/);
  assert.match(later("tax_collection", "refuse"), /^(?!.*4장의).*반란 압력이 40 오릅니다 \(까닭: 영주의 징수원\)/, "in chapter 4 the pressure is now");
});

test("DEC-CARD heir: the candidates sit above the answers (the card's grid replaces the side-by-side card), each by the answer that names them", () => {
  const view = petitionCard(petitionStates().get("heir_choice")!)!;
  assert.equal(view.heirs.length, 3);
  const markup = renderToStaticMarkup(createElement(PetitionModal, { view, onRespond: noop, onLater: noop }));
  assert.equal((markup.match(/class="petition-heir"/g) ?? []).length, 3);
  for (const entry of view.heirs) assert.ok(markup.includes(`data-person="${entry.heir.personId}"`) && markup.includes(entry.label));
  assert.ok(markup.indexOf("petition-heirs") < markup.indexOf("decision-card-choices"), "the candidates before the answers");
});

test("DEC-CARD P-D4: the petition's presentation copies no relation table or rule sum any more (the card runs the answer)", () => {
  const source = readFileSync("src/ui/petitionPresentation.ts", "utf8");
  for (const copied of ["LEGACY_RELATIONS", "REORGANISATION_RELATIONS", "REORGANISATION_EVENT_RELATIONS", "charterSums", "refusedBacklash", "legacyRelations", "reorgRelations"]) {
    assert.ok(!source.includes(copied), copied);
  }
});
