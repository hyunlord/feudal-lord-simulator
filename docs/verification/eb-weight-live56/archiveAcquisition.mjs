// Offline acquisition evidence only: no game imports, simulation, or screen acceptance.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';

const [runId, fetchedRoot, archiveDirectory, ...extra] = process.argv.slice(2);
assert.ok(runId && fetchedRoot && archiveDirectory && !extra.length,
  'Usage: node archiveAcquisition.mjs RUN_ID FETCHED_ROOT ARCHIVE_DIR');
assert.match(runId, /^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const supplied = resolve(fetchedRoot);
const input = realpathSync(basename(supplied) === runId ? supplied : join(supplied, runId));
const output = resolve(archiveDirectory), cap = 3 * 1024 * 1024;
assert.ok(output !== input && !output.startsWith(`${input}${sep}`), 'Archive must be outside the fetched run');
assert.ok(!existsSync(output) || readdirSync(output).length === 0, 'Refusing to overwrite evidence');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const files = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  assert.ok(!entry.isSymbolicLink(), `Symlink is not evidence: ${join(directory, entry.name)}`);
  return entry.isDirectory() ? files(join(directory, entry.name)) : entry.isFile() ? [join(directory, entry.name)] : [];
}).sort();
const exitPath = join(input, 'exit-code');
assert.ok(existsSync(exitPath), 'No terminal exit-code; do not archive a running acquisition');
const exitText = readFileSync(exitPath, 'utf8').trim();
assert.match(exitText, /^\d{1,3}$/);
const exitCode = Number(exitText); assert.ok(exitCode <= 255);
const inputFiles = files(input);
const reports = inputFiles.filter(path => /^acquisition\.json(?:\.gz)?$/.test(basename(path)));
assert.equal(reports.length, 1, 'Expected exactly one acquisition report per logical run');
const reportPath = reports[0], reportDirectory = dirname(reportPath);
const packedReport = readFileSync(reportPath);
const reportBytes = reportPath.endsWith('.gz') ? gunzipSync(packedReport) : packedReport;
const report = JSON.parse(reportBytes);
assert.equal(report.schemaVersion, 1, 'Expected one of the four schema-1 acquisition producers');
assert.ok(Array.isArray(report.errors) && Array.isArray(report.offered) && Array.isArray(report.targetsFound));
const checks = [], saves = [], externalReferences = [];
const check = (condition, reason) => { if (!condition) checks.push(reason); };
check(/^[a-f0-9]{40}$/.test(report.toolRevision), 'invalid_tool_revision');
check(/^[a-f0-9]{40}$/.test(report.product), 'invalid_product_revision');
check(typeof report.found === 'boolean', 'missing_found_flag');
check(exitCode === (report.errors.length ? 1 : report.found ? 0 : 2), 'report_and_terminal_exit_disagree');
check(report.errors.length ? report.status === 'error' : report.found
  ? ['targets_acquired', 'at_least_one_target_acquired'].includes(report.status)
  : report.status === 'bounded_search_no_target', 'report_status_disagrees_with_result');
const targets = report.targets ?? report.case?.targets ?? [];
assert.ok(Array.isArray(targets), 'Malformed target list');
check(targets.length > 0, 'missing_targets');
if (report.found) check(report.targetsFound.length > 0, 'acquired_flag_without_target');
if (report.status === 'targets_acquired') check(targets.every(id => report.targetsFound.includes(id)), 'incomplete_targets_claim');
for (const id of report.targetsFound) check(report.offered.some(row => row.entryId === id && row.file), `target_without_save:${id}`);
function inspectReferences(value, location = 'report') {
  if (!value || typeof value !== 'object') return;
  if (typeof value.file === 'string' && (value.gzipSha256 || value.encodedSha256 || value.stateSha256)) {
    const path = resolve(reportDirectory, value.file);
    if (isAbsolute(value.file)) externalReferences.push({ location, ...value, retainedByPath: false });
    else {
      const row = { location, file: value.file, expected: value, valid: false };
      try {
        assert.ok(path.startsWith(`${reportDirectory}${sep}`), 'Reference leaves the case directory');
        const compressed = readFileSync(path), raw = gunzipSync(compressed), encoded = JSON.parse(raw);
        const state = encoded.state ?? encoded;
        Object.assign(row, { gzipSha256: sha(compressed), encodedSha256: sha(raw),
          stateSha256: sha(JSON.stringify(state)), tick: state.tick, schemaVersion: encoded.schemaVersion ?? 0 });
        for (const key of ['gzipSha256', 'encodedSha256', 'stateSha256', 'tick']) {
          if (value[key] !== undefined) assert.equal(row[key], value[key], `${key} differs`);
        }
        row.valid = true;
      } catch (error) { row.error = String(error); checks.push(`save_integrity:${location}:${row.error}`); }
      saves.push(row);
    }
  }
  for (const [key, item] of Object.entries(value)) inspectReferences(item, `${location}.${key}`);
}
inspectReferences(report);
if (typeof report.input === 'string') externalReferences.push({ location: 'report.input', file: report.input,
  originalSha256: report.expectedInputSha256 ?? null, retainedByPath: false });
const originals = inputFiles.map(path => {
  const bytes = readFileSync(path), source = relative(input, path);
  assert.ok(!/[\0\r\n]/.test(source), 'Unsafe archive member name');
  return { source, originalBytes: bytes.length, originalSha256: sha(bytes) };
});
for (const reference of externalReferences) {
  const pin = reference.originalSha256 ?? reference.gzipSha256;
  reference.matchingFetchedFiles = pin ? originals.filter(row => row.originalSha256 === pin).map(row => row.source) : [];
}
const summary = { schemaVersion: 1, runId, officialExitCode: exitCode, originalStatus: report.status,
  inputAcquisition: checks.length ? 'unconfirmed_due_to_evidence_errors'
    : report.errors.length ? 'error' : report.found ? 'input_acquired' : 'bounded_search_no_target',
  uiGate: 'not_tested', archiveIntegrity: checks.length ? 'errors' : 'verified', checks,
  caseId: report.caseId ?? report.case?.id ?? null, productRevision: report.product, toolRevision: report.toolRevision,
  targets, targetsFound: report.targetsFound, allTargetsFound: targets.every(id => report.targetsFound.includes(id)),
  startTick: report.startTick ?? null, endTick: report.endTick ?? null, originalErrors: report.errors,
  provenance: report.provenance, limits: report.limits ?? report.provenance?.limits ?? [],
  input: report.input, externalReferences, saves, originals,
  reportSource: relative(input, reportPath), reportDecodedSha256: sha(reportBytes) };
const reportName = 'acquisition.json.gz';
const reviewReport = reportPath.endsWith('.gz') ? packedReport : gzipSync(reportBytes, { level: 9 });
assert.ok(gunzipSync(reviewReport).equals(reportBytes));
const checksums = entries => Buffer.from([...entries].sort(([a], [b]) => a.localeCompare(b))
  .map(([name, bytes]) => `${sha(bytes)}  ${name}\n`).join(''));
function finish(payload, storage, members) {
  summary.storage = storage;
  summary.originals = members;
  payload.set(reportName, reviewReport);
  payload.set('exit-code', readFileSync(exitPath));
  payload.set('archive.json', Buffer.from(`${JSON.stringify(summary, null, 2)}\n`));
  const readme = [
    `# Acquisition evidence: ${runId}`, '',
    `Input result: **${summary.inputAcquisition}**; UI gate: **not tested**.`,
    `Original status: ${report.status}; terminal exit: ${exitCode}; archive integrity: ${summary.archiveIntegrity}.`,
    `Product: \`${report.product}\`; tool: \`${report.toolRevision}\`.`,
    `Targets: ${targets.join(', ')}; reported acquired: ${report.targetsFound.join(', ') || 'none'}.`,
    `Ticks: ${summary.startTick} → ${summary.endTick}. All targets acquired: ${summary.allTargetsFound}.`, '',
    '[Original report](acquisition.json.gz) and [terminal receipt](exit-code) are retained unchanged in content.',
    'archive.json records every fetched file, original errors, provenance, save checks and storage mapping.',
    'All fetched files are retained; external input paths are not fetched by this tool. Matching raw inputs, if present, are identified by SHA.',
    'The initial admitted save is not a claim to retain the original external raw input container.', '',
    `Storage: ${storage.mode}. Verify repository files with \`shasum -a 256 -c SHA256SUMS\`.`,
    ...(storage.bundle ? [
      `Extract [${storage.bundle}](${storage.bundle}) outside the repository and verify every member:`, '', '```sh',
      'archive="$(pwd)"', 'review_dir="$(mktemp -d "${TMPDIR:-/tmp}/eb-weight-acquisition.XXXXXX")"',
      `tar -xJf "$archive/${storage.bundle}" -C "$review_dir"`,
      '(cd "$review_dir" && shasum -a 256 -c "$archive/content-members.SHA256SUMS")', '```', '' ] : []),
    ...(storage.exactDecodedSaveMembers ? [
      'Size fallback stores exact gunzip output bytes for save files; no JSON parse/reserialization is used for storage.',
      'Their original gzip containers are NOT retained in this repository and byte-exact reconstruction is not supported.',
      'archive.json separates original gzip SHA/size from extracted decoded SHA/size. Fetched originals remain untouched.',
      'Every other bundled file keeps its original bytes; each extracted member was verified by size and SHA.', '' ] : []),
    'Limits: input acquisition is not a UI test, screen acceptance, event outcome, frequency measurement or natural-cohort claim.',
    'This utility runs no game, browser, codec migration or simulation. Original provenance and errors govern interpretation.',
    ...report.errors.map(error => `- Original error: ${JSON.stringify(error)}`),
    ...checks.map(error => `- Archive check: ${error}`), '' ];
  payload.set('README.md', Buffer.from(readme.join('\n')));
  payload.set('SHA256SUMS', checksums(payload));
  return payload;
}
const size = payload => [...payload.values()].reduce((sum, bytes) => sum + bytes.length, 0);
const loose = new Map(), looseMembers = originals.map(row => {
  const raw = readFileSync(join(input, row.source)), compress = /\.(json|log)$/.test(row.source);
  const name = join('files', `${row.source}${compress ? '.gz' : ''}`);
  assert.ok(!loose.has(name), `Filename collision: ${name}`);
  const bytes = compress ? gzipSync(raw, { level: 9 }) : raw;
  if (compress) assert.ok(gunzipSync(bytes).equals(raw));
  loose.set(name, bytes);
  return { ...row, archive: name, archivedBytes: bytes.length, archivedSha256: sha(bytes),
    encoding: compress ? 'lossless_gzip' : 'unchanged_bytes' };
});
let payload = finish(loose, { mode: 'loose_lossless_files', fetchedOriginalsRetained: true }, looseMembers);
if (size(payload) >= cap) {
  const temporary = mkdtempSync(join(tmpdir(), 'eb-acquisition-archive-'));
  try {
    for (const decodeStates of [false, true]) {
      const stage = join(temporary, `stage-${decodeStates}`), verified = join(temporary, `verified-${decodeStates}`);
      mkdirSync(stage); mkdirSync(verified);
      const members = originals.map(row => {
        const original = readFileSync(join(input, row.source));
        assert.equal(sha(original), row.originalSha256, 'Fetched evidence changed');
        let bytes = original, decoded = false;
        if (decodeStates && /\.(save|state)\.json\.gz$/.test(row.source)) {
          try { bytes = gunzipSync(original); decoded = true; } catch { /* Preserve invalid containers as originally fetched. */ }
        }
        const member = decoded ? `${row.source}.decoded` : row.source;
        mkdirSync(dirname(join(stage, member)), { recursive: true });
        writeFileSync(join(stage, member), bytes, { flag: 'wx' });
        return { ...row, archive: 'evidence.tar.xz', member, memberBytes: bytes.length, memberSha256: sha(bytes),
          encoding: decoded ? 'tar_xz_exact_gunzip_content' : 'tar_xz_original_bytes',
          ...(decoded ? { originalGzipSha256: row.originalSha256, originalGzipBytes: row.originalBytes,
            decodedSha256: sha(bytes), decodedBytes: bytes.length, originalGzipRetainedInRepository: false,
            originalGzipReconstruction: 'not_supported' } : {}) };
      });
      const list = join(temporary, 'members'); writeFileSync(list, members.map(row => `${row.member}\0`).join(''));
      const bundle = join(temporary, 'evidence.tar.xz');
      execFileSync('tar', ['-cJf', bundle, '-C', stage, '--null', '-T', list],
        { env: { ...process.env, COPYFILE_DISABLE: '1' }, stdio: 'pipe' });
      execFileSync('tar', ['-xJf', bundle, '-C', verified], { stdio: 'pipe' });
      assert.deepEqual(files(verified).map(path => relative(verified, path)).sort(), members.map(row => row.member).sort());
      for (const row of members) {
        const bytes = readFileSync(join(verified, row.member));
        assert.equal(bytes.length, row.memberBytes); assert.equal(sha(bytes), row.memberSha256);
      }
      const bytes = readFileSync(bundle);
      payload = finish(new Map([['evidence.tar.xz', bytes], ['content-members.SHA256SUMS',
        Buffer.from(members.map(row => `${row.memberSha256}  ${row.member}\n`).join(''))]]), {
        mode: decodeStates ? 'lossless_decoded_save_content_tar_xz' : 'lossless_original_files_tar_xz',
        bundle: 'evidence.tar.xz', bundleBytes: bytes.length, bundleSha256: sha(bytes),
        extractedMembersVerified: members.length, fetchedOriginalsRetained: true,
        exactDecodedSaveMembers: members.filter(row => row.encoding === 'tar_xz_exact_gunzip_content').length }, members);
      if (size(payload) < cap) break;
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
assert.ok(size(payload) < cap, `Complete evidence exceeds 3 MiB (${size(payload)} bytes); no archive written or evidence deleted`);
for (const row of originals) assert.equal(sha(readFileSync(join(input, row.source))), row.originalSha256, 'Fetched evidence changed');
mkdirSync(output, { recursive: true });
for (const [name, bytes] of payload) {
  const path = join(output, name); mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes, { flag: 'wx' }); assert.equal(sha(readFileSync(path)), sha(bytes));
}
console.log(JSON.stringify({ runId, archive: output, bytes: size(payload), files: originals.length,
  acquisition: summary.inputAcquisition, uiGate: summary.uiGate, integrity: summary.archiveIntegrity, storage: summary.storage.mode }));
if (checks.length) process.exitCode = 2;
