import assert from 'node:assert/strict';
import test from 'node:test';
import { V4_COPY } from '../src/content/registry/v4Copy.generated';
import { decisionRemembers, traceInRange, yearReview } from '../src/engine/decisionReads';
import { stateCalendar } from '../src/engine/scenarioState';
import { gameReducer } from '../src/state/gameStore';
import { decisionAbout, decisionSubjectWords } from '../src/ui/results/decisionThread';
import { delegated } from './helpers/engineBTlinkFixtures';

test('each merged successful answer remains in the year review and owns its own live memories', () => {
  const base = delegated();
  assert.ok(base.stewardship);
  const original = base.stewardship.petitions[0]; assert.ok(original);
  const petitions = ['first', 'second'].map(id => ({ ...original, id, tick: base.tick, deadline: base.tick + 1000,
    status: 'open' as const, escalated: 'rights' as const }));
  const first = gameReducer({ ...base, stewardship: { ...base.stewardship, petitions } },
    { type: 'answer_estate_petition', petitionId: 'first', grant: false });
  const after = gameReducer({ ...first, tick: first.tick + 1 }, { type: 'answer_estate_petition', petitionId: 'second', grant: false });
  const answers = after.trace?.answers ?? [];
  assert.equal(answers.length, 2);
  assert.equal(answers[0]?.threadId, answers[1]?.threadId);
  const review = yearReview(after, stateCalendar(after).year);
  assert.deepEqual(review.decisions.map(row => row.decisionId), answers.map(row => row.id));
  for (const answer of answers) {
    assert.equal(answer.memoryEvidence.length, 0, 'off-map mood changes do not invent faction memories');
    const memories = decisionRemembers(after, answer.id);
    assert.equal(memories.length, answer.memoryEvidence.length);
    assert.ok(memories.every(memory => answer.memoryEvidence.some(evidence => evidence.recordId === memory.recordId && evidence.factionId === memory.actor)));
    assert.equal(traceInRange(after, answer.tick, answer.tick + 1).filter(row => row.key === 'relation' && row.decisionId === answer.id).length, memories.length);
  }
});

test('chronicle uses persisted shown title and original choice after occurrence removal', () => {
  const state = delegated();
  const record = { id: 'h-presentation', tick: state.tick, kind: 'decision', template: 'decision.card', severity: 1,
    subject: { type: 'town', id: 'town' }, params: { command: 'answer_registry_offer', chosen: 'able',
      sourceEntryId: 'ck_evt_031', displayEntryId: 'ck_evt_067', subjectId: 'pruned-occurrence' } } as const;
  assert.equal(decisionSubjectWords(state, record), V4_COPY.ck_evt_067?.title);
  assert.ok(decisionAbout(state, record).includes(V4_COPY.ck_evt_031?.choices.able?.label ?? 'missing original choice'));
});

test('live faction feelings retain the exact home answer identity', () => {
  const base = delegated(); assert.ok(base.stewardship);
  const petition = { id: 'home-pannage', estateId: 'estate-home', kind: 'pannage' as const, group: 'tenants' as const,
    amount: 20, rights: false, marriage: false, tick: base.tick, deadline: base.tick + 1000, status: 'open' as const };
  const after = gameReducer({ ...base, stewardship: { ...base.stewardship, petitions: [petition] } },
    { type: 'answer_estate_petition', petitionId: petition.id, grant: true });
  const answer = after.trace?.answers?.at(-1); assert.ok(answer);
  assert.ok(answer.memoryEvidence.length > 0);
  assert.equal(decisionRemembers(after, answer.id).length, answer.memoryEvidence.length);
  assert.equal(traceInRange(after, answer.tick, answer.tick + 1).filter(row => row.key === 'relation' && row.decisionId === answer.id).length, answer.memoryEvidence.length);
});
