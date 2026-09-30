// A–B–A–B: two commits compared on the same scene, run by turns, so whatever else the machine does at the time hits both
// alike and the paired differences keep only what the commits change. Nothing waits for a quiet machine (user
// decision 2026-09-30); each run's conditions (other work's CPU, a person's input) are recorded beside it.
//   PLAYWRIGHT_MODULE=… npm run perf:ab -- [--a <commit>] [--b <commit>] [--scene big-town-x5] [--rounds 4] [--seconds 60]
//     [--headless] [--out docs/verification/perf-ab]
// Mac (default): the real Chrome window. DGX: scripts/remote/run.sh <label> -- node_modules/.bin/tsx scripts/perf/perfAB.ts --headless …
// --a defaults to the trunk (origin/codex/phase15-organic-ground), --b to HEAD. Scenes are perf:gate's (perfGate.ts SCENES).
// Per metric: the mean of A and of B, the mean paired difference B − A with a ±2 standard-error band, and how many rounds
// B was worse. "나빠짐" / "좋아짐" only when the whole band is on one side of zero; otherwise "소음 안".
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { otherCpuSample, otherCpuShare } from "./machineLoad";
import { SCENES, zoomSteps } from "./perfGate";
import { sourceTree } from "./sourceTree";
import { freePort } from "./freePort";

const argv = process.argv.slice(2);
const flag = (name: string, fallback: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] ?? fallback : fallback; };
const headless = argv.includes("--headless"); const rounds = Number(flag("rounds", "4")); const seconds = Number(flag("seconds", "60"));
const sceneId = flag("scene", "big-town-x5"); const outDir = flag("out", "docs/verification/perf-ab");
const git = (...args: string[]) => spawnSync("git", args, { encoding: "utf8" }).stdout.trim();
const resolve = (ref: string) => git("rev-parse", "--verify", `${ref}^{commit}`);

// Metric → [label, how to read it from a hitchAudit summary, higher is worse?]
export const AB_METRICS: readonly [string, string, (summary: any) => number | null][] = [
  ["scriptMsPerFrame", "프레임당 스크립트 ms", summary => summary.metrics?.scriptMsPerFrame ?? null],
  ["taskMsPerFrame", "프레임당 메인 작업 ms", summary => summary.metrics?.taskMsPerFrame ?? null],
  ["heapAllocMBps", "JS 할당 MB/s", summary => summary.metrics?.heapAllocMBps ?? null],
  ["gcPerMin", "힙 하락(GC)/분", summary => summary.metrics?.gcPerMin ?? null],
  ["heapAfterGcMB", "GC 뒤 남은 JS 힙 MB", summary => summary.metrics?.heapAfterGcMB ?? null],
  ["heapEndMB", "JS 힙 끝 MB(GC 톱니 위 한 점)", summary => summary.metrics?.heapEndMB ?? null],
  ["canvasPerSec", "캔버스 생성/초", summary => (summary.metrics?.canvasPerSec ?? 0) + (summary.metrics?.offscreenPerSec ?? 0)],
  ["bitmapPerSec", "비트맵 생성/초", summary => summary.metrics?.bitmapPerSec ?? null],
  ["getImageDataPerSec", "getImageData/초", summary => summary.metrics?.getImageDataPerSec ?? null],
  ["p95", "p95 ms", summary => summary.stats?.p95 ?? null],
  ["p99", "p99 ms", summary => summary.stats?.p99 ?? null],
  ["max", "최대 ms", summary => summary.stats?.max ?? null],
  ["over33PerMin", "33 ms 초과/분", summary => summary.stats?.over33PerMin ?? null],
  ["over50PerMin", "50 ms 초과/분", summary => summary.stats?.over50PerMin ?? null],
];

/** Paired comparison: B − A per round; worse when the ±2 SE band is above zero (all metrics: higher is worse). */
export function paired(a: readonly number[], b: readonly number[]) {
  const diffs = a.map((value, index) => b[index]! - value);
  const n = diffs.length; const mean = diffs.reduce((sum, value) => sum + value, 0) / Math.max(1, n);
  const sd = n > 1 ? Math.sqrt(diffs.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1)) : 0;
  const band = n > 1 ? 2 * sd / Math.sqrt(n) : Number.POSITIVE_INFINITY;
  const meanA = a.reduce((sum, value) => sum + value, 0) / Math.max(1, a.length); const meanB = b.reduce((sum, value) => sum + value, 0) / Math.max(1, b.length);
  const verdict = mean - band > 0 ? "나빠짐" : mean + band < 0 ? "좋아짐" : "소음 안";
  return { meanA, meanB, diff: mean, band, percent: meanA === 0 ? null : (mean / meanA) * 100, worseRounds: diffs.filter(value => value > 0).length, n, verdict };
}

async function main() {
  const scene = SCENES.find(entry => entry.id === sceneId); if (scene === undefined) throw new Error(`no scene ${sceneId}`);
  const a = resolve(flag("a", "origin/codex/phase15-organic-ground")); const b = resolve(flag("b", "HEAD"));
  if (a === "" || b === "") throw new Error("--a / --b: not a commit");
  const work = mkdtempSync(join(tmpdir(), "fls-perf-ab-")); const servers: ReturnType<typeof spawn>[] = []; const trees: string[] = [];
  const started = new Date();
  const urls: Record<"A" | "B", string> = { A: "", B: "" };
  const runs: { side: "A" | "B"; round: number; summary: any; otherCpu: number }[] = [];
  try {
    for (const [side, commit, port] of [["A", a, await freePort()], ["B", b, await freePort()]] as const) {
      const tree = sourceTree(".", commit); trees.push(tree);
      const build = join(work, `build-${side}`);
      const built = spawnSync(join(tree, "node_modules/.bin/vite"), ["build", "--minify", "false", "--outDir", build, "--emptyOutDir"], { cwd: tree, encoding: "utf8" });
      if (built.status !== 0) throw new Error(`${side} build failed: ${built.stderr.slice(-400)}`);
      servers.push(spawn("node_modules/.bin/vite", ["preview", "--outDir", build, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { stdio: "ignore" }));
      urls[side] = `http://127.0.0.1:${port}/`;
    }
    for (const url of Object.values(urls)) for (let i = 0; i < 60; i++) { if (await fetch(url).then(response => response.ok, () => false)) break; await new Promise(done => setTimeout(done, 1000)); }
    const minZoom = 0.5; const steps = "zoom" in scene ? zoomSteps(scene.zoom, minZoom) : { out: 0, in: 0 };
    if (steps === null) throw new Error(`${sceneId}: the zoom is below the game's minimum`);
    for (let round = 1; round <= rounds; round++) {
      for (const side of ["A", "B"] as const) {
        console.log(`== ${new Date().toTimeString().slice(0, 8)} round ${round} ${side} ${sceneId} (${seconds} s)`);
        const before = otherCpuSample();
        const args = ["scripts/perf/hitchAudit.ts", "--url", urls[side], "--scene", `${sceneId}-${side}${round}`, "--speed", String(scene.speed), "--seconds", String(seconds),
          "--action", scene.action, "--machine", headless ? "dgx-headless" : "mac-chrome-window", "--out", join(work, "runs"), "--traces", join(work, "records"),
          "--no-trace", "--no-proof", "--zoom-out", String(steps.out), "--zoom-in", String(steps.in), ...(headless ? [] : ["--headed"]),
          ...(scene.save === null ? [] : ["--save", scene.save])];
        const audit = spawnSync("node_modules/.bin/tsx", args, { encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" } });
        const otherCpu = Math.round(otherCpuShare(before, otherCpuSample()) * 100) / 100;
        const file = join(work, "runs", `${headless ? "dgx-headless" : "mac-chrome-window"}-${sceneId}-${side}${round}-x${scene.speed}${scene.action === "none" ? "" : `-${scene.action}`}-notrace-noproof.json`);
        if (audit.status !== 0 || !existsSync(file)) { console.log(`   run failed: ${(audit.stderr || audit.stdout).split("\n").find(line => /Error/.test(line)) ?? audit.status}`); continue; }
        const summary = JSON.parse(readFileSync(file, "utf8"));
        runs.push({ side, round, summary, otherCpu });
        console.log(`   p99 ${summary.stats.p99} max ${summary.stats.max} script ${summary.metrics?.scriptMsPerFrame} ms/frame alloc ${summary.metrics?.heapAllocMBps} MB/s gc ${summary.metrics?.gcPerMin}/min · other CPU ${Math.round(otherCpu * 100)}%`);
      }
    }
  } finally {
    for (const server of servers) server.kill();
    for (const tree of trees) spawnSync("git", ["worktree", "remove", "--force", tree], { encoding: "utf8" });
    rmSync(work, { recursive: true, force: true });
  }
  // Pair by round: only rounds with both sides.
  const roundsBoth = [...new Set(runs.map(run => run.round))].filter(round => runs.some(run => run.round === round && run.side === "A") && runs.some(run => run.round === round && run.side === "B"));
  const pick = (side: "A" | "B", read: (summary: any) => number | null) => roundsBoth.map(round => read(runs.find(run => run.round === round && run.side === side)!.summary) ?? 0);
  const table = AB_METRICS.map(([key, label, read]) => ({ key, label, ...paired(pick("A", read), pick("B", read)) }));
  const stamp = `${started.toLocaleDateString("sv-SE")}-${started.toTimeString().slice(0, 5).replace(":", "")}-${a.slice(0, 8)}-${b.slice(0, 8)}`;
  mkdirSync(outDir, { recursive: true });
  const machine = headless ? `DGX 헤드리스(${process.platform})` : "Mac 실제 Chrome 창";
  const record = { tool: "perf:ab", a, b, scene: sceneId, seconds, rounds, pairedRounds: roundsBoth.length, machine, started: started.toISOString(),
    runs: runs.map(run => ({ side: run.side, round: run.round, otherCpu: run.otherCpu, input: run.summary.input ?? null, window: run.summary.windowAtStart ?? null,
      stats: run.summary.stats, metrics: run.summary.metrics ?? null })), table };
  writeFileSync(join(outDir, `${stamp}.json`), `${JSON.stringify(record, null, 1)}\n`);
  const f = (value: number | null, digits = 2) => value === null || !Number.isFinite(value) ? "-" : String(Math.round(value * 10 ** digits) / 10 ** digits);
  const lines = [`# perf:ab — A \`${a.slice(0, 8)}\` 대 B \`${b.slice(0, 8)}\``, "",
    `- 실행 위치: ${machine} · 장면 \`${sceneId}\` · ${seconds}초 × ${rounds}쌍(짝 맞은 ${roundsBoth.length}쌍), A-B 번갈아 · ${started.toISOString()}`,
    `- 판정: 짝지은 차이(B − A)의 평균 ± 2 표준오차가 0의 한쪽에 있을 때만 나빠짐/좋아짐. 모든 지표는 클수록 나쁘다.`,
    `- 그때의 환경(관문 밖 CPU): ${runs.map(run => `${run.side}${run.round} ${Math.round(run.otherCpu * 100)}%${run.summary.input && run.summary.input.hidIdleAtEnd !== null && run.summary.input.hidIdleAtEnd < run.summary.input.recordSeconds ? "·입력" : ""}`).join(" · ")}`, "",
    "| 지표 | A 평균 | B 평균 | B − A | ±2SE | % | B가 나쁜 쌍 | 판정 |", "|---|---:|---:|---:|---:|---:|---:|---|",
    ...table.map(row => `| ${row.label} | ${f(row.meanA)} | ${f(row.meanB)} | ${f(row.diff)} | ${f(row.band)} | ${f(row.percent, 1)} | ${row.worseRounds}/${row.n} | ${row.verdict} |`), ""];
  writeFileSync(join(outDir, `${stamp}.md`), lines.join("\n"));
  console.log(`perf:ab → ${join(outDir, `${stamp}.md`)}`);
  for (const row of table.filter(row => row.verdict !== "소음 안")) console.log(`  ${row.label}: ${row.verdict} (${f(row.meanA)} → ${f(row.meanB)})`);
}

if (process.argv[1]?.endsWith("perfAB.ts")) await main();
