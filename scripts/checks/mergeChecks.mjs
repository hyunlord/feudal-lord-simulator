// Merge checks (REVIEW-1): npm run check:merge [-- --base <rev> --head <rev>]
// Runs before anything reaches the trunk: the pre-push hook calls it for every push to codex/phase15-organic-ground
// or main (with FLS_PUSH_OK=1 too). Default range: merge-base with the trunk..HEAD.
//  1. pins        scripts/checks/pinChanges.mjs      pin changes are named in the decision list
//  2. exceptions  scripts/checks/lintExceptions.mjs  new eslint-disable / @ts-ignore / @ts-expect-error / as any
//                                                    carry "// why:"
//  3. eslint      tools/eslint (own install)         files changed in the range; only violations that are not
//                                                    in tools/eslint/eslint-suppressions.json fail
//  4. typecheck   tsc --noEmit (root node_modules)
//  5. ledger      scripts/checks/inboxLedger.mjs     assets-inbox/INBOX_LEDGER.csv: every replaced_by path is a ledger
//                                                    row, canonical marks match, new same-sha256 rows are marked
//  6. korean      scripts/checks/koreanStrings.mjs   no new Korean string in src outside *.ko.ts and *.generated.*
//                                                    (parsed with tools/eslint's TypeScript 6)
//  7. budget      scripts/checks/distBudget.mjs      `vite build` of <head> into a temporary folder: the total and each
//                                                    budgeted category (distBudget.config.json) within budget
// The layer rule (simulation folders do not import src/ui or src/render) is an ESLint rule: tools/eslint/layers.mjs.
// 1, 2, 5 and 6 read git objects. 3, 4 and 7 need files: they run in this checkout when it is at <head> with no tracked
// changes, otherwise in a temporary worktree of <head> (LFS files left as pointers) that borrows node_modules; step 7
// checks out there only the received PNGs the build turns into web derivatives (git lfs checkout, from the local store).
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatBudgetTable, loadBudgetConfig, measureBuild } from './distBudget.mjs';
import { changedFiles, git, resolveRange } from './gitRange.mjs';
import { checkPinChanges, formatPinResult } from './pinChanges.mjs';
import { checkLintExceptions, formatLintResult } from './lintExceptions.mjs';
import { checkInboxLedger, formatLedgerResult, ledgerOk } from './inboxLedger.mjs';
import { checkKoreanStrings, formatKoreanResult } from './koreanStrings.mjs';

const CODE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const ESLINT_DIR = 'tools/eslint';

// A hook runs with GIT_DIR and friends set; they must not leak into git calls made in another worktree.
for (const name of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_PREFIX']) delete process.env[name];

const top = git(['rev-parse', '--show-toplevel']).trim();
process.chdir(top);
const { base, head } = resolveRange();
const results = [];
const report = (name, ok, text) => { results.push({ name, ok }); console.log(text); };
console.log(`check:merge ${base.slice(0, 8)}..${head.slice(0, 8)}`);

const pins = checkPinChanges({ base, head });
report('pins', pins.missing.length === 0, formatPinResult(pins));
const exceptions = checkLintExceptions({ head });
report('exceptions', exceptions.unexplained.length === 0, formatLintResult(exceptions));
const ledger = checkInboxLedger({ base, head });
report('ledger', ledgerOk(ledger), formatLedgerResult(ledger));
ensureEslint();   // koreanStrings parses with tools/eslint's TypeScript
const korean = checkKoreanStrings({ head });
report('korean', korean.added.length === 0, formatKoreanResult(korean));

// Files for ESLint and tsc: this checkout if it is exactly <head>, else a temporary worktree.
const clean = git(['status', '--porcelain', '--untracked-files=no']).trim() === '';
const atHead = git(['rev-parse', 'HEAD']).trim() === head;
let work = top; let temporary = null;
if (!(clean && atHead)) {
  temporary = mkdtempSync(join(tmpdir(), 'fls-check-merge-'));
  execFileSync('git', ['worktree', 'add', '--detach', '--quiet', temporary, head], { env: { ...process.env, GIT_LFS_SKIP_SMUDGE: '1' }, stdio: 'inherit' });
  work = temporary;
  console.log(`(checking ${head.slice(0, 8)} in a temporary worktree: this checkout is ${clean ? 'at another commit' : 'modified'})`);
}
try {
  report(...eslintStep(work));
  report(...typecheckStep(work));
  report(...budgetStep(work));
} finally {
  if (temporary !== null) {
    spawnSync('git', ['worktree', 'remove', '--force', temporary], { stdio: 'ignore' });
    rmSync(temporary, { recursive: true, force: true });
  }
}

const failed = results.filter(result => !result.ok).map(result => result.name);
console.log(failed.length === 0 ? 'check:merge: passed' : `check:merge: FAILED (${failed.join(', ')})`);
process.exitCode = failed.length === 0 ? 0 : 1;

function eslintStep(dir) {
  const config = join(dir, ESLINT_DIR, 'eslint.config.mjs');
  if (!existsSync(config)) return ['eslint', true, `eslint: skipped (${ESLINT_DIR} does not exist at ${head.slice(0, 8)})`];
  const bin = ensureEslint();
  // The config resolves its plugins from its own folder: a temporary worktree borrows this checkout's install.
  const modules = join(dir, ESLINT_DIR, 'node_modules');
  if (dir !== top && !existsSync(modules)) symlinkSync(join(top, ESLINT_DIR, 'node_modules'), modules);
  const files = changedFiles(base, head).filter(file => file.status !== 'D' && CODE.test(file.path)).map(file => file.path)
    .filter(path => existsSync(join(dir, path)));
  if (files.length === 0) return ['eslint', true, 'eslint: no code file changed'];
  const run = spawnSync(bin, ['-c', join(ESLINT_DIR, 'eslint.config.mjs'), '--suppressions-location', join(ESLINT_DIR, 'eslint-suppressions.json'),
    '--pass-on-unpruned-suppressions', '--no-warn-ignored', '--max-warnings', '0', ...files], { cwd: dir, encoding: 'utf8' });
  const output = `${run.stdout}${run.stderr}`.trim();
  return ['eslint', run.status === 0, `eslint: ${files.length} changed file(s), ${run.status === 0 ? 'no new violation' : 'new violations'}${output ? `\n${indent(output)}` : ''}`];
}

// tools/eslint has its own lockfile; install it (npm ci) when node_modules is missing or older than the lockfile.
function ensureEslint() {
  const dir = join(top, ESLINT_DIR);
  const lockHash = createHash('sha256').update(readFileSync(join(dir, 'package-lock.json'))).digest('hex');
  const marker = join(dir, 'node_modules', '.fls-lock-sha256');
  if (!existsSync(marker) || readFileSync(marker, 'utf8').trim() !== lockHash) {
    console.log(`(installing ${ESLINT_DIR}: npm ci)`);
    execFileSync('npm', ['ci', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: dir, stdio: 'inherit' });
    writeFileSync(marker, `${lockHash}\n`);
  }
  return join(dir, 'node_modules', '.bin', 'eslint');
}

function typecheckStep(dir) {
  const tsc = join(top, 'node_modules', '.bin', 'tsc');
  if (!existsSync(tsc)) return ['typecheck', false, 'typecheck: node_modules missing in this checkout (run npm ci)'];
  if (dir !== top && !existsSync(join(dir, 'node_modules'))) symlinkSync(join(top, 'node_modules'), join(dir, 'node_modules'));
  const run = spawnSync(tsc, ['--noEmit'], { cwd: dir, encoding: 'utf8' });
  const output = `${run.stdout}${run.stderr}`.trim();
  return ['typecheck', run.status === 0, `typecheck: ${run.status === 0 ? 'passed' : 'failed'}${output ? `\n${indent(output.split('\n').slice(0, 30).join('\n'))}` : ''}`];
}

function budgetStep(dir) {
  const configPath = join(dir, 'scripts', 'checks', 'distBudget.config.json');
  if (!existsSync(configPath) || !existsSync(join(dir, 'vite.config.ts'))) return ['budget', true, `budget: skipped (no vite.config.ts or distBudget.config.json at ${head.slice(0, 8)})`];
  if (!existsSync(join(top, 'node_modules', '.bin', 'vite'))) return ['budget', false, 'budget: node_modules missing in this checkout (run npm ci)'];
  const started = Date.now();
  try {
    if (dir !== top) {
      if (!existsSync(join(dir, 'node_modules'))) symlinkSync(join(top, 'node_modules'), join(dir, 'node_modules'));
      checkoutDerivativeSources(dir);
    }
    const { buildMs, result } = measureBuild({ cwd: dir, config: loadBudgetConfig(configPath) });
    const mb = bytes => (bytes / result.megabyte).toFixed(2);
    const over = result.over.map(id => { const row = id === 'total' ? { name: '전체', ...result.total } : result.categories.find(category => category.id === id);
      return `${row.name} ${mb(row.bytes)} MB > ${mb(row.budgetBytes)} MB`; });
    const summary = `budget: ${mb(result.total.bytes)} MB of ${mb(result.total.budgetBytes)} MB, ${result.pass ? 'within budget' : `OVER (${over.join(', ')})`}` +
      ` (build ${(buildMs / 1000).toFixed(1)} s, step ${((Date.now() - started) / 1000).toFixed(1)} s)`;
    return ['budget', result.pass, `${summary}\n${indent(formatBudgetTable(result))}`];
  } catch (error) {
    return ['budget', false, `budget: failed\n${indent(String(error.message ?? error))}`];
  }
}

// The build decodes the received keyart, illustration and portrait PNGs (Git LFS, assets-inbox) into web derivatives;
// a temporary worktree has them as pointers, so check those out from the local LFS store.
function checkoutDerivativeSources(dir) {
  const list = "import('./scripts/keyartDerivatives.ts').then(m => console.log([...new Set(m.WEB_ART_DERIVATIVES.map(d => d.source))].join('\\n')))";
  const sources = execFileSync(join(top, 'node_modules', '.bin', 'tsx'), ['-e', list], { cwd: dir, encoding: 'utf8' }).split('\n').filter(Boolean);
  execFileSync('git', ['lfs', 'checkout', '--', ...sources], { cwd: dir, stdio: 'ignore' });
}

function indent(text) { return text.split('\n').map(line => `  ${line}`).join('\n'); }
