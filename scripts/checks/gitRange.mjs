// Shared git helpers for the merge checks (REVIEW-1). Everything reads git objects, never the working tree, so a
// check judges exactly the commits being merged or pushed.
import { execFileSync } from 'node:child_process';
import { gitPaths } from '../gitPaths.mjs';

export const TRUNK = 'codex/phase15-organic-ground';

export function git(args, cwd = process.cwd()) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 2 ** 20 });
}

/** --base/--head from argv; defaults: head = HEAD, base = merge-base with origin/<trunk> (or <trunk>). */
export function resolveRange(argv = process.argv.slice(2), cwd = process.cwd()) {
  const flag = name => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
  const head = git(['rev-parse', '--verify', `${flag('head') ?? 'HEAD'}^{commit}`], cwd).trim();
  let base = flag('base');
  if (base === undefined) {
    const trunkRef = [`origin/${TRUNK}`, TRUNK].find(ref => {
      try { git(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], cwd); return true; } catch { return false; }
    });
    if (trunkRef === undefined) throw new Error(`No ${TRUNK} ref to compare with; pass --base <rev>`);
    base = git(['merge-base', trunkRef, head], cwd).trim();
  } else {
    base = git(['rev-parse', '--verify', `${base}^{commit}`], cwd).trim();
  }
  return { base, head };
}

/** Files changed base..head as { status, path } (renames are split into a delete and an add). */
export function changedFiles(base, head, cwd) {
  return gitPaths(['diff', '--name-status', '--no-renames', '-z', base, head], { cwd })
    .reduce((rows, field, index, all) => index % 2 === 0 ? [...rows, { status: field, path: all[index + 1] }] : rows, []);
}

/** Lines added base..head in the given paths, as { path, text }. */
export function addedLines(base, head, paths, cwd) {
  if (paths.length === 0) return [];
  const out = git(['diff', '--no-renames', '--unified=0', base, head, '--', ...paths], cwd);
  const rows = []; let path = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('+++ ')) path = line === '+++ /dev/null' ? null : line.slice(6);
    else if (line.startsWith('+') && path !== null) rows.push({ path, text: line.slice(1) });
  }
  return rows;
}

/** Removed and added lines per file base..head: Map<path, { removed: string[], added: string[] }>. */
export function lineChanges(base, head, paths, cwd) {
  const map = new Map();
  if (paths.length === 0) return map;
  const out = git(['diff', '--no-renames', '--unified=0', base, head, '--', ...paths], cwd);
  let path = null;
  for (const line of out.split('\n')) {
    if (line.startsWith('diff --git ')) path = line.split(' b/').pop();
    else if (line.startsWith('+++ ') || line.startsWith('--- ')) continue;
    else if (path !== null && (line.startsWith('+') || line.startsWith('-'))) {
      const entry = map.get(path) ?? { removed: [], added: [] };
      (line.startsWith('+') ? entry.added : entry.removed).push(line.slice(1));
      map.set(path, entry);
    }
  }
  return map;
}

export const isMain = url => process.argv[1] !== undefined && new URL(url).pathname === process.argv[1];
