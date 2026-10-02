// Git merge driver for the generated perf-trend page (decision RR4): docs/verification/perf-trend/{README.md,trend.json}
// are written whole by `npm run perf:trend` from the per-commit data files, so when two sessions both refreshed the page
// (the post-merge hook commits it) the newer page wins instead of a conflict: the side with more measured commits —
// rows of trend.json, commit rows of README.md's tables — or ours on a tie. The data files (data/<sha>.json) never clash.
// .gitattributes names the driver (merge=fls-trend); scripts/git-hooks/install.sh configures it:
//   node scripts/perf/trendMergeDriver.mjs %O %A %B %P      writes the chosen side to %A, exit 0
// Anything it cannot read falls back to git merge-file (an ordinary conflict).
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Measured commits a page version shows, or null when unreadable. */
export function pageSize(path, text) {
  if (path.endsWith('.json')) {
    try { const rows = JSON.parse(text); return Array.isArray(rows) ? rows.length : null; } catch { return null; }
  }
  return text.split('\n').filter(line => /^\| `[0-9a-f]{8}`/.test(line)).length;
}

/** 'ours' | 'theirs' | null (null: fall back to a text merge). */
export function pickTrendSide(path, ours, theirs) {
  const a = pageSize(path, ours); const b = pageSize(path, theirs);
  if (a === null || b === null) return null;
  return b > a ? 'theirs' : 'ours';
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [base, ours, theirs, path = ''] = process.argv.slice(2);
  const side = pickTrendSide(path, readFileSync(ours, 'utf8'), readFileSync(theirs, 'utf8'));
  if (side === null) process.exit(spawnSync('git', ['merge-file', ours, base, theirs], { stdio: 'inherit' }).status ?? 1);
  if (side === 'theirs') writeFileSync(ours, readFileSync(theirs));
  process.exit(0);
}
