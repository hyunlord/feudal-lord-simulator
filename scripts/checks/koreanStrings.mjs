// New Korean strings live in *.ko.ts (CODE-1b, AGENTS.md rules 5, 9 and 19).
//   node scripts/checks/koreanStrings.mjs [--head <rev>]           check the commit (default HEAD)
//   node scripts/checks/koreanStrings.mjs --write-baseline         record the current strings as the known list
// In src/**/*.{ts,tsx,js,jsx,mjs,cjs} at <head>, a string literal, template text or JSX text containing Hangul is
// allowed only in *.ko.ts files and generated files (*.generated.*). Comments do not count. Strings that existed
// when the check came in are on the known list (korean-strings-baseline.json: per file, the exact texts), so a new
// string — or an edited old one — outside *.ko.ts fails. Entries that no longer occur are reported so the list can
// shrink. Parsing uses the TypeScript 6 that tools/eslint installs (the root TypeScript 7 has no JS parser API).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { git, isMain, resolveRange } from './gitRange.mjs';

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const ALLOWED = [/\.ko\.ts$/, /\.generated\./];
export const BASELINE_FILE = new URL('./korean-strings-baseline.json', import.meta.url);

function typescript(top) {
  try { return createRequire(join(top, 'tools/eslint/package.json'))('typescript'); } catch {
    throw new Error('koreanStrings: tools/eslint is not installed (npm --prefix tools/eslint ci, or npm run check:merge installs it)');
  }
}

/** File contents at <head> in one `git cat-file --batch` process: [path, text][]. */
function readBlobs(head, paths, cwd) {
  if (paths.length === 0) return [];
  const out = execFileSync('git', ['cat-file', '--batch'], { cwd, input: paths.map(path => `${head}:${path}`).join('\n') + '\n', maxBuffer: 1 << 30 });
  const blobs = []; let offset = 0;
  for (const path of paths) {
    const newline = out.indexOf(10, offset);
    const size = Number(out.subarray(offset, newline).toString().split(' ')[2]);
    blobs.push([path, out.subarray(newline + 1, newline + 1 + size).toString('utf8')]);
    offset = newline + 1 + size + 1;
  }
  return blobs;
}

/** Korean string texts per file at <head>: Map<path, { text, line }[]>. */
export function findKoreanStrings(head, cwd = process.cwd()) {
  const top = git(['rev-parse', '--show-toplevel'], cwd).trim();
  const ts = typescript(top);
  const paths = git(['ls-tree', '-r', '--name-only', head, '--', 'src'], cwd).split('\n')
    .filter(path => CODE.test(path) && !ALLOWED.some(pattern => pattern.test(path)));
  const result = new Map();
  for (const [path, text] of readBlobs(head, paths, cwd)) {
    if (!HANGUL.test(text)) continue;
    const kind = /x$/.test(path) ? ts.ScriptKind.TSX : /\.m?js$|\.cjs$/.test(path) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
    const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, false, kind);
    const strings = [];
    const K = ts.SyntaxKind;
    const visit = node => {
      if ((node.kind === K.StringLiteral || node.kind === K.NoSubstitutionTemplateLiteral || node.kind === K.TemplateHead
        || node.kind === K.TemplateMiddle || node.kind === K.TemplateTail || node.kind === K.JsxText) && HANGUL.test(node.text)) {
        const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
        strings.push({ text: node.text.trim(), line: line + 1 });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (strings.length > 0) result.set(path, strings);
  }
  return result;
}

export function readBaseline() {
  try { return JSON.parse(readFileSync(BASELINE_FILE, 'utf8')).files; } catch { return {}; }
}

export function checkKoreanStrings({ head, cwd = process.cwd(), baseline = readBaseline() }) {
  const found = findKoreanStrings(head, cwd);
  const added = []; let total = 0;
  const pool = Object.fromEntries(Object.entries(baseline).map(([path, texts]) => [path, texts.map(text => ({ text, used: false }))]));
  for (const [path, strings] of found) {
    for (const string of strings) {
      total++;
      const known = (pool[path] ?? []).find(entry => !entry.used && entry.text === string.text);
      if (known) known.used = true; else added.push({ path, ...string });
    }
  }
  const stale = Object.entries(pool).flatMap(([path, entries]) => entries.filter(entry => !entry.used).map(entry => ({ path, text: entry.text })));
  return { files: found.size, total, added, stale };
}

export function formatKoreanResult({ files, total, added, stale }) {
  const lines = [`korean strings: ${total} outside *.ko.ts in ${files} file(s), ${added.length} new`];
  for (const hit of added.slice(0, 30)) lines.push(`  MISSING ${hit.path}:${hit.line}  "${hit.text.slice(0, 80)}"`);
  if (added.length > 30) lines.push(`  … and ${added.length - 30} more`);
  if (added.length > 0) lines.push('  Put new Korean text in the area\'s *.ko.ts and import it (AGENTS.md rules 5, 9, 19).');
  if (stale.length > 0) lines.push(`  note: ${stale.length} known string(s) no longer occur; run --write-baseline on the trunk to shrink the list`);
  return lines.join('\n');
}

if (isMain(import.meta.url)) {
  if (process.argv.includes('--write-baseline')) {
    const head = git(['rev-parse', 'HEAD']).trim();
    const files = Object.fromEntries([...findKoreanStrings(head)].sort(([a], [b]) => a.localeCompare(b))
      .map(([path, strings]) => [path, strings.map(string => string.text)]));
    writeFileSync(BASELINE_FILE, `${JSON.stringify({
      note: 'Korean strings outside *.ko.ts and *.generated.* before CODE-1b, per file. New ones go to *.ko.ts. Shrink only; never add entries by hand.',
      recordedAt: head, files }, null, 2)}\n`);
    console.log(`korean strings: recorded ${Object.values(files).flat().length} string(s) in ${Object.keys(files).length} file(s) at ${head.slice(0, 8)}`);
  } else {
    const result = checkKoreanStrings(resolveRange());
    console.log(formatKoreanResult(result));
    process.exitCode = result.added.length > 0 ? 1 : 0;
  }
}
