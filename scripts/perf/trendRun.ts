// The per-commit trend (user decision 2026-09-30): noise-resistant metrics of a commit, measured on the DGX headless
// (software raster: frame times there are for the record only). For each commit: a production build, then each trend
// scene `--rounds` times (hitchAudit, no trace, the proof port on for the tick count), and the median of each metric.
//   On the DGX (npm run remote:trend, or scripts/remote/run.sh <label> -- …):
//     tsx scripts/perf/trendRun.ts [--commits <sha,sha,…>] [--rounds 3] [--seconds 45] [--store ~/fls-runs/_trend]
//   Without --commits: the run folder's own tree (FLS_REMOTE_COMMIT). Other commits come from the DGX's git mirror.
// One JSON per commit in the store (outside the pruned run folders) and in .remote/trend/ (fetched back to the Mac).
// scripts/perf/perfTrend.ts gathers them into docs/verification/perf-trend/.
// Confirmation (decision RR7, scripts/perf/trendRule.ts): after measuring a commit, each scene where a judged metric is
// outside the widened range of the nearest earlier measured commit (a suspicion) runs perf:ab --headless between the
// two (45 s × 4 pairs) into <store>/ab/<a>-<b>-<scene>.json; a suspected metric that A-B finds worse runs a second A-B
// (kept in the same record as `second`). The page marks "나빠짐" only when both A-B runs find it worse.
//   --no-confirm     measure only
//   --confirm-only   do not measure; confirm --commits against their stored comparison commits
//   --force          run the A-B for every trend scene, suspicion or not (to check the rule)
import { spawn, spawnSync } from "node:child_process";
import { spawnServer } from "../serverProcess";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { SCENES } from "./perfGate";
import { sourceTree } from "./sourceTree";
import { otherCpuSample, otherCpuShare } from "./machineLoad";
import { abVerdict, confirmationName, JUDGED, median, suspect } from "./trendRule";

const argv = process.argv.slice(2);
const flag = (name: string, fallback: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] ?? fallback : fallback; };
const rounds = Number(flag("rounds", "3")); const seconds = Number(flag("seconds", "45"));
const store = flag("store", join(homedir(), "fls-runs", "_trend")); const port = Number(process.env.FLS_REMOTE_PORT ?? flag("port", "4398"));
export const TREND_SCENES = ["big-town-x5", "new-game-x3"] as const;
// The metrics kept per scene (hitchAudit summary.metrics / stats), medians over the rounds.
export const TREND_METRICS = ["scriptMsPerTick", "heapAllocKBPerTick", "canvasPer1kTicks", "scriptMsPerFrame", "taskMsPerFrame", "heapAllocMBps", "gcPerMin",
  "canvasPerSec", "bitmapPerSec", "getImageDataPerSec", "heapEndMB", "heapAfterGcMB", "p50", "p95", "p99", "max", "over33PerMin", "otherCpu"] as const;
// otherCpu: the share of the DGX's cores other work took during the run (machineLoad.ts). The per-tick metrics are not
// immune to it: a busy DGX runs fewer ticks while the page's per-frame work goes on (a597617b: 13.5 ms/tick measured
// quiet, 19.9 ms/tick beside a full test run), so the page shows it beside the values.

const git = (...args: string[]) => spawnSync("git", args, { encoding: "utf8" }).stdout.trim();

async function measure(commit: string, tree: string) {
  const work = mkdtempSync(join(tmpdir(), "fls-trend-")); const build = join(work, "build");
  const built = spawnSync(join(tree, "node_modules/.bin/vite"), ["build", "--minify", "false", "--outDir", build, "--emptyOutDir"], { cwd: tree, encoding: "utf8" });
  if (built.status !== 0) throw new Error(`${commit}: build failed ${built.stderr.slice(-300)}`);
  const preview = spawnServer("node_modules/.bin/vite", ["preview", "--outDir", build, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { stdio: "ignore" });
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
        const before = otherCpuSample();
        const audit = spawnSync("node_modules/.bin/tsx", args, { encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" } });
        const otherCpu = Math.round(otherCpuShare(before, otherCpuSample()) * 100) / 100;
        const file = join(work, "runs", `dgx-headless-trend-${sceneId}-${round}-x${scene.speed}${scene.action === "none" ? "" : `-${scene.action}`}-notrace.json`);
        if (audit.status !== 0 || !existsSync(file)) { console.log(`${commit.slice(0, 8)} ${sceneId} ${round}: failed ${(audit.stderr || "").split("\n").find(line => /Error/.test(line)) ?? audit.status}`); continue; }
        const summary = JSON.parse(readFileSync(file, "utf8"));
        for (const key of TREND_METRICS) { const value = key === "otherCpu" ? otherCpu : summary.metrics?.[key] ?? summary.stats?.[key]; if (typeof value === "number") values[key]!.push(value); }
        console.log(`${commit.slice(0, 8)} ${sceneId} ${round}: script ${summary.metrics?.scriptMsPerTick} ms/tick alloc ${summary.metrics?.heapAllocKBPerTick} KB/tick canvas ${summary.metrics?.canvasPer1kTicks}/1k ticks · other CPU ${Math.round(otherCpu * 100)}%`);
      }
      scenes[sceneId] = { runs: values.p50!.length, medians: Object.fromEntries(TREND_METRICS.map(key => [key, median(values[key]!)])), values };
    }
  } finally { preview.kill(); rmSync(work, { recursive: true, force: true }); }
  return scenes;
}

// The code budgets moved out of the regression tests (tests/helpers/codeBudget.ts, docs/verification/wall-clock-tests.md): their tests
// run here in the commit's tree with FLS_CODE_BUDGETS set, three rounds, the median per budget. Commits from before the
// move have no such helper and no code budgets.
export const CODE_BUDGET_TESTS = ["tests/chronicleScreen.test.ts", "tests/historyLedger.test.ts", "tests/wave26HouseVariants.test.ts"] as const;
function measureCodeBudgets(tree: string) {
  if (!existsSync(join(tree, "tests/helpers/codeBudget.ts"))) return null;
  const budgets: Record<string, { label: string; budgetMs: number; values: number[]; median: number | null }> = {}; const otherCpu: number[] = [];
  for (let round = 1; round <= rounds; round++) {
    const file = join(mkdtempSync(join(tmpdir(), "fls-code-budgets-")), "budgets.jsonl"); const before = otherCpuSample();
    const run = spawnSync(join(tree, "node_modules/.bin/tsx"), ["--test", ...CODE_BUDGET_TESTS], { cwd: tree, encoding: "utf8", env: { ...process.env, FLS_CODE_BUDGETS: file } });
    otherCpu.push(Math.round(otherCpuShare(before, otherCpuSample()) * 100) / 100);
    if (run.status !== 0 || !existsSync(file)) { console.log(`code budgets ${round}: tests failed (${run.status})`); continue; }
    for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
      const entry = JSON.parse(line) as { id: string; label: string; ms: number; budgetMs: number };
      (budgets[entry.id] ??= { label: entry.label, budgetMs: entry.budgetMs, values: [], median: null }).values.push(Math.round(entry.ms * 1000) / 1000);
    }
    rmSync(join(file, ".."), { recursive: true, force: true });
  }
  for (const budget of Object.values(budgets)) budget.median = median(budget.values);
  console.log(`code budgets: ${Object.entries(budgets).map(([id, budget]) => `${id} ${budget.median} ms (budget ${budget.budgetMs})`).join(", ")}`);
  return { budgets, otherCpu };
}

type Stored = { commit: string; scenes: Record<string, { values: Record<string, number[]> }> };
const stored = (commit: string): Stored | null => { const file = join(store, `${commit}.json`); return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) as Stored : null; };

/** A second port of the 4300–4399 range, held (flock on the run system's lock file) until release() — perf:ab serves two builds. */
async function holdPort(except: number): Promise<{ port: number; release: () => void } | null> {
  for (let port = 4300; port <= 4399; port++) {
    if (port === except || spawnSync("ss", ["-Hltn", `sport = :${port}`], { encoding: "utf8" }).stdout.trim() !== "") continue;
    // One process holds the lock: the shell takes it on fd 9, then becomes `sleep` (exec), so killing that process lets
    // the port go. (`flock <file> sleep` forked a sleep that kept the lock after flock was killed: 36 trend runs left
    // ports 4300–4346 held and their scopes alive for a day, 2026-10-02.) The sleep is also capped at three hours.
    const lock = join(homedir(), "fls-runs", "_ports", `${port}.lock`);
    const holder = spawn("bash", ["-c", 'exec 9>"$1"; flock -n 9 || exit 1; exec sleep 10800', "hold-port", lock], { stdio: "ignore" });
    await new Promise(done => setTimeout(done, 300));   // flock -n exits at once when another run holds the port
    if (holder.exitCode === null) return { port, release: () => { holder.kill("SIGKILL"); } };
  }
  return null;
}

/** The suspicions of `commit` against its nearest earlier measured ancestor, and the A-B runs that settle them. */
/** One perf:ab --headless (45 s × 4 pairs) of `a` against `b` on `scene`; its record, or null when it failed. */
async function runAb(a: string, b: string, scene: string): Promise<any | null> {
  const second = await holdPort(port); if (second === null) { console.log("   no second port in 4300–4399; A-B left for later"); return null; }
  const out = mkdtempSync(join(tmpdir(), "fls-trend-ab-"));
  try {
    const ab = spawnSync("node_modules/.bin/tsx", ["scripts/perf/perfAB.ts", "--headless", "--a", a, "--b", b, "--scene", scene, "--rounds", "4", "--seconds", "45",
      "--out", out, "--ports", `${port},${second.port}`], { encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" } });
    const file = readdirSync(out).find(entry => entry.endsWith(".json"));
    if (ab.status !== 0 || file === undefined) { console.log(`   A-B failed: ${(ab.stderr || ab.stdout).split("\n").filter(Boolean).slice(-2).join(" / ")}`); return null; }
    const record = JSON.parse(readFileSync(join(out, file), "utf8"));
    // A side that never ran leaves no pairs: not kept, so the next confirm runs it again.
    if ((record.pairedRounds ?? 0) < 2) { console.log(`   A-B failed: ${record.pairedRounds ?? 0} paired rounds (${(ab.stdout.match(/run failed: .*/g) ?? []).slice(0, 2).join(" / ")})`); return null; }
    return record;
  } finally { second.release(); rmSync(out, { recursive: true, force: true }); }
}

/**
 * The suspicions of `commit` against its nearest earlier measured ancestor, and the A-B runs that settle them. A
 * suspected metric the A-B finds worse gets a second A-B; it is "나빠짐" only when both are (user instruction
 * 2026-10-01: at a 95 % band identical code is still judged worse about once in twenty).
 */
async function confirm(commit: string, force: boolean) {
  const row = stored(commit); if (row === null) { console.log(`confirm ${commit.slice(0, 8)}: not measured`); return; }
  const earlier = git("rev-list", "--date-order", `${commit}^@`).split("\n").find(candidate => candidate !== "" && stored(candidate) !== null);
  if (earlier === undefined) { console.log(`confirm ${commit.slice(0, 8)}: no earlier measured commit`); return; }
  const before = stored(earlier)!;
  mkdirSync(join(store, "ab"), { recursive: true }); mkdirSync(".remote/trend/ab", { recursive: true });
  const verdicts = (record: any) => JUDGED.map(([key]) => `${key} ${abVerdict(record, key) ?? "-"}`).join(", ");
  for (const scene of TREND_SCENES) {
    const suspects = JUDGED.map(([key]) => ({ key, suspicion: suspect(median(row.scenes[scene]?.values?.[key] ?? []), before.scenes[scene]?.values?.[key] ?? []) }))
      .filter(entry => entry.suspicion !== "");
    const name = confirmationName(earlier, commit, scene); const file = join(store, "ab", name);
    console.log(`confirm ${commit.slice(0, 8)} ${scene} against ${earlier.slice(0, 8)}: ${suspects.length === 0 ? "no suspicion" : suspects.map(entry => `${entry.key} ${entry.suspicion}`).join(", ")}`);
    let record: any = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
    if (record === null) {
      if (suspects.length === 0 && !force) continue;
      const first = await runAb(earlier, commit, scene); if (first === null) continue;
      record = { ...first, suspects, forced: suspects.length === 0 };
      console.log(`   A-B: ${verdicts(record)}`);
    }
    const worse = (record.suspects ?? []).filter((entry: { key: string }) => abVerdict(record, entry.key) === "나빠짐");
    if (worse.length > 0 && record.second === undefined) {
      console.log(`   worse on ${worse.map((entry: { key: string }) => entry.key).join(", ")}: a second A-B`);
      const again = await runAb(earlier, commit, scene);
      if (again !== null) { record = { ...record, second: again }; console.log(`   second A-B: ${verdicts(again)}`); }
    }
    for (const dir of [join(store, "ab"), ".remote/trend/ab"]) writeFileSync(join(dir, name), `${JSON.stringify(record, null, 1)}\n`);
  }
}

async function main() {
  mkdirSync(store, { recursive: true }); mkdirSync(".remote/trend", { recursive: true });
  const own = process.env.FLS_REMOTE_COMMIT ?? git("rev-parse", "HEAD");
  const commits = flag("commits", "").split(",").filter(Boolean).map(ref => git("rev-parse", "--verify", `${ref}^{commit}`) || ref);
  const confirmOnly = argv.includes("--confirm-only"); const force = argv.includes("--force"); const noConfirm = argv.includes("--no-confirm");
  for (const commit of commits.length > 0 ? commits : [own]) {
    if (confirmOnly) { await confirm(commit, force); continue; }
    const tree = commit === own && commits.length === 0 ? "." : sourceTree(".", commit);
    try {
      const scenes = await measure(commit, tree);
      const codeBudgets = measureCodeBudgets(tree);
      const record = { commit, subject: git("log", "-1", "--format=%s", commit).slice(0, 120), committed: git("log", "-1", "--format=%cI", commit),
        measured: new Date().toISOString(), host: hostname(), machine: "dgx-headless", rounds, seconds, scenes, ...(codeBudgets === null ? {} : { codeBudgets }) };
      writeFileSync(join(store, `${commit}.json`), `${JSON.stringify(record, null, 1)}\n`);
      writeFileSync(join(".remote/trend", `${commit}.json`), `${JSON.stringify(record, null, 1)}\n`);
      console.log(`trend ${commit.slice(0, 8)} → ${join(store, `${commit}.json`)}`);
    } finally { if (tree !== ".") spawnSync("git", ["worktree", "remove", "--force", tree], { encoding: "utf8" }); }
    if (!noConfirm) await confirm(commit, force);
  }
}

if (process.argv[1]?.endsWith("trendRun.ts")) await main();
