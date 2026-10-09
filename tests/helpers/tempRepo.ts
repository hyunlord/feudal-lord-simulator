// Throwaway git repositories for the gate's tests (decision RR26: no flaky gate test). They live under the repository's
// ignored .tmp/, and their git runs without auto maintenance: every commit starts `git maintenance run --auto --detach`,
// which tidies .git/objects in the background while the test's next commit writes there. On the Mac that failed 4 runs
// in 10 with "unable to create temporary file: Invalid argument"; with maintenance off, 0 in 10 (2026-10-09).
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join, resolve } from "node:path";

export const TEMP_ROOT = resolve(import.meta.dirname, "../../.tmp");
/** Git options for a throwaway repository: a fixed author, no background maintenance or gc. */
export const QUIET_GIT = ["-c", "user.email=t@t", "-c", "user.name=t", "-c", "maintenance.auto=false", "-c", "gc.auto=0"];

/** A new empty folder under .tmp/ (removed by the test). */
export function tempDir(prefix: string): string {
  mkdirSync(TEMP_ROOT, { recursive: true });
  return mkdtempSync(join(TEMP_ROOT, prefix));
}

/** Git in `dir` with QUIET_GIT; returns trimmed stdout. */
export function gitIn(dir: string): (...args: string[]) => string {
  return (...args: string[]) => execFileSync("git", [...QUIET_GIT, ...args], { cwd: dir, encoding: "utf8" }).trim();
}
