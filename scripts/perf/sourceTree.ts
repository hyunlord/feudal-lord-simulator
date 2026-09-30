// A detached worktree of a commit to build it beside the current checkout (perf:ab, the trend): node_modules is
// shared when package-lock.json is the same, else installed with `npm ci`. The caller removes it (git worktree remove).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export function sourceTree(repo: string, commit: string): string {
  const dir = join(tmpdir(), `fls-src-${commit.slice(0, 12)}-${process.pid}`);
  if (!existsSync(dir)) {
    const added = spawnSync("git", ["-C", repo, "worktree", "add", "--detach", dir, commit], { encoding: "utf8" });
    if (added.status !== 0) throw new Error(`worktree ${commit}: ${added.stderr}`);
  }
  if (!existsSync(join(dir, "node_modules"))) {
    const same = readFileSync(join(repo, "package-lock.json"), "utf8") === readFileSync(join(dir, "package-lock.json"), "utf8");
    if (same) symlinkSync(resolve(repo, "node_modules"), join(dir, "node_modules"));
    else {
      const ci = spawnSync("npm", ["ci", "--no-audit", "--no-fund", "--ignore-scripts"], { cwd: dir, encoding: "utf8" });
      if (ci.status !== 0) throw new Error(`npm ci ${commit}: ${ci.stderr.slice(-400)}`);
    }
  }
  return dir;
}
