// The per-commit trend (user decision 2026-09-30): noise-resistant metrics of a commit, measured on the DGX headless
// (software raster: frame times there are for the record only). For each commit: a production build, then each trend
// scene `--rounds` times (hitchAudit, no trace, the proof port on for the tick count), and the median of each metric.
//   On the DGX (npm run remote:trend, or scripts/remote/run.sh <label> -- …):
//     tsx scripts/perf/trendRun.ts [--commits <sha,sha,…>] [--rounds 3] [--seconds 45] [--store ~/fls-runs/_trend]
//   Without --commits: the run folder's own tree (FLS_REMOTE_COMMIT). Other commits come from the DGX's git mirror.
// One JSON per commit in the store (outside the pruned run folders) and in .remote/trend/ (fetched back to the Mac).
// scripts/perf/perfTrend.ts gathers them into docs/verification/perf-trend/.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { SCENES } from "./perfGate";
import { sourceTree } from "./sourceTree";

const argv = process.argv.slice(2);
const flag = (name: string, fallback: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] ?? fallback : fallback; };
const rounds = Number(flag("rounds", "3")); const seconds = Number(flag("seconds", "45"));
const store = flag("store", join(homedir(), "fls-runs", "_trend")); const port = Number(process.env.FLS_REMOTE_PORT ?? flag("port", "4398"));
export const TREND_SCENES = ["big-town-x5", "new-game-x3"] as const;
// The metrics kept per scene (hitchAudit summary.metrics / stats), medians over the rounds.
export const TREND_METRICS = ["scriptMsPerTick", "heapAllocKBPerTick", "canvasPer1kTicks", "scriptMsPerFrame", "taskMsPerFrame", "heapAllocMBps", "gcPerMin",
  "canvasPerSec", "bitmapPerSec", "getImageDataPerSec", "heapEndMB", "p50", "p95", "p99", "max", "over33PerMin"] as const;

const median = (values: readonly number[]) => { const sorted = values.filter(Number.isFinite).sort((a, b) => a - b); return sorted.length === 0 ? null : sorted[Math.floor((sorted.length - 1) / 2)]!; };
const git = (...args: string[]) => spawnSync("git", args, { encoding: "utf8" }).stdout.trim();

async function measure(commit: string, tree: string) {
  const work = mkdtempSync(join(tmpdir(), "fls-trend-")); const build = join(work, "build");
  const built = spawnSync(join(tree, "node_modules/.bin/vite"), ["build", "--minify", "false", "--outDir", build, "--emptyOutDir"], { cwd: tree, encoding: "utf8" });
  if (built.status !== 0) throw new Error(`${commit}: build failed ${built.stderr.slice(-300)}`);
  const preview = spawn("node_modules/.bin/vite", ["preview", "--outDir", build, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { stdio: "ignore" });
  const url = `http://127.0.0.1:${port}/`;
  const scenes: Record<string, { runs: number; medians: Record<string, number | null>; values: Record<string, number[]> }> = {};
  try {
    for (let i = 0; i < 60; i++) { if (await fetch(url).then(response => response.ok, () => false)) break; await new Promise(done => setTimeout(done, 1000)); }
    for (const sceneId of TREND_SCENES) {
      const scene = SCENES.find(entry => entry.id === sceneId)!;
      const values: Record<string, number[]> = Object.fromEntries(TREND_METRICS.map(key => [key, []]));
      for (let round = 1; round <= rounds; round++) {
        const args = ["scripts/perf/hitchAudit.ts", "--url", url, "--scene", `trend-${sceneId}-${round}`, "--speed", String(scene.speed), "--seconds", String(seconds),
          "--action", scene.action, "--machine", "dgx-headless", "--out", join(work, "runs"), "--traces", join(work, "records"), "--no-trace",
          ...(scene.save === null ? [] : ["--save", scene.save])];
        const audit = spawnSync("node_modules/.bin/tsx", args, { encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" } });
        const file = join(work, "runs", `dgx-headless-trend-${sceneId}-${round}-x${scene.speed}${scene.action === "none" ? "" : `-${scene.action}`}-notrace.json`);
        if (audit.status !== 0 || !existsSync(file)) { console.log(`${commit.slice(0, 8)} ${sceneId} ${round}: failed ${(audit.stderr || "").split("\n").find(line => /Error/.test(line)) ?? audit.status}`); continue; }
        const summary = JSON.parse(readFileSync(file, "utf8"));
        for (const key of TREND_METRICS) { const value = summary.metrics?.[key] ?? summary.stats?.[key]; if (typeof value === "number") values[key]!.push(value); }
        console.log(`${commit.slice(0, 8)} ${sceneId} ${round}: script ${summary.metrics?.scriptMsPerTick} ms/tick alloc ${summary.metrics?.heapAllocKBPerTick} KB/tick canvas ${summary.metrics?.canvasPer1kTicks}/1k ticks`);
      }
      scenes[sceneId] = { runs: values.p50!.length, medians: Object.fromEntries(TREND_METRICS.map(key => [key, median(values[key]!)])), values };
    }
  } finally { preview.kill(); rmSync(work, { recursive: true, force: true }); }
  return scenes;
}

async function main() {
  mkdirSync(store, { recursive: true }); mkdirSync(".remote/trend", { recursive: true });
  const own = process.env.FLS_REMOTE_COMMIT ?? git("rev-parse", "HEAD");
  const commits = flag("commits", "").split(",").filter(Boolean).map(ref => git("rev-parse", "--verify", `${ref}^{commit}`) || ref);
  for (const commit of commits.length > 0 ? commits : [own]) {
    const tree = commit === own && commits.length === 0 ? "." : sourceTree(".", commit);
    try {
      const scenes = await measure(commit, tree);
      const record = { commit, subject: git("log", "-1", "--format=%s", commit).slice(0, 120), committed: git("log", "-1", "--format=%cI", commit),
        measured: new Date().toISOString(), host: hostname(), machine: "dgx-headless", rounds, seconds, scenes };
      writeFileSync(join(store, `${commit}.json`), `${JSON.stringify(record, null, 1)}\n`);
      writeFileSync(join(".remote/trend", `${commit}.json`), `${JSON.stringify(record, null, 1)}\n`);
      console.log(`trend ${commit.slice(0, 8)} → ${join(store, `${commit}.json`)}`);
    } finally { if (tree !== ".") spawnSync("git", ["worktree", "remove", "--force", tree], { encoding: "utf8" }); }
  }
}

if (process.argv[1]?.endsWith("trendRun.ts")) await main();
