import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { GameState } from '../src/engine/engine.types';
import type { GameAction } from '../src/state/gameStore.types';
import type { DecisionCardView } from '../src/ui/decisionCard/decisionCardTypes';
import { gameReducer } from '../src/state/gameStore';
import { diplomacyOf } from '../src/engine/negotiation';
import { answerEffects } from '../src/engine/decisionTraceAnswers';
import { homePetitionCard } from '../src/ui/decisionCard/families/homePetitionCard';
import { auditDecisionView, marriageDecisionView, offMapPetitionView } from '../src/ui/lord/decisions/decisionCardsModel';
import { lordRequestView, openHomePetitions } from '../src/ui/lordCardsModel';
import { registryOfferView } from '../src/ui/registryCardModel';
import { checkEffectCoverage } from './helpers/answerEffectOracle';
const baselinePath = process.env.ANSWER_EFFECTS_BASELINE;
const baselineReducer: typeof gameReducer | undefined = baselinePath ? (await import(baselinePath)).gameReducer : undefined;
const evidence: unknown[] = [];
function checkAnswer(label: string, before: GameState, command: GameAction, _card: DecisionCardView | null, _choiceId: string) {
  const after = gameReducer(before, command);
  if (baselineReducer) {
    const baseline = baselineReducer(before, command);
    const { trace: _baselineTrace, ...oldDomain } = baseline;
    const { trace: _newTrace, ...newDomain } = after;
    assert.deepEqual(newDomain, oldDomain, `${label}: observation must not change any non-trace state`);
  }
  const answer = after.trace?.answers?.at(-1);
  assert.ok(answer && !before.trace?.answers?.some(row => row.id === answer.id), `${label}: own answer`);
  const effects = answerEffects(after, answer.id);
  assert.ok(effects, `${label}: recorded effects`);
  checkEffectCoverage(before, after, effects, label);
  if (command.type === 'answer_audit' && command.choice === 'punish') {
    const recovery = effects.find(effect => effect.target === 'audit_recovery');
    const posted = after.ledger?.entries.filter(entry => entry.category === 'audit_recovery' && !before.ledger?.entries.some(old => old.id === entry.id)) ?? [];
    assert.equal(recovery?.after, posted.reduce((sum, entry) => sum + entry.amount, 0), `${label}: recovered ledger amount`);
  }
  if (command.type === 'answer_will_change') {
    const stage = effects.find(effect => effect.path.join('.') === 'diplomacy.marriage.stage');
    assert.equal(stage?.before, before.diplomacy?.marriage?.stage);
    assert.equal(stage?.after, after.diplomacy?.marriage?.stage);
  }
  if (command.type === 'answer_counter' && command.accept) {
    const term = effects.find(effect => effect.path.includes('effectiveTerms') && effect.path.at(-1) === 'amount');
    assert.equal(term?.target, 'term');
    assert.equal(term?.beforePresent, false);
    assert.equal(term?.after, 1305, 'the accepted deferred-debt clause in the retained fixture');
  }
  evidence.push({ label, command, answerId: answer.id, effects });
}
const FOLDERS: Readonly<Record<string, readonly string[]>> = {
  LMR2_STATES: ["attention-overloaded", "audit-pending", "contested", "inherited", "marriage-contracted", "neighbour-suit", "offer-countered", "promises",
    "suit-defence-enforcing", "suit-defence-patronage", "suit-entry-forced", "suit-entry-threat", "suit-neighbour-took", "will-change"],
  LMR1_PETITION_STATES: ["guardian", "home-ale_fines", "home-boundary_dispute", "home-chancel_repair", "home-common_pasture", "home-heriot", "home-merchet",
    "home-mill_suit", "home-newcomer", "home-pannage", "home-road_bridge", "home-stall_dispute", "home-wardship", "precedent", "request"],
  LORD_STATES: ["lord-receipts", "lord-receipts-old", "registry-offer", "registry-offer-hold"],
  VARIANT_STATES: ["home-041", "home-048", "home-056", "registry-067", "registry-078"],
};

function realStates(): readonly { name: string; state: GameState }[] {
  return Object.entries(FOLDERS).flatMap(([env, names]) => {
    const dir = process.env[env];
    if (dir === undefined) return [];
    return names.map(name => join(dir, `${name}.json`)).filter(file => existsSync(file))
      .map(file => ({ name: `${env}/${file.slice(dir.length + 1)}`, state: JSON.parse(readFileSync(file, "utf8")) as GameState }));
  });
}

test("on the real lord-slice states: home and off-map petitions, audits, registry offers, the will and the town's request", t => {
  const states = realStates();
  if (states.length === 0) { t.skip("no state folder given (LMR2_STATES, LMR1_PETITION_STATES, LORD_STATES, VARIANT_STATES)"); return; }
  const seen = new Set<string>();
  for (const { name, state } of states) {
    const home = openHomePetitions(state)[0];
    const homeCard = homePetitionCard(state);
    if (home !== undefined && homeCard !== null) for (const choice of homeCard.choices.filter(entry => entry.refusal === null)) {
      checkAnswer(`${name} home ${choice.id}`, state, { type: "answer_estate_petition", petitionId: home.id, grant: choice.id === "grant" }, homeCard, choice.id);
      seen.add(`home:${choice.id}`);
    }
    const offMap = offMapPetitionView(state);
    if (offMap !== null) for (const choice of offMap.card.choices.filter(entry => entry.refusal === null)) {
      checkAnswer(`${name} offmap ${choice.id}`, state, { type: "answer_estate_petition", petitionId: offMap.petitionId, grant: choice.id === "grant" }, offMap.card, choice.id);
      seen.add(`offmap:${choice.id}`);
    }
    const audit = auditDecisionView(state);
    if (audit !== null) for (const choice of audit.card.choices.filter(entry => entry.refusal === null)) {
      checkAnswer(`${name} audit ${choice.id}`, state, { type: "answer_audit", auditId: audit.auditId, choice: choice.id === "replace" ? "replace" : choice.id === "tolerate" ? "tolerate" : "punish" }, audit.card, choice.id);
      seen.add(`audit:${choice.id}`);
    }
    const offer = registryOfferView(state);
    if (offer !== null) for (const choice of offer.card.choices.filter(entry => entry.refusal === null)) {
      checkAnswer(`${name} registry ${offer.entryId} ${choice.id}`, state, { type: "answer_registry_offer", occurrenceId: offer.occurrenceId, choiceId: choice.id }, offer.card, choice.id);
      seen.add(`registry:${offer.entryId}`);
    }
    const will = marriageDecisionView(state);
    if (will !== null && will.kind === "will_change") for (const choice of will.card.choices.filter(entry => entry.refusal === null)) {
      checkAnswer(`${name} will ${choice.id}`, state, { type: "answer_will_change", choice: choice.id === "support_promise" ? "support_promise" : choice.id === "let_it_be" ? "let_it_be" : "favour" }, will.card, choice.id);
      seen.add(`will:${choice.id}`);
    }
    const request = lordRequestView(state);
    if (request !== null && request.command !== null) { checkAnswer(`${name} request`, state, request.command, null, "grant"); seen.add("request"); }
  }
  assert.equal(evidence.length, 74, "same 74 renderer answer cases, before the two counter cases");
  const counterState = states.find(entry => entry.name.endsWith('/offer-countered.json'))?.state;
  if (counterState) {
    const offer = diplomacyOf(counterState).negotiations.find(row => row.status === 'countered');
    assert.ok(offer);
    for (const accept of [true, false]) checkAnswer(`counter ${accept}`, counterState, { type: 'answer_counter', negotiationId: offer.id, accept }, null, String(accept));
  }
  const destination = process.env.ANSWER_EFFECTS_REPORT;
  if (destination) writeFileSync(destination, JSON.stringify({ count: evidence.length, evidence }, null, 2));
  console.log(`answer-effects replay: ${evidence.length} actual answers including two counter answers`);
  if (states.some(entry => entry.name.startsWith("LORD_STATES")) && states.some(entry => entry.name.startsWith("LMR2_STATES"))) {
    assert.ok([...seen].filter(key => key.startsWith("registry:")).length >= 3, `several registry kinds: ${[...seen].join(", ")}`);
  }
  // The targets the task names: both answers of both petitions, the audit's punish and tolerate, several registry kinds.
  for (const key of ["home:grant", "home:refuse", "offmap:grant", "offmap:refuse", "audit:punish", "audit:tolerate"]) {
    if (states.some(entry => entry.name.startsWith("LMR2_STATES")) || !key.startsWith("offmap") && !key.startsWith("audit")) assert.ok(seen.has(key), key);
  }
});

