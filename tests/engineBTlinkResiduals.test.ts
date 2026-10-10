import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
const { outcomeSha256, verifyOutcomeReplay } = await import(new URL('../scripts/engineBOutcomeArchive.mjs', import.meta.url).href);
const { scoreOutcomeGate } = await import(new URL('../scripts/engineBOutcomeGate.mjs', import.meta.url).href);
const { auditTlinkResiduals, RESIDUAL_SOURCE_FILES, PHASE_HISTORY_SOURCES } = await import(new URL('../scripts/engineBTlinkResiduals.mjs', import.meta.url).href);

const encode = (value: unknown) => Buffer.from(JSON.stringify(value));
interface Options { audit?: boolean; auditIssue?: string; success?: number; target?: string; cause?: string; missing?: boolean; late?: boolean; phase?: boolean; futurePhase?: boolean; incompatible?: boolean; futureAnswer?: boolean; stone?: boolean; wrongPhase?: boolean; baselinePhase?: boolean; phaseLate?: boolean; approvedPhaseSha?: string; estate?: 'repair' | 'rent_relief' | 'charter_request'; counter?: boolean; declined?: boolean; contextIssue?: string }
function fixture(options: Options = {}) {
  const tick = options.late ? 499999 : 10;
  const chosen = options.audit ? 'tolerate' : options.estate === 'charter_request' ? 'refused' : options.counter ? options.declined ? 'declined' : 'accepted' : 'granted';
  const command = options.audit ? 'answer_audit' : options.estate ? 'answer_estate_petition' : options.counter ? 'answer_counter' : 'enforce_possession';
  const row = { ordinal: 1, tick, historyId: 'answer', command, source: options.audit ? 'audit:tolerate:s1' : options.estate ? `estate_petition:estate-1:${options.estate}:${chosen}` : options.counter ? 'answer_counter:s1' : 'suit:s1:enforce', kind: options.estate ? 'estate_petition' : options.counter ? 'marriage' : 'suit', weights: ['rights'], cameHeavyToLord: true, status: 'classified' };
  const phase = { ordinal: 2, tick: options.phaseLate ? 499999 : 30, historyId: 'phase', command: options.stone ? 'confirm_stone_town_proclamation' : 'confirm_palisade_proclamation', source: null, kind: null, weights: null, cameHeavyToLord: null, status: 'unclassified' };
  const classification = { rows: options.phase ? [row, phase] : [row], classified: [row], unclassified: options.phase ? [phase] : [], excluded: [], unresolved: [] };
  const history = [
    { id: 'answer', tick, kind: 'decision', template: 'decision.card', params: { command: row.command, subjectId: 's1', chosen } },
    ...options.missing ? [] : [{ id: 'effect', tick, kind: 'event', template: options.audit ? 'stewardship.audit_answered' : options.estate ? 'stewardship.lord_decided' : options.counter ? options.declined ? 'negotiation.withdrawn' : 'negotiation.accepted' : 'estate.possession_enforced', params: { stewardId: options.auditIssue === 'steward' ? 'other' : 'steward-1', choice: options.auditIssue === 'status' ? 'pending' : 'tolerated', recovered: 0, kind: options.estate, granted: chosen === 'granted' ? 1 : 0, negotiation: options.target ?? 's1', suit: options.target ?? 's1', attempt: 1, succeeded: options.success ?? 1 }, because: [{ decisionId: options.cause ?? 'answer', key: 'decision_effect' }] }],
    ...options.phase ? [{ id: 'phase', tick: phase.tick, kind: 'decision', template: options.wrongPhase ? 'decision.card' : options.stone ? 'decision.stone_town' : 'decision.market_town', params: { decisionKind: options.stone ? 'stone_town' : 'market_town' } }] : [],
    ...options.futureAnswer ? [{ id: 'answer-result', tick: tick + 1, kind: 'event', template: 'consequence', params: {}, because: [{ decisionId: 'answer', key: 'suit_rent' }] }] : [],
    ...options.futurePhase ? [{ id: 'phase-result', tick: 31, kind: 'event', template: 'phase.actual', params: {}, because: [{ decisionId: 'phase', key: 'phase' }] }] : [],
  ];
  if (options.auditIssue === 'ambiguous-receipt') {
    const effect = history[1];
    assert.ok(effect);
    history.push({ ...effect, id: 'second-effect' });
  }
  const provenance = { sourceRevision: 'a'.repeat(40), dirtyPaths: '', node: 'v24.21.0', sourceFiles: options.baselinePhase ? [{ path: 'src/engine/history.ts', sha256: options.approvedPhaseSha ?? PHASE_HISTORY_SOURCES[0].sha256 }] : RESIDUAL_SOURCE_FILES.map((path: string) => ({ path, sha256: options.incompatible ? '0'.repeat(64) : outcomeSha256(readFileSync(path)) })) };
  const raw = { seed: 1, years: 125, startYear: 1300, endYearExclusive: 1425, endTick: 500000, provenance,
    observation: { firstTick: 0, lastTick: 500000, maxGap: 1, reversals: 0 }, history, decisions: [], occurrences: [] };
  const rawBytes = encode(raw);
  const before = { id: 's1', estateId: 'estate-1', kind: options.estate, amount: 20, tick: 0, deadline: 1000, status: 'open' };
  const context = { ordinal: options.contextIssue === 'ordinal' ? 2 : 1, tick, command: { type: command, auditId: options.auditIssue === 'target' ? 'other' : 's1', choice: 'tolerate', petitionId: options.contextIssue === 'target' ? 'wrong' : 's1', grant: chosen === 'granted' }, stateChanged: options.auditIssue !== 'unchanged', agencyPresent: true,
    beforeHistoryLength: 1, afterHistoryLength: 3, history: options.contextIssue === 'history' ? {} : history[0],
    ownRoot: options.auditIssue?.startsWith('root') ? { id: options.auditIssue === 'root' ? 'root' : 'answer', tick, source: 'audit:tolerate:s1', targets: [options.auditIssue === 'root-target' ? 'estate:other' : 'estate:estate-1'] } : null,
    context: { estateBefore: before, estateAfter: { ...before, status: options.contextIssue === 'transition' ? 'open' : chosen, decidedBy: 'lord' } } };
  const contextBytes = gzipSync(encode(options.contextIssue === 'malformed' ? {} : options.contextIssue === 'duplicate' ? [context, context] : [context]));
  const audit = { id: 's1', estateId: 'estate-1', stewardId: 'steward-1', status: options.auditIssue === 'pending' ? 'pending' : 'tolerated', tick: 0, deadline: options.auditIssue === 'deadline' ? 0 : 500000 };
  const finalBytes = encode({ seed: options.auditIssue === 'seed' ? 2 : 1, tick: options.auditIssue === 'tick' ? 499999 : 500000, stewardship: { audits: options.auditIssue === 'duplicate' ? [audit, audit] : [audit], stewards: [{ personId: 'steward-1', loyalty: 100 }] } });
  const finalStateBytes = gzipSync(finalBytes);
  const finalSha = outcomeSha256(finalBytes);
  const manifest = { contextSha256: outcomeSha256(contextBytes), valid: true, browserEligible: false, replayFormat: 'outcome-replay-v1', replayVerified: true, seed: 1, sourceRevision: provenance.sourceRevision,
    source: { revision: provenance.sourceRevision, node: provenance.node, platform: 'linux', status: '', lock: 'b'.repeat(64), expectedLock: 'b'.repeat(64) },
    toolHashes: { collector: 'c'.repeat(64) }, raw: { sha256: outcomeSha256(rawBytes), provenance }, commandCount: classification.rows.length, classification, registryAnswerSetVerified: 0,
    checkpoints: [], final: { hit: true, phase: 'final', tick: raw.endTick, stateSha: options.auditIssue === 'missing-pin' ? undefined : finalSha }, finalComparison: { expectedSha256: finalSha, actualSha256: finalSha, expectedChecksum: 'sum', actualChecksum: 'sum' } };
  const manifestBytes = encode(manifest);
  const input = { ...(options.audit && options.auditIssue !== 'missing-final' ? { finalStateBytes: options.auditIssue === 'hash' ? gzipSync(encode({})) : finalStateBytes } : {}), ...((options.estate || options.audit) && options.contextIssue !== 'missing' ? { contextBytes: options.contextIssue === 'hash' ? Buffer.from('wrong') : contextBytes } : {}), format: 'outcome-replay-v1', rawBytes, manifestBytes, classificationBytes: encode(classification), validityBytes: encode({ valid: true, browserEligible: false, manifestSha256: outcomeSha256(manifestBytes) }) };
  const contractBytes = encode({ schemaVersion: 1, provenance, events: [] });
  const configBytes = encode({ schemaVersion: 1, seeds: [1], replayFormat: input.format, replayDirectory: '.', rawDirectory: '.', contractFile: 'contract.json', contractSha256: outcomeSha256(contractBytes),
    horizonTicks: 12000, ticksPerSeason: 1000, replayPins: [{ seed: 1, manifestSha256: outcomeSha256(manifestBytes), rawSha256: outcomeSha256(rawBytes) }] });
  const report = { ...scoreOutcomeGate([verifyOutcomeReplay(input)], JSON.parse(contractBytes.toString()), { horizonTicks: 12000, ticksPerSeason: 1000 }),
    configSha256: outcomeSha256(configBytes), contractSha256: outcomeSha256(contractBytes), scorerHashes: Object.fromEntries(['Archive', 'Gate', 'Run'].map(name => [`engineBOutcome${name}.mjs`, outcomeSha256(readFileSync(`scripts/engineBOutcome${name}.mjs`))])) };
  return { configBytes, contractBytes, scoreBytes: encode(report), inputs: [input] };
}

test('exact settled domain success is immediate only, preserving original future metric and bytes', () => {
  const input = fixture(), result = auditTlinkResiduals(input);
  assert.equal(result.residuals[0].category, 'immediate-only-observed');
  assert.equal(result.originalScoreSha256, outcomeSha256(input.scoreBytes));
  assert.deepEqual(result.originalPrimaryMetric, JSON.parse(input.scoreBytes.toString()).legacyDirectRatio);
  assert.equal(result.originalPrimaryMetric.numerator, 0);
  assert.equal(result.conservation.residuals, 1);
});
test('false observed predicate differs from missing, wrong-target and wrong-identity evidence', () => {
  assert.equal(auditTlinkResiduals(fixture({ success: 0 })).residuals[0].category, 'conditional-unmet-observed');
  for (const options of [{ missing: true }, { target: 'other' }, { cause: 'other' }, { success: 2 }, { incompatible: true }])
    assert.equal(auditTlinkResiduals(fixture(options)).residuals[0].category, 'unexplained');
});
test('censoring takes priority over same-tick success', () => {
  assert.equal(auditTlinkResiduals(fixture({ late: true })).residuals[0].category, 'insufficient-observation');
});
test('actual phase decision enters supplemental denominator without becoming a future receipt', () => {
  const result = auditTlinkResiduals(fixture({ phase: true }));
  assert.equal(result.supplemental.phaseAnswers[0].classification, 'phase_big');
  assert.equal(result.supplemental.expandedHeavyRatio.denominator, 2);
  assert.equal(result.supplemental.expandedHeavyRatio.numerator, 0);
  assert.equal(result.supplemental.phaseAnswers[0].futureReceipts.length, 0);
  assert.equal(auditTlinkResiduals(fixture({ phase: true, futurePhase: true })).supplemental.expandedHeavyRatio.numerator, 1);
});
test('tampered score, external pins, omitted inputs and wrong seed fail closed', () => {
  const input = fixture(), report = JSON.parse(input.scoreBytes.toString());
  report.answers = [];
  assert.throws(() => auditTlinkResiduals({ ...input, scoreBytes: encode(report) }), /score/);
  assert.throws(() => auditTlinkResiduals({ ...input, inputs: [] }), /input/);
  const config = JSON.parse(input.configBytes.toString()); config.replayPins[0].rawSha256 = '0'.repeat(64);
  assert.throws(() => auditTlinkResiduals({ ...input, configBytes: encode(config) }), /pin/);
  config.seeds = [2];
  assert.throws(() => auditTlinkResiduals({ ...input, configBytes: encode(config) }), /pin|seed/);
});

test('conservation includes censored answers with observed future receipts, excludes mature direct answers', () => {
  const censored = auditTlinkResiduals(fixture({ late: true, futureAnswer: true }));
  assert.equal(censored.residuals.length, 1);
  assert.equal(censored.residuals[0].category, 'insufficient-observation');
  assert.equal(censored.conservation.originalDirect, 0);
  assert.equal(censored.residuals[0].observedFutureReceipts.length, 1);
  const direct = auditTlinkResiduals(fixture({ futureAnswer: true }));
  assert.equal(direct.residuals.length, 0);
  assert.equal(direct.conservation.originalDirect, 1);
});
test('both phase commands require their exact history identity and compatible producer', () => {
  const stone = auditTlinkResiduals(fixture({ phase: true, stone: true }));
  assert.equal(stone.supplemental.phaseAnswers[0].evidence.template, 'decision.stone_town');
  for (const options of [{ phase: true, wrongPhase: true }, { phase: true, incompatible: true }]) {
    const result = auditTlinkResiduals(fixture(options));
    assert.equal(result.supplemental.phaseAnswers.length, 0);
    assert.equal(result.supplemental.unresolvedUnclassified.length, 1);
    assert.equal(result.supplemental.expandedHeavyRatio.denominator, 1);
  }
});

test('reviewed baseline phase history works without prototype receipt sources; supplemental status remains explicit', () => {
  const result = auditTlinkResiduals(fixture({ phase: true, baselinePhase: true }));
  assert.equal(result.supplemental.phaseAnswers[0].status, 'unlinked');
  assert.equal(result.supplemental.expandedHeavyRatio.denominator, 2);
  assert.equal(result.supplemental.expandedHeavyRatio.thresholdMet, false);
  assert.equal(result.supplemental.allUnclassifiedResolved, true);
  const censored = auditTlinkResiduals(fixture({ phase: true, phaseLate: true }));
  assert.equal(censored.supplemental.phaseAnswers[0].status, 'insufficient-observation');
  assert.equal(censored.supplemental.expandedHeavyRatio.denominator, 1);
  assert.equal(result.residuals[0].category, 'unexplained');
  assert.equal(result.residuals[0].provenance.matcherSourceCompatible, false);
  assert.equal(auditTlinkResiduals(fixture({ phase: true, futurePhase: true })).supplemental.phaseAnswers[0].status, 'direct');
  assert.equal(auditTlinkResiduals(fixture({ phase: true, incompatible: true })).supplemental.allUnclassifiedResolved, false);
});

test('estate grant/refusal settlement is immediate only with exact pinned context and own domain record', () => {
  for (const estate of ['repair', 'rent_relief', 'charter_request'] as const) {
    const input = fixture({ estate }), result = auditTlinkResiduals(input);
    assert.equal(result.residuals[0].category, 'immediate-only-observed');
    assert.equal(result.residuals[0].provenance.contextSha256.length, 64);
    assert.deepEqual(result.originalPrimaryMetric, JSON.parse(input.scoreBytes.toString()).legacyDirectRatio);
  }
});
test('missing or mismatched estate context never establishes settlement', () => {
  for (const contextIssue of ['missing', 'target', 'transition', 'history'])
    assert.equal(auditTlinkResiduals(fixture({ estate: 'repair', contextIssue })).residuals[0].category, 'unexplained');
  for (const contextIssue of ['hash', 'malformed', 'ordinal', 'duplicate'])
    assert.throws(() => auditTlinkResiduals(fixture({ estate: 'repair', contextIssue })), /context/);
  for (const options of [{ cause: 'wrong' }, { missing: true }, { incompatible: true }])
    assert.equal(auditTlinkResiduals(fixture({ estate: 'repair', ...options })).residuals[0].category, 'unexplained');
});
test('counter immediate settlement requires exact negotiation target and own answer identity', () => {
  assert.equal(auditTlinkResiduals(fixture({ counter: true })).residuals[0].category, 'immediate-only-observed');
  assert.equal(auditTlinkResiduals(fixture({ counter: true, declined: true })).residuals[0].category, 'immediate-only-observed');
  for (const options of [{ target: 'wrong' }, { cause: 'wrong' }, { missing: true }, { incompatible: true }])
    assert.equal(auditTlinkResiduals(fixture({ counter: true, ...options })).residuals[0].category, 'unexplained');
});


test('audit tolerance proves only immediate settlement, including capped loyalty, without changing future credit', () => {
  const input = fixture({ audit: true }), bytes = Buffer.from(input.scoreBytes), result = auditTlinkResiduals(input);
  assert.equal(result.residuals[0].category, 'immediate-only-observed');
  assert.equal(result.residuals[0].reason, 'audit_tolerance_status_settled');
  assert.equal(result.residuals[0].loyaltyDeltaObserved, null);
  assert.equal(auditTlinkResiduals(fixture({ audit: true, auditIssue: 'root-valid' })).residuals[0].category, 'immediate-only-observed');
  assert.equal(result.originalPrimaryMetric.numerator, 0);
  assert.deepEqual(input.scoreBytes, bytes);
  assert.equal(auditTlinkResiduals(fixture({ audit: true, late: true })).residuals[0].category, 'insufficient-observation');
});
test('audit settlement requires pinned final state, exact command and receipt, without root inference', () => {
  for (const auditIssue of ['missing-final', 'target', 'pending', 'steward', 'status', 'deadline', 'unchanged', 'root', 'root-target', 'ambiguous-receipt'])
    assert.equal(auditTlinkResiduals(fixture({ audit: true, auditIssue })).residuals[0].category, 'unexplained', auditIssue);
  for (const options of [{ contextIssue: 'missing' }, { cause: 'root' }, { missing: true }, { incompatible: true }])
    assert.equal(auditTlinkResiduals(fixture({ audit: true, ...options })).residuals[0].category, 'unexplained');
  for (const auditIssue of ['hash', 'seed', 'tick', 'duplicate', 'missing-pin'])
    assert.throws(() => auditTlinkResiduals(fixture({ audit: true, auditIssue })), /final/, auditIssue);
});


test('all frozen reviewed phase producers remain supported while unknown source hashes remain unresolved', () => {
  for (const source of PHASE_HISTORY_SOURCES) {
    const result = auditTlinkResiduals(fixture({ phase: true, baselinePhase: true, approvedPhaseSha: source.sha256 }));
    assert.equal(result.supplemental.phaseAnswers.length, 1, source.sha256);
    assert.equal(result.supplemental.phaseAnswers[0].classification, 'phase_big');
    assert.equal(result.supplemental.expandedHeavyRatio.denominator, 2);
    assert.equal(result.supplemental.expandedHeavyRatio.numerator, 0);
  }
  const unknown = auditTlinkResiduals(fixture({ phase: true, baselinePhase: true, approvedPhaseSha: '0'.repeat(64) }));
  assert.equal(unknown.supplemental.phaseAnswers.length, 0);
  assert.equal(unknown.supplemental.unresolvedUnclassified.length, 1);
});
