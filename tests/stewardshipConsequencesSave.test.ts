import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { assertGameStateSnapshot, decodeSave, encodeSave } from '../src/save/saveCodec';
import { SAVE_SCHEMA_VERSION } from '../src/save/saveTypes';
import { delegated } from './helpers/engineBTlinkFixtures';

const resistance = { petitionId: 'charter-retained', since: 100, retryAfter: 2000, remainingSeasons: 4 };
const error = { auditId: 'audit-retained', unrecovered: 20, perSeason: 2, remainingSeasons: 4 };
function pressured() {
  const state = delegated(); assert.ok(state.stewardship);
  return { ...state, stewardship: { ...state.stewardship,
    oversight: state.stewardship.oversight.map(row => ({ ...row, charterResistance: resistance })),
    stewards: state.stewardship.stewards.map(row => ({ ...row, toleratedErrors: [error] })),
    audits: [{ id: error.auditId, estateId: 'delegated-estate', tick: 100, stewardId: 'current', mode: 'accounts' as const,
      revealedKept: 10, revealedErrors: 10, hidden: 0, status: 'tolerated' as const, deadline: 500, unrecovered: 20 }],
    summaries: [{ estateId: 'delegated-estate', tick: 500, mode: 'steward' as const, income: 20, reported: 10, kept: 5, error: 2,
      rentPermille: 1000, duesPermille: 1000, petitions: [], tenants: 0, merchants: 0, overloaded: false,
      charterLoss: { petitionId: resistance.petitionId, amount: 3 }, toleratedLosses: [{ auditId: error.auditId, amount: 2 }] }],
  } };
}
test('active pressures and seasonal loss provenance survive save roundtrip', () => {
  const state = pressured();
  const saved = encodeSave({ state, createdAt: '2026-10-10', savedAt: '2026-10-10' });
  assert.equal(saved.header.schemaVersion, 57);
  assert.deepEqual(decodeSave(saved.bytes).envelope.state, state);
});
test('v56 migration preserves legacy state without inventing tolerated errors or charter resistance', () => {
  const state = delegated();
  const saved = encodeSave({ state, createdAt: '2026-10-10', savedAt: '2026-10-10' });
  const text = new TextDecoder().decode(saved.bytes).replace(`"schemaVersion":${SAVE_SCHEMA_VERSION}`, '"schemaVersion":56');
  const restored = decodeSave(new TextEncoder().encode(text));
  assert.equal(restored.migratedFrom, 56);
  assert.deepEqual(restored.envelope.state, state);
});
test('malformed pressure identities, amounts and bounded durations are rejected', () => {
  const state = pressured();
  const invalidResistance = [null, { ...resistance, petitionId: '' }, { ...resistance, since: -1 },
    { ...resistance, since: state.tick + 1 }, { ...resistance, retryAfter: 0 },
    { ...resistance, remainingSeasons: 5 }, { ...resistance, remainingSeasons: -1 }, { ...resistance, remainingSeasons: 0.5 }];
  for (const charterResistance of invalidResistance) assert.throws(() => assertGameStateSnapshot({ ...state,
    stewardship: { ...state.stewardship, oversight: state.stewardship.oversight.map(row => ({ ...row, charterResistance })) } }), /charterResistance/);
  const invalidErrors = [null, [error, error], [{ ...error, auditId: '' }], [{ ...error, unrecovered: 0 }],
    [{ ...error, perSeason: Infinity }], [{ ...error, perSeason: 0.5 }], [{ ...error, remainingSeasons: 0 }], [{ ...error, remainingSeasons: 5 }]];
  for (const toleratedErrors of invalidErrors) assert.throws(() => assertGameStateSnapshot({ ...state,
    stewardship: { ...state.stewardship, stewards: state.stewardship.stewards.map(row => ({ ...row, toleratedErrors })) } }), /toleratedErrors/);
  for (const unrecovered of [-1, NaN, 0.5]) assert.throws(() => assertGameStateSnapshot({ ...state,
    stewardship: { ...state.stewardship, audits: state.stewardship.audits.map(row => ({ ...row, unrecovered })) } }), /unrecovered/);
  for (const charterLoss of [null, { petitionId: '', amount: 1 }, { petitionId: 'x', amount: 0 }]) assert.throws(() => assertGameStateSnapshot({ ...state,
    stewardship: { ...state.stewardship, summaries: state.stewardship.summaries.map(row => ({ ...row, charterLoss })) } }), /charterLoss/);
  for (const toleratedLosses of [null, [{ auditId: '', amount: 1 }], [{ auditId: 'x', amount: NaN }], [{ auditId: 'x', amount: 0 }]]) assert.throws(() => assertGameStateSnapshot({ ...state,
    stewardship: { ...state.stewardship, summaries: state.stewardship.summaries.map(row => ({ ...row, toleratedLosses })) } }), /toleratedLosses/);
});
test('expired charter cooldown and zero audit recovery are valid without live source records', () => {
  const state = pressured();
  assert.doesNotThrow(() => assertGameStateSnapshot({ ...state, stewardship: { ...state.stewardship, petitions: [],
    oversight: state.stewardship.oversight.map(row => ({ ...row, charterResistance: { ...resistance, remainingSeasons: 0 } })),
    audits: state.stewardship.audits.map(row => ({ ...row, unrecovered: 0 })),
  } }));
});

test('prepared v57 fixture contains real active pressures, realized losses and their exact answers', () => {
  const { envelope } = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v57/eb-inert-pressure.save.json')));
  const state = envelope.state, own = state.stewardship;
  assert.ok(own);
  assert.equal(own.oversight[0]?.charterResistance?.remainingSeasons, 3);
  assert.equal(own.stewards[0]?.toleratedErrors?.[0]?.remainingSeasons, 3);
  assert.equal(own.audits.find(row => row.id === 'inert-fixture-audit')?.unrecovered, 48);
  const summary = own.summaries.at(-1);
  assert.ok(summary && summary.charterLoss && summary.charterLoss.amount > 0);
  assert.equal(summary.charterLoss.petitionId, 'inert-fixture-charter');
  assert.equal(summary.toleratedLosses?.[0]?.auditId, 'inert-fixture-audit');
  assert.ok((summary.toleratedLosses?.[0]?.amount ?? 0) > 0);
  const receipt = state.history?.records.find(row => row.template === 'stewardship.season' && row.tick === summary.tick);
  assert.ok(receipt);
  const causes = receipt.because?.filter(row => row.key === 'decision_effect').map(row => row.decisionId) ?? [];
  const exact = state.trace?.answers?.filter(row => row.targets.includes('estate_petition:inert-fixture-charter')
    || row.source === 'audit:tolerate:inert-fixture-audit') ?? [];
  assert.equal(exact.length, 2);
  assert.ok(exact.every(answer => causes.includes(answer.id)));
});

test('standing tolerance provenance validates even without legacy finite pressures', () => {
  const state = delegated(); assert.ok(state.stewardship);
  const own = state.stewardship;
  const policy = { auditId: 'retained', since: 100, baselineLoss: 48, baselineLoyalty: 100, perSeason: 3 };
  const withPolicy = (auditTolerance: unknown) => ({ ...state, stewardship: { ...own,
    stewards: own.stewards.map(row => ({ ...row, auditTolerance })) } });
  assert.doesNotThrow(() => assertGameStateSnapshot(withPolicy(policy)));
  for (const invalid of [null, { ...policy, auditId: '' }, { ...policy, since: state.tick + 1 },
    { ...policy, baselineLoss: -1 }, { ...policy, baselineLoyalty: 101 }, { ...policy, perSeason: 0.5 }]) {
    assert.throws(() => assertGameStateSnapshot(withPolicy(invalid)), /auditTolerance/);
  }
});

test('automatic audit provenance rejects unknown actors and absent source IDs', () => {
  const state = pressured();
  for (const provenance of [{ decidedBy: 'unknown' }, { decidedBy: 'steward', policyAuditId: '' },
    { decidedBy: 'steward' }, { decidedBy: 'lord', policyAuditId: 'other' }]) {
    assert.throws(() => assertGameStateSnapshot({ ...state, stewardship: { ...state.stewardship,
      audits: state.stewardship.audits.map(row => ({ ...row, ...provenance })) } }), /audits/);
  }
});
