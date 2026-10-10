// Finds git calls in scripts/ that list paths without scripts/gitPaths.mjs (the user's order 2026-10-11, after the third
// Korean-path regression). A listing call is one whose arguments name a listing subcommand or option (ls-files, ls-tree,
// diff-tree, whatchanged, --name-only, --name-status, --numstat, --stat, --raw, --porcelain, or `status` on a line that
// names git).
//   JavaScript/TypeScript: such an argument written as a string literal must sit on a line that calls gitPaths(,
//     gitPathsOut( or gitText( — keep the call on one line; and a git command line in a string that is run (execSync,
//     spawn, sh -c) is refused outright. Messages that tell a person to run `git diff --stat` are no call.
//   Shell (and hooks, units): a git command line that lists paths carries -c core.quotePath=false or -z itself — a shell
//     script the DGX timers load alone (nightlyGeometry.sh, trunkClone.sh) cannot source a helper beside it.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LISTING = ['ls-files', 'ls-tree', 'diff-tree', 'whatchanged', '--name-only', '--name-status', '--numstat', '--stat', '--raw', '--porcelain', '--porcelain=v1', '--porcelain=v2'];
const LITERAL = new RegExp(`(['"\`])(${LISTING.map(word => word.replace(/[-=]/g, '\\$&')).join('|')})\\1`);
const STATUS = /(['"`])status\1/;
const RUNS = /\b(exec|execSync|execFile|execFileSync|spawn|spawnSync)\(|\b(sh|bash) -c\b/;
const HELPER_CALL = /\b(gitPaths|gitPathsOut|gitText)\(/;
const COMMAND = /\bgit\s+(?:(?:-C\s+\S+|-c\s+\S+|--git-dir[= ]\S+|--work-tree[= ]\S+)\s+)*(ls-files|ls-tree|diff-tree|whatchanged|status|(?:diff|log|show)\b[^\n|;&]*--(?:name-only|name-status|numstat|stat|raw)\b)/;
const SAFE_SHELL = /core\.quotePath=false|\s-z\b/;   // tested on the git command itself, from `git` on (`[ -z "$(git …)" ]` is no -z)
const JS = /\.(mjs|cjs|js|ts|mts|cts|tsx)$/;

/** One finding per line: { path, line, text, why }. `files` maps a path to its text. */
export function unsafeGitPathCalls(files) {
  const found = [];
  for (const [path, text] of files) {
    if (path === 'scripts/gitPaths.mjs' || path === 'scripts/checks/gitPathCalls.mjs') continue;
    const js = JS.test(path);
    text.split('\n').forEach((line, index) => {
      const code = line.trimStart();
      if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*') || code.startsWith('#')) return;
      const at = { path, line: index + 1, text: line.trim().slice(0, 160) };
      if (js) {
        const listing = LITERAL.test(line) || (STATUS.test(line) && /\bgit\b/.test(line));
        if (listing && !HELPER_CALL.test(line)) found.push({ ...at, why: 'listing argument outside gitPaths/gitPathsOut/gitText' });
        else if (RUNS.test(line) && COMMAND.test(line)) found.push({ ...at, why: 'git listing command in a string — call gitPaths with an argument list' });
      } else if (COMMAND.test(line) && !SAFE_SHELL.test(line.slice(line.search(/\bgit\s/)))) found.push({ ...at, why: 'shell git listing without -c core.quotePath=false or -z' });
    });
  }
  return found;
}

/** The tracked text files under scripts/ that can call git: scripts, shell, hooks, systemd units. */
export function scriptFiles(cwd = process.cwd()) {
  const paths = execFileSync('git', ['-c', 'core.quotePath=false', 'ls-files', '-z', '--', 'scripts'], { cwd, encoding: 'utf8', maxBuffer: 2 ** 28 })
    .split('\0').filter(path => path && (JS.test(path) || /\.(sh|bash|service)$/.test(path) || path.startsWith('scripts/git-hooks/')) && !path.endsWith('.d.mts') && !path.endsWith('.d.ts'));
  return new Map(paths.map(path => [path, readFileSync(join(cwd, path), 'utf8')]));
}
