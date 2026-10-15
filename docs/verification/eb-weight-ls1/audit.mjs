import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

assert.equal(process.platform, 'linux', 'Run current save/read models only on DGX');
assert.equal(process.env.FLS_REMOTE, '1', 'Submit through scripts/remote/run.sh');
const [checkpointRoot, outputDir] = process.argv.slice(2);
assert(checkpointRoot && outputDir, 'Usage: npx tsx audit.mjs CHECKPOINTS_ROOT OUTPUT_DIR');
const repo = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const stateSha = state => sha(JSON.stringify(state));
const sourceRevision = '2485af40046793f1856829fa1161dc4431942aa7';
const manifestPins = [
  'e4615d5a01c18d7b6adba9f3eec12c570f0ab14041266e947305674c04e2b93d',
  '766a84d5db46f5a91777f885f11c0a249b3e84aec3169635216201efb1b3553e',
  '0a1f2527ced012082f4127516680f5b5d95e16ca469881bcc8708fe4a37478e0',
];
const coveragePath = 'docs/verification/eb-weight/coverage56/three-seed-2485af4.json.gz';
const coverageBytes = readFileSync(join(repo, coveragePath));
assert.equal(sha(coverageBytes), '65267a7d46e52cd0b22385625bffed6beae31e4837168db69c6ee954fac757cb');
const coverage = JSON.parse(gunzipSync(coverageBytes));
assert.equal(coverage.sourceRevision, sourceRevision);
assert.equal(coverage.entries.length, 56);
const [{ decodeSave }, { traceInRange }, { traceGroups }, { yearResults }, { BALANCE }, homeCards, variants] = await Promise.all([
  import('../../../src/save/saveCodec.ts'), import('../../../src/engine/decisionReads.ts'),
  import('../../../src/ui/results/decisionThread.ts'), import('../../../src/ui/results/yearResults.ts'),
  import('../../../src/content/balanceConfig.ts'),
  import('../../../src/ui/lordCardsModel.ts'), import('../../../src/engine/registryVariants.ts'),
]);
const readerPaths = ['src/save/saveCodec.ts', 'src/engine/decisionReads.ts', 'src/ui/results/decisionThread.ts',
  'src/ui/results/yearResults.ts', 'src/ui/chronicle/historyIndex.ts', 'src/content/balanceConfig.ts',
  'src/ui/lordCardsModel.ts', 'src/engine/registryVariants.ts', 'src/content/registry/registryVariantConfig.ts'];
const inputPins = [];
const observations = [];
const errors = [];
const roadOpen = new Map();
const roadAnswers = new Map();

function keepUnique(map, value, witness) {
  const key = JSON.stringify(value);
  const found = map.get(key);
  if (found) { found.checkpointCount += 1; found.lastWitness = witness; }
  else map.set(key, { ...value, checkpointCount: 1, firstWitness: witness, lastWitness: witness });
}

function inspectRoad(seed, file, state, results, yearStartTick, allStateRows, yearRows) {
  const witness = { file, tick: state.tick };
  const selected = homeCards.homePetitionView(state);
  for (const petition of homeCards.openHomePetitions(state).filter(item => item.kind === 'road_bridge')) {
    const variant = variants.estatePetitionVariantFor(state, petition.id);
    const selectedByCard = selected?.petitionId === petition.id;
    keepUnique(roadOpen, { seed, petitionId: petition.id, offeredTick: petition.tick, deadline: petition.deadline,
      variant, selectedByCard, selectedTitle: selectedByCard ? selected.title : null,
      proof: 'current-reader-on-historical-open-petition-not-original-screen' }, witness);
  }
  const recordIndex = new Map((state.history?.records ?? []).map(record => [record.id, record]));
  for (const decision of state.trace?.decisions ?? []) {
    if (!/^manor_petition:road_bridge:(granted|refused)$/.test(decision.source)) continue;
    const history = recordIndex.get(decision.id);
    if (!history) continue;
    const yearItem = results?.items.find(item => item.decisionId === decision.id) ?? null;
    const rows = yearRows.filter(row => row.decisionId === decision.id);
    const allRows = yearItem === null ? allStateRows.filter(row => row.decisionId === decision.id) : rows;
    keepUnique(roadAnswers, { seed, answerId: decision.id, decisionTick: decision.tick, source: decision.source,
      by: decision.by, historyTemplate: history.template, petitionId: history.params?.subjectId ?? null,
      chosen: history.decision?.chosen ?? history.params?.chosen ?? null, yearStartTick,
      yearItem, included: yearItem !== null, currentYearTraceCount: rows.length,
      reason: yearItem ? 'included' : decision.by === 'steward' && rows.length ? 'steward_excluded'
        : allRows.length && !rows.length ? 'outside_current_year' : 'no_trace_in_observed_state',
      variantProvenance: 'variant-provenance-unconfirmed',
      limit: 'v55 has no answered variant ID; road_bridge source does not prove ck_evt_056 was shown' }, witness);
  }
}

function inspect(seed, directory, pair, kind) {
  const checkpoint = pair[kind];
  assert.equal(basename(checkpoint.file), checkpoint.file, 'Checkpoint filename must stay within seed directory');
  const compressed = readFileSync(join(directory, checkpoint.file));
  assert.equal(compressed.byteLength, checkpoint.bytes, `${checkpoint.file}: compressed bytes`);
  assert.equal(sha(compressed), checkpoint.fileSha256, `${checkpoint.file}: compressed SHA`);
  const bytes = gunzipSync(compressed);
  assert.equal(sha(bytes), checkpoint.encodedSaveSha256, `${checkpoint.file}: encoded save SHA`);
  const raw = JSON.parse(bytes);
  const decoded = decodeSave(bytes);
  const state = decoded.envelope.state;
  const rawStateSha256 = stateSha(raw.state);
  const decodedStateSha256 = stateSha(state);
  assert.equal(state.tick, checkpoint.observedTick);
  assert.equal(raw.state.tick, state.tick);
  assert.equal(state.seed, seed);
  assert.equal(raw.state.seed, seed);
  const changedTopLevelKeys = [...new Set([...Object.keys(raw.state), ...Object.keys(state)])]
    .filter(key => JSON.stringify(raw.state[key]) !== JSON.stringify(state[key])).sort();
  const yearStartTick = state.tick - state.tick % BALANCE.TICKS_PER_YEAR;
  const records = state.history?.records ?? [];
  const decisionRecord = records.find(record => record.id === pair.decisionId) ?? null;
  const target = row => row.decisionId === pair.decisionId;
  const allStateRows = traceInRange(state, 0, state.tick + 1);
  const yearRows = traceInRange(state, yearStartTick, state.tick + 1);
  const allTimeRows = allStateRows.filter(target);
  const targetYearRows = yearRows.filter(target);
  const groups = traceGroups(state, targetYearRows);
  const group = groups.find(item => item.decisionId === pair.decisionId) ?? null;
  const results = yearResults(state);
  const yearItem = results?.items.find(item => item.decisionId === pair.decisionId) ?? null;
  const originalTargetHistory = kind === 'consequence'
    ? (raw.state.history?.records ?? []).find(record => record.id === checkpoint.historyId) ?? null : null;
  const targetHistory = kind === 'consequence' ? records.find(record => record.id === checkpoint.historyId) ?? null : null;
  if (kind === 'consequence') {
    assert(originalTargetHistory?.because?.some(target), `${checkpoint.file}: original target because missing`);
    assert.deepEqual(originalTargetHistory.because, checkpoint.because, `${checkpoint.file}: manifest because`);
    if (!targetHistory?.because?.some(target)) errors.push({ seed, file: checkpoint.file, reason: 'migration_lost_target_because' });
    if (!allTimeRows.some(row => row.recordId === checkpoint.historyId)) errors.push({ seed, file: checkpoint.file, reason: 'reader_lost_target_consequence' });
  }
  const reason = yearItem !== null ? 'included'
    : allTimeRows.length === 0 ? (kind === 'answer' ? 'no_trace_yet_at_answer' : 'no_trace_at_consequence')
    : targetYearRows.length === 0 ? 'outside_current_year'
    : decisionRecord === null ? 'missing_decision_record'
    : group?.by === 'steward' ? 'steward_excluded' : 'unexplained_reader_exclusion';
  if (reason === 'unexplained_reader_exclusion') errors.push({ seed, file: checkpoint.file, reason });
  if (yearItem !== null) assert.equal(yearItem.count, targetYearRows.length);
  inspectRoad(seed, checkpoint.file, state, results, yearStartTick, allStateRows, yearRows);
  assert.equal(stateSha(state), decodedStateSha256, 'Read models mutated decoded state');
  assert.equal(stateSha(raw.state), rawStateSha256, 'Original state mutated');
  return { seed, entryId: pair.entryId, choice: pair.source.split(':').at(-1), answerId: pair.decisionId,
    pairStatus: pair.status, pairSource: pair.source, decisionTick: pair.decisionTick, checkpointKind: kind,
    file: checkpoint.file, bytes: compressed.byteLength, compressedSha256: sha(compressed), encodedSaveSha256: sha(bytes),
    rawSchemaVersion: raw.schemaVersion, currentSchemaVersion: decoded.envelope.schemaVersion,
    migratedFrom: decoded.migratedFrom, rawStateSha256, decodedStateSha256, changedTopLevelKeys,
    observedTick: state.tick, yearStartTick, decisionRecord, originalTargetHistory, targetHistory,
    allTimeRows, targetYearRows, groupBy: group?.by ?? null, yearItem,
    totalYearResultCount: results?.count ?? 0, included: yearItem !== null, reason };
}

for (const seed of [1, 2, 3]) {
  const directory = join(checkpointRoot, `seed-${seed}`);
  const bytes = readFileSync(join(directory, 'manifest.json'));
  assert.equal(sha(bytes), manifestPins[seed - 1], `seed ${seed}: manifest SHA`);
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.sourceRevision, sourceRevision);
  assert.equal(manifest.dirtyPaths, '');
  inputPins.push({ seed, file: `seed-${seed}/manifest.json`, sha256: sha(bytes), sourceRevision,
    schemaVersion: manifest.schemaVersion, pairs: manifest.pairs.length });
  for (const pair of manifest.pairs) {
    observations.push(inspect(seed, directory, pair, 'answer'));
    if (pair.consequence) observations.push(inspect(seed, directory, pair, 'consequence'));
  }
}
const entries = coverage.entries.map(entry => {
  const rows = observations.filter(row => row.entryId === entry.id);
  const priorStewardAnswers = entry.seeds.reduce((sum, seed) => sum + (seed.counts?.stewardAnswered ?? 0), 0);
  const noInputReason = coverage.invalidOnlyIds.includes(entry.id) ? 'only_invalid_occurrences'
    : coverage.unobservedIds.includes(entry.id) ? 'unobserved_in_historical_cohort'
    : priorStewardAnswers > 0 ? 'steward_answers_not_retained_as_lord_checkpoints' : 'no_retained_checkpoint';
  return { entryId: entry.id, supportedChoices: entry.supportedChoices, priorStewardAnswers,
    verdict: rows.some(row => row.included) ? 'included' : rows.length ? 'not_included' : 'missing_input',
    reasons: [...new Set(rows.length ? rows.map(row => row.reason) : [noInputReason])],
    witnesses: rows.map(({ seed, answerId, choice, checkpointKind, included, reason }) => ({ seed, answerId, choice, checkpointKind, included, reason })) };
});
const report = { schemaVersion: 1, status: errors.length ? 'FAIL' : 'read_only_audit_complete_not_full56_visual_acceptance',
  sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  inputSourceRevision: sourceRevision, inputPins, coveragePin: { path: coveragePath, sha256: sha(coverageBytes) },
  readerPins: readerPaths.map(path => ({ path, sha256: sha(readFileSync(join(repo, path))) })),
  event056InAuditList: coverage.entries.some(entry => entry.id === 'ck_evt_056'),
  scope: 'Current decodeSave/traceInRange/traceGroups/yearResults on historical immutable checkpoints; no simulation, no UI automation, no fabricated state/ticks/causes.',
  limits: ['First-lord checkpoint per entry/seed only; missing input is not a trace failure.',
    'A year chip inclusion is the current read-model result, not a screenshot or natural-play observation.',
    'Historical steward counts are retained as context, not new steward checkpoint evidence.'],
  roadBridge056: { separateFromHistorical56: true, actualScreenVerified: false,
    open: [...roadOpen.values()], answers: [...roadAnswers.values()],
    uniqueOpenPetitions: new Set([...roadOpen.values()].map(row => `${row.seed}:${row.petitionId}`)).size,
    uniqueAnsweredDecisions: new Set([...roadAnswers.values()].map(row => `${row.seed}:${row.answerId}`)).size },
  counts: { entries: entries.length, checkpoints: observations.length,
    includedEntries: entries.filter(entry => entry.verdict === 'included').length,
    notIncludedEntries: entries.filter(entry => entry.verdict === 'not_included').length,
    missingInputEntries: entries.filter(entry => entry.verdict === 'missing_input').length }, entries, observations, errors };
mkdirSync(outputDir, { recursive: true });
writeFileSync(join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
const table = ['# EB-WEIGHT LS1-4 checkpoint read audit', '', `Status: ${report.status}`,
  `Reader: ${report.sourceRevision}; historical input: ${sourceRevision}.`,
  `ck_evt_056 belongs to the historical 56-entry audit: ${report.event056InAuditList}.`,
  'This table is current reader output over historical saves, not a new play run or full visual acceptance.', '',
  '| Event | LS1-4 | Checkpoints | Prior steward answers | Reasons |', '|---|---|---:|---:|---|',
  ...entries.map(entry => `| ${entry.entryId} | ${entry.verdict} | ${entry.witnesses.length} | ${entry.priorStewardAnswers} | ${entry.reasons.join(', ')} |`), '',
  `Separate road_bridge/056: ${report.roadBridge056.uniqueOpenPetitions} unique open petitions, ${report.roadBridge056.uniqueAnsweredDecisions} retained answered decisions.`,
  'Answered road_bridge results remain variant-provenance-unconfirmed: v55 does not record the variant ID. Current open-petition reader selection is not original screen evidence.', ''];
writeFileSync(join(outputDir, 'table.md'), table.join('\n'));
console.log(JSON.stringify({ status: report.status, counts: report.counts, errors }));
if (errors.length) process.exitCode = 1;
