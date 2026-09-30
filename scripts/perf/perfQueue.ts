// perf:gate's queue: judgement runs held for when nobody uses this Mac. `npm run perf:gate -- --queue [--source <commit>]
// [--label <name>] [gate options]` adds a job and starts the runner in the background if none is running. The runner
// waits until the Mac has had no keyboard or mouse input for --idle-minutes (10) and other work took at most 15 % of the
// cores for a minute, then runs the job's gate:
//  - the game is built from a detached worktree of the job's commit (node_modules shared when package-lock.json is
//    the same, else `npm ci`), with this checkout's gate scripts (scenes, checks) and scene save;
//  - a run a person touched (the Mac's hardware input idle time at its end is shorter than the run) is no judgement,
//    and so is a covered or undrawn window; a job that came out "판정 아님" goes back in the queue, five tries in all; queued, each scene also waits for a quiet Mac first.
// While the runner lives, `caffeinate -d -i` keeps the display awake (a slept or locked screen draws nothing).
// Jobs, the runner's pid and its log: ~/.fls-perf-queue (FLS_PERF_QUEUE). Results: the gate's usual files in the
// queuing checkout's docs/verification/perf-gate/ (commit them from there).
//   npm run perf:gate -- --queue-status        the jobs and their verdicts
//   npm run perf:gate -- --queue-cancel <id>
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { cpus, homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { hidIdleSeconds } from "./scenePage";
import { otherCpuSeconds } from "./machineLoad";

export const QUEUE_DIR = process.env.FLS_PERF_QUEUE ?? join(homedir(), ".fls-perf-queue");
const JOBS = join(QUEUE_DIR, "jobs"); const LOG = join(QUEUE_DIR, "runner.log"); const PID = join(QUEUE_DIR, "runner.pid");
export interface Job {
  readonly id: string; readonly repo: string; readonly commit: string; readonly source: string; readonly label: string;
  readonly args: readonly string[]; readonly idleMinutes: number; readonly queuedAt: string; readonly playwrightModule: string;
  status: "queued" | "running" | "done" | "no-judgement" | "cancelled"; attempts: number; results: { at: string; verdict: string; file: string | null; exit: number | null }[];
}
const MAX_ATTEMPTS = 5; const CPU_LIMIT = 0.15;
const log = (text: string) => { mkdirSync(QUEUE_DIR, { recursive: true }); appendFileSync(LOG, `${new Date().toISOString()} ${text}\n`); };
const readJob = (file: string) => JSON.parse(readFileSync(join(JOBS, file), "utf8")) as Job;
const writeJob = (job: Job) => writeFileSync(join(JOBS, `${job.id}.json`), `${JSON.stringify(job, null, 1)}\n`);
export const jobs = () => existsSync(JOBS) ? readdirSync(JOBS).filter(name => name.endsWith(".json")).sort().map(readJob) : [];
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const runnerPid = () => { try { const pid = Number(readFileSync(PID, "utf8")); return alive(pid) ? pid : null; } catch { return null; } };

/** Adds a job for `source` (a commit-ish of the checkout at `repo`) and makes sure a runner is waiting for it. */
export function enqueue(input: { readonly repo: string; readonly source: string; readonly label?: string; readonly args: readonly string[]; readonly idleMinutes: number }): Job {
  const playwrightModule = process.env.PLAYWRIGHT_MODULE ?? "";
  if (playwrightModule === "") throw new Error("PLAYWRIGHT_MODULE=/abs/path/playwright-core/index.mjs is required (the runner opens Chrome later)");
  const commit = spawnSync("git", ["-C", input.repo, "rev-parse", "--verify", `${input.source}^{commit}`], { encoding: "utf8" }).stdout.trim();
  if (commit === "") throw new Error(`${input.source}: not a commit in ${input.repo}`);
  mkdirSync(JOBS, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..*/, "");
  const job: Job = { id: `${stamp}-${commit.slice(0, 8)}`, repo: resolve(input.repo), commit, source: input.source, label: input.label ?? input.source,
    args: input.args, idleMinutes: input.idleMinutes, queuedAt: new Date().toISOString(), playwrightModule, status: "queued", attempts: 0, results: [] };
  writeJob(job); log(`queued ${job.id} ${job.label} (${commit.slice(0, 8)})`);
  if (runnerPid() === null) {
    const out = openSync(LOG, "a");
    const child = spawn(join(job.repo, "node_modules/.bin/tsx"), [join(job.repo, "scripts/perf/perfQueue.ts"), "run"], { cwd: job.repo, detached: true, stdio: ["ignore", out, out], env: process.env });
    child.unref(); log(`runner started (pid ${child.pid})`);
  }
  return job;
}

export function queueStatus(): string {
  const rows = jobs().map(job => `${job.id}  ${job.status.padEnd(12)} ${job.label} (${job.commit.slice(0, 8)}) · 시도 ${job.attempts} · ${job.results.map(result => result.verdict).join(" / ") || "-"}`);
  const pid = runnerPid();
  return [`대기열 ${QUEUE_DIR} · 실행기 ${pid === null ? "없음" : `pid ${pid}`} · 기록 ${LOG}`, ...rows].join("\n");
}
export function cancel(id: string) { const job = jobs().find(entry => entry.id === id); if (job === undefined) throw new Error(`no job ${id}`); job.status = "cancelled"; writeJob(job); log(`cancelled ${id}`); }

/** Waits for a Mac nobody uses: no hardware input for `minutes`, other work at most CPU_LIMIT of the cores for 60 s. */
async function waitForIdleMac(minutes: number) {
  let lastNote = 0;
  for (;;) {
    const idle = hidIdleSeconds() ?? 0;
    if (idle >= minutes * 60) {
      const before = otherCpuSeconds(); const at = Date.now();
      await new Promise(done => setTimeout(done, 60_000));
      const share = (otherCpuSeconds() - before) / (((Date.now() - at) / 1000) * cpus().length);
      if ((hidIdleSeconds() ?? 0) >= 60 && share <= CPU_LIMIT) return;
      if (Date.now() - lastNote > 300_000) { log(`waiting: idle ${Math.round(idle)} s, other CPU ${Math.round(share * 100)} %`); lastNote = Date.now(); }
    } else {
      if (Date.now() - lastNote > 300_000) { log(`waiting: the Mac was used ${Math.round(idle)} s ago (needs ${minutes} min)`); lastNote = Date.now(); }
      await new Promise(done => setTimeout(done, Math.max(15_000, Math.min(120_000, (minutes * 60 - idle) * 1000))));
    }
  }
}

/** A detached worktree of the job's commit, sharing node_modules when the lock file is the same. */
function sourceTree(job: Job): string {
  const dir = join(tmpdir(), `fls-gate-src-${job.commit.slice(0, 12)}`);
  if (!existsSync(dir)) {
    const added = spawnSync("git", ["-C", job.repo, "worktree", "add", "--detach", dir, job.commit], { encoding: "utf8" });
    if (added.status !== 0) throw new Error(`worktree: ${added.stderr}`);
  }
  if (!existsSync(join(dir, "node_modules"))) {
    const same = readFileSync(join(job.repo, "package-lock.json"), "utf8") === readFileSync(join(dir, "package-lock.json"), "utf8");
    if (same) symlinkSync(join(job.repo, "node_modules"), join(dir, "node_modules"));
    else { log(`${job.id}: npm ci (package-lock.json differs)`); const ci = spawnSync("npm", ["ci", "--no-audit", "--no-fund"], { cwd: dir, encoding: "utf8" }); if (ci.status !== 0) throw new Error(`npm ci: ${ci.stderr.slice(-500)}`); }
  }
  return dir;
}

async function runner() {
  mkdirSync(QUEUE_DIR, { recursive: true });
  const other = runnerPid(); if (other !== null && other !== process.pid) { log(`another runner (pid ${other}) is running`); return; }
  writeFileSync(PID, String(process.pid));
  spawn("caffeinate", ["-d", "-i", "-w", String(process.pid)], { stdio: "ignore", detached: true }).unref();
  for (;;) {
    const job = jobs().find(entry => entry.status === "queued");
    if (job === undefined) { log("queue empty: runner stops"); rmSync(PID, { force: true }); return; }
    log(`${job.id}: waiting for an idle Mac (${job.idleMinutes} min without input)`);
    await waitForIdleMac(job.idleMinutes);
    const fresh = readJob(`${job.id}.json`); if (fresh.status !== "queued") continue;   // cancelled meanwhile
    fresh.status = "running"; fresh.attempts += 1; writeJob(fresh);
    log(`${job.id}: gate starts (try ${fresh.attempts}/${MAX_ATTEMPTS})`);
    let verdict = "오류"; let file: string | null = null; let exit: number | null = null;
    try {
      const tree = sourceTree(fresh);
      const gate = spawnSync(join(job.repo, "node_modules/.bin/tsx"), [join(job.repo, "scripts/perf/perfGate.ts"), ...fresh.args, "--source-dir", tree],
        { cwd: job.repo, encoding: "utf8", env: { ...process.env, PLAYWRIGHT_MODULE: fresh.playwrightModule, FLS_PERF_QUEUED: job.id }, maxBuffer: 64 * 1024 * 1024 });
      exit = gate.status;
      const last = /perf:gate (\S+(?: \S+)?) → (\S+\.md)/.exec(gate.stdout ?? "");
      verdict = last?.[1] ?? `종료 ${exit}`; file = last?.[2] ?? null;
      appendFileSync(LOG, gate.stdout ?? ""); appendFileSync(LOG, gate.stderr ?? "");
    } catch (error) { log(`${job.id}: ${(error as Error).message}`); }
    const done = readJob(`${job.id}.json`);
    done.results.push({ at: new Date().toISOString(), verdict, file, exit });
    done.status = exit === 2 || exit === null ? (done.attempts < MAX_ATTEMPTS ? "queued" : "no-judgement") : "done";
    writeJob(done); log(`${job.id}: ${verdict}${file === null ? "" : ` → ${file}`} (${done.status})`);
    if (done.status !== "queued") {   // finished: the job's worktree goes (a retry keeps it)
      spawnSync("git", ["-C", job.repo, "worktree", "remove", "--force", join(tmpdir(), `fls-gate-src-${job.commit.slice(0, 12)}`)], { encoding: "utf8" });
    }
  }
}

if (process.argv[1]?.endsWith("perfQueue.ts") && process.argv[2] === "run") await runner();
