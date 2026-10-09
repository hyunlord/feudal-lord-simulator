import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runOutcomeGate, prepareOutcomeConfig } from '../scripts/engineBOutcomeRun.mjs';
import { createHash } from 'node:crypto';
import { verifyOutcomeReplay } from '../scripts/engineBOutcomeArchive.mjs';
import { scoreOutcomeGate } from '../scripts/engineBOutcomeGate.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const encode = value => Buffer.from(JSON.stringify(value));
function fixture(count = 5) {
  const rows = Array.from({ length: count }, (_, i) => ({ ordinal: i + 1, tick: 10 + i, historyId: `a${i}`, command: 'answer_registry_offer',
    source: 'registry:ck_evt_005:a', kind: 'registry', weights: ['rights'], cameHeavyToLord: true, status: 'classified' }));
  const classification = { rows, classified: rows, excluded: [], unclassified: [], unresolved: [] };
  const history = rows.map(row => ({ id: row.historyId, tick: row.tick, kind: 'decision', template: 'decision.card',
    params: { command: row.command, subjectId: `offer${row.ordinal}`, chosen: 'a' } }));
  history.push(...rows.slice(0, 4).map(row => ({ id: `r${row.ordinal}`, tick: row.tick + 1, kind: 'event', template: 'consequence',
    params: { key: 'payment_flow', target: 'dues', eligible: true }, because: [{ decisionId: row.historyId, key: 'payment_flow', part: true }] })));
  const raw = { seed: 1, years: 125, startYear: 1300, endYearExclusive: 1425, endTick: 500000,
    provenance: { sourceRevision: 'a'.repeat(40), dirtyPaths: '', node: 'v24.21.0' }, observation: { firstTick: 0, lastTick: 500000, maxGap: 1, reversals: 0 },
    history, decisions: [], occurrences: rows.map(row => ({ id: `offer${row.ordinal}`, entryId: 'ck_evt_005', choiceId: 'a', status: 'answered', settledTick: row.tick, bound: { target: 'dues' } })) };
  const rawBytes = encode(raw);
  const manifest = { valid: true, browserEligible: true, seed: 1, sourceRevision: raw.provenance.sourceRevision,
    source: { revision: raw.provenance.sourceRevision, lock: 'b'.repeat(64), expectedLock: 'b'.repeat(64), status: '', node: 'v24.21.0', platform: 'linux' },
    toolHashes: { collector: 'c'.repeat(64) }, raw: { sha256: sha(rawBytes), provenance: raw.provenance },
    final: { phase: 'final', hit: true, tick: raw.endTick }, finalComparison: { expectedSha256: 'd'.repeat(64), actualSha256: 'd'.repeat(64), expectedChecksum: 'sum', actualChecksum: 'sum' },
    checkpoints: [], classification, commandCount: count, registryAnswerSetVerified: count };
  const manifestBytes = encode(manifest);
  return { raw, manifest, input: { format: 'answer-replay-v1', rawBytes, manifestBytes, classificationBytes: encode(classification), validityBytes: encode({ valid: true, browserEligible: true, manifestSha256: sha(manifestBytes) }) } };
}
function repack(value) {
  value.input.rawBytes = encode(value.raw); value.manifest.raw.sha256 = sha(value.input.rawBytes);
  value.input.manifestBytes = encode(value.manifest); value.input.classificationBytes = encode(value.manifest.classification);
  value.input.validityBytes = encode({ valid: true, browserEligible: true, manifestSha256: sha(value.input.manifestBytes) });
  return value.input;
}
const contract = () => ({ schemaVersion: 1, provenance: { sourceRevision: 'a'.repeat(40), sourceFiles: [{ path: 'src/engine/test.ts', sha256: 'e'.repeat(64) }] }, events: [{ id: 'ck_evt_005', choices: [{ id: 'a', outcomes: [{ id: 'flow', effectKind: 'conditional', withinSeasons: 12, expectedResultTemplates: ['consequence'], expectedResultKeys: ['payment_flow'], primaryDirectDecisionLink: { required: true, identity: 'successful_answer_history_id' }, evidenceMatcher: {
  answerTarget: { record: 'occurrence', path: ['bound', 'target'] }, resultTarget: { path: ['params', 'target'] }, conditions: [{ record: 'result', path: ['params', 'eligible'], equals: true }],
} }] }] }] });
const score = (value = fixture(), c = contract()) => scoreOutcomeGate([verifyOutcomeReplay(repack(value))], c, { horizonTicks: 12000, ticksPerSeason: 1000 });

test('exact 80 percent passes with primary own-answer, target, and condition evidence', () => {
  const report = score(); assert.equal(report.strictContractDirectRatio.numerator, 4); assert.equal(report.strictContractDirectRatio.denominator, 5); assert.equal(report.pass, true);
  assert.deepEqual(report.counts, { direct: 4, conditional: 0, 'insufficient-observation': 0, unlinked: 1 });
});
test('conditional evidence stays in mature denominator, never direct', () => {
  const value = fixture(); value.raw.history.find(row => row.id === 'r1').params.eligible = false;
  const report = score(value); assert.equal(report.strictCounts.conditional, 1); assert.equal(report.strictContractDirectRatio.numerator, 3); assert.equal(report.strictContractDirectRatio.denominator, 5); assert.equal(report.pass, true);
});
test('censored answers are insufficient, missing mature receipt is unlinked', () => {
  const value = fixture(); const row = value.manifest.classification.rows.at(-1); row.tick = 499999;
  value.raw.history.find(h => h.id === row.historyId).tick = row.tick; value.raw.occurrences.at(-1).settledTick = row.tick;
  const report = score(value); assert.equal(report.counts['insufficient-observation'], 1); assert.equal(report.counts.unlinked, 0); assert.equal(report.strictContractDirectRatio.denominator, 4);
});
test('member cause, wrong target, stale receipt and generic decision card are never direct', () => {
  for (const mutate of [r => r.because.unshift({ decisionId: 'another', key: 'payment_flow' }), r => { r.params.target = 'other'; }, r => { r.tick = 10; }, r => { r.template = 'decision.card'; }]) {
    const value = fixture(); mutate(value.raw.history.find(r => r.id === 'r1')); assert.equal(score(value).strictContractDirectRatio.numerator, 3);
  }
});
test('missing contract, matcher, unknown condition and incompatible source fail closed', () => {
  for (const change of [c => { c.events = []; }, c => { delete c.events[0].choices[0].outcomes[0].evidenceMatcher; }, c => { c.events[0].choices[0].outcomes[0].evidenceMatcher.conditions[0].path = ['missing']; }, c => { c.provenance.sourceRevision = 'f'.repeat(40); }]) {
    const c = contract(); change(c); const report = score(fixture(), c); assert.equal(report.strictContractDirectRatio.thresholdMet, false); assert.equal(report.strictContractDirectRatio.numerator, 0);
  }
  assert.throws(() => score(fixture(), null));
});
test('no answers cannot pass; all conditional cannot pass', () => {
  assert.equal(score(fixture(0)).pass, false);
  const value = fixture(4); for (const r of value.raw.history.filter(r => r.kind === 'event')) r.params.eligible = false;
  assert.equal(score(value).strictContractDirectRatio.thresholdMet, false); assert.equal(score(value).strictContractDirectRatio.denominator, 4);
});
test('archive rejects missing fields, duplicates and mismatched source or bytes', () => {
  for (const mutate of [v => { delete v.raw.history; }, v => { v.raw.history.push(v.raw.history[0]); }, v => { v.manifest.classification.rows[1].ordinal = 1; }, v => { v.manifest.classification.rows[1].historyId = 'a0'; }, v => { v.manifest.source.revision = 'f'.repeat(40); }, v => { v.raw.observation.maxGap = 2; }]) {
    const value = fixture(); mutate(value); assert.throws(() => verifyOutcomeReplay(repack(value)));
  }
  const value = fixture(); value.input.rawBytes = encode({}); assert.throws(() => verifyOutcomeReplay(value.input));
});
test('unclassified taxonomy gaps block acceptance even if direct fraction passes', () => {
  const value = fixture(4); const unknown = { ordinal: 5, tick: 100, historyId: 'unknown', command: 'new_command', status: 'unclassified', source: null, kind: null, weights: null, cameHeavyToLord: null };
  value.manifest.classification.rows.push(unknown); value.manifest.classification.unclassified.push(unknown); value.manifest.classification.classified = value.manifest.classification.rows.filter(r => r.status === 'classified'); value.manifest.commandCount++;
  value.raw.history.push({ id: 'unknown', tick: 100, kind: 'decision' }); assert.equal(score(value).pass, false);
});

test('historical80% is independent from stricter target and primary-cause audit', () => {
  const value = fixture(); value.raw.history.find(r => r.id === 'r1').params.target = 'wrong';
  const report = score(value); assert.equal(report.legacyDirectRatio.numerator, 4); assert.equal(report.pass, true);
  assert.equal(report.strictContractDirectRatio.numerator, 3); assert.equal(report.strictContractDirectRatio.thresholdMet, false);
});
test('exact three-year endpoint counts, next tick and same tick do not; roots cannot substitute', () => {
  for (const [tick, expected] of [[12010, 4], [12011, 3], [10, 3]]) {
    const value = fixture(); value.raw.history.find(r => r.id === 'r1').tick = tick;
    assert.equal(score(value).legacyDirectRatio.numerator, expected);
  }
  const value = fixture(); value.raw.history.find(r => r.id === 'r1').because[0].decisionId = 'root';
  value.raw.decisions.push({ id: 'root', tick: 1, lastTick: 20, source: 'registry:ck_evt_005:a' });
  const report = score(value); assert.equal(report.legacyDirectRatio.numerator, 3);
  assert.equal(report.answers[0].inferredRootCandidates[0].id, 'root'); assert.equal(report.answers[0].inferredMembershipVerified, false);
});
test('observed false condition without a receipt stays conditional and in primary denominator', () => {
  const value = fixture(); value.raw.history = value.raw.history.filter(row => row.id !== 'r1');
  value.raw.occurrences[0].eligible = false;
  const c = contract(); c.events[0].choices[0].outcomes[0].evidenceMatcher.conditions = [{ record: 'occurrence', path: ['eligible'], equals: true }];
  const report = score(value, c); assert.equal(report.counts.conditional, 1); assert.equal(report.legacyDirectRatio.denominator, 5); assert.equal(report.pass, false);
});
test('faction receipt may locate key in own because and target in explicit alternate path', () => {
  const value = fixture(); const result = value.raw.history.find(row => row.id === 'r1');
  delete result.params.key; delete result.params.target; result.params.faction = 'dues';
  const c = contract(); const matcher = c.events[0].choices[0].outcomes[0].evidenceMatcher;
  matcher.resultKey = { record: 'ownCause', path: ['key'] }; matcher.resultTarget.alternatives = [['params', 'faction']];
  assert.equal(score(value, c).strictContractDirectRatio.numerator, 4);
});
test('censored linked receipt remains observed but is never counted as mature success', () => {
  const value = fixture(); const answer = value.manifest.classification.rows[0]; answer.tick = 499999;
  value.raw.history.find(row => row.id === 'a0').tick = answer.tick; value.raw.occurrences[0].settledTick = answer.tick;
  value.raw.history.find(row => row.id === 'r1').tick = 500000;
  const report = score(value); assert.equal(report.counts['insufficient-observation'], 1); assert.equal(report.legacyDirectRatio.numerator, 3);
  assert.equal(report.answers[0].directReceipts.length, 1);
});

test('removing unlinked rows and reducing cached command count cannot hide raw answers', () => {
  const value = fixture(6); value.manifest.classification.rows.splice(4); value.manifest.commandCount = 4; value.manifest.registryAnswerSetVerified = 4;
  assert.throws(() => score(value), /omitted/);
});
test('a missing attempted-command row fails even when category arrays agree', () => {
  const value = fixture(); value.manifest.classification.rows.pop(); value.manifest.registryAnswerSetVerified = 4;
  assert.throws(() => score(value), /classification rows/);
});
test('product source hashes permit docs-only revisions but never changed product bytes', () => {
  const value = fixture(), c = contract(); value.raw.provenance.sourceFiles = c.provenance.sourceFiles;
  c.provenance.sourceRevision = 'f'.repeat(40);
  assert.equal(score(value, c).strictContractDirectRatio.numerator, 4);
  value.raw.provenance.sourceFiles = [{ path: c.provenance.sourceFiles[0].path, sha256: '0'.repeat(64) }];
  assert.equal(score(value, c).strictContractDirectRatio.numerator, 0);
});


test('portable producer config/CLI verifies artifacts, rejects wrong cohorts and never overwrites', () => {
  const directory = mkdtempSync(join(tmpdir(), 'outcome-gate-'));
  try {
    const value = fixture(); value.manifest.replayFormat = 'outcome-replay-v1'; value.manifest.replayVerified = true; value.manifest.browserEligible = false;
    const input = repack(value); input.validityBytes = encode({ valid: true, browserEligible: false, manifestSha256: sha(input.manifestBytes) });
    mkdirSync(join(directory, 'seed-1'));
    writeFileSync(join(directory, 'seed-1.json'), input.rawBytes);
    for (const [name, bytes] of [['manifest.json', input.manifestBytes], ['validity.json', input.validityBytes], ['answer-classification.json', input.classificationBytes]]) writeFileSync(join(directory, 'seed-1', name), bytes);
    const pins = { seed: 1, years: 125, ticksPerSeason: 1000, horizonTicks: 12000, rawSha256: sha(input.rawBytes), manifestSha256: sha(input.manifestBytes) };
    writeFileSync(join(directory, 'seed-1/pins.json'), encode(pins));
    writeFileSync(join(directory, 'contract.json'), encode(contract()));
    const configPath = join(directory, 'config.json'), output = join(directory, 'report.json');
    const config = prepareOutcomeConfig(directory, join(directory, 'contract.json'), configPath, [1]);
    assert.equal(config.replayDirectory, '.'); assert.equal(runOutcomeGate(configPath, output).pass, true);
    const prior = readFileSync(output); assert.throws(() => runOutcomeGate(configPath, output), /EEXIST/); assert.deepEqual(readFileSync(output), prior);
    mkdirSync(join(directory, 'seed-2'));
    for (const name of ['manifest.json', 'validity.json', 'answer-classification.json']) writeFileSync(join(directory, 'seed-2', name), readFileSync(join(directory, 'seed-1', name)));
    writeFileSync(join(directory, 'seed-2.json'), input.rawBytes);
    config.seeds = [2]; config.replayPins[0].seed = 2; writeFileSync(configPath, encode(config));
    assert.throws(() => runOutcomeGate(configPath, join(directory, 'wrong.json')), /requested seed/);
    config.seeds = [1]; config.replayPins[0].seed = 1; config.contractSha256 = '0'.repeat(64); writeFileSync(configPath, encode(config));
    assert.throws(() => runOutcomeGate(configPath, join(directory, 'wrong.json')), /contract file pin/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('short probes, absent runtime provenance, unknown protocol and duplicate cohorts fail closed', () => {
  for (const mutate of [v => { v.raw.years = 1; v.raw.endYearExclusive = 1301; }, v => { delete v.manifest.source.node; }]) {
    const value = fixture(); mutate(value); assert.throws(() => verifyOutcomeReplay(repack(value)));
  }
  const value = fixture(); const input = repack(value); input.format = 'anything'; assert.throws(() => verifyOutcomeReplay(input), /format/);
  const run = verifyOutcomeReplay(repack(fixture()));
  assert.throws(() => scoreOutcomeGate([run, run], contract(), { horizonTicks: 12000, ticksPerSeason: 1000 }), /duplicate seed/);
});

test('registry verification rejects an answered lord occurrence without any command/history row', () => {
  const value = fixture();
  value.raw.occurrences.push({ ...value.raw.occurrences[0], id: 'missing-lord-answer', settledTick: 123 });
  assert.throws(() => score(value), /registry.*occurrence|occurrence.*registry/);
});
test('registry verification rejects duplicate occurrence attribution and mismatched settlement', () => {
  const duplicate = fixture(); duplicate.raw.history.find(row => row.id === 'a1').params.subjectId = 'offer1';
  assert.throws(() => verifyOutcomeReplay(repack(duplicate)), /registry/);
  const mismatch = fixture(); mismatch.raw.occurrences[0].settledTick += 1;
  assert.throws(() => verifyOutcomeReplay(repack(mismatch)), /registry/);
});
test('registry occurrence equality excludes steward, invalid, lapsed and endpoint rows', () => {
  const value = fixture(); const occurrence = value.raw.occurrences[0];
  value.raw.occurrences.push({ ...occurrence, id: 'steward', decidedBy: 'steward' },
    { ...occurrence, id: 'invalid', status: 'invalid' }, { ...occurrence, id: 'lapsed', status: 'lapsed' },
    { ...occurrence, id: 'endpoint', settledTick: value.raw.endTick });
  assert.equal(score(value).legacyDirectRatio.denominator, 5);
});
