import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DEFAULT_SCENARIO_ID, LORD_SLICE_SCENARIO_ID, SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import type { GameState } from "../src/engine/engine.types";
import { answerWillChange } from "../src/engine/marriage";
import { diplomacyOf } from "../src/engine/negotiation";
import { answerAudit, answerEstatePetition, lordEstatePetitions, pendingAudits } from "../src/engine/stewardship";
import { advanceTick } from "../src/engine/tick";
import { treasuryBalance } from "../src/ledger/ledger";
import { newGameState } from "../src/state/newGame";
import { decisionModal } from "../src/ui/eventStory";
import { auditDecisionHead, auditDecisionView, marriageDecisionView, offMapPetitionView, openOffMapPetitions } from "../src/ui/lord/decisions/decisionCardsModel";
import { PortfolioPanel } from "../src/ui/lord/estates/PortfolioPanel";
import { decidingId } from "../src/ui/lord/screen/DecideButton";
import type { LordDecisionModal } from "../src/ui/lord/screen/lordScreenTypes";
import { lordBeats } from "../src/ui/lordStoryBeats";
import type { DecisionCardView } from "../src/ui/decisionCard/decisionCardTypes";
import { lordOutcome } from "../src/ui/decisionCard/families/lordOutcome";
import { afterAnswer } from "../src/ui/decisionCard/remembers";
import { AuditDecisionModal, MarriageDecisionModal, OffMapPetitionModal } from "../src/ui/lord/decisions/DecisionCards";
import { gameReducer } from "../src/state/gameStore";
import type { GameAction } from "../src/state/gameStore.types";

// LM-R2: the lord's decision cards (the father's will, the contested inheritance, an audit's finding, an off-map
// petition) on real lord2 states (scripts/lmr2States.ts; LMR2_STATES=<dir>), and nothing of them outside lord mode.

function lord2(name: string): GameState | null {
  const dir = process.env.LMR2_STATES;
  const file = dir === undefined ? "" : join(dir, `${name}.json`);
  return dir === undefined || !existsSync(file) ? null : JSON.parse(readFileSync(file, "utf8")) as GameState;
}
const NO_STATES = "LMR2_STATES not set (the lord2 states come from scripts/lmr2States.ts on the DGX)";

test("outside lord mode there is no decision card and no decision beat", () => {
  for (const scenarioId of [SANDBOX_SCENARIO_ID, DEFAULT_SCENARIO_ID]) {
    let town = newGameState({ scenarioId })!;
    for (let tick = 0; tick < 200; tick += 1) town = advanceTick(town);
    assert.equal(marriageDecisionView(town), null, scenarioId);
    assert.equal(auditDecisionView(town), null, scenarioId);
    assert.equal(offMapPetitionView(town), null, scenarioId);
    assert.deepEqual(lordBeats(town), [], scenarioId);
  }
  let slice = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID })!;
  for (let tick = 0; tick < 200; tick += 1) slice = advanceTick(slice);
  assert.equal(marriageDecisionView(slice), null, "a new lord has no marriage decision");
});

test("the will's card: three equal answers with the engine's own numbers, and one chip that stands for the will's moment", t => {
  const state = lord2("will-change");
  if (state === null) { t.skip(NO_STATES); return; }
  const view = marriageDecisionView(state);
  assert.ok(view !== null && view.kind === "will_change");
  assert.deepEqual(view.card.choices.map(choice => choice.id), ["favour", "support_promise", "let_it_be"]);
  const favour = view.card.choices[0]!;
  const paid = treasuryBalance(answerWillChange(state, "favour")) - treasuryBalance(state);
  assert.equal(favour.refusal === null, paid !== 0, "the favour is refused exactly when the engine refuses it");
  const beats = lordBeats(state).filter(beat => beat.decision === "marriage_decision");
  assert.equal(beats.length, 1);
  assert.equal(decisionModal(beats[0]!.decision!), "marriage_decision");
  assert.ok(!lordBeats(state).some(beat => beat.kind === "lord_moment" && beat.illustration === beats[0]!.illustration), "no second chip for the will");
  assert.equal(marriageDecisionView(answerWillChange(state, "let_it_be")), null, "answered: the card goes");
});

test("the contested inheritance's card opens the lord's suit on the ledger screen", t => {
  const state = lord2("contested");
  if (state === null) { t.skip(NO_STATES); return; }
  const view = marriageDecisionView(state);
  assert.ok(view !== null && view.kind === "contested");
  const plan = diplomacyOf(state).marriage!;
  const suit = state.estates?.suits.find(entry => entry.claimId === plan.claimId && entry.plaintiff === "lord");
  assert.equal(view.focus, suit?.id ?? plan.claimId);
});

test("the audit's card: punish, replace, tolerate with the engine's numbers; answered, it goes", t => {
  const state = lord2("audit-pending");
  if (state === null) { t.skip(NO_STATES); return; }
  const view = auditDecisionView(state);
  assert.ok(view !== null);
  assert.equal(view.auditId, pendingAudits(state)[0]!.id);
  assert.deepEqual(view.card.choices.map(choice => choice.id), ["punish", "replace", "tolerate"]);
  for (const choice of view.card.choices) {
    assert.equal(choice.refusal === null, answerAudit(state, view.auditId, choice.id as "punish" | "replace" | "tolerate") !== state, choice.id);
  }
  assert.equal(auditDecisionView(answerAudit(state, view.auditId, "tolerate")), null);
});

test("an off-map estate's petition gets its card; the home estate's keep LM-R1's", t => {
  const names = ["inherited", "audit-pending", "attention-overloaded", "promises", "neighbour-suit"];
  const found = names.map(name => ({ name, state: lord2(name) })).filter((entry): entry is { name: string; state: GameState } => entry.state !== null);
  if (found.length === 0) { t.skip(NO_STATES); return; }
  let seen = 0;
  for (const { name, state } of found) {
    const view = offMapPetitionView(state);
    assert.equal(view === null, openOffMapPetitions(state).length === 0, name);
    if (view === null) continue;
    seen += 1;
    assert.notEqual(view.estateId, "estate-home", name);
    assert.deepEqual(view.card.choices.map(choice => choice.id), ["grant", "refuse"]);
    assert.notEqual(offMapPetitionView(answerEstatePetition(state, view.petitionId, true))?.petitionId, view.petitionId, `${name}: answered, it goes`);
  }
  t.diagnostic(`${seen} of ${found.length} lord2 states hold an off-map petition`);
});

test("from the 영지 screen, the first waiting audit and petition open their cards; nothing without onDecide", t => {
  const state = lord2("audit-pending");
  if (state === null) { t.skip(NO_STATES); return; }
  const opened: string[] = [];
  const render = (onDecide?: (modal: LordDecisionModal) => void) => renderToStaticMarkup(createElement(PortfolioPanel,
    { state, dispatch: () => undefined, focus: "estate-neighbour-3", onOpen: () => undefined, onPerson: undefined, ...(onDecide === undefined ? {} : { onDecide }) }));
  const html = render(modal => opened.push(modal));
  const audit = auditDecisionHead(state)!;
  assert.match(html, new RegExp(`data-decide="audit_decision" data-decide-id="${audit.auditId}"`));
  for (const petition of lordEstatePetitions(state)) {
    const shown = decidingId(state, petition.estateId === "estate-home" ? "estate_petition" : "estate_petition_offmap");
    if (shown === petition.id) assert.match(html, new RegExp(`data-decide-id="${petition.id}"`), petition.id);
    else assert.doesNotMatch(html, new RegExp(`data-decide-id="${petition.id}"`), `${petition.id}: behind another`);
  }
  assert.doesNotMatch(render(), /data-decide=/, "no way to a card without the host's onDecide");
});

// DEC-CARD: each card is the heavy decision card — what is happening, what is at stake, until when, and each answer's
// now / later / who remembers, the engine's own (the command run on the state, put in words by lordOutcome).
const ACTION: Readonly<Record<string, (state: GameState, id: string) => GameAction>> = {
  will_change: (_state, id) => ({ type: "answer_will_change", choice: id as "favour" | "support_promise" | "let_it_be" }),
  audit: (state, id) => ({ type: "answer_audit", auditId: pendingAudits(state)[0]!.id, choice: id as "punish" | "replace" | "tolerate" }),
  estate_petition_offmap: (state, id) => ({ type: "answer_estate_petition", petitionId: openOffMapPetitions(state)[0]!.id, grant: id === "grant" }),
};

function cardsOf(state: GameState): readonly { readonly card: DecisionCardView; readonly markup: string }[] {
  const shown: { card: DecisionCardView; markup: string }[] = [];
  const marriage = marriageDecisionView(state);
  if (marriage !== null) shown.push({ card: marriage.card, markup: renderToStaticMarkup(createElement(MarriageDecisionModal, { view: marriage, onAnswer: () => undefined, onOpenSuit: () => undefined, onLater: () => undefined })) });
  const audit = auditDecisionView(state);
  if (audit !== null) shown.push({ card: audit.card, markup: renderToStaticMarkup(createElement(AuditDecisionModal, { view: audit, onAnswer: () => undefined, onLater: () => undefined })) });
  const offMap = offMapPetitionView(state);
  if (offMap !== null) shown.push({ card: offMap.card, markup: renderToStaticMarkup(createElement(OffMapPetitionModal, { view: offMap, onAnswer: () => undefined, onLater: () => undefined })) });
  return shown;
}

test("DEC-CARD: the will, the audit and the off-map petition say what is happening, what is at stake, and each answer's now / later / who remembers — the engine's own", t => {
  const found = ["will-change", "audit-pending", "inherited", "promises"].map(name => ({ name, state: lord2(name) })).filter((entry): entry is { name: string; state: GameState } => entry.state !== null);
  if (found.length === 0) { t.skip(NO_STATES); return; }
  const families = new Set<string>();
  for (const { name, state } of found) {
    for (const { card, markup } of cardsOf(state)) {
      families.add(card.family);
      assert.ok(card.situation !== "" && card.stake !== "" && card.deadline !== null, `${name} ${card.family}`);
      for (const choice of card.choices) {
        const after = afterAnswer(state, ACTION[card.family]!(state, choice.id));
        assert.equal(choice.refusal === null, after !== null, `${name} ${card.family} ${choice.id}: shut exactly when the engine refuses it`);
        if (after === null) continue;
        const outcome = lordOutcome(state, after);
        assert.ok(outcome.now.every(line => choice.now.includes(line)), `${name} ${choice.id}: the run's now`);
        assert.ok(outcome.later.every(line => choice.later.includes(line)), `${name} ${choice.id}: the run's later`);
        assert.deepEqual(choice.remembers, outcome.remembers, `${name} ${choice.id}`);
        assert.ok(choice.now.length > 0, `${name} ${choice.id}: at least the treasury's line`);
      }
      // DEC-CARD: the situation and the stake always; now / later / who remembers exactly where an open answer has lines (an empty part is left out).
      for (const part of ["무슨 일인가", "걸린 것"]) assert.ok(markup.includes(part), `${name} ${card.family}: ${part}`);
      const open = card.choices.filter(choice => choice.refusal === null);
      for (const [part, has] of [["지금", open.some(c => c.now.length > 0)], ["나중에", open.some(c => c.later.length > 0)], ["기억하는 이", open.some(c => c.remembers.length > 0)]] as const) assert.equal(markup.includes(`class="decision-card-part-head">${part}</span>`), has, `${name} ${card.family}: ${part}`);
      assert.match(markup, /class="story-modal petition-card decision-card lord-card"/);
      assert.doesNotMatch(markup, /ui-btn--primary/, "equal answers, all secondary (LR1-D2)");
      assert.doesNotMatch(markup, /\stitle="/);
    }
  }
  t.diagnostic(`families: ${[...families].join(", ")}`);
  const will = lord2("will-change");
  if (will !== null) {
    const card = marriageDecisionView(will)!.card;
    const support = card.choices.find(choice => choice.id === "support_promise")!;
    const made = diplomacyOf(gameReducer(will, { type: "answer_will_change", choice: "support_promise" })).promises.at(-1)!;
    assert.ok(support.later.some(line => line.includes(String(made.stake.relation)) && line.includes("증인")), "the promise's stake and witnesses");
    const letBe = card.choices.find(choice => choice.id === "let_it_be")!;
    assert.ok(letBe.now.some(line => line.includes("청구를 냅니다")), "the rival's claim");
  }
  const audit = lord2("audit-pending");
  if (audit !== null) {
    const punish = auditDecisionView(audit)!.card.choices.find(choice => choice.id === "punish")!;
    assert.ok(punish.remembers.some(entry => entry.delta < 0), "the punished steward's faction remembers it");
  }
});

test("DEC-CARD: the contested inheritance keeps its one primary act, the way to the suit, and no answer of its own", t => {
  const state = lord2("contested");
  if (state === null) { t.skip(NO_STATES); return; }
  const view = marriageDecisionView(state)!;
  assert.equal(view.card.choices.length, 0);
  const markup = renderToStaticMarkup(createElement(MarriageDecisionModal, { view, onAnswer: () => undefined, onOpenSuit: () => undefined, onLater: () => undefined }));
  assert.equal((markup.match(/ui-btn--primary/g) ?? []).length, 1);
  assert.match(markup, /class="lord-decision-open[^"]*ui-btn--primary/);
  for (const part of ["무슨 일인가", "걸린 것"]) assert.ok(markup.includes(part), part);
});
