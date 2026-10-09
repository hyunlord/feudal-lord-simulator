import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { QUIET_GIT, tempDir } from "./helpers/tempRepo";

// The trunk's bundled clone names the first bad commit (scripts/remote/tasks.sh trunk-bisect, run by trunkClone.sh):
// a throwaway repository whose fourth commit breaks a check, with a merge in the range as the trunk has.
const tasks = resolve(import.meta.dirname, "../scripts/remote/tasks.sh");
const hasBash = spawnSync("bash", ["-c", "true"]).status === 0;

test("trunk-bisect names the first commit where the check fails, across a merge", { skip: !hasBash && "needs bash" }, () => {
  const dir = tempDir("fls-bisect-");
  const git = (...args: string[]) => execFileSync("git", [...QUIET_GIT, "-c", "user.name=tester", ...args], { cwd: dir, encoding: "utf8" }).trim();
  const commit = (message: string) => { git("add", "-A"); git("commit", "-qm", message); return git("rev-parse", "HEAD"); };
  try {
    git("init", "-q", "-b", "trunk");
    writeFileSync(join(dir, "package-lock.json"), "{}\n"); writeFileSync(join(dir, ".gitignore"), "node_modules\n.remote/\n");
    writeFileSync(join(dir, "value.txt"), "good\n");
    const good = commit("c1 start");
    writeFileSync(join(dir, "a.txt"), "1\n"); commit("c2 fine");
    git("checkout", "-qb", "side"); writeFileSync(join(dir, "b.txt"), "1\n"); commit("c3 side work");
    git("checkout", "-q", "trunk"); git("merge", "-q", "--no-edit", "side");
    writeFileSync(join(dir, "value.txt"), "bad\n"); commit("EB-C4: BREAKS-IT\n\nConfidence: high");
    writeFileSync(join(dir, "c.txt"), "1\n"); const bad = commit("c5 later");
    mkdirSync(join(dir, "node_modules"));
    const out = spawnSync("bash", [tasks, "trunk-bisect", good, bad, "--", "grep", "-q", "good", "value.txt"], { cwd: dir, encoding: "utf8" });
    assert.equal(out.status, 0, out.stderr);
    // Every session commits as the same git user: the line names the owner from the prefix (user order 2026-10-09).
    assert.match(readFileSync(join(dir, ".remote/bisect.txt"), "utf8"), /^[0-9a-f]{7,} EB-C4: BREAKS-IT \(tester\) — owner: engine B \(Astra\), by its EB- prefix$/m);
    assert.equal(git("worktree", "list").split("\n").length, 1, "the bisect tree is gone");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

const owner = resolve(import.meta.dirname, "../scripts/remote/commitOwner.sh");

test("the clone notice's owner comes from the commit's prefix and closing lines, a merge by its branch tip", { skip: !hasBash && "needs bash" }, () => {
  const dir = tempDir("fls-owner-");
  const git = (...args: string[]) => execFileSync("git", [...QUIET_GIT, "-c", "user.name=tester", ...args], { cwd: dir, encoding: "utf8" }).trim();
  let n = 0;
  const commit = (message: string) => { writeFileSync(join(dir, "f.txt"), `${n++}\n`); git("add", "-A"); git("commit", "-qm", message); return git("rev-parse", "HEAD"); };
  const ownerOf = (sha: string) => execFileSync("bash", [owner, sha], { cwd: dir, encoding: "utf8" }).trim();
  try {
    git("init", "-q", "-b", "trunk");
    assert.equal(ownerOf(commit("EB-LME9c-2: ground six more decisions\n\nConfidence: high")), "engine B (Astra), by its EB- prefix");
    assert.equal(ownerOf(commit("RB-HEIGHT-ERA: retain a receipt")), "render B (Astra), by its RB- prefix");
    assert.equal(ownerOf(commit("LM-R3: choose the house\n\nCo-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>")), "a Claude session, task LM-R3");
    assert.equal(ownerOf(commit("Keep the wet-path installation traceable\n\nTested: 12 tests\nScope-risk: low")), "an Astra session (engine B or render B: no EB-/RB- prefix)");
    assert.equal(ownerOf(commit("NAT-2: report")), "unknown (no EB-/RB- prefix, no Claude or Astra lines), task NAT-2");
    git("checkout", "-qb", "side"); const tip = commit("RB-SEASONS: winter edge");
    git("checkout", "-q", "trunk"); git("merge", "-q", "--no-ff", "--no-edit", "side");
    assert.equal(ownerOf(git("rev-parse", "HEAD")), `render B (Astra), by its RB- prefix (a merge, judged by its branch tip ${tip.slice(0, 7)})`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
