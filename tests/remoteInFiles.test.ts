import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { QUIET_ENV, gitIn, tempDir } from "./helpers/tempRepo";

// The DGX timers make a run folder with `git archive` and list its files in .remote-in/in-files.txt; remote-exec.sh
// deletes every file of the folder that list does not name (stale). A list with quoted names (git's default for Korean
// letters) named no file there: the 16 review records `검수표.md` were deleted and the nightly audit of 2026-10-11
// measured a dirty tree (nightly-GEOMETRY-1011-eeae4c8, not valid). Each timer's own listing line runs here.
const hasBash = spawnSync("bash", ["-c", "true"]).status === 0;

for (const script of ["nightlyGeometry.sh", "trunkClone.sh"]) {
  test(`${script}: the run folder's file list names every file as it is on disk, Korean names too`, { skip: !hasBash && "needs bash" }, () => {
    const source = readFileSync(resolve(import.meta.dirname, "../scripts/remote", script), "utf8");
    const lines = source.split("\n").filter(line => line.includes("ls-tree") && line.includes("in-files.txt"));
    assert.equal(lines.length, 1, "one listing line");
    const repo = tempDir("fls-infiles-");
    try {
      const git = gitIn(repo);
      git("init", "-q", "-b", "trunk");
      mkdirSync(join(repo, "records"));
      writeFileSync(join(repo, "a.txt"), "1\n");
      writeFileSync(join(repo, "records", "검수표.md"), "1\n");
      writeFileSync(join(repo, "records", "with space.md"), "1\n");
      git("add", "-A"); git("commit", "-qm", "c1");
      const sha = git("rev-parse", "HEAD");
      const dir = join(repo, "run");
      mkdirSync(join(dir, ".remote-in"), { recursive: true });
      execFileSync("bash", ["-c", `git -C "$MIRROR" archive "$sha" | tar -x -C "$dir"\n${lines[0]}`], { env: { ...QUIET_ENV, MIRROR: repo, sha, dir } });
      const listed = readFileSync(join(dir, ".remote-in", "in-files.txt"), "utf8").split("\n").filter(Boolean);
      assert.deepEqual(listed.sort(), ["a.txt", "records/with space.md", "records/검수표.md"].sort());
      for (const path of listed) assert.ok(existsSync(join(dir, path)), `${path} is a file of the run folder`);
    } finally { rmSync(repo, { recursive: true, force: true }); }
  });
}
