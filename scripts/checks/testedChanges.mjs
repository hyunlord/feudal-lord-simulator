// check:merge step: the tests the range picks passed on the pushed content (decision RR16, 2026-10-06), or on an earlier
// content whose differences none of them reads (decision RR25, 2026-10-09).
// `npm run test:changed` (scripts/checks/changedTests.mjs) writes a record per run: on the Mac
// .remote-runs/test-changed/<tree>.<ms>.json (one file per run), on the DGX .remote/test-changed.json, which run.sh brings back as
// .remote-runs/<run>/test-changed.json. A required test (one the range base..head picks) is covered by a passing record
// that ran it when either
//  - the record's tree is <head>'s tree (the same content), or
//  - between the record's tree and <head>'s tree no changed file is one the test reads: none picks it again by an import
//    (direct or through other files), by naming its path, by the source-scan list (RR24) or by the lock files. The
//    trunk moving under a long gate, a merge's resolution and later own edits are all in that one tree difference.
// For each test the newest record whose content is the same for it (same tree, or no overlap) decides: a pass covers
// it, a failure blocks it (an older pass never outweighs a newer failure on the same inputs). Records that did not run
// the test do not count. A test with an overlap is run again (on the new content); the others keep their result. No test picked (documents,
// data no test reads): passes without a record. The output names, per reused record, "no overlap" and the number of
// files that changed since it, and per test still to run, the changed files it reads.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pickTests } from './pickTests.mjs';
import { inputOverlap, treeChanges, unpackInputs } from './testInputs/testInputs.mjs';

/** Newest first by the record's time (a record without a readable time counts as the oldest). */
export const newestFirst = (a, b) => (Date.parse(b.at) || -Infinity) - (Date.parse(a.at) || -Infinity);

/** Every test:changed record this checkout has, newest first. */
export function testedRecords(top) {
  const dir = join(top, '.remote-runs');
  if (!existsSync(dir)) return [];
  const files = [];
  const own = join(dir, 'test-changed');
  if (existsSync(own)) for (const f of readdirSync(own)) if (f.endsWith('.json')) files.push(join(own, f));
  for (const run of readdirSync(dir)) { const f = join(dir, run, 'test-changed.json'); if (existsSync(f)) files.push(f); }
  return files.flatMap(file => { try { return [{ file, ...JSON.parse(readFileSync(file, 'utf8')) }]; } catch { return []; } })
    .sort(newestFirst);
}

const treeKnown = (work, tree) => { try { execFileSync('git', ['cat-file', '-e', `${tree}^{tree}`], { cwd: work, stdio: 'ignore' }); return true; } catch { return false; } };

/**
 * Which of `required` the records cover on `headTree` (the content in `work`), from the inputs each test was measured
 * to read (RR25, measured: scripts/checks/testInputs/). Per test the newest record that ran it on the same inputs decides:
 *  - a record of `headTree` itself (same content);
 *  - a record of another tree whose measured inputs none of the files changed since touch (inputOverlap);
 *  a pass covers the test ('same' / 'reused'), a failure blocks it. A record whose inputs touch a change is skipped (its
 *  result was of other inputs); a record that cannot be compared — content this checkout lacks, no measured inputs for
 *  the test, a test that is not measurable (a child process, the network, reads outside the repository) — never covers,
 *  and when it failed it blocks (it may have been of the same inputs).
 * covered: test -> { record, how, changed }; overlaps: test -> { record, files }; failed: test -> { record, how };
 * unmeasured: test -> { record, why }; uncovered: the tests to run.
 */
export function testCoverage({ top, work, required, headTree, records = testedRecords(top) }) {
  const known = records.filter(r => typeof r.tree === 'string').sort(newestFirst);
  const between = new Map();   // record tree -> its changes to headTree, or null (a tree this checkout does not have)
  const changesSince = tree => {
    if (!between.has(tree)) between.set(tree, treeKnown(work, tree) ? treeChanges(work, tree, headTree) : null);
    return between.get(tree);
  };
  const covered = new Map(); const overlaps = new Map(); const failed = new Map(); const unmeasured = new Map();
  for (const test of required) {
    for (const record of known) {
      if (!(record.picked ?? []).includes(test)) continue;
      if (record.tree === headTree) {
        if (record.passed) covered.set(test, { record, how: 'same', changed: 0 }); else failed.set(test, { record, how: 'same' });
        break;
      }
      const changes = changesSince(record.tree);
      const inputs = unpackInputs(record.inputs, test);
      const why = changes === null ? 'its content is not in this checkout' : inputs === null ? 'its record has no measured inputs for it'
        : inputs.untraceable.length > 0 ? `not measurable: ${inputs.untraceable.join(', ')}` : null;
      if (why !== null) {
        if (!record.passed) { failed.set(test, { record, how: 'uncompared' }); break; }   // a failure that may be of the same inputs blocks
        if (!unmeasured.has(test)) unmeasured.set(test, { record, why });
        continue;
      }
      const touched = inputOverlap(inputs, changes);
      if (touched.length > 0) { if (!overlaps.has(test)) overlaps.set(test, { record, files: touched }); continue; }
      if (record.passed) covered.set(test, { record, how: 'reused', changed: changes.length }); else failed.set(test, { record, how: 'reused' });
      break;
    }
  }
  return { covered, overlaps, failed, unmeasured, uncovered: required.filter(test => !covered.has(test)) };
}

/**
 * The tests a range touches by what they were measured to read (RR25, measured; the static pick's folder list stays the
 * safety net for tests never measured): test -> the changed files it read, from the newest record with its inputs.
 */
export function measuredPicks({ work, base, head, records }) {
  const changes = treeChanges(work, base, head);
  const picks = new Map(); const seen = new Set();
  for (const record of [...records].sort(newestFirst)) {
    for (const test of Object.keys(record.inputs?.tests ?? {})) {
      if (seen.has(test)) continue; seen.add(test);
      const inputs = unpackInputs(record.inputs, test);
      if (inputs === null || inputs.untraceable.length > 0) continue;
      const touched = inputOverlap(inputs, changes);
      if (touched.length > 0) picks.set(test, touched);
    }
  }
  return picks;
}

export function checkTestedChanges({ top, work, base, head }) {
  const { picked } = pickTests({ root: work, base, head });
  const records = testedRecords(top);
  for (const [test, files] of measuredPicks({ work, base, head, records })) if (!picked.has(test) && existsSync(join(work, test))) picked.set(test, `reads ${files[0]} (measured)`);
  const required = [...picked.keys()].sort();
  if (required.length === 0) return { required, ok: true };
  const tree = execFileSync('git', ['rev-parse', `${head}^{tree}`], { cwd: work, encoding: 'utf8' }).trim();
  const coverage = testCoverage({ top, work, required, headTree: tree, records });
  return { required, ok: coverage.uncovered.length === 0, tree, ...coverage };
}

const short = value => String(value ?? '?').slice(0, 8);

/**
 * The reuse evidence a test:changed record keeps (user order 2026-10-09: what was reused, whose result, why): per source
 * record, the tests it covers, how ('same' content or 'reused' with no overlap), its content (tree), commit, run (where)
 * and time, how many files changed since, and why.
 */
export function reuseEvidence(covered) {
  const bySource = new Map();
  for (const [test, entry] of covered) {
    const key = entry.record.file ?? `${entry.record.tree}|${entry.record.at}`;
    if (!bySource.has(key)) bySource.set(key, { how: entry.how, from: { tree: entry.record.tree, commit: entry.record.head ?? null, run: entry.record.where ?? null,
      at: entry.record.at ?? null }, changedSince: entry.changed, why: entry.how === 'same' ? 'same content: that run was of this exact tree'
      : 'no overlap: none of the files changed since that content is among what these tests were measured to read (RR25, measured)', tests: [] });
    bySource.get(key).tests.push(test);
  }
  return [...bySource.values()].map(entry => ({ ...entry, tests: entry.tests.sort() }));
}

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
    : `  ${entry.tests.length} reused, no overlap: ${entry.changed} file(s) changed since the run's content ${short(entry.record.tree)} (commit ${short(entry.record.head)}, ${entry.record.where}, ${entry.record.at}), none among what they were measured to read`);
}

/** The lines for the tests still to run: the changed files each reads, or that no passing record ran it. */
export function overlapLines(uncovered, overlaps, limit = 12, failed = new Map(), unmeasured = new Map()) {
  return uncovered.slice(0, limit).map(test => {
    const failure = failed.get(test);
    if (failure !== undefined) return `    ${test} — FAILED on ${failure.how === 'same' ? 'this content' : failure.how === 'uncompared' ? `content it cannot be compared with (${short(failure.record.tree)})` : `the same inputs (content ${short(failure.record.tree)})`} (${failure.record.where}, ${failure.record.at})`;
    const overlap = overlaps.get(test);
    const plain = unmeasured.get(test);
    if (overlap === undefined && plain !== undefined) return `    ${test} — never reused: ${plain.why}`;
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
    `  to run again (${result.uncovered.length}):`, ...overlapLines(result.uncovered, result.overlaps, 12, result.failed, result.unmeasured),
    '  (more than 30 tests: scripts/remote/run.sh <label> --light -- npm run -s test:changed)'].join('\n');
}
