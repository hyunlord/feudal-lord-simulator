import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

// The DGX slot keeper (scripts/remote/slotKeeper.sh, decision RR23) holds the rules — the last slot is the gates', one
// experiment per session, sessions in turn — for every copy of heavySlots.sh a run brings: the one before RR20 that
// filled all three slots on 2026-10-07 (first come first served, 7c81bc43), RR20's (8eb15180), RR21's (f9e98bcf) and
// this one. The old copies are kept as they were in tests/fixtures/heavySlots/. Linux flock only (the DGX).
// RR9: every wait is for a state (a log line, a status line), polled; the cap only ends a hung test.
const ROOT = resolve(import.meta.dirname, "..");
const KEEPER = join(ROOT, "scripts/remote/slotKeeper.sh");
const COPIES = {
  now: join(ROOT, "scripts/remote/heavySlots.sh"),
  fifo: join(ROOT, "tests/fixtures/heavySlots/heavySlots-fifo-7c81bc43.sh"),
  lines: join(ROOT, "tests/fixtures/heavySlots/heavySlots-lines-8eb15180.sh"),
  turns: join(ROOT, "tests/fixtures/heavySlots/heavySlots-turns-f9e98bcf.sh"),
};
const hasFlock = spawnSync("sh", ["-c", "command -v flock"]).status === 0;
const CAP_MS = 5 * 60_000;
const pause = (ms: number) => new Promise(done => setTimeout(done, ms));

function bench(name: string) {
  const base = mkdtempSync(join(tmpdir(), `fls-keeper-${name}-`));
  mkdirSync(join(base, "_slots"), { recursive: true });
  writeFileSync(join(base, "_slots/max"), "4\n");             // every copy reads it: slots 1-3 experiments, 4 gates
  const children: ChildProcess[] = [];
  const out: Record<string, string> = {};
  const status = () => existsSync(join(base, "_slots/keeper.status")) ? readFileSync(join(base, "_slots/keeper.status"), "utf8") : "";
  const until = async (what: string, check: () => boolean) => {
    for (const end = Date.now() + CAP_MS; !check() && Date.now() < end;) await pause(100);
    if (!check()) assert.fail(`${what}\n--- keeper status\n${status()}\n--- keeper log\n${(out.keeper ?? "").slice(-2_000)}\n--- runs\n${Object.entries(out).filter(([run]) => run !== "keeper").map(([run, text]) => `[${run}]\n${text.slice(-800)}`).join("\n")}`);
  };
  const keeper = () => {
    const child = spawn("bash", [KEEPER], { env: { ...process.env, FLS_KEEPER_BASE: base, KEEPER_POLL_S: "0.3", KEEPER_DOOR_S: "20", KEEPER_UPDATE: "0" }, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout!.on("data", chunk => { out.keeper = (out.keeper ?? "") + chunk; });
    children.push(child);
    return child;
  };
  // A run whose folder holds <copy> as scripts/remote/heavySlots.sh — the copy it sources, as remote-exec.sh does.
  const start = (run: string, copy: keyof typeof COPIES, cls: "gate" | "experiment") => {
    const helper = join(base, run, "scripts/remote/heavySlots.sh");
    mkdirSync(join(base, run, "scripts/remote"), { recursive: true });
    copyFileSync(COPIES[copy], helper);
    const child = spawn("bash", ["-c", `. ${JSON.stringify(helper)}; heavy_take_slot ${JSON.stringify(base)} ${run} "test ${run}" ${cls}; echo TOOK
while [ ! -e ${JSON.stringify(join(base, `release-${run}`))} ]; do sleep 0.2; done`],
      { env: { ...process.env, HEAVY_SLOTS: "4", HEAVY_POLL_S: "1", HEAVY_KEEPER_POLL_S: "0.3" }, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout!.on("data", chunk => { out[run] = (out[run] ?? "") + chunk; });
    children.push(child);
  };
  const release = (run: string) => writeFileSync(join(base, `release-${run}`), "");
  const done = () => {
    for (const run of Object.keys(out)) release(run);
    for (const child of children) if (child.exitCode === null) child.kill("SIGKILL");
    rmSync(base, { recursive: true, force: true });
  };
  return { base, out, until, keeper, start, release, status, done };
}

test("the keeper holds the rules for every copy of heavySlots.sh: an old copy neither takes the gates' slot nor a second slot for its session", { skip: !hasFlock && "needs flock (Linux)" }, async () => {
  const b = bench("rules");
  try {
    b.keeper(); await b.until("the keeper writes its status", () => /cap 4, slots 1-3 for experiments, slot 4 kept for gates/.test(b.status()));
    b.start("engineB-a", "fifo", "experiment"); await b.until("the first old run goes", () => /== heavy slot 1\/4/.test(b.out["engineB-a"] ?? ""));
    b.start("engineB-b", "fifo", "experiment");
    await b.until("the keeper says why engineB-b waits", () => /engineB waits: engineB-b — engineB has an experiment running/.test(b.status()));
    // An RR21 copy of another session goes past the old run at the front of the line; so does a run of this protocol.
    b.start("render-x", "turns", "experiment"); await b.until("render-x goes", () => /== heavy slot 2\/4 \(experiment line\)/.test(b.out["render-x"] ?? ""));
    b.start("engine-x", "now", "experiment"); await b.until("engine-x goes", () => /== heavy slot 3\/4 \(experiment line, let in by the DGX slot keeper\)/.test(b.out["engine-x"] ?? ""));
    // Slot 4 is free. The 7c81bc43 copy alone would take it (it is first in its line, and that copy takes any free slot up
    // to the cap): this is 2026-10-07. Once it has looked with engine-x in slot 3, it has seen slot 4 free and the fence.
    await b.until("engineB-b has looked again", () => /running slot 3: engine-x[\s\S]*ahead in line: _slotkeeper/.test(b.out["engineB-b"] ?? ""));
    assert.doesNotMatch(b.out["engineB-b"] ?? "", /TOOK/, "slot 4 is the gates' and engineB has one running");
    b.start("engine-gate", "turns", "gate"); await b.until("a gate takes slot 4", () => /== heavy slot 4\/4 \(gate line\)/.test(b.out["engine-gate"] ?? ""));
    b.start("astra-gate", "lines", "gate"); await b.until("the next gate waits", () => /gate line \(first come first served\):\n {2}1\. astra-gate \(lines copy\)/.test(b.status()));
    b.release("render-x");                                     // slot 2 frees: the waiting gate, not an experiment
    await b.until("astra-gate takes slot 2", () => /== heavy slot 2\/4 \(gate line\)/.test(b.out["astra-gate"] ?? ""));
    assert.doesNotMatch(b.out["engineB-b"] ?? "", /TOOK/);
    b.release("engineB-a");                                    // engineB has none running now: its old run goes
    await b.until("engineB-b takes slot 1", () => /== heavy slot 1\/4/.test(b.out["engineB-b"] ?? ""));
  } finally { b.done(); }
});

test("the keeper lets the session served longest ago go first, one experiment per session, with RR21 copies too", { skip: !hasFlock && "needs flock (Linux)" }, async () => {
  const b = bench("turns");
  try {
    // Started together after the keeper: it lets them in one at a time (without it, RR21's own rule can let two of them
    // in at once when neither sees the other's ticket yet).
    b.keeper(); await b.until("the keeper writes its status", () => /slot 4 kept for gates/.test(b.status()));
    for (let n = 1; n <= 3; n += 1) b.start(`infra-hold${n}`, "now", "experiment");
    await b.until("one infra run holds a slot", () => /slot 1: infra-hold/.test(b.status()));
    // Only one infra experiment at a time: the other two wait though slots 2 and 3 are free.
    await b.until("the others wait their turn", () => /infra waits: infra-hold\d — infra has an experiment running/.test(b.status()));
    mkdirSync(join(b.base, "_slots/served"), { recursive: true });
    writeFileSync(join(b.base, "_slots/served/render"), "");   // render was served just now; astra never
    b.start("render-r", "turns", "experiment");
    await b.until("render-r goes (slot 2 is free and render has none running)", () => /== heavy slot 2\/4/.test(b.out["render-r"] ?? ""));
    b.start("astra-a", "turns", "experiment");
    await b.until("astra-a goes", () => /== heavy slot 3\/4/.test(b.out["astra-a"] ?? ""));
    // Now: render-s (RR21 copy, render served just now) arrives before engine-e (RR21 copy, engine never served).
    b.start("render-s", "turns", "experiment"); await b.until("render-s waits", () => /render waits: render-s/.test(b.status()));
    b.start("engine-e", "turns", "experiment"); await b.until("engine-e waits", () => /engine \(served never\): engine-e/.test(b.status()));
    b.release("render-r");                                     // slot 2 frees, render has none running: still engine first
    await b.until("engine-e goes first", () => /== heavy slot 2\/4/.test(b.out["engine-e"] ?? ""));
    assert.doesNotMatch(b.out["render-s"] ?? "", /TOOK/);
    b.release("astra-a");
    await b.until("render-s goes", () => /== heavy slot 3\/4/.test(b.out["render-s"] ?? ""));
  } finally { b.done(); }
});

test("an older copy goes only when it is first in its line; when the keeper stops, its fences go and every copy follows its own rules", { skip: !hasFlock && "needs flock (Linux)" }, async () => {
  const b = bench("stop");
  try {
    const keeper = b.keeper();
    await b.until("the fences stand", () => existsSync(join(b.base, "_slots/queue/0000000000000000000-_slotkeeper")) && existsSync(join(b.base, "_slots/queue-gate/0000000000000000000-_slotkeeper")));
    b.start("engineB-o", "fifo", "experiment"); await b.until("engineB-o goes", () => /== heavy slot 1\/4/.test(b.out["engineB-o"] ?? ""));
    b.start("engineB-p", "fifo", "experiment"); await b.until("engineB-p waits", () => /engineB waits: engineB-p/.test(b.status()));
    // The RR20 copy only looks at the tickets ahead of it: behind engineB-p it cannot be let in alone.
    b.start("astra-l", "lines", "experiment");
    await b.until("astra-l waits behind it", () => /astra waits: astra-l — an older copy of heavySlots.sh \(lines\), let in only when first in line/.test(b.status()));
    b.release("engineB-o");
    await b.until("engineB-p goes", () => /== heavy slot 1\/4/.test(b.out["engineB-p"] ?? ""));
    await b.until("then astra-l, first in line now", () => /== heavy slot 2\/4 \(experiment line\)/.test(b.out["astra-l"] ?? ""));
    keeper.kill("SIGTERM");
    await b.until("the keeper lifted its fences", () => /fences are lifted/.test(b.out.keeper ?? ""));
    assert.ok(!existsSync(join(b.base, "_slots/queue/0000000000000000000-_slotkeeper")));
    b.start("engine-f", "now", "experiment");
    await b.until("a run takes a slot by its own rules", () => /== heavy slot 3\/4 \(experiment line\)$/m.test(b.out["engine-f"] ?? ""));
  } finally { b.done(); }
});
