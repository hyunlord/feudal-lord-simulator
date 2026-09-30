// How far the performance trend page (docs/verification/perf-trend, `npm run perf:trend`) lags the commit being pushed.
// A warning, never a failure (user decision 2026-09-30): the session that merges refreshes the page; when warnings pile up
// the infra session collects the DGX results and commits the page. Each warning is also appended to
// <git common dir>/fls-trend-lag.log, shared by every worktree, so the pile-up can be seen from any checkout.
// Lag counts trunk heads, the unit the trend measures (the DGX measures each pushed trunk head): the distinct commits
// the trunk ref has pointed to (reflog of origin/<trunk>, shared by the worktrees of this repository) plus <head>, that
// <head> reaches and no measured commit on the page reaches. Without that reflog (a fresh clone) it counts every commit
// in that range instead, which overcounts (merged branches bring their own commits).
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { git, TRUNK } from './gitRange.mjs';

export const TREND_FILE = 'docs/verification/perf-trend/trend.json';
export const TREND_LAG_LIMIT = 10;

/** { measured, newest, lag, unit } — measured: page commits that are ancestors of head; lag null when the page is absent. */
export function checkTrendLag({ head, cwd = process.cwd(), trunkHeads = reflogHeads(cwd) }) {
  let rows;
  try { rows = JSON.parse(execFileSync('git', ['show', `${head}:${TREND_FILE}`], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 2 ** 20 })); } catch { return { measured: [], newest: null, lag: null, unit: 'trunk heads' }; }
  const ancestor = commit => { try { git(['merge-base', '--is-ancestor', commit, head], cwd); return true; } catch { return false; } };
  const measured = rows.map(row => row.commit).filter(ancestor);
  const newest = measured.length === 0 ? null : measured[measured.length - 1];
  const unmeasured = git(['rev-list', head, ...measured.map(commit => `^${commit}`)], cwd).trim().split('\n').filter(Boolean);
  if (trunkHeads.length === 0) return { measured, newest, lag: unmeasured.length, unit: 'commits' };
  const pending = new Set(unmeasured);
  const heads = new Set([...trunkHeads, head].filter(commit => pending.has(commit)));
  return { measured, newest, lag: heads.size, unit: 'trunk heads' };
}

/** Every commit origin/<trunk> has pointed to in this repository (empty without a reflog). */
export function reflogHeads(cwd = process.cwd()) {
  try { return [...new Set(git(['reflog', 'show', '--format=%H', `refs/remotes/origin/${TRUNK}`], cwd).trim().split('\n').filter(Boolean))]; } catch { return []; }
}

export function formatTrendLag({ newest, lag, unit }, limit = TREND_LAG_LIMIT) {
  if (lag === null) return `trend: WARNING — ${TREND_FILE} is missing (not a failure)`;
  if (lag <= limit) return `trend: the perf-trend page is ${lag} ${unit} behind (limit ${limit})`;
  return `trend: WARNING — the perf-trend page is ${lag} ${unit} behind (newest measured ${newest === null ? 'none' : newest.slice(0, 8)}, limit ${limit}). `
    + 'Run `npm run perf:trend` and commit docs/verification/perf-trend (not a failure).';
}

/** Appends a warning line to the shared log; returns whether it was a warning. */
export function logTrendLag(result, head, cwd = process.cwd(), limit = TREND_LAG_LIMIT) {
  if (result.lag !== null && result.lag <= limit) return false;
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], cwd).trim();
  appendFileSync(join(common, 'fls-trend-lag.log'), `${new Date().toISOString()} ${head.slice(0, 8)} lag=${result.lag ?? 'no page'}\n`);
  return true;
}
