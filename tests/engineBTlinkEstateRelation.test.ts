import { readFileSync } from 'node:fs';
import { migrateV55ToV56 } from '../src/save/migrations/v55ToV56';
import { advanceTick } from '../src/engine/tick';
import { advanceHistory } from '../src/engine/history';
import { advanceTrace, traceCommand } from '../src/engine/decisionTrace';
import { canonicalTlinkRuleState } from '../scripts/engineBTlinkParity';
import { encodeSave, decodeSave } from '../src/save/saveCodec';
import { traceAnswerProblem } from '../src/save/traceAnswerValidation';
import assert from 'node:assert/strict';
import test from 'node:test';
import { gameReducer } from '../src/state/gameStore';
import { advanceStewardship } from '../src/engine/stewardship';
import { delegated, linked, transition } from './helpers/engineBTlinkFixtures';
import type { GameState } from '../src/engine/engine.types';

function petition(state: GameState, id: string, kind: 'repair' | 'rent_relief' | 'charter_request' = 'repair') {
  assert.ok(state.stewardship);
  return { ...state, stewardship: { ...state.stewardship, petitions: [...state.stewardship.petitions,
    { id, estateId: 'delegated-estate', kind, group: kind === 'charter_request' ? 'merchants' as const : 'tenants' as const,
      amount: 2, rights: true, marriage: false, tick: state.tick, deadline: state.tick + 1000,
      status: 'open' as const, escalated: 'rights' as const }] } };
}
function settled(state: GameState, id: string, grant = true) {
  const after = gameReducer(state, { type: 'answer_estate_petition', petitionId: id, grant });
  const own = after.trace?.answers?.at(-1);
  assert.ok(own);
  return { after, own };
}
function direct() {
  const state = delegated();
  assert.ok(state.stewardship);
  return { ...state, stewardship: { ...state.stewardship, oversight: state.stewardship.oversight.map(row => ({ ...row, mode: 'direct' as const })) } };
}

test('opposing seasonal rates retain the actual marginal repair contribution without new history', () => {
  const base = delegated();
  assert.ok(base.stewardship);
  const state = { ...base, stewardship: { ...base.stewardship,
    rules: { rights: true, marriage: true, amountAtLeast: 0 },
    stewards: base.stewardship.stewards.map(row => ({ ...row, disposition: 'greedy' as const })) } };
  const { after, own } = settled(petition(state, 'repair'), 'repair');
  const before = { ...after, tick: 2000 };
  const actual = advanceStewardship(before);
  const counterfactual = advanceStewardship(mood(before, 0));
  assert.equal(after.stewardship?.oversight[0]?.tenants, 4);
  assert.equal(actual.stewardship?.oversight[0]?.tenants, -2);
  assert.equal(counterfactual.stewardship?.oversight[0]?.tenants, -6);
  const recorded = advanceHistory(before, actual); assert.ok(recorded.trace);
  const traced = advanceTrace(before, recorded);
  const receipts = linked(traced, own.id, 'estate_mood');
  assert.equal(receipts.length, 1);
  assert.equal(receipts[0]?.template, 'stewardship.season');
  assert.equal(receipts[0]?.params?.traceTenantsContribution, 4);
  assert.equal(receipts[0]?.params?.traceRelationTenants, -2);
  assert.ok(recorded.history?.records.some(row => row.id === receipts[0]?.id));
  assert.equal(traced.history?.nextOrdinal, advanceTrace(before, { ...recorded, trace: { ...recorded.trace, answers: [] } }).history?.nextOrdinal);
});

function mood(state: GameState, tenants: number, merchants = 0): GameState {
  assert.ok(state.stewardship);
  return { ...state, stewardship: { ...state.stewardship, oversight: state.stewardship.oversight.map(row => ({ ...row, tenants, merchants })) } };
}

test('two same-direction actual answers keep both own causes and readable contributions', () => {
  const first = settled(petition(direct(), 'a'), 'a');
  const second = settled(petition({ ...first.after, tick: 1001 }, 'b', 'rent_relief'), 'b');
  const result = transition(second.after, 2000, advanceStewardship);
  for (const own of [first.own, second.own]) assert.equal(linked(result.after, own.id, 'estate_mood').length, 1);
  const record = linked(result.after, first.own.id, 'estate_mood')[0];
  assert.equal(record?.params?.traceTenantsContribution, 12);
  assert.equal(record?.params?.traceRelationTenants, 12);
  assert.equal(record?.params?.traceMerchantsContribution, 0);
});

for (const initial of [100, 98]) {
  test(`zero or partial clamp at ${initial} produces no relation cause`, () => {
    const result = settled(petition(mood(direct(), initial), 'a'), 'a');
    const next = transition(result.after, 2000, advanceStewardship);
    assert.equal(linked(next.after, result.own.id, 'estate_mood').length, 0);
  });
}

test('later clamp erases earlier pending evidence; opposite direction invalidates both', () => {
  for (const initial of [94, 0]) {
    const first = settled(petition(mood(direct(), initial), 'a'), 'a');
    const second = settled(petition(first.after, 'b', 'rent_relief'), 'b', initial === 94);
    const next = transition(second.after, 2000, advanceStewardship);
    for (const own of [first.own, second.own]) assert.equal(linked(next.after, own.id, 'estate_mood').length, 0);
  }
});

test('unknown command mutation cannot extend a known dimension chain', () => {
  const result = settled(petition(direct(), 'a'), 'a');
  const altered = traceCommand(result.after, mood(result.after, 7), { type: 'untracked_relation' });
  const next = transition(altered, 2000, advanceStewardship);
  assert.equal(linked(next.after, result.own.id, 'estate_mood').length, 0);
});

test('unknown tick mutation invalidates even if a later mutation restores the value', () => {
  const result = settled(petition(direct(), 'a'), 'a');
  const changed = advanceTrace(result.after, mood({ ...result.after, tick: 1001 }, 7));
  const restored = advanceTrace(changed, mood({ ...changed, tick: 1002 }, 4));
  const next = transition(restored, 2000, advanceStewardship);
  assert.equal(linked(next.after, result.own.id, 'estate_mood').length, 0);
});

test('evidence is consumed by its first next season only and repeated advance is idempotent', () => {
  const result = settled(petition(direct(), 'a'), 'a');
  const first = transition(result.after, 2000, advanceStewardship);
  const second = transition(first.after, 3000, advanceStewardship);
  assert.equal(linked(second.after, result.own.id, 'estate_mood').filter(row => row.template === 'stewardship.season').length, 1);
  assert.deepEqual(advanceTrace(first.after, first.after), first.after);
});

test('missing legacy evidence and a skipped first season never reconstruct old causes', () => {
  const result = settled(petition(direct(), 'a'), 'a');
  assert.ok(result.after.trace?.answers);
  const legacy = { ...result.after, trace: { ...result.after.trace,
    answers: result.after.trace.answers.map(({ estateRelationEvidence: _proof, ...row }) => row) } };
  assert.equal(linked(transition(legacy, 2000, advanceStewardship).after, result.own.id, 'estate_mood').length, 0);
  assert.equal(linked(transition(result.after, 3000, advanceStewardship).after, result.own.id, 'estate_mood').length, 0);
});

test('rolling eight actual summaries still link fresh existing season with allocation and rule projection preserved', () => {
  let state: GameState = direct();
  for (let tick = 1000; tick <= 8000; tick += 1000) state = transition(state, tick, advanceStewardship).after;
  assert.equal(state.stewardship?.summaries.length, 8);
  assert.ok(state.stewardship);
  for (const row of state.stewardship.petitions.filter(row => row.status === 'open'))
    state = gameReducer(state, { type: 'answer_estate_petition', petitionId: row.id, grant: true });
  const result = settled(petition(mood({ ...state, tick: 8001 }, 0), 'final'), 'final');
  const before = { ...result.after, tick: 9000 };
  const actual = advanceStewardship(before), recorded = advanceHistory(before, actual);
  const after = advanceTrace(before, recorded);
  assert.equal(after.stewardship?.summaries.length, 8);
  assert.equal(linked(after, result.own.id, 'estate_mood').filter(row => row.template === 'stewardship.season').length, 1);
  assert.ok(recorded.trace?.answers);
  const legacyRecorded = { ...recorded, trace: { ...recorded.trace,
    answers: recorded.trace.answers.map(({ estateRelationEvidence: _proof, ...row }) => row) } };
  const baseline = advanceTrace(before, legacyRecorded);
  assert.equal(after.history?.nextOrdinal, baseline.history?.nextOrdinal);
  assert.deepEqual(after.history?.records.map(row => row.id), baseline.history?.records.map(row => row.id));
  assert.deepEqual(canonicalTlinkRuleState(after), canonicalTlinkRuleState(baseline));
});

test('an ambiguous fresh season record never gains a guessed estate cause', () => {
  const result = settled(petition(direct(), 'a'), 'a');
  const before = { ...result.after, tick: 2000 }, recorded = advanceHistory(before, advanceStewardship(before));
  const seasonRecord = recorded.history?.records.find(row => row.template === 'stewardship.season' && row.tick === 2000);
  assert.ok(recorded.history && seasonRecord);
  const duplicate = { ...recorded, history: { ...recorded.history, records: [...recorded.history.records, { ...seasonRecord, id: 'ambiguous' }] } };
  assert.equal(linked(advanceTrace(before, duplicate), result.own.id, 'estate_mood').length, 0);
});

test('pending evidence survives official save roundtrip and rejects inconsistent delta', () => {
  const result = settled(petition(direct(), 'a'), 'a');
  const saved = encodeSave({ state: result.after, createdAt: '2026-10-10T00:00:00Z', savedAt: '2026-10-10T00:00:00Z' }).bytes;
  const reloaded = decodeSave(saved).envelope.state;
  assert.deepEqual(reloaded.trace, result.after.trace);
  assert.equal(linked(transition(reloaded, 2000, advanceStewardship).after, result.own.id, 'estate_mood').length, 1);
  const invalid = structuredClone(result.after);
  assert.ok(invalid.trace?.answers?.at(-1)?.estateRelationEvidence);
  const malformed = JSON.parse(JSON.stringify(invalid));
  malformed.trace.answers.at(-1).estateRelationEvidence[0].actual = 99;
  assert.match(traceAnswerProblem(malformed) ?? '', /delta is invalid/);
});

for (const initial of [0, -100]) {
  test(`actual charter refusal tracks merchants only, initial=${initial}`, () => {
    const result = settled(petition(mood(direct(), 0, initial), 'charter', 'charter_request'), 'charter', false);
    const season = transition(result.after, 2000, advanceStewardship);
    const rows = linked(season.after, result.own.id, 'estate_mood');
    assert.equal(rows.length, initial === 0 ? 1 : 0);
    if (initial === 0) {
      assert.equal(rows[0]?.params?.traceMerchantsContribution, -8);
      assert.equal(rows[0]?.params?.traceRelationMerchants, -8);
      assert.equal(rows[0]?.params?.traceTenantsContribution, 0);
    }
  });
}

test('actual seasonal clamp rejects a pending relation despite its nonzero answer delta', () => {
  const base = mood(delegated(), 94);
  assert.ok(base.stewardship);
  const state = { ...base, stewardship: { ...base.stewardship,
    rules: { rights: true, marriage: true, amountAtLeast: 0 },
    stewards: base.stewardship.stewards.map(row => ({ ...row, disposition: 'peasant' as const })) } };
  const result = settled(petition(state, 'a'), 'a');
  assert.equal(result.after.stewardship?.oversight[0]?.tenants, 98);
  const next = transition(result.after, 2000, advanceStewardship);
  assert.equal(next.actual.stewardship?.oversight[0]?.tenants, 100);
  assert.equal(linked(next.after, result.own.id, 'estate_mood').length, 0);
});

test('initial summary band change retains its allocated observation but excludes unrelated broad estate answers', () => {
  const first = transition(direct(), 1000, advanceStewardship).after;
  const setting = gameReducer(first, { type: 'set_audit_mode', estateId: 'delegated-estate', mode: 'visit' });
  const own = setting.trace?.answers?.at(-1);
  assert.ok(own);
  const before = mood({ ...setting, tick: 2000 }, 25);
  const recorded = advanceHistory(before, advanceStewardship(before));
  const after = advanceTrace(before, recorded);
  const observed = after.history?.records.filter(row => row.tick === 2000 && row.template === 'consequence' && row.params?.key === 'estate_mood');
  assert.equal(observed?.length, 1);
  assert.deepEqual(observed[0]?.because, []);
  assert.equal(after.history?.nextOrdinal, (recorded.history?.nextOrdinal ?? 0) + 2);
  assert.equal(after.history?.records.filter(row => !recorded.history?.records.some(old => old.id === row.id) && row.template === 'decision.steward').length, 1);
  assert.equal(linked(after, own.id, 'estate_mood').length, 0);
});

test('v55 migration preserves unknown relation evidence without backfill', () => {
  const source = settled(petition(direct(), 'a'), 'a').after;
  assert.ok(source.trace?.answers);
  const old = { ...source, trace: { ...source.trace,
    answers: source.trace.answers.map(({ estateRelationEvidence: _evidence, ...answer }) => answer) } };
  const migrated = migrateV55ToV56({ schemaVersion: 55, state: old });
  assert.deepEqual(migrated, { schemaVersion: 56, state: old });
  assert.throws(() => migrateV55ToV56({ schemaVersion: 55 }), /state/);
});

test('annotation remains outside the unchanged rule projection through real subsequent ticks', () => {
  const result = settled(petition(direct(), 'a'), 'a');
  let annotated = transition(result.after, 2000, advanceStewardship).after;
  assert.ok(annotated.history && annotated.trace?.answers);
  let plain: GameState = { ...annotated, trace: { ...annotated.trace,
    answers: annotated.trace.answers.map(({ estateRelationEvidence: _proof, ...row }) => row) },
    history: { ...annotated.history, records: annotated.history.records.map(record => record.template !== 'stewardship.season' ? record : { ...record,
      params: Object.fromEntries(Object.entries(record.params ?? {}).filter(([key]) => !key.startsWith('trace'))),
      because: record.because?.filter(cause => cause.key !== 'estate_mood') ?? [] }) } };
  for (let index = 0; index < 16; index += 1) {
    annotated = advanceTick(annotated);
    plain = advanceTick(plain);
    assert.equal(canonicalTlinkRuleState(annotated), canonicalTlinkRuleState(plain));
    assert.equal(annotated.history?.nextOrdinal, plain.history?.nextOrdinal);
  }
});


test('v56 pending and consumed fixtures roundtrip with every relation proof field fingerprinted', () => {
  const fingerprint = readFileSync('src/save/schemaFingerprint.v56.json', 'utf8');
  for (const suffix of ['', '-consumed']) {
    const state = decodeSave(readFileSync(`fixtures/saves/v56/eb-tlink-estate-relation${suffix}.save.json`)).envelope.state;
    const own = state.trace?.answers?.at(-1);
    assert.equal(own?.estateRelationEvidence?.[0]?.status, suffix ? 'consumed' : 'pending');
    assert.deepEqual(decodeSave(encodeSave({ state, createdAt: '2026-10-10T00:00:00Z', savedAt: '2026-10-10T00:00:00Z' }).bytes).envelope.state, state);
    if (suffix) {
      assert.ok(own);
      const receipt = state.history?.records.find(row => row.template === 'stewardship.season' && row.because?.some(cause => cause.decisionId === own.id && cause.key === 'estate_mood'));
      assert.equal(receipt?.params?.traceTenantsContribution, 4);
      assert.equal(receipt?.tick, own.estateRelationEvidence?.[0]?.firstSeasonTick);
    }
  }
  for (const field of ['estateId', 'dimension', 'before', 'after', 'intended', 'actual', 'expected', 'firstSeasonTick', 'status']) {
    assert.ok(fingerprint.includes(`$.trace.answers[].estateRelationEvidence[].${field}:`), field);
  }
  for (const field of ['traceEstate', 'traceRelationTenants', 'traceRelationMerchants', 'traceTenantsContribution', 'traceMerchantsContribution']) {
    assert.ok(fingerprint.includes(`$.history.records[].params.${field}:`), field);
  }
});

test('interior actual season still rejects a clamped marginal counterfactual', () => {
  const base = mood(delegated(), -97); assert.ok(base.stewardship);
  const state = { ...base, stewardship: { ...base.stewardship, rules: { rights: true, marriage: true, amountAtLeast: 0 },
    stewards: base.stewardship.stewards.map(row => ({ ...row, disposition: 'greedy' as const })) } };
  const result = settled(petition(state, 'a'), 'a');
  const next = transition(result.after, 2000, advanceStewardship);
  assert.equal(next.actual.stewardship?.oversight[0]?.tenants, -99);
  assert.equal(advanceStewardship(mood({ ...result.after, tick: 2000 }, -97)).stewardship?.oversight[0]?.tenants, -100);
  assert.equal(linked(next.after, result.own.id, 'estate_mood').length, 0);
});
