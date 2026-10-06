// check:merge step: the tests the range picks ran and passed on exactly the pushed content (decision RR16, 2026-10-06).
// `npm run test:changed` (scripts/checks/changedTests.mjs) writes a record per run: on the Mac
// .remote-runs/test-changed/<tree>.json, on the DGX .remote/test-changed.json, which run.sh brings back as
// .remote-runs/<run>/test-changed.json. A record counts when its tree is <head>'s tree, it passed, and its tests include
// every test the range base..head picks. No test picked (documents, data no test reads): passes without a record.
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pickTests } from './changedTests.mjs';

function records(top) {
  const dir = join(top, '.remote-runs');
  if (!existsSync(dir)) return [];
  const files = [];
  const own = join(dir, 'test-changed');
  if (existsSync(own)) for (const f of readdirSync(own)) if (f.endsWith('.json')) files.push(join(own, f));
  for (const run of readdirSync(dir)) { const f = join(dir, run, 'test-changed.json'); if (existsSync(f)) files.push(f); }
  return files.flatMap(file => { try { return [{ file, ...JSON.parse(readFileSync(file, 'utf8')) }]; } catch { return []; } });
}

export function checkTestedChanges({ top, work, base, head }) {
  const { picked } = pickTests({ root: work, base, head });
  const required = [...picked.keys()].sort();
  if (required.length === 0) return { required, ok: true };
  const tree = execFileSync('git', ['rev-parse', `${head}^{tree}`], { cwd: work, encoding: 'utf8' }).trim();
  const all = records(top);
  const match = all.filter(r => r.tree === tree && r.passed && required.every(t => (r.picked ?? []).includes(t)))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)))[0];
  const sameTree = all.filter(r => r.tree === tree);
  return { required, ok: Boolean(match), match, tree, sameTree };
}

export function formatTestedChanges(result) {
  if (result.required.length === 0) return 'tested: no test picked by this range (test:changed not needed)';
  if (result.ok) {
    const m = result.match;
    return `tested: ${result.required.length} picked test file(s) passed on this content — ${m.pass}/${m.tests} at ${m.where}, ${m.at}`;
  }
  const why = result.sameTree.length === 0
    ? 'no test:changed record of this exact content (run it after your last commit, merges included)'
    : result.sameTree.some(r => !r.passed) ? 'the test:changed run of this content FAILED' : 'the test:changed run of this content did not include every picked test';
  return `tested: FAILED — ${result.required.length} picked test file(s), ${why}\n` +
    `  run: npm run test:changed   (more than 30 tests: scripts/remote/run.sh <label> --light -- npm run -s test:changed)\n` +
    result.required.slice(0, 12).map(t => `    ${t}`).join('\n') + (result.required.length > 12 ? `\n    … ${result.required.length - 12} more` : '');
}
