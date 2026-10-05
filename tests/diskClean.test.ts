import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

// DGX disk upkeep (scripts/remote/diskClean.sh, decision RR15) on a throwaway ~/fls-runs. Linux flock, GNU tar --zstd
// and /proc only (the DGX): skipped where they are missing. Ages are file times set by touch, never waited for (RR9).
const helper = resolve(import.meta.dirname, "../scripts/remote/diskClean.sh");
const linux = process.platform === "linux" && spawnSync("sh", ["-c", "command -v flock && command -v zstd"]).status === 0;
const TRUNK = "codex/phase15-organic-ground";

function base() {
  const dir = mkdtempSync(join(tmpdir(), "fls-disk-"));
  for (const sub of ["_locks", "_kept", "_clones"]) mkdirSync(join(dir, sub), { recursive: true });
  // The mirror: a bare repository whose trunk has a report naming one kept run.
  const work = mkdtempSync(join(tmpdir(), "fls-disk-mirror-"));   // outside the base: it would count as a run folder
  mkdirSync(join(work, "docs"), { recursive: true });
  writeFileSync(join(work, "docs/REPORT.md"), "clone kept-named-1111111 passed\n");
  const git = (cwd: string, ...args: string[]) => execFileSync("git", args, { cwd, stdio: "ignore" });
  git(work, "init", "-q", "-b", TRUNK); git(work, "-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
  git(work, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "r");
  execFileSync("git", ["clone", "-q", "--bare", work, join(dir, "_cache/repo.git")], { stdio: "ignore" });
  rmSync(work, { recursive: true, force: true });
  return dir;
}
const touch = (path: string, hoursAgo: number) => execFileSync("touch", ["-d", `@${Math.floor(Date.now() / 1000 - hoursAgo * 3600)}`, path]);
function run(dir: string, name: string, { finishedHoursAgo, keep = false, folderHoursAgo }: { finishedHoursAgo?: number; keep?: boolean; folderHoursAgo: number }) {
  const remote = join(dir, name, ".remote");
  mkdirSync(remote, { recursive: true });
  writeFileSync(join(dir, name, "big.bin"), "x".repeat(1000));
  if (finishedHoursAgo !== undefined) { writeFileSync(join(remote, "exit-code"), "0\n"); touch(join(remote, "exit-code"), finishedHoursAgo); }
  if (keep) { writeFileSync(join(remote, "keep"), ""); writeFileSync(join(remote, "summary.txt"), "kept result\n"); }
  touch(join(dir, name), folderHoursAgo);
}
function hold(lock: string): ChildProcess { return spawn("bash", ["-c", `exec 9>"$1"; flock -n 9 || exit 1; exec sleep 600`, "hold", lock], { stdio: "ignore" }); }
function clean(dir: string, mode: string, env: Record<string, string> = {}) {
  return execFileSync("bash", ["-c", `BASE=${JSON.stringify(dir)}; . ${JSON.stringify(helper)}; clean_disk test ${mode}`],
    { encoding: "utf8", env: { ...process.env, DC_FREE_GB: "1000", ...env } });
}
async function untilHeld(lock: string) {
  for (let i = 0; i < 3000 && spawnSync("bash", ["-c", `( flock -n 9 ) 9<"$1"`, "c", lock]).status === 0; i++) await new Promise(done => setTimeout(done, 20));
}

test("finished run folders go after a day (kept results copied first); running, unfinished, young and the newest three stay", { skip: !linux && "needs Linux flock, /proc and zstd" }, async () => {
  const dir = base(); const holders: ChildProcess[] = [];
  try {
    run(dir, "old-plain-1111111", { finishedHoursAgo: 30, folderHoursAgo: 30 });
    run(dir, "old-kept-1111111", { finishedHoursAgo: 40, keep: true, folderHoursAgo: 40 });
    run(dir, "young-1111111", { finishedHoursAgo: 2, folderHoursAgo: 20 });
    run(dir, "unfinished-1111111", { folderHoursAgo: 50 });
    run(dir, "running-1111111", { finishedHoursAgo: 60, folderHoursAgo: 60 });
    for (const n of [1, 2, 3]) run(dir, `newest-${n}-1111111`, { finishedHoursAgo: 99, folderHoursAgo: 0 });
    const lock = join(dir, "_locks/running-1111111.lock"); holders.push(hold(lock)); await untilHeld(lock);
    mkdirSync(join(dir, "_clones/left-1111111"), { recursive: true });
    mkdirSync(join(dir, "_clones/going-1111111"), { recursive: true });
    const going = join(dir, "_locks/going-1111111.lock"); holders.push(hold(going)); await untilHeld(going);

    const log = clean(dir, "normal");
    assert.equal(existsSync(join(dir, "old-plain-1111111")), false);
    assert.equal(existsSync(join(dir, "old-kept-1111111")), false);
    assert.equal(existsSync(join(dir, "_kept/old-kept-1111111/.remote/summary.txt")), true, "kept results copied before the folder went");
    for (const stays of ["young-1111111", "unfinished-1111111", "running-1111111", "newest-1-1111111", "newest-2-1111111", "newest-3-1111111"]) assert.equal(existsSync(join(dir, stays)), true, stays);
    assert.equal(existsSync(join(dir, "_clones/left-1111111")), false);
    assert.equal(existsSync(join(dir, "_clones/going-1111111")), true);
    assert.match(log, /removed run folder old-plain-1111111 .*finished 30 h ago/);
    assert.match(log, /GB free after cleaning/);

    const tight = clean(dir, "tight", { DC_FREE_GB: "10" });
    assert.equal(existsSync(join(dir, "young-1111111")), false, "tight takes every finished folder");
    assert.equal(existsSync(join(dir, "running-1111111")), true);
    assert.match(tight, /\(test, tight\)/);
  } finally { for (const h of holders) h.kill("SIGKILL"); rmSync(dir, { recursive: true, force: true }); }
});

test("kept results no report names are packed after three days; named and young ones stay", { skip: !linux && "needs Linux flock, /proc and zstd" }, () => {
  const dir = base();
  try {
    for (const [name, daysAgo] of [["kept-named-1111111", 5], ["kept-unnamed-1111111", 5], ["kept-young-1111111", 1]] as const) {
      mkdirSync(join(dir, "_kept", name, ".remote"), { recursive: true });
      writeFileSync(join(dir, "_kept", name, ".remote/summary.txt"), `${name}\n`);
      touch(join(dir, "_kept", name), daysAgo * 24);
    }
    const log = clean(dir, "normal");
    assert.equal(existsSync(join(dir, "_kept/kept-named-1111111")), true, "a report names it");
    assert.equal(existsSync(join(dir, "_kept/kept-young-1111111")), true);
    assert.equal(existsSync(join(dir, "_kept/kept-unnamed-1111111")), false);
    assert.equal(existsSync(join(dir, "_kept/_archive/kept-unnamed-1111111.tar.zst")), true);
    assert.match(log, /packed _kept\/kept-unnamed-1111111/);
    const listing = execFileSync("tar", ["--zstd", "-tf", join(dir, "_kept/_archive/kept-unnamed-1111111.tar.zst")], { encoding: "utf8" });
    assert.match(listing, /kept-unnamed-1111111\/\.remote\/summary\.txt/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
