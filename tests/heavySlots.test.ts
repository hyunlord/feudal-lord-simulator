import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

// The DGX heavy-run cap (scripts/remote/heavySlots.sh, decision RR14): two slots, the rest in line, first come first
// served, each waiting run logging its place and what runs ahead. Linux flock only (the DGX): skipped where it is
// missing. RR9: every wait is for a state (a log line, a slot taken), polled; the cap only ends a hung test.
const helper = resolve(import.meta.dirname, "../scripts/remote/heavySlots.sh");
const hasFlock = spawnSync("sh", ["-c", "command -v flock"]).status === 0;
const CAP_MS = 5 * 60_000;
const pause = (ms: number) => new Promise(done => setTimeout(done, ms));

test("two heavy runs go, the next ones wait in line with their place and the runs ahead, then go in order", { skip: !hasFlock && "needs flock (Linux)" }, async () => {
  const base = mkdtempSync(join(tmpdir(), "fls-heavy-"));
  const children: ChildProcess[] = [];
  const log = (run: string) => join(base, `${run}.log`);
  const start = (run: string) => {
    const body = `. ${JSON.stringify(helper)}; heavy_take_slot ${JSON.stringify(base)} ${run} "test: ${run} command"; echo TOOK
while [ ! -e ${JSON.stringify(join(base, `release-${run}`))} ]; do sleep 0.2; done`;
    const child = spawn("bash", ["-c", body], { env: { ...process.env, HEAVY_SLOTS: "3", HEAVY_POLL_S: "1" }, stdio: ["ignore", "pipe", "pipe"] });   // 3: experiments use 1–2
    child.stdout!.on("data", chunk => writeFileSync(log(run), chunk, { flag: "a" }));
    children.push(child);
  };
  const text = (run: string) => existsSync(log(run)) ? readFileSync(log(run), "utf8") : "";
  const until = async (run: string, pattern: RegExp) => {
    for (const end = Date.now() + CAP_MS; !pattern.test(text(run)) && Date.now() < end;) await pause(100);
    assert.match(text(run), pattern);
  };
  try {
    mkdirSync(join(base, "_slots/queue"), { recursive: true });
    // A ticket left by a run that is gone (not locked, older than a minute) is dropped, not counted.
    writeFileSync(join(base, "_slots/queue", `${(BigInt(Date.now() - 3_600_000) * 1_000_000n).toString()}-gone-run`), "");
    start("a"); await until("a", /TOOK/);
    start("b"); await until("b", /TOOK/);
    // A waiting run's log arrives line by line: wait for each expected line itself.
    start("c"); await until("c", /number 1 in line/);
    await until("c", /running slot 1: a .*test: a command/);
    await until("c", /running slot 2: b .*test: b command/);
    start("d"); await until("d", /number 2 in line/);
    await until("d", /ahead in line: c\b/);
    assert.deepEqual(spawnSync("ls", [join(base, "_slots/queue")], { encoding: "utf8" }).stdout.split("\n").filter(Boolean).map(name => name.replace(/^\d+-/, "")).sort(), ["c", "d"]);

    writeFileSync(join(base, "release-a"), "");
    await until("c", /TOOK/);
    assert.doesNotMatch(text("d"), /TOOK/);
    await until("d", /number 1 in line/);
    writeFileSync(join(base, "release-b"), "");
    await until("d", /TOOK/);
  } finally {
    for (const run of ["a", "b", "c", "d"]) writeFileSync(join(base, `release-${run}`), "");
    for (const child of children) if (child.exitCode === null) child.kill("SIGKILL");
    rmSync(base, { recursive: true, force: true });
  }
});

// The experiment line keeps the last slot for gates (RR20); with a cap of 4, experiments use slots 1–3.
test("an experiment takes a slot no experiment ahead of it can take: a slot the older copies do not know is not left empty", { skip: !hasFlock && "needs flock (Linux)" }, async () => {
  const base = mkdtempSync(join(tmpdir(), "fls-heavy3-"));
  const children: ChildProcess[] = [];
  const out: Record<string, string> = {};
  const hold = (file: string) => { const c = spawn("bash", ["-c", `exec 9>"$1"; flock -n 9 || exit 1; exec sleep 600`, "hold", file], { stdio: "ignore" }); children.push(c); return c; };
  const held = (file: string) => spawnSync("bash", ["-c", `( flock -n 9 ) 9<"$1"`, "c", file]).status !== 0;
  const until = async (check: () => boolean) => { for (const end = Date.now() + CAP_MS; !check() && Date.now() < end;) await pause(100); assert.ok(check()); };
  try {
    mkdirSync(join(base, "_slots/queue"), { recursive: true });
    for (const n of [1, 2]) { writeFileSync(join(base, `_slots/heavy.${n}.info`), `old-${n}\t0\tbusy\n`); hold(join(base, `_slots/heavy.${n}.lock`)); }
    // An older copy of heavySlots.sh waits for slots 1–2: its ticket is empty (counts as cap 2) and held.
    const old = join(base, "_slots/queue", `${(BigInt(Date.now() - 5000) * 1_000_000n).toString()}-old-run`);
    writeFileSync(old, ""); hold(old);
    await until(() => held(join(base, "_slots/heavy.2.lock")) && held(old));
    const start = (run: string, cls: string) => {
      const child = spawn("bash", ["-c", `. ${JSON.stringify(helper)}; heavy_take_slot ${JSON.stringify(base)} ${run} "test" ${cls}; echo TOOK; exec sleep 600`],
        { env: { ...process.env, HEAVY_SLOTS: "4", HEAVY_POLL_S: "1" }, stdio: ["ignore", "pipe", "pipe"] });
      child.stdout!.on("data", chunk => { out[run] = (out[run] ?? "") + chunk; });
      children.push(child);
    };
    start("new", "experiment");
    await until(() => /== heavy slot 3\/4 \(experiment line\)/.test(out.new ?? ""));
    start("later", "experiment");
    await until(() => /number 2 in line/.test(out.later ?? ""));
    assert.doesNotMatch(out.later ?? "", /TOOK/, "slot 4 is the gates'");
  } finally {
    for (const child of children) child.kill("SIGKILL");
    rmSync(base, { recursive: true, force: true });
  }
});

test("the gate line: a gate runs at once on the slot kept for gates while experiments fill the rest, and goes before waiting experiments", { skip: !hasFlock && "needs flock (Linux)" }, async () => {
  const base = mkdtempSync(join(tmpdir(), "fls-gate-"));
  const children: ChildProcess[] = [];
  const out: Record<string, string> = {};
  const until = async (check: () => boolean) => { for (const end = Date.now() + CAP_MS; !check() && Date.now() < end;) await pause(100); assert.ok(check()); };
  const start = (run: string, cls: string) => {
    const child = spawn("bash", ["-c", `. ${JSON.stringify(helper)}; heavy_take_slot ${JSON.stringify(base)} ${run} "test" ${cls}; echo TOOK
while [ ! -e ${JSON.stringify(join(base, `release-${run}`))} ]; do sleep 0.2; done`],
      { env: { ...process.env, HEAVY_SLOTS: "3", HEAVY_POLL_S: "1" }, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout!.on("data", chunk => { out[run] = (out[run] ?? "") + chunk; });
    children.push(child);
  };
  try {
    start("exp1", "experiment"); await until(() => /heavy slot 1\/3 \(experiment line\)/.test(out.exp1 ?? ""));
    start("exp2", "experiment"); await until(() => /heavy slot 2\/3 \(experiment line\)/.test(out.exp2 ?? ""));
    start("exp3", "experiment"); await until(() => /experiment line: slots 1-2, slot 3 kept for gates\): number 1 in line/.test(out.exp3 ?? ""));
    start("gate1", "gate"); await until(() => /heavy slot 3\/3 \(gate line\)/.test(out.gate1 ?? ""));
    start("gate2", "gate"); await until(() => /gate line, every slot busy\): number 1 among gates/.test(out.gate2 ?? ""));
    await until(() => /1 gate\(s\) go first/.test(out.exp3 ?? ""));
    writeFileSync(join(base, "release-exp1"), "");           // slot 1 frees: the waiting gate takes it, not the experiment
    await until(() => /heavy slot 1\/3 \(gate line\)/.test(out.gate2 ?? ""));
    assert.doesNotMatch(out.exp3 ?? "", /TOOK/);
    writeFileSync(join(base, "release-exp2"), "");           // no gate waits now: the experiment takes slot 2
    await until(() => /heavy slot 2\/3 \(experiment line\)/.test(out.exp3 ?? ""));
  } finally {
    for (const run of ["exp1", "exp2", "exp3", "gate1", "gate2"]) writeFileSync(join(base, `release-${run}`), "");
    for (const child of children) if (child.exitCode === null) child.kill("SIGKILL");
    rmSync(base, { recursive: true, force: true });
  }
});
