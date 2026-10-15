// Offline archival only: preserves a finished official run without importing game or browser code.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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
let total = [...payload.values()].reduce((sum, bytes) => sum + bytes.length, 0);
if (total >= 3 * 1024 * 1024) {
  // Only the oversized path changes storage. Pack original fetched bytes, not JPEG recompressions or projected states.
  const temporary = mkdtempSync(join(tmpdir(), 'eb-weight-archive-'));
  try {
    const bundle = 'originals.tar.xz', bundlePath = join(temporary, bundle), list = join(temporary, 'members');
    for (const row of originals) {
      assert.ok(!row.source.includes('\0') && !row.source.includes('\n'), 'Unsafe tar member name');
      assert.equal(sha(readFileSync(join(input, row.source))), row.originalSha256, 'Fetched evidence changed');
    }
    writeFileSync(list, originals.map(row => `${row.source}\0`).join(''));
    execFileSync('tar', ['-cJf', bundlePath, '-C', input, '--null', '-T', list],
      { env: { ...process.env, COPYFILE_DISABLE: '1' }, stdio: 'pipe' });
    const extracted = join(temporary, 'verified'); mkdirSync(extracted);
    execFileSync('tar', ['-xJf', bundlePath, '-C', extracted], { stdio: 'pipe' });
    assert.deepEqual(files(extracted).map(path => relative(extracted, path)).sort(), originals.map(row => row.source).sort(),
      'Extracted tar members differ from the original evidence set');
    for (const row of originals) {
      const bytes = readFileSync(join(extracted, row.source));
      assert.equal(bytes.length, row.originalBytes, `Extracted size changed: ${row.source}`);
      assert.equal(sha(bytes), row.originalSha256, `Extracted hash changed: ${row.source}`);
    }
    const bundled = readFileSync(bundlePath);
    const loose = new Map(['final.jpg', 'live-case.json.gz', 'source-revision.txt']
      .filter(name => payload.has(name)).map(name => [name, payload.get(name)]));
    summary.storage = { mode: 'lossless_tar_xz_original_files', bundle, bundleBytes: bundled.length,
      bundleSha256: sha(bundled), originalPayloadBytes: total, extractedMembersVerified: originals.length,
      bundledPayloadFiles: originals.map(row => row.archive), looseReviewCopies: [...loose.keys()] };
    summary.originals = originals.map(row => ({ source: row.source, originalBytes: row.originalBytes,
      originalSha256: row.originalSha256, archive: bundle, member: row.source,
      memberBytes: row.originalBytes, memberSha256: row.originalSha256, encoding: 'tar_xz_original_bytes',
      ...(loose.has(row.archive) ? { reviewCopy: { archive: row.archive, encoding: row.encoding,
        archivedBytes: row.archivedBytes, archivedSha256: row.archivedSha256 } } : {}) }));
    const byArchive = new Map(originals.map(row => [row.archive, row]));
    const bundledReadme = readme.map(line => line.startsWith('- Original JSON/log bytes')
      ? '- All fetched evidence bytes are preserved in originals.tar.xz; loose review copies duplicate final.jpg, source-revision.txt and the losslessly gzipped report.'
      : line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (link, label, path) => {
        const row = byArchive.get(path);
        return row && !loose.has(path) ? `[${label} in bundle](${bundle}), member \`${row.source}\`` : link;
      }));
    bundledReadme.push('', 'Lossless size fallback:', '',
      `The ordinary archive was ${total} bytes. All ${originals.length} original members were extracted and matched by byte length and SHA256 before publication.`,
      'archive.json lists each bundled original path/hash and its former loose payload filename in storage.bundledPayloadFiles.',
      'Only storage changed: no JPEG was transformed, no fetched evidence was deleted, and the original result remains unchanged.',
      'Extract outside the repository into a fresh temporary directory, then verify every member:', '', '```sh',
      'archive="$(pwd)"', 'review_dir="$(mktemp -d "${TMPDIR:-/tmp}/eb-weight-review.XXXXXX")"',
      'tar -xJf "$archive/originals.tar.xz" -C "$review_dir"',
      '(cd "$review_dir" && shasum -a 256 -c "$archive/original-members.SHA256SUMS")', '```', '');
    payload.clear();
    for (const [name, bytes] of loose) payload.set(name, bytes);
    payload.set(bundle, bundled);
    payload.set('original-members.SHA256SUMS', Buffer.from(originals.map(row => `${row.originalSha256}  ${row.source}\n`).join('')));
    payload.set('archive.json', Buffer.from(`${JSON.stringify(summary, null, 2)}\n`));
    payload.set('README.md', Buffer.from(bundledReadme.join('\n')));
    payload.set('SHA256SUMS', Buffer.from([...payload].sort(([a], [b]) => a.localeCompare(b))
      .map(([name, bytes]) => `${sha(bytes)}  ${name}\n`).join('')));
    total = [...payload.values()].reduce((sum, bytes) => sum + bytes.length, 0);
  } finally {
    // This directory contains only newly created verification copies; fetched originals and existing archives are untouched.
    rmSync(temporary, { recursive: true, force: true });
  }
}
assert.ok(total < 3 * 1024 * 1024,
  `Archive would be ${total} bytes, not below 3 MiB. No evidence was deleted or written; fetched originals remain intact.`);
mkdirSync(output, { recursive: true });
for (const [name, bytes] of payload) {
  const path = join(output, name); mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes, { flag: 'wx' });
  assert.equal(sha(readFileSync(path)), sha(bytes), `Written archive hash mismatch: ${name}`);
}
console.log(JSON.stringify({ archive: output, bytes: total, verdict: summary.verdict, humanJpegReview: 'pending' }));
