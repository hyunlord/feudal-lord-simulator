// Throwaway git repositories for the gate's tests (decision RR26: no flaky gate test). They live under the repository's
// ignored .tmp/, and their git runs without auto maintenance: every commit starts `git maintenance run --auto --detach`,
// which tidies .git/objects in the background while the test's next commit writes there. On the Mac that failed 4 runs
// in 10 with "unable to create temporary file: Invalid argument"; with maintenance off, 0 in 10 (2026-10-09).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const TEMP_ROOT = resolve(import.meta.dirname, "../../.tmp");
/** Git options for a throwaway repository: a fixed author, no background maintenance or gc. */
export const QUIET_GIT = ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "maintenance.auto=false", "-c", "gc.auto=0"];

/** A new empty folder under .tmp/ (removed by the test). */
export function tempDir(prefix: string): string {
  mkdirSync(TEMP_ROOT, { recursive: true });
  return mkdtempSync(join(TEMP_ROOT, prefix));
}

/**
 * The environment for a throwaway repository's git: it never looks above .tmp/, so a test whose repository lost its .git
 * cannot reach the real checkout around it.
 */
export const QUIET_ENV = { ...process.env, GIT_CEILING_DIRECTORIES: TEMP_ROOT };

/** Git in `dir` with QUIET_GIT and QUIET_ENV; returns trimmed stdout. */
export function gitIn(dir: string): (...args: string[]) => string {
  return (...args: string[]) => execFileSync("git", [...QUIET_GIT, ...args], { cwd: dir, encoding: "utf8", env: QUIET_ENV }).trim();
}

/**
 * The Korean-named file every gate, audit and clone fixture repository holds by default (user order 2026-10-11, after
 * the third regression: the gate's log parse, path quotes, the DGX run folder's list). Git quotes such a name unless
 * told not to; a path-listing call that forgets reads "tools/\\355\\225\\234…" for it. Off the safe list (no .md, not
 * under docs/), imported by nothing, with a space.
 */
export const KOREAN_PATH = "tools/한글 이름.cfg";
export function writeKoreanFile(dir: string, text = "기본\n"): void {
  mkdirSync(join(dir, "tools"), { recursive: true });
  writeFileSync(join(dir, KOREAN_PATH), text);
}
