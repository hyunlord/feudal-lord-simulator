// check:merge step: the tests the range picks passed on the pushed content (decision RR16, 2026-10-06), or on an earlier
// content whose differences none of them reads (decision RR25, 2026-10-09).
// `npm run test:changed` (scripts/checks/changedTests.mjs) writes a record per run: on the Mac
// .remote-runs/test-changed/<tree>.json, on the DGX .remote/test-changed.json, which run.sh brings back as
// .remote-runs/<run>/test-changed.json. A required test (one the range base..head picks) is covered by a passing record
// that ran it when either
//  - the record's tree is <head>'s tree (the same content), or
//  - between the record's tree and <head>'s tree no changed file is one the test reads: none picks it again by an import
//    (direct or through other files), by naming its path, by the source-scan list (RR24) or by the lock files. The
//    trunk moving under a long gate, a merge's resolution and later own edits are all in that one tree difference.
// A test with an overlap is run again (on the new content); the others keep their result. No test picked (documents,
// data no test reads): passes without a record. The output names, per reused record, "no overlap" and the number of
// files that changed since it, and per test still to run, the changed files it reads.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pickTests } from './pickTests.mjs';

/** Every test:changed record this checkout has, newest first. */
export function testedRecords(top) {
  const dir = join(top, '.remote-runs');
  if (!existsSync(dir)) return [];
  const files = [];
  const own = join(dir, 'test-changed');
  if (existsSync(own)) for (const f of readdirSync(own)) if (f.endsWith('.json')) files.push(join(own, f));
  for (const run of readdirSync(dir)) { const f = join(dir, run, 'test-changed.json'); if (existsSync(f)) files.push(f); }
  return files.flatMap(file => { try { return [{ file, ...JSON.parse(readFileSync(file, 'utf8')) }]; } catch { return []; } })
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

const treeKnown = (work, tree) => { try { execFileSync('git', ['cat-file', '-e', `${tree}^{tree}`], { cwd: work, stdio: 'ignore' }); return true; } catch { return false; } };

/**
 * Which of `required` the passing records cover on `headTree` (the content in `work`). covered: test -> { record, how:
 * 'same' | 'reused', changed (files between the record's tree and headTree) }; overlaps: test -> { record, files } (the
 * newest record that ran it, and the changed files it reads); uncovered: the tests to run again.
 */
export function testCoverage({ top, work, required, headTree, records = testedRecords(top) }) {
  const passing = records.filter(r => r.passed && typeof r.tree === 'string');
  const between = new Map();   // record tree -> { causes, changed } | null (a tree this checkout does not have)
  const diff = tree => {
    if (!between.has(tree)) {
      if (!treeKnown(work, tree)) between.set(tree, null);
      else { const { causes, changed } = pickTests({ root: work, base: tree, head: headTree }); between.set(tree, { causes, changed: changed.size }); }
    }
    return between.get(tree);
  };
  const covered = new Map(); const overlaps = new Map();
  for (const test of required) {
    for (const record of passing) {
      if (!(record.picked ?? []).includes(test)) continue;
      if (record.tree === headTree) { covered.set(test, { record, how: 'same', changed: 0 }); break; }
      const d = diff(record.tree); if (d === null) continue;
      const files = d.causes.get(test);
      if (files === undefined) { covered.set(test, { record, how: 'reused', changed: d.changed }); break; }
      if (!overlaps.has(test)) overlaps.set(test, { record, files: [...files].sort() });
    }
  }
  return { covered, overlaps, uncovered: required.filter(test => !covered.has(test)) };
}

export function checkTestedChanges({ top, work, base, head }) {
  const { picked } = pickTests({ root: work, base, head });
  const required = [...picked.keys()].sort();
  if (required.length === 0) return { required, ok: true };
  const tree = execFileSync('git', ['rev-parse', `${head}^{tree}`], { cwd: work, encoding: 'utf8' }).trim();
  const coverage = testCoverage({ top, work, required, headTree: tree });
  return { required, ok: coverage.uncovered.length === 0, tree, ...coverage };
}

const short = value => String(value ?? '?').slice(0, 8);

/** The evidence lines: per record, how many tests it covers and how ("on this content" / "no overlap"). */
export function coverageLines(covered) {
  const byRecord = new Map();
  for (const [test, entry] of covered) {
    const key = entry.record.file ?? entry.record.tree;
    if (!byRecord.has(key)) byRecord.set(key, { ...entry, tests: [] });
    byRecord.get(key).tests.push(test);
  }
  return [...byRecord.values()].map(entry => entry.how === 'same'
    ? `  ${entry.tests.length} on this content — ${entry.record.pass}/${entry.record.tests} at ${entry.record.where}, ${entry.record.at}`
    : `  ${entry.tests.length} reused, no overlap: ${entry.changed} file(s) changed since the run's content ${short(entry.record.tree)} (${entry.record.where}, ${entry.record.at}), none read by them`);
}

/** The lines for the tests still to run: the changed files each reads, or that no passing record ran it. */
export function overlapLines(uncovered, overlaps, limit = 12) {
  return uncovered.slice(0, limit).map(test => {
    const overlap = overlaps.get(test);
    if (overlap === undefined) return `    ${test} — no passing record ran it`;
    const files = overlap.files.slice(0, 3).join(', ') + (overlap.files.length > 3 ? ` … ${overlap.files.length - 3} more` : '');
    return `    ${test} — reads ${files} (changed since ${short(overlap.record.tree)})`;
  }).concat(uncovered.length > limit ? [`    … ${uncovered.length - limit} more`] : []);
}

export function formatTestedChanges(result) {
  if (result.required.length === 0) return 'tested: no test picked by this range (test:changed not needed)';
  const head = `${result.required.length} picked test file(s)`;
  if (result.ok) return [`tested: ${head} passed${result.covered.size > 0 && [...result.covered.values()].every(e => e.how === 'same') ? ' on this content' : ''}`, ...coverageLines(result.covered)].join('\n');
  return [`tested: FAILED — ${head}, ${result.uncovered.length} not covered (run them: npm run test:changed — it runs only these)`,
    ...coverageLines(result.covered),
    `  to run again (${result.uncovered.length}):`, ...overlapLines(result.uncovered, result.overlaps),
    '  (more than 30 tests: scripts/remote/run.sh <label> --light -- npm run -s test:changed)'].join('\n');
}
