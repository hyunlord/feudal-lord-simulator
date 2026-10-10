import test from 'node:test';
import assert from 'node:assert/strict';
const { buildTlinkOutcomeEvidence, TLINK_REVIEWED_EFFECT_SOURCES } = await import(new URL('../scripts/engineBTlinkOutcomeEvidence.mjs', import.meta.url).href);
const { tlinkImmediateDifferences } = await import(new URL('../scripts/engineBTlinkOutcomeCategoriesRun.mjs', import.meta.url).href);
function fixture(kind: 'audit' | 'petition', changed = false) {
  const before = { treasuryCoin: 50, stewardship: {
    audits: [{ id: 'a', estateId: 'e', stewardId: 's', tick: 0, deadline: 100, status: 'pending' }],
    stewards: [{ personId: 's', loyalty: 100 }], oversight: [{ estateId: 'e', tenants: -40, merchants: -40 }],
    petitions: [{ id: 'p', estateId: 'e', kind: 'charter_request', status: 'open', deadline: 100 }],
  } };
  const after = structuredClone(before);
  const audit = after.stewardship.audits[0], steward = before.stewardship.stewards[0], petition = after.stewardship.petitions[0], oversight = before.stewardship.oversight[0];
  assert.ok(audit && steward && petition && oversight);
  if (kind === 'audit') { audit.status = 'tolerated'; if (changed) steward.loyalty = 98; }
  else { Object.assign(petition, { status: 'refused', decidedBy: 'lord' }); if (changed) oversight.merchants = -38; }
  return { before, after, command: kind === 'audit' ? { type: 'answer_audit', auditId: 'a', choice: 'tolerate' } : { type: 'answer_estate_petition', petitionId: 'p', grant: false } };
}
function mapped(fixture: { before: unknown; after: unknown; command: unknown }, incompatible = false) {
  const deltas = tlinkImmediateDifferences(fixture.before, fixture.after).map((delta: { path: string }) => ({ ...delta, path: delta.path.slice(1).split('/') }));
  return buildTlinkOutcomeEvidence({ provenance: { sourceFiles: incompatible ? [{ path: 'unknown', sha256: '0'.repeat(64) }] : TLINK_REVIEWED_EFFECT_SOURCES, originalScoreSha256: '1'.repeat(64) },
    rows: [{ ...fixture, seed: 1, historyId: 'answer', ordinal: 1, tick: 10, source: 'source', deltaPaths: deltas }] }).rows[0];
}
const changes = (proof: ReturnType<typeof mapped>) => proof.effects.filter((effect: { kind: string; before: unknown; after: unknown }) => effect.kind !== 'bookkeeping' && !assertionEqual(effect.before, effect.after));
function assertionEqual(a: unknown, b: unknown) { return JSON.stringify(a) === JSON.stringify(b); }
test('capped audit loyalty and clamped refused charter are inert; processing does not become gameplay', () => {
  for (const kind of ['audit', 'petition'] as const) {
    const proof = mapped(fixture(kind));
    assert.equal(proof.proofComplete, true); assert.equal(changes(proof).length, 0);
    assert.ok(proof.effects.some((effect: { kind: string }) => effect.kind === 'bookkeeping'));
  }
});
test('actual loyalty and estate relation changes are observed, not intended deltas', () => {
  for (const kind of ['audit', 'petition'] as const) {
    const proof = mapped(fixture(kind, true));
    assert.equal(proof.proofComplete, true); assert.equal(changes(proof).length, 1);
    assert.equal(changes(proof)[0].kind, 'relation');
  }
});
test('unknown changes, wrong target and missing source review never establish zero effects', () => {
  const item = fixture('audit');
  assert.equal(mapped({ ...item, after: { ...item.after, newMechanic: 1 } }).proofComplete, false);
  assert.equal(mapped({ ...item, command: { ...item.command, auditId: 'other' } }).proofComplete, false);
  assert.equal(mapped(item, true).proofComplete, false);
});
test('unsupported commands with unchanged world are unknown, while actual money is retained as partial proof', () => {
  const item = fixture('audit'), command = { type: 'answer_registry_offer' };
  assert.equal(mapped({ ...item, after: item.before, command }).proofComplete, false);
  const proof = mapped({ ...item, after: { ...item.after, treasuryCoin: 49 }, command });
  assert.equal(proof.proofComplete, false); assert.equal(changes(proof)[0].kind, 'money');
});
test('reordered or duplicated target arrays never produce a false scalar relation change', () => {
  const item = fixture('audit');
  const after = { ...item.after, stewardship: { ...item.after.stewardship, stewards: [{ personId: 'other', loyalty: 1 }, ...item.after.stewardship.stewards] } };
  const proof = mapped({ ...item, after });
  assert.equal(proof.proofComplete, false); assert.equal(changes(proof).length, 0);
});

test('ledger metadata is not blanket ignored, and missing actual loyalty cannot prove inert', () => {
  const item = fixture('petition');
  const proof = mapped({ ...item, after: { ...item.after, ledger: { unexpectedObligation: 50 } } });
  assert.equal(proof.proofComplete, false); assert.equal(changes(proof).length, 0);
  const audit = fixture('audit');
  assert.equal(mapped({ ...audit, after: { ...audit.after, stewardship: { ...audit.after.stewardship, stewards: [] } } }).proofComplete, false);
});
test('refused repair requires its own estate value scope, including real neglect rather than closure status', () => {
  const item = fixture('petition');
  const petitionBefore = item.before.stewardship.petitions[0], petitionAfter = item.after.stewardship.petitions[0];
  assert.ok(petitionBefore && petitionAfter); petitionBefore.kind = 'repair'; petitionAfter.kind = 'repair';
  assert.equal(mapped(item).proofComplete, false);
  const proof = mapped({ ...item, before: { ...item.before, estates: { estates: [{ id: 'e', annualValue: 100 }] } },
    after: { ...item.after, estates: { estates: [{ id: 'e', annualValue: 90 }] } } });
  assert.equal(proof.proofComplete, true); assert.equal(changes(proof).length, 1); assert.equal(changes(proof)[0].kind, 'land');
});
test('retained trace state is unknown rather than blanket bookkeeping', () => {
  const item = fixture('audit');
  const proof = mapped({ ...item, before: { ...item.before, trace: { acts: [] } }, after: { ...item.after, trace: { acts: [{ kind: 'gift' }] } } });
  assert.equal(proof.proofComplete, false); assert.equal(changes(proof).length, 0);
  assert.ok(proof.unknownChangedPaths.some((path: string[]) => path[0] === 'trace'));
});
test('actual persistent oversight/audit settings and existing timber order values are gameplay state', () => {
  const item = fixture('audit');
  const proof = mapped({ ...item, command: { type: 'answer_registry_offer' },
    before: { ...item.before, timberOrder: 1, stewardship: { ...item.before.stewardship, oversight: [{ estateId: 'e', mode: 'steward', auditMode: 'accounts' }] } },
    after: { ...item.after, timberOrder: 16, stewardship: { ...item.after.stewardship, oversight: [{ estateId: 'e', mode: 'direct', auditMode: 'visit' }] } } });
  assert.equal(proof.proofComplete, false); assert.equal(changes(proof).length, 3);
  assert.ok(changes(proof).every((effect: { kind: string }) => effect.kind === 'command-state'));
});
test('timber order creation and cancellation are actual persistent command changes', () => {
  const item = fixture('audit');
  for (const [before, after] of [[{}, { timberOrder: 16 }], [{ timberOrder: 16 }, {}]]) {
    const proof = mapped({ ...item, command: { type: 'answer_registry_offer' }, before: { ...item.before, ...before }, after: { ...item.after, ...after } });
    assert.equal(changes(proof).length, 1); assert.equal(changes(proof)[0].kind, 'command-state');
  }
});
test('absent and explicit zero timber orders have the same gameplay value', () => {
  const item = fixture('audit');
  for (const [before, after] of [[{}, { timberOrder: 0 }], [{ timberOrder: 0 }, {}]]) {
    const proof = mapped({ ...item, command: { type: 'answer_registry_offer' }, before: { ...item.before, ...before }, after: { ...item.after, ...after } });
    assert.equal(changes(proof).length, 0);
    assert.equal(proof.proofComplete, false);
    assert.ok(proof.unknownChangedPaths.some((path: string[]) => path.length === 1 && path[0] === 'timberOrder'));
  }
});
test('changed transitive source pins invalidate semantic reuse even when direct handler pins match', () => {
  const item = fixture('audit');
  for (const path of ['src/content/stewardshipConfig.ts', 'src/engine/estates.ts', 'src/ledger/ledger.ts', 'src/engine/registryV4.ts', 'src/engine/estateSuits.ts']) {
    const sourceFiles = TLINK_REVIEWED_EFFECT_SOURCES.map((pin: { path: string; sha256: string }) => pin.path === path ? { ...pin, sha256: '0'.repeat(64) } : pin);
    const result = buildTlinkOutcomeEvidence({ provenance: { sourceFiles, originalScoreSha256: '1'.repeat(64) }, rows: [{ ...item, seed: 1, historyId: 'answer', ordinal: 1, tick: 10, source: 'source', deltaPaths: [] }] });
    assert.equal(result.rows[0].proofComplete, false, path);
    assert.deepEqual(result.rows[0].effects, [], path);
    assert.equal(result.rows[0].unsupportedReason, 'reviewed_source_pin_mismatch', path);
  }
});

test('actual strength of the same claim is a rights effect, while replacement and duplicate identities stay unknown', () => {
  const command = { type: 'answer_registry_offer', choiceId: 'defer' };
  const before = { estates: { claims: [{ id: 'claim-2', strength: 55 }] } };
  const after = { estates: { claims: [{ id: 'claim-2', strength: 50 }] } };
  const proof = mapped({ command, before, after });
  assert.equal(changes(proof).length, 1);
  assert.equal(changes(proof)[0].kind, 'rights');
  assert.deepEqual(changes(proof)[0].path, ['estates', 'claims', '0', 'strength']);
  assert.equal(proof.proofComplete, false);
  assert.equal(changes(mapped({ command, before, after: before })).length, 0);
  for (const claims of [[{ id: 'other', strength: 50 }], [{ id: 'claim-2', strength: 50 }, { id: 'claim-2', strength: 55 }]]) {
    assert.equal(changes(mapped({ command, before, after: { estates: { claims } } })).length, 0);
  }
});

test('reviewed INERT schedules alone are not actual economic outcomes and mutated pins stay unknown', async () => {
  const { INERT_REVIEWED_EFFECT_SOURCES } = await import(new URL('../scripts/engineBInertReviewedSources.mjs', import.meta.url).href);
  for (const kind of ['audit', 'petition'] as const) {
    const item = fixture(kind);
    if (kind === 'audit') {
      Object.assign(item.after.stewardship.audits[0] ?? {}, { unrecovered: 64 });
      Object.assign(item.after.stewardship.stewards[0] ?? {}, { toleratedErrors: [{ auditId: 'a', unrecovered: 64, perSeason: 4, remainingSeasons: 4 }] });
    } else Object.assign(item.after.stewardship.oversight[0] ?? {}, { charterResistance: { petitionId: 'p', since: 10, remainingSeasons: 4, retryAfter: 12010 } });
    const row = { ...item, seed: 1, historyId: 'answer', ordinal: 1, tick: 10, source: 'source',
      deltaPaths: tlinkImmediateDifferences(item.before, item.after).map((delta: { path: string }) => ({ ...delta, path: delta.path.slice(1).split('/') })) };
    const proof = buildTlinkOutcomeEvidence({ provenance: { sourceFiles: INERT_REVIEWED_EFFECT_SOURCES, originalScoreSha256: '1'.repeat(64) }, rows: [row] }).rows[0];
    assert.equal(proof.proofComplete, true); assert.equal(changes(proof).length, 0);
    const altered = INERT_REVIEWED_EFFECT_SOURCES.map((pin: { path: string; sha256: string }) => pin.path.endsWith('stewardshipConsequences.ts') ? { ...pin, sha256: '0'.repeat(64) } : pin);
    const unknown = buildTlinkOutcomeEvidence({ provenance: { sourceFiles: altered, originalScoreSha256: '1'.repeat(64) }, rows: [row] }).rows[0];
    assert.equal(unknown.proofComplete, false); assert.deepEqual(unknown.effects, []);
  }
});

test('INERT reviewed source profile matches every current reviewed actuator before a measurement run', async () => {
  const { readFileSync } = await import('node:fs');
  const { createHash } = await import('node:crypto');
  const { INERT_REVIEWED_EFFECT_SOURCES } = await import(new URL('../scripts/engineBInertReviewedSources.mjs', import.meta.url).href);
  for (const pin of INERT_REVIEWED_EFFECT_SOURCES) {
    const actual = createHash('sha256').update(readFileSync(new URL(`../${pin.path}`, import.meta.url))).digest('hex');
    assert.equal(actual, pin.sha256, `Source changed after semantic review: ${pin.path}`);
  }
});
