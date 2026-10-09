import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { classifyAnswerEvidence, createAnswerEvidenceCollector, type AnswerEvidence, OUTCOME_COMMAND_KIND } from '../scripts/engineBOutcomeEvidence';
import { verifyOutcomeTaxonomy } from '../scripts/engineBOutcomeTaxonomy';
import { createOutcomeArchive } from '../scripts/engineBOutcomeCollect';
import { decodeSave } from '../src/save/saveCodec';
import { gameReducer } from '../src/state/gameStore';
import { initialPolitics } from '../src/engine/politics';
import { initialRegistry } from '../src/engine/registry';
import { prepareRegistryChapterPetition } from '../src/engine/registryChapterPetitions';
import { initialAgency } from '../src/engine/townAgency';
import { stewardshipOf } from '../src/engine/stewardship';
import { estatesOf } from '../src/engine/estates';
import type { GameState } from '../src/engine/engine.types';
import type { EstatePetition } from '../src/engine/stewardship.types';

function base(): GameState {
  const state = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
  return { ...state, tick: 100, agency: initialAgency(), trace: { decisions: [], acts: [] } };
}
function estateAnswers(): readonly AnswerEvidence[] {
  const state = base();
  const estate = estatesOf(state).estates.find(row => row.id !== 'estate-home'); assert.ok(estate);
  const petition: EstatePetition = { id: 'test-first', estateId: estate.id, kind: 'repair', group: 'tenants', amount: 20,
    rights: false, marriage: false, tick: 0, deadline: 1000, status: 'open', escalated: 'rights' };
  const before: GameState = { ...state, stewardship: { ...stewardshipOf(state), oversight: [{ estateId: estate.id, mode: 'direct', stewardId: 'test-steward', auditMode: 'accounts', tenants: 0, merchants: 0, undetected: 0, since: 0 }], petitions: [petition, { ...petition, id: 'test-second', escalated: 'amount' as const }] } };
  const collector = createAnswerEvidenceCollector();
  const first = { type: 'answer_estate_petition' as const, petitionId: 'test-first', grant: false };
  const middle = gameReducer(before, first); collector.observe(before, middle, first, 1);
  const second = { type: 'answer_estate_petition' as const, petitionId: 'test-second', grant: false };
  const after = gameReducer(middle, second);
  const beforeJson = JSON.stringify(middle), afterJson = JSON.stringify(after);
  collector.observe(middle, after, second, 2);
  assert.equal(JSON.stringify(middle), beforeJson); assert.equal(JSON.stringify(after), afterJson);
  return collector.snapshot();
}

test('passive real reducers preserve each merged estate answer weight rather than root weight', () => {
  const records = estateAnswers(); assert.equal(records.length, 2);
  assert.equal(records[0]?.ownRoot?.weights[0], 'rights');
  assert.equal(records[1]?.ownRoot, null);
  const result = classifyAnswerEvidence(records);
  assert.equal(result.unresolved.length, 0);
  assert.deepEqual(result.classified.map(row => row.weights), [['rights'], ['large_sum']]);
  assert.deepEqual(result.classified.map(row => row.cameHeavyToLord), [true, true]);
  assert.equal(records[1]?.context.estateBefore?.status, 'open');
  assert.equal(records[1]?.context.estateAfter?.status, 'refused');
});

test('missing dynamic context and mismatched own-root weights fail closed', () => {
  const [record] = estateAnswers(); assert.ok(record); assert.ok(record.ownRoot);
  const missing = { ...record, context: { ...record.context, estateAfter: null } };
  assert.equal(classifyAnswerEvidence([missing]).unresolved[0]?.reason, 'missing_or_mismatched_estate_context');
  const malformed = { ...record, ownRoot: { ...record.ownRoot, weights: [] } };
  assert.equal(classifyAnswerEvidence([malformed]).unresolved[0]?.reason, 'own_root_classification_mismatch');
});

test('new-root initiative classification matches real reducer and snapshots cannot mutate retained evidence', () => {
  const before = base(), command = { type: 'order_timber' as const, amount: 8 };
  const after = gameReducer(before, command), collector = createAnswerEvidenceCollector();
  collector.observe(before, after, command, 1);
  collector.observe(after, after, command, 2);
  const snapshot = collector.snapshot(); assert.equal(snapshot.length, 2);
  assert.equal(classifyAnswerEvidence(snapshot).excluded[0]?.reason, 'unchanged_or_non_lord_state');
  const row = classifyAnswerEvidence(snapshot).classified[0]; assert.ok(row);
  assert.equal(row.source, 'order_timber:8'); assert.equal(row.cameHeavyToLord, false);
  assert.notEqual(collector.snapshot()[0], snapshot[0]);
});

test('history-length selection, unknown taxonomy and invalid registry are explicit', () => {
  const before = base(); const existing = before.history?.records ?? [];
  const history = { id: 'outside', tick: before.tick, kind: 'decision' as const, template: 'decision.market_town',
    subject: { type: 'town' as const, id: 'town' }, severity: 1 as const, params: {} };
  assert.ok(before.history);
  const after = { ...before, history: { ...before.history, records: [...existing, history] } };
  const collector = createAnswerEvidenceCollector();
  collector.observe(before, after, { type: 'restart_settlement' }, 1);
  assert.equal(classifyAnswerEvidence(collector.snapshot()).unclassified.length, 1);
  const [record] = estateAnswers(); assert.ok(record);
  const registry: AnswerEvidence = { ...record, command: { type: 'answer_registry_offer', occurrenceId: 'bad', choiceId: 'a' },
    context: { ...record.context, registryAfter: { id: 'bad', entryId: 'ck_evt_005', boundId: '', offeredTick: 0, deadline: 1000,
      status: 'invalid', receipt: { draw: 0, chancePermille: 1000, conditions: [] } } } };
  assert.equal(classifyAnswerEvidence([registry]).excluded[0]?.reason, 'invalid_registry_answer');
  const noGrowth = { ...record, history: null, afterHistoryLength: record.beforeHistoryLength };
  assert.equal(classifyAnswerEvidence([noGrowth]).excluded[0]?.reason, 'no_new_history_decision_by_pinned_length_semantics');
});


test('actual chapter context is cloned passively and weighed only by offline classifier', () => {
  const state = base();
  const prepared = prepareRegistryChapterPetition({ ...state, tick: 328000, politics: initialPolitics(state), registry: initialRegistry(),
    buildings: [{ id: 'market', kind: 'market', workers: 0, tx: 10, ty: 10, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 },
      { id: 'chapel', kind: 'chapel', workers: 0, tx: 12, ty: 10, inventory: {}, reserved: {}, stockReserved: {}, productionProgress: 0 }] }, 'ck_evt_058');
  assert.ok(prepared); const petition = prepared.politics?.petitions.find(row => row.defId === 'ck_evt_058'); assert.ok(petition);
  const before: GameState = { ...prepared, registry: { ...initialRegistry(), occurrences: [{ id: 'registry-chapter', entryId: 'ck_evt_058',
    source: 'v4', boundId: petition.id, bound: { chapterPetition: petition.id }, offeredTick: prepared.tick, deadline: prepared.tick + 1000,
    status: 'offered', weights: [], receipt: { draw: 0, chancePermille: 1000, conditions: [] } }] } };
  const command = { type: 'petition_response' as const, petitionId: petition.id, response: 'accept_with_price' as const };
  const after = gameReducer(before, command), collector = createAnswerEvidenceCollector();
  const original = JSON.stringify(before); collector.observe(before, after, command, 1);
  const [record] = collector.snapshot(); assert.ok(record); assert.ok(record.context.chapterBeforeState);
  assert.notEqual(record.context.chapterBeforeState, before); assert.equal(JSON.stringify(before), original);
  const serialized = JSON.stringify(record.context.chapterBeforeState);
  const classified = classifyAnswerEvidence([record]); assert.equal(classified.unresolved.length, 0); assert.equal(classified.classified.length, 1);
  assert.equal(JSON.stringify(record.context.chapterBeforeState), serialized);
  const missing = { ...record, context: { ...record.context, chapterBeforeState: null } };
  assert.equal(classifyAnswerEvidence([missing]).unresolved[0]?.reason, 'missing_actual_chapter_before_state');
});


test('duplicate ordinals and history identities fail closed for every affected row without dropping evidence', () => {
  const [first, second] = estateAnswers(); assert.ok(first); assert.ok(second);
  const exact = classifyAnswerEvidence([first, first]);
  assert.equal(exact.rows.length, 2); assert.equal(exact.classified.length, 0);
  assert.deepEqual(exact.unresolved.map(row => row.reason), ['duplicate_command_ordinal', 'duplicate_command_ordinal']);
  const duplicateOrdinal = classifyAnswerEvidence([first, { ...second, ordinal: first.ordinal }]);
  assert.equal(duplicateOrdinal.unresolved.length, 2);
  const duplicateHistory = classifyAnswerEvidence([first, { ...first, ordinal: 3 }]);
  assert.deepEqual(duplicateHistory.unresolved.map(row => row.reason), ['duplicate_answer_history_id', 'duplicate_answer_history_id']);
  const noHistory = { ...first, history: null, ownRoot: null, stateChanged: false };
  const legal = classifyAnswerEvidence([{ ...noHistory, ordinal: 3 }, { ...noHistory, ordinal: 4 }]);
  assert.equal(legal.excluded.length, 2); assert.equal(legal.unresolved.length, 0);
});

test('nonpositive, fractional and unsafe ordinals are unresolved; collector retains repeated observations', () => {
  const [record] = estateAnswers(); assert.ok(record);
  for (const ordinal of [0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN]) {
    const result = classifyAnswerEvidence([{ ...record, ordinal }]);
    assert.equal(result.classified.length, 0); assert.equal(result.unresolved[0]?.reason, 'invalid_command_ordinal');
  }
  const before = base(), command = { type: 'order_timber' as const, amount: 8 }, after = gameReducer(before, command);
  const collector = createAnswerEvidenceCollector();
  collector.observe(before, after, command, 1); collector.observe(before, after, command, 1);
  assert.equal(collector.snapshot().length, 2);
  assert.equal(classifyAnswerEvidence(collector.snapshot()).unresolved.length, 2);
});


test('every command attempt is retained, including unknown no-history commands', () => {
  const before = base(), collector = createAnswerEvidenceCollector();
  collector.observe(before, before, { type: 'restart_settlement' }, 1);
  const result = classifyAnswerEvidence(collector.snapshot());
  assert.equal(result.rows.length, 1); assert.equal(result.excluded.length, 1);
  assert.equal(result.rows[0]?.reason, 'no_new_decision_outside_trace_taxonomy');
});


test('taxonomy matches current engine and rejects drift or computed source', () => {
  const source = readFileSync('src/engine/decisionTrace.ts', 'utf8');
  assert.match(verifyOutcomeTaxonomy(source, OUTCOME_COMMAND_KIND), /^[a-f0-9]{64}$/);
  assert.throws(() => verifyOutcomeTaxonomy(source.replace('order_timber: "timber"', 'order_timber: "suit"'), OUTCOME_COMMAND_KIND));
  assert.throws(() => verifyOutcomeTaxonomy('const COMMAND_KIND = { [something]: "suit" }', OUTCOME_COMMAND_KIND));
});

test('archive keeps answers across ID-reusing rollups and updates real decision actuals', () => {
  const state = base(); assert.ok(state.history);
  const collector = createOutcomeArchive();
  const answer = { id: 'retain', tick: state.tick, kind: 'decision' as const, template: 'decision.card', severity: 1 as const, subject: { type: 'town' as const, id: 'town' } };
  const first = { ...state, history: { ...state.history, records: [answer] } }; collector.observe(first);
  collector.observe({ ...state, tick: 101, history: { ...state.history, records: [{ ...answer, kind: 'event' as const, template: 'history.ledger', because: [] }] } });
  assert.equal(collector.snapshot().history[0]?.template, 'decision.card');
  collector.observe({ ...state, tick: 102, history: { ...state.history, records: [{ ...answer, params: { actual: 2 } }] } });
  assert.deepEqual(collector.snapshot().history[0]?.params, { actual: 2 });
  assert.equal(collector.snapshot().observation.maxGap, 1);
});

test('taxonomy literal reader rejects comments, expressions, duplicate declarations and hidden anchors', () => {
  const declaration = 'const COMMAND_KIND: Readonly<Record<string, TracedDecisionKind>> = ';
  const expected = { answer_registry_offer: 'registry' };
  const valid = `${declaration}{ answer_registry_offer: "registry", };`;
  assert.match(verifyOutcomeTaxonomy(valid, expected), /^[a-f0-9]{64}$/);
  for (const source of [
    `${declaration}{ answer_registry_offer: "registry", /* hidden */ };`,
    `${declaration}{ answer_registry_offer: "registry", answer_registry_offer: "registry" };`,
    `${declaration}{ ["answer_registry_offer"]: "registry" };`,
    `${declaration}{ ...other };`,
    `${declaration}{ answer_registry_offer: pick() };`,
    `${declaration}{ answer_registry_offer: "registry" + "" };`,
    `${declaration}{ answer_registry_offer: "reg\\u0069stry" };`,
    `${valid}\n${valid}`, `/*\n${valid}\n*/`, `const text = \`\n${valid}\n\`;`,
    'const text = `outer ${`\n' + valid + '\n`}`;',
  ]) assert.throws(() => verifyOutcomeTaxonomy(source, expected), source);
});
