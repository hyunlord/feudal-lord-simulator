// Offline archival only: preserves a finished official run without importing game or browser code.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const [runId, fetchedRoot, archiveDirectory, ...extra] = process.argv.slice(2);
assert.ok(runId && fetchedRoot && archiveDirectory && extra.length === 0,
  'Usage: node archiveCase.mjs RUN_ID FETCHED_ROOT ARCHIVE_DIR');
assert.match(runId, /^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const supplied = resolve(fetchedRoot);
const input = realpathSync(basename(supplied) === runId ? supplied : join(supplied, runId));
const output = resolve(archiveDirectory);
assert.ok(output !== input && !output.startsWith(`${input}${sep}`), 'Archive must be outside the fetched run');
assert.ok(!existsSync(output) || readdirSync(output).length === 0, 'Refusing to overwrite an existing archive');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  assert.ok(!entry.isSymbolicLink(), `Symlink is not archival evidence: ${join(directory, entry.name)}`);
  return entry.isDirectory() ? files(join(directory, entry.name)) : entry.isFile() ? [join(directory, entry.name)] : [];
});
const exitFile = join(input, 'exit-code');
assert.ok(existsSync(exitFile), 'No fetched exit-code: the official run is not confirmed finished');
const exitText = readFileSync(exitFile, 'utf8').trim();
assert.match(exitText, /^\d{1,3}$/, 'Malformed official exit-code');
const exitCode = Number(exitText);
assert.ok(exitCode <= 255, 'Invalid official exit-code');
const reports = files(input).filter(path => basename(path) === 'live-case.json');
assert.equal(reports.length, 1, 'Expected exactly one live-case.json in this official run');
const reportPath = reports[0], caseDirectory = dirname(reportPath);
const reportBytes = readFileSync(reportPath), report = JSON.parse(reportBytes);
assert.equal(report.schemaVersion, 1);
assert.equal(report.mode, 'one_historical_answer_current_UI_natural_10x');
assert.match(report.entryId, /^ck_evt_\d{3}$/);
assert.equal(basename(caseDirectory), report.entryId, 'Report and case directory disagree');
assert.ok(Array.isArray(report.states) && Array.isArray(report.errors), 'Malformed live-case evidence');
const sourceFile = join(caseDirectory, 'source-revision.txt');
const toolRevision = readFileSync(sourceFile, 'utf8').trim();
assert.match(toolRevision, /^[a-f0-9]{40}$/);
const contractBytes = readFileSync(new URL('../../design/engine-B-outcomes.json', import.meta.url));
const event = JSON.parse(contractBytes).events.find(item => item.id === report.entryId);
assert.ok(event?.choices.some(choice => choice.id === report.choice), 'Event/choice absent from the canonical contract');

const checks = [], stateChecks = [], decisionSources = new Set();
const check = (condition, reason) => { if (!condition) checks.push(reason); };
check(report.toolRevision === toolRevision, 'source_revision_disagrees_with_report');
for (const snapshot of report.states) {
  try {
    assert.equal(basename(snapshot.stateFile), snapshot.stateFile);
    assert.equal(basename(snapshot.screen), snapshot.screen);
    assert.match(snapshot.stateFile, /\.state\.json\.gz$/);
    assert.match(snapshot.screen, /\.jpg$/);
    const compressed = readFileSync(join(caseDirectory, snapshot.stateFile));
    const raw = gunzipSync(compressed), state = JSON.parse(raw);
    const jpeg = readFileSync(join(caseDirectory, snapshot.screen));
    const valid = sha(compressed) === snapshot.compressedSha256 && sha(raw) === snapshot.sha256
      && state.tick === snapshot.tick && jpeg[0] === 0xff && jpeg[1] === 0xd8 && jpeg[2] === 0xff;
    check(valid, `snapshot_integrity_failed:${snapshot.label}`);
    stateChecks.push({ label: snapshot.label, tick: state.tick, stateFile: snapshot.stateFile,
      stateSha256: sha(raw), compressedSha256: sha(compressed), screen: snapshot.screen, screenSha256: sha(jpeg), valid });
    const decision = state.trace?.decisions?.find(row => row.id === report.answerId);
    if (decision?.source) decisionSources.add(decision.source);
  } catch (error) {
    checks.push(`snapshot_unreadable:${snapshot.label}:${String(error)}`);
  }
}
const expectedSource = `registry:${report.entryId}:${report.choice}`;
check(decisionSources.size === 1 && decisionSources.has(expectedSource), 'selected_answer_source_not_confirmed');
const manual = report.manual, automatic = report.automatic;
const titleMatches = typeof manual?.expectedFact === 'string' && manual.expectedFact.includes(event.title);
const actualFactMatches = titleMatches && manual.facts?.filter(text => text === manual.expectedFact).length === 1
  && manual.visibleFacts?.filter(row => row.text === manual.expectedFact && row.exposed === true).length === 1;
const navigationUnchanged = manual?.stateUnchanged === true && /^[a-f0-9]{64}$/.test(manual.beforeSha256)
  && manual.beforeSha256 === manual.afterSha256;
const realReceipts = (report.receipts ?? []).filter(row => row.semanticMatch && row.actualEvidence
  && row.because?.some(cause => cause.decisionId === report.answerId));
check(exitCode === 0, `official_exit_code:${exitCode}`);
check(report.valid === true, 'original_report_valid_is_not_true');
check(report.errors.length === 0, 'original_report_has_errors');
check(report.states.length > 0, 'no_state_or_jpeg_evidence');
check(titleMatches, 'canonical_title_missing_from_manual_expected_fact');
check(actualFactMatches && manual?.targetCaptured === true, 'exact_manual_fact_not_confirmed_exposed');
check(navigationUnchanged, 'manual_navigation_state_hash_not_confirmed');
check(automatic?.evidenceKind === 'automatic_yearly_aggregation' && automatic.chip?.exposed === true
  && automatic.target?.decisionId === report.answerId && automatic.exactNewRows?.length > 0,
'automatic_exact_answer_aggregation_not_confirmed');
check(realReceipts.length > 0, 'no_new_exact_receipt_with_actual_effect_evidence');
check(report.progressAtTen === true, 'normal_10x_progress_not_confirmed');
const pass = checks.length === 0;

const payload = new Map(), originals = [];
function addOriginal(path, destination) {
  const original = readFileSync(path);
  const compress = /\.(json|log)$/.test(destination);
  const name = compress ? `${destination}.gz` : destination;
  assert.ok(!payload.has(name), `Archive filename collision: ${name}`);
  const bytes = compress ? gzipSync(original, { level: 9 }) : original;
  if (compress) assert.ok(gunzipSync(bytes).equals(original), 'Gzip round trip changed original bytes');
  payload.set(name, bytes);
  originals.push({ source: relative(input, path), archive: name, originalBytes: original.length,
    originalSha256: sha(original), archivedBytes: bytes.length, archivedSha256: sha(bytes),
    encoding: compress ? 'lossless_gzip' : 'unchanged_bytes' });
}
for (const path of files(caseDirectory)) addOriginal(path, relative(caseDirectory, path));
for (const entry of readdirSync(input, { withFileTypes: true })) {
  if (entry.isFile()) addOriginal(join(input, entry.name), join('runner', entry.name));
}
const summary = { schemaVersion: 1, runId, entryId: report.entryId, choice: report.choice,
  answerId: report.answerId, officialExitCode: exitCode, originalValid: report.valid,
  verdict: pass ? 'PASS_automated_only_pending_human_JPEG_review' : 'FAIL', humanJpegReview: 'pending',
  productRevision: report.productRevision, historicalSourceRevision: report.sourceRevision, toolRevision,
  canonicalContractSha256: sha(contractBytes), canonicalTitle: event.title, canonicalTitleMatches: titleMatches,
  selectedSource: [...decisionSources], expectedSource, originalReportSha256: sha(reportBytes),
  stop: report.stop ?? null, absence: report.absence ?? null, errors: report.errors, archiveChecks: checks,
  metrics: { initialTick: report.initial?.tick ?? report.startTick, finalTick: report.final?.tick ?? null,
    initialYearCount: report.initial?.results?.count ?? null, automaticYearCount: automatic?.results?.count ?? null,
    exactReceiptCount: report.receipts?.length ?? 0, actualEffectReceiptCount: realReceipts.length,
    exactNewRowCount: automatic?.exactNewRows?.length ?? 0, progressAtTen: report.progressAtTen === true,
    manualTargetCaptured: manual?.targetCaptured ?? null, navigationUnchanged: manual ? navigationUnchanged : null },
  manualExpectedFact: manual?.expectedFact ?? null, manualBeforeSha256: manual?.beforeSha256 ?? null,
  manualAfterSha256: manual?.afterSha256 ?? null, states: stateChecks, originals, limits: report.limits ?? [] };
payload.set('archive.json', Buffer.from(`${JSON.stringify(summary, null, 2)}\n`));
const shown = value => value === null || value === undefined ? 'not observed' : String(value).replaceAll('|', '\\|').replaceAll('\n', ' ');
const readme = [
  `# ${report.entryId}/${report.choice} — ${event.title}`, '',
  `Status: **${pass ? 'PASS — automated checks only; human JPEG review pending' : 'FAIL — original failure retained; human JPEG review pending'}**.`, '',
  `Official run: \`${runId}\`; exit ${exitCode}; original valid: ${report.valid}.`,
  `Product: \`${report.productRevision}\`; historical input: \`${report.sourceRevision}\`; tool: \`${toolRevision}\`.`,
  `Selected source observed: ${[...decisionSources].map(value => `\`${value}\``).join(', ') || 'not observed'}. Answer: \`${report.answerId}\`.`, '',
  '| Metric | Observed |', '|---|---|',
  ...Object.entries(summary.metrics).map(([key, value]) => `| ${key} | ${shown(value)} |`), '',
  `Canonical title in actual manual expected fact: ${titleMatches}. Fact: ${shown(manual?.expectedFact)}.`,
  `Manual navigation SHA: \`${shown(manual?.beforeSha256)}\` → \`${shown(manual?.afterSha256)}\`.`,
  `Stop: ${shown(report.stop)}. Absence: ${shown(report.absence)}.`, '',
  'Original errors and archive checks:', '',
  ...[...report.errors, ...checks].map(value => `- ${shown(value)}`),
  ...(!report.errors.length && !checks.length ? ['- None.'] : []), '',
  'State and unchanged JPEG evidence:', '',
  ...stateChecks.map(row => `- ${row.label}@${row.tick}: [JPEG](${row.screen}), [state](${row.stateFile}), SHA \`${row.stateSha256}\`; integrity ${row.valid}.`), '',
  'Limits:', '',
  '- No human image review is claimed. Review the original JPEG files before visual acceptance.',
  '- This archive performs file and report checks only; it runs no game, browser, or simulation.',
  '- Original JSON/log bytes are losslessly gzipped; JPEG/state gzip/source revision bytes are unchanged.',
  '- The original report, including all errors and results, is retained in live-case.json.gz; archive.json adds checks without rewriting it.',
  ...(report.limits ?? []).map(value => `- ${shown(value)}`), '',
  'Verify the retained files with `shasum -a 256 -c SHA256SUMS` from this directory.', '' ];
payload.set('README.md', Buffer.from(readme.join('\n')));
payload.set('SHA256SUMS', Buffer.from([...payload].sort(([a], [b]) => a.localeCompare(b))
  .map(([name, bytes]) => `${sha(bytes)}  ${name}\n`).join('')));
const total = [...payload.values()].reduce((sum, bytes) => sum + bytes.length, 0);
assert.ok(total < 3 * 1024 * 1024,
  `Archive would be ${total} bytes, not below 3 MiB. No evidence was deleted or written; fetched originals remain intact.`);
mkdirSync(output, { recursive: true });
for (const [name, bytes] of payload) {
  const path = join(output, name); mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes, { flag: 'wx' });
  assert.equal(sha(readFileSync(path)), sha(bytes), `Written archive hash mismatch: ${name}`);
}
console.log(JSON.stringify({ archive: output, bytes: total, verdict: summary.verdict, humanJpegReview: 'pending' }));
