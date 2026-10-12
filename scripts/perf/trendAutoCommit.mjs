// Refreshes the perf-trend page (docs/verification/perf-trend) after a merge and commits it on its own (decision RR4,
// user decision 2026-10-03). The post-merge hook (scripts/git-hooks/post-merge) runs it after every merge:
//   node scripts/perf/trendAutoCommit.mjs <squash flag from git>
// It refreshes only when all hold: a work branch (not the trunk, not main, not detached), not a squash merge, the
// trunk head is in HEAD (the merge brought the trunk in), the page lags HEAD by more than the limit (scripts/checks/
// trendLag.mjs, the same count check:merge warns with), and nothing under the page's folder is uncommitted. Then it runs
// `npm run perf:trend` (fetches the DGX results; offline it writes from the committed data) and commits only that
// folder, so the tree is never left dirty (AGENTS.md rule 20). Every outcome is one "post-merge: trend …" line; a
// failure never undoes the merge. FLS_TREND_AUTO=0 turns it off; FLS_TREND_AUTO_CMD replaces perf:trend (tests).
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitPaths } from '../gitPaths.mjs';
import { git, TRUNK } from '../checks/gitRange.mjs';
import { checkTrendLag, TREND_LAG_LIMIT } from '../checks/trendLag.mjs';

export const TREND_DIR = 'docs/verification/perf-trend';
const REFRESH_TIMEOUT_MS = 3 * 60_000;

/** { refresh, reason }: whether a merge should refresh and commit the page. */
export function refreshPlan({ branch, squash, trunkInHead, lag, dirty, limit = TREND_LAG_LIMIT }) {
  if (squash) return { refresh: false, reason: 'squash merge' };
  if (!branch) return { refresh: false, reason: 'detached HEAD' };
  if (branch === TRUNK || branch === 'main') return { refresh: false, reason: `on ${branch} (work branches only)` };
  if (!trunkInHead) return { refresh: false, reason: `origin/${TRUNK} is not in HEAD` };
  if (lag === null) return { refresh: false, reason: 'no page in HEAD' };
  if (lag <= limit) return { refresh: false, reason: `${lag} behind, within the limit ${limit}` };
  if (dirty) return { refresh: false, reason: `${lag} behind, but ${TREND_DIR} has uncommitted changes` };
  return { refresh: true, reason: `${lag} behind (limit ${limit})` };
}

function run(squashFlag, cwd) {
  const say = line => process.stderr.write(`post-merge: trend ${line}\n`);
  const quiet = args => { try { return git(args, cwd).trim(); } catch { return null; } };
  const top = quiet(['rev-parse', '--show-toplevel']);
  if (top === null) return;
  const branch = quiet(['symbolic-ref', '-q', '--short', 'HEAD']);
  const head = quiet(['rev-parse', 'HEAD']);
  const trunk = quiet(['rev-parse', '--verify', '--quiet', `refs/remotes/origin/${TRUNK}`]);
  const trunkInHead = trunk !== null && quiet(['merge-base', '--is-ancestor', trunk, head]) !== null;
  const lag = head === null ? null : checkTrendLag({ head, cwd: top });
  const dirty = (() => { try { return gitPaths(['status', '--porcelain', '--', TREND_DIR], { cwd }).length > 0; } catch { return false; } })();
  const plan = refreshPlan({ branch, squash: squashFlag === '1', trunkInHead, lag: lag?.lag ?? null, dirty });
  if (!plan.refresh) { if (lag?.lag !== null && lag?.lag !== undefined && lag.lag > TREND_LAG_LIMIT) say(`not refreshed — ${plan.reason}`); return; }
  const custom = process.env.FLS_TREND_AUTO_CMD;
  const tsx = join(top, 'node_modules', '.bin', 'tsx');
  if (!custom && !existsSync(tsx)) { say(`not refreshed — ${plan.reason}, but node_modules has no tsx (npm ci)`); return; }
  say(`page ${plan.reason}: npm run perf:trend …`);
  const [command, ...args] = custom ? ['/bin/sh', '-c', custom] : [tsx, 'scripts/perf/perfTrend.ts'];
  const refreshed = spawnSync(command, args, { cwd: top, stdio: ['ignore', 'inherit', 'inherit'], timeout: REFRESH_TIMEOUT_MS });
  if (refreshed.status !== 0) {
    putBack(top);
    say(`not committed — perf:trend ${refreshed.error ? refreshed.error.message : `exit ${refreshed.status}`}; the folder was put back`);
    return;
  }
  // Inside post-merge git still counts the merge as running and refuses `git commit -- <path>`, so the commit is built
  // on a scratch index (HEAD plus the folder) and the branch moved to it; the real index then takes the same folder.
  const scratch = join(mkdtempSync(join(tmpdir(), 'fls-trend-index-')), 'index');
  try {
    const env = { ...process.env, GIT_INDEX_FILE: scratch };
    const withIndex = args => execFileSync('git', args, { cwd: top, env, encoding: 'utf8' }).trim();
    withIndex(['read-tree', 'HEAD']);
    withIndex(['add', '-A', '--', TREND_DIR]);
    const tree = withIndex(['write-tree']);
    if (tree === git(['rev-parse', 'HEAD^{tree}'], top).trim()) { say('refreshed, nothing new to commit'); return; }
    const message = `perf-trend: refreshed after a merge (the page was ${lag.lag} trunk heads behind, limit ${TREND_LAG_LIMIT}) — automatic, decision RR4`;
    const commit = git(['commit-tree', tree, '-p', head, '-m', message], top).trim();
    git(['update-ref', '-m', 'perf-trend: refreshed after a merge', 'HEAD', commit, head], top);
    git(['add', '-A', '--', TREND_DIR], top);
    say(`committed ${commit.slice(0, 8)} (only ${TREND_DIR}; push it with your work)`);
  } catch (error) {
    putBack(top);
    say(`not committed — ${error.message.split('\n')[0]}; the folder was put back`);
  } finally { rmSync(dirname(scratch), { recursive: true, force: true }); }
}

/** The folder back to HEAD: nothing of a failed refresh stays in the tree. */
function putBack(top) {
  for (const args of [['reset', '-q', '--', TREND_DIR], ['checkout', '--', TREND_DIR], ['clean', '-fdq', '--', TREND_DIR]]) {
    try { git(args, top); } catch { /* a folder absent from HEAD has nothing to put back */ }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url) && process.env.FLS_TREND_AUTO !== '0') {
  try { run(process.argv[2] ?? '0', process.cwd()); } catch (error) { process.stderr.write(`post-merge: trend not refreshed — ${error.message}\n`); }
}
