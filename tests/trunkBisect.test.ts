import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

// The trunk's bundled clone names the first bad commit (scripts/remote/tasks.sh trunk-bisect, run by trunkClone.sh):
// a throwaway repository whose fourth commit breaks a check, with a merge in the range as the trunk has.
const tasks = resolve(import.meta.dirname, "../scripts/remote/tasks.sh");
const hasBash = spawnSync("bash", ["-c", "true"]).status === 0;

test("trunk-bisect names the first commit where the check fails, across a merge", { skip: !hasBash && "needs bash" }, () => {
  const dir = mkdtempSync(join(tmpdir(), "fls-bisect-"));
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=tester", ...args], { cwd: dir, encoding: "utf8" }).trim();
  const commit = (message: string) => { git("add", "-A"); git("commit", "-qm", message); return git("rev-parse", "HEAD"); };
  try {
    git("init", "-q", "-b", "trunk");
    writeFileSync(join(dir, "package-lock.json"), "{}\n"); writeFileSync(join(dir, ".gitignore"), "node_modules\n.remote/\n");
    writeFileSync(join(dir, "value.txt"), "good\n");
    const good = commit("c1 start");
    writeFileSync(join(dir, "a.txt"), "1\n"); commit("c2 fine");
    git("checkout", "-qb", "side"); writeFileSync(join(dir, "b.txt"), "1\n"); commit("c3 side work");
    git("checkout", "-q", "trunk"); git("merge", "-q", "--no-edit", "side");
    writeFileSync(join(dir, "value.txt"), "bad\n"); commit("c4 BREAKS-IT");
    writeFileSync(join(dir, "c.txt"), "1\n"); const bad = commit("c5 later");
    mkdirSync(join(dir, "node_modules"));
    const out = spawnSync("bash", [tasks, "trunk-bisect", good, bad, "--", "grep", "-q", "good", "value.txt"], { cwd: dir, encoding: "utf8" });
    assert.equal(out.status, 0, out.stderr);
    assert.match(readFileSync(join(dir, ".remote/bisect.txt"), "utf8"), /^[0-9a-f]{7,} c4 BREAKS-IT \(tester\)/);
    assert.equal(git("worktree", "list").split("\n").length, 1, "the bisect tree is gone");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
