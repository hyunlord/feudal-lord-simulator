// Every git call in scripts/ that lists paths goes through here (tests/gitPaths.test.ts finds the ones that do not).
// Git quotes a path with letters outside ASCII ("assets-inbox/…/\352\262\200…") unless told not to, and a script that
// reads that list takes the quoted text for a name: the gate's log parse, the path quotes and the DGX run folder's file
// list each lost the Korean review records that way (nightly-GEOMETRY-1011-eeae4c8). Here git always runs with
// core.quotePath=false, and a list is read with -z (one NUL after every path: spaces, tabs and newlines stay as they are).
import { execFileSync } from 'node:child_process';

const QUOTE_OFF = ['-c', 'core.quotePath=false'];

/**
 * git's output as text, paths unquoted: for output read line by line as it always was (a patch, a status shown to a
 * person, numstat). `exec` replaces execFileSync (a test's stand-in).
 */
export function gitText(args, { cwd = process.cwd(), maxBuffer = 2 ** 30, exec = execFileSync } = {}) {
  return exec('git', [...QUOTE_OFF, ...args], { cwd, encoding: 'utf8', maxBuffer, stdio: ['ignore', 'pipe', 'pipe'] });
}

/**
 * The NUL-separated output of a listing call (`-z` added after the subcommand when missing), unsplit: for parsers that
 * read fields (ls-tree -l, diff --name-status, status --porcelain, log --name-only).
 */
export function gitPathsOut(args, options = {}) {
  const [command, ...rest] = args;
  return gitText(rest.includes('-z') ? args : [command, '-z', ...rest], options);
}

/** The paths a listing call names, one array entry each (empty entries dropped). */
export function gitPaths(args, options = {}) {
  return gitPathsOut(args, options).split('\0').filter(Boolean);
}
