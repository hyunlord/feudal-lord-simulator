import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync, type ChildProcess } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
    { encoding: "utf8", env: { ...process.env, DC_FREE_GB: "1000", DC_TMP: join(dir, "_no-tmp"), ...env } });   // never the real /tmp
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

test("a folder with a read-only part is left whole and said once in the clean's own log; by default (RR15b) a run folder finished a day ago, unlocked, unused and wholly ours gets u+w back and goes", { skip: !linux && "needs Linux flock, /proc and zstd" }, () => {
  const dir = base();
  const frozen = (name: string, finishedHoursAgo: number) => {
    run(dir, name, { finishedHoursAgo, folderHoursAgo: 30 });
    // As a run's prep locks its input states (files 0444, folders 0555) and never unlocks them.
    const states = join(dir, name, ".remote/geometry/private-scenes/UI5_STATES");
    mkdirSync(states, { recursive: true }); writeFileSync(join(states, "town.json"), "{}"); chmodSync(join(states, "town.json"), 0o444); chmodSync(states, 0o555);
    touch(join(dir, name), 30);
  };
  try {
    frozen("frozen-1111111", 30);
    frozen("young-frozen-1111111", 2);
    for (const n of [1, 2, 3]) run(dir, `newest-${n}-1111111`, { finishedHoursAgo: 99, folderHoursAgo: 0 });
    const logged = (name: string) => readFileSync(join(dir, "_logs/disk-clean.log"), "utf8").split("\n").filter(line => line.includes(`left ${name} `));

    const off = clean(dir, "normal", { DC_FIX_READONLY: "0" });
    assert.equal(existsSync(join(dir, "frozen-1111111/.remote/exit-code")), true, "turned off: left whole, no part deleted (it can still age and go later)");
    assert.equal(existsSync(join(dir, "frozen-1111111/big.bin")), true);
    assert.doesNotMatch(off, /frozen-1111111|허가|denied/i, "nothing about it in the run's log");
    assert.equal(logged("frozen-1111111").length, 1);
    assert.match(logged("frozen-1111111")[0]!, /left frozen-1111111 whole: \.remote\/geometry\/private-scenes\/UI5_STATES is not writable/);
    clean(dir, "normal", { DC_FIX_READONLY: "0" });
    assert.equal(logged("frozen-1111111").length, 1, "said once, not at every clean");

    // Tight takes every finished folder at any age, but write permission comes back only after a day.
    const fixed = clean(dir, "tight", { DC_FREE_GB: "10" });
    assert.equal(existsSync(join(dir, "frozen-1111111")), false, "default: finished 30 h ago, ours, unlocked, unused — u+w restored, then it goes");
    assert.match(fixed, /removed run folder frozen-1111111/);
    assert.equal(existsSync(join(dir, "_logs/disk-clean.left/frozen-1111111")), false, "forgotten once it went");
    assert.equal(existsSync(join(dir, "young-frozen-1111111/.remote/exit-code")), true, "finished 2 h ago: left whole even in tight mode");
    assert.equal(logged("young-frozen-1111111").length, 1);
  } finally { spawnSync("chmod", ["-R", "u+w", dir]); rmSync(dir, { recursive: true, force: true }); }
});
test("the game's /tmp leftovers: a source tree whose process is gone goes, tsx cache files unread for three days go; the rest stays", { skip: !linux && "needs Linux flock, /proc and zstd" }, async () => {
  const dir = base(); const tmp = mkdtempSync(join(tmpdir(), "fls-disk-tmp-")); const holders: ChildProcess[] = [];
  try {
    const gone = spawnSync("true").pid!;                     // a pid that has exited
    for (const pid of [gone, process.pid]) mkdirSync(join(tmp, `fls-src-0123456789ab-${pid}`, "src"), { recursive: true });
    const worked = join(tmp, `fls-src-ba9876543210-${gone}`); mkdirSync(worked);
    const sleeper = spawn("sleep", ["600"], { cwd: worked, stdio: "ignore" }); holders.push(sleeper);
    for (let i = 0; i < 3000 && spawnSync("readlink", [`/proc/${sleeper.pid}/cwd`], { encoding: "utf8" }).stdout.trim() !== worked; i++) await new Promise(done => setTimeout(done, 20));
    const uid = execFileSync("id", ["-u"], { encoding: "utf8" }).trim();
    const tsx = join(tmp, `tsx-${uid}`); mkdirSync(tsx);
    for (const [name, daysAgo] of [["stale", 5], ["read-yesterday", 1]] as const) {
      writeFileSync(join(tsx, name), "compiled\n");
      execFileSync("touch", ["-a", "-d", `@${Math.floor(Date.now() / 1000 - daysAgo * 86400)}`, join(tsx, name)]);
    }
    const log = clean(dir, "normal", { DC_TMP: tmp });
    assert.equal(existsSync(join(tmp, `fls-src-0123456789ab-${gone}`)), false);
    assert.equal(existsSync(join(tmp, `fls-src-0123456789ab-${process.pid}`)), true, "its process is alive");
    assert.equal(existsSync(worked), true, "a process works in it");
    assert.equal(existsSync(join(tsx, "stale")), false);
    assert.equal(existsSync(join(tsx, "read-yesterday")), true);
    assert.match(log, new RegExp(`removed ${tmp}/fls-src-0123456789ab-${gone} .*process ${gone} is gone`));
    assert.match(log, /tsx cache: removed 1 file\(s\) not read for 3 days/);
  } finally { for (const h of holders) h.kill("SIGKILL"); rmSync(dir, { recursive: true, force: true }); rmSync(tmp, { recursive: true, force: true }); }
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
