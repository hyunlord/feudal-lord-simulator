// New lint and type exceptions need a reason (REVIEW-1, AGENTS.md rule 19).
//   node scripts/checks/lintExceptions.mjs [--head <rev>]           check the commit (default HEAD)
//   node scripts/checks/lintExceptions.mjs --write-baseline         record the current exceptions as the known list
// Every `eslint-disable…`, `@ts-ignore`, `@ts-expect-error` and `as any` in a tracked code file at <head> must carry
// a `// why: …` comment on the same line or the line above, unless it is on the known list
// (lint-exceptions-baseline.json: the exceptions that existed when the check was introduced, matched by file and
// line text, so moving such a line keeps it known and editing it makes it new). Entries of the list that no longer
// occur are reported so the list can shrink; they do not fail the check.
import { readFileSync, writeFileSync } from 'node:fs';
import { git, isMain, resolveRange } from './gitRange.mjs';

// `as any` only as a cast (followed by the end of an expression), not English such as "as soon as any road".
const EXCEPTION = /eslint-disable|@ts-ignore|@ts-expect-error|\bas any(?=\s*(?:[)\];,}.?|&=>[]|$))/;
const WHY = /(\/\/|\/\*|\{\/\*)\s*why:/;
const CODE = ['*.ts', '*.tsx', '*.js', '*.jsx', '*.mjs', '*.cjs'];
// This folder names the patterns itself.
const IGNORED = [':(exclude)scripts/checks/**'];
export const BASELINE_FILE = new URL('./lint-exceptions-baseline.json', import.meta.url);

export function findExceptions(head, cwd = process.cwd()) {
  let out = '';
  try {
    // git grep's ERE has no portable \b; the coarse pattern here is re-checked with EXCEPTION below.
    out = git(['grep', '-n', '-I', '-E', 'eslint-disable|@ts-ignore|@ts-expect-error|as any', head, '--', ...CODE, ...IGNORED], cwd);
  } catch (error) { if (error.status !== 1) throw error; }            // 1 = no match
  const hits = [];
  const files = new Map();
  for (const row of out.split('\n').filter(Boolean)) {
    const rest = row.slice(head.length + 1);
    const first = rest.indexOf(':'); const second = rest.indexOf(':', first + 1);
    const path = rest.slice(0, first); const line = Number(rest.slice(first + 1, second));
    if (!files.has(path)) files.set(path, git(['show', `${head}:${path}`], cwd).split('\n'));
    const lines = files.get(path);
    const text = lines[line - 1];
    if (!EXCEPTION.test(text)) continue;
    const above = line >= 2 ? lines[line - 2].trim() : '';
    const why = WHY.test(text) || (/^(\/\/|\/\*|\*|\{\/\*)/.test(above) && WHY.test(above));
    hits.push({ path, line, text: text.trim(), why });
  }
  return hits;
}

export function readBaseline() {
  try { return JSON.parse(readFileSync(BASELINE_FILE, 'utf8')).exceptions; } catch { return []; }
}

export function checkLintExceptions({ head, cwd = process.cwd(), baseline = readBaseline() }) {
  const hits = findExceptions(head, cwd);
  const pool = baseline.map(entry => ({ ...entry, used: false }));
  const unexplained = [];
  for (const hit of hits) {
    if (hit.why) continue;
    const known = pool.find(entry => !entry.used && entry.path === hit.path && entry.text === hit.text);
    if (known) known.used = true; else unexplained.push(hit);
  }
  return { hits, unexplained, stale: pool.filter(entry => !entry.used) };
}

export function formatLintResult({ hits, unexplained, stale }) {
  const lines = [`lint exceptions: ${hits.length} in the tree, ${unexplained.length} new without "// why:"`];
  for (const hit of unexplained) lines.push(`  MISSING ${hit.path}:${hit.line}  ${hit.text.slice(0, 110)}`);
  if (unexplained.length > 0) lines.push('  Put "// why: <reason>" on the same line or the line above (AGENTS.md rule 19).');
  if (stale.length > 0) lines.push(`  note: ${stale.length} known-list entr${stale.length === 1 ? 'y no longer occurs' : 'ies no longer occur'}; run --write-baseline on the trunk to shrink the list`);
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  if (process.argv.includes('--write-baseline')) {
    const head = git(['rev-parse', 'HEAD']).trim();
    const exceptions = findExceptions(head).filter(hit => !hit.why).map(({ path, text }) => ({ path, text }));
    writeFileSync(BASELINE_FILE, `${JSON.stringify({
      note: 'Lint/type exceptions that existed before REVIEW-1. New ones need a "// why:" comment. Shrink only; never add entries by hand.',
      recordedAt: head, exceptions }, null, 2)}\n`);
    console.log(`lint exceptions: recorded ${exceptions.length} known exception(s) at ${head.slice(0, 8)}`);
  } else {
    const result = checkLintExceptions(resolveRange());
    console.log(formatLintResult(result));
    process.exitCode = result.unexplained.length > 0 ? 1 : 0;
  }
}
