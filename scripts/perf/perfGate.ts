// SMOOTH-G: the smoothness gate, stage 1 (user decision 2026-09-29, from SMOOTH-1). On this Mac's real Chrome window,
// without tracing, four scenes run 3 minutes each, one after another, and every one must hold:
//   p99 <= 16.7 ms, max <= 100 ms, frames over 50 ms <= 1 per minute, frames over 33 ms <= 3 per minute,
// and over the four runs, the share of season changes and autosaves followed by a long frame (> 33 ms, the frame ending
// 250 ms before to 1 s after the moment) is no higher than the share of any 1.25 s window holding one (one-sided
// binomial test at 5 %: a higher share that chance explains passes).
// Scenes: the biggest town (fixtures/perf-gate/ch4-1380: 1380, 768 people, 86 buildings) at 5x; a new game at 3x; the
// same town at 1x for the season changes as they come in play; and that town at 3x with placement drags (road, house,
// zone brush). Frames are the page's rAF intervals (scripts/perf/hitchAudit.ts --no-trace --no-proof: the page as a
// player gets it, without the proof port's render recorders; season changes are read from the HUD's date).
// A run is valid only on a Mac at 120 Hz (rAF p50 8.3 ms), with no page error, and when work outside the gate (another
// session's tests, a build) took at most a quarter of the machine's cores in any 10 s of the run; the DGX (software raster) never judges.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs npm run perf:gate [-- --only big-town-x5,season-x1] [--seconds 180]
//     [--port <n>, default a free port] [--out docs/verification/perf-gate]
// Nothing waits (user decision 2026-09-30): no lock, no queue, no quiet-Mac wait. The conditions of each run — other
// work's CPU, a person's input, the window drawn or not, the refresh rate — are recorded beside its numbers, not used to
// void it. Exit 0 = pass, 1 = fail, 2 = not a judgement (not a Mac, a page error, a run that did not finish).
// Results: docs/verification/perf-gate/<date>-<time>-<commit>.{json,md} and a line in its README.md.
import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cpus, loadavg, tmpdir } from "node:os";
import { otherCpuSample, otherCpuShare } from "./machineLoad";
import { freePort } from "./freePort";
import { join } from "node:path";

const argv = process.argv.slice(2);
const flag = (name: string, fallback: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] ?? fallback : fallback; };
const seconds = Number(flag("seconds", "180")); const fixedPort = flag("port", "");
const outDir = flag("out", "docs/verification/perf-gate"); const only = flag("only", "").split(",").filter(Boolean);
// The game is built from this tree (a queued job's worktree of another commit); the gate's own scripts stay these.
const sourceDir = flag("source-dir", ".");

export const LIMITS = { p99Ms: 16.7, maxMs: 100, over50PerMin: 1, over33PerMin: 3, momentAlpha: 0.05, otherCpu: 0.25 } as const;
const SAVE = "fixtures/perf-gate/ch4-1380.save.json.gz";
export const SCENES = [
  { id: "big-town-x5", label: "가장 큰 도시 5배속", save: SAVE, speed: 5, action: "none" },
  { id: "new-game-x3", label: "새 게임 3배속", save: null, speed: 3, action: "none" },
  { id: "season-x1", label: "계절 전환(가장 큰 도시 1배속)", save: SAVE, speed: 1, action: "none" },
  { id: "placement-x3", label: "배치 끌기(가장 큰 도시 3배속)", save: SAVE, speed: 3, action: "placement" },
  // The far view (NAT-2: the block map drawn with reduced real art): the same town zoomed out with the wheel.
  { id: "far-zoom-50-x5", label: "먼 줌 0.5(가장 큰 도시 5배속)", save: SAVE, speed: 5, action: "none", zoom: 0.5 },
  { id: "far-zoom-40-x5", label: "먼 줌 0.4(가장 큰 도시 5배속)", save: SAVE, speed: 5, action: "none", zoom: 0.4 },
  // LAND-UI (opt-in: only with --only, not in the stage-1 set): the fen town of scripts/landStates.ts with its three
  // drainage works (a drained patch, stage 1, stage 3 with diggers) at 3x — the fen's ground, reeds and meres, and the
  // works digging on (the 80 % one finishes in the run and its cells turn to meadow).
  { id: "land-fen-works-x3", label: "소택지 배수 공사 3배속", save: "fixtures/perf-gate/fen_drainage-works.save.json.gz", speed: 3, action: "none", optIn: true },
] as const;
type Scene = (typeof SCENES)[number];

/**
 * The wheel steps to a zoom: out to the game's minimum (it clamps there, exactly), then in by x1.1 steps to the nearest
 * of the target. Null when the target is below the game's minimum (src/render/camera.ts MIN_ZOOM of the built tree).
 */
export function zoomSteps(target: number, minZoom: number): { out: number; in: number; zoom: number } | null {
  if (target < minZoom - 1e-9) return null;
  const up = Math.round(Math.log(target / minZoom) / Math.log(1.1));
  return { out: 60, in: up, zoom: Math.round(minZoom * Math.pow(1.1, up) * 1000) / 1000 };
}
const minZoomOf = (tree: string) => { const match = /export const MIN_ZOOM = ([\d.]+)/.exec(readFileSync(join(tree, "src/render/camera.ts"), "utf8")); return match === null ? 0.5 : Number(match[1]); };
const MACHINE = "mac-chrome-window";
const run = (command: string, args: readonly string[], cwd = ".") => spawnSync(command, args, { encoding: "utf8", cwd });
const git = (...args: string[]) => run("git", ["-C", sourceDir, ...args]).stdout.trim();

interface Frame { readonly from: number; readonly to: number; readonly ms: number }
type LongAnimationFrame = { readonly start: number; readonly duration: number; readonly [field: string]: unknown };
interface Summary { readonly input?: { readonly hidIdleAtEnd: number | null; readonly recordSeconds: number }; readonly longAnimationFrames?: readonly LongAnimationFrame[]; readonly startMarkPageMs?: number; readonly stats: Record<string, number | null>; readonly longFrames: readonly Frame[]; readonly moments: readonly { kind: string; t: number }[]; readonly errors: readonly string[]; readonly loadSeconds: number; readonly page: Record<string, unknown> }

// P(X >= k) for X ~ Binomial(n, p).
export function binomialTail(k: number, n: number, p: number): number {
  if (k <= 0) return 1; if (p <= 0) return 0; if (p >= 1) return 1;
  let term = Math.pow(1 - p, n); let below = 0;   // P(X = 0)
  for (let i = 0; i < k; i++) { below += term; term *= ((n - i) / (i + 1)) * (p / (1 - p)); }
  return Math.max(0, 1 - below);
}

/** Stage-1 limits for one run's frame statistics; the list of what failed. */
export function judgeRun(stats: Summary["stats"]): string[] {
  const failed: string[] = [];
  const value = (key: string) => stats[key] ?? Number.POSITIVE_INFINITY;
  if (value("p99") > LIMITS.p99Ms) failed.push(`p99 ${stats.p99} ms > ${LIMITS.p99Ms}`);
  if (value("max") > LIMITS.maxMs) failed.push(`최대 ${stats.max} ms > ${LIMITS.maxMs}`);
  if (value("over50PerMin") > LIMITS.over50PerMin) failed.push(`50 ms 초과 ${stats.over50PerMin}/분 > ${LIMITS.over50PerMin}`);
  if (value("over33PerMin") > LIMITS.over33PerMin) failed.push(`33 ms 초과 ${stats.over33PerMin}/분 > ${LIMITS.over33PerMin}`);
  return failed;
}

/** Season changes and autosaves against any 1.25 s window, over all runs. */
export function judgeMoments(runs: readonly Pick<Summary, "stats" | "longFrames" | "moments">[]) {
  let windows = 0; let windowsWithLong = 0; const kinds = new Map<string, { seen: number; hit: number }>();
  for (const summary of runs) {
    const span = (summary.stats.minutes ?? 0) * 60_000; const count = Math.floor(span / 1250);
    windows += count;
    windowsWithLong += Math.min(count, new Set(summary.longFrames.map(frame => Math.floor(frame.to / 1250))).size);
    for (const moment of summary.moments) {
      if (moment.kind !== "season" && moment.kind !== "autosave") continue;
      const entry = kinds.get(moment.kind) ?? { seen: 0, hit: 0 }; entry.seen += 1;
      if (summary.longFrames.some(frame => frame.to >= moment.t - 250 && frame.to <= moment.t + 1000)) entry.hit += 1;
      kinds.set(moment.kind, entry);
    }
  }
  const baseline = windows === 0 ? 0 : windowsWithLong / windows;
  const rows = [...kinds].map(([kind, entry]) => {
    const share = entry.seen === 0 ? 0 : entry.hit / entry.seen;
    const pValue = binomialTail(entry.hit, entry.seen, baseline);
    return { kind, seen: entry.seen, followedByLongFrame: entry.hit, share, baseline, pValue, pass: share <= baseline || pValue >= LIMITS.momentAlpha };
  });
  return { windows, windowsWithLong, baseline, rows, pass: rows.every(row => row.pass) };
}

// The audit's own error (the thrown line and the next), not Node's closing lines ("}" / "Node.js vNN").
const auditError = (text: string) => {
  const lines = text.split("\n"); const at = lines.findIndex(line => /\b\w*Error\b|error:/i.test(line));
  return (at >= 0 ? lines.slice(at, at + 2) : lines.slice(-3)).map(line => line.trim()).filter(Boolean).join(" / ").slice(0, 400);
};

async function main() {
  const invalid: string[] = [];
  if (process.platform !== "darwin") invalid.push(`이 기계(${process.platform})는 판정하지 않는다: Mac 실제 Chrome 창에서만 판정한다`);
  const commit = git("rev-parse", "HEAD"); const dirty = git("status", "--porcelain", "--untracked-files=no") !== "";
  const chrome = run("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--version"]).stdout?.trim() ?? "";
  const model = run("sysctl", ["-n", "hw.model"]).stdout?.trim() ?? "";
  const started = new Date(); const load: number[] = [loadavg()[0] ?? 0];
  const scenes = SCENES.filter(scene => only.length === 0 ? !("optIn" in scene) : only.includes(scene.id));
  const work = mkdtempSync(join(tmpdir(), "fls-perf-gate-")); const build = join(work, "build");
  let preview: ReturnType<typeof spawn> | null = null;
  const results: { scene: Scene; summary: Summary | null; loadMax: number; skipped?: string; failed: string[]; invalid: string[]; conditions?: string[] }[] = [];
  try {
    if (invalid.length === 0) {
      console.log(`perf:gate ${commit.slice(0, 8)}${dirty ? " (dirty)" : ""}: build`);
      // Keep the display awake for the whole gate (macOS caffeinate, ends with this process).
      spawn("caffeinate", ["-d", "-i", "-w", String(process.pid)], { stdio: "ignore", detached: true }).unref();
      const built = run(join(sourceDir, "node_modules/.bin/vite"), ["build", "--minify", "false", "--outDir", build, "--emptyOutDir"], sourceDir);
      if (built.status !== 0) throw new Error(`vite build failed:\n${built.stdout}\n${built.stderr}`);
      const port = fixedPort === "" ? await freePort() : Number(fixedPort);   // never a port another session may hold
      preview = spawn("node_modules/.bin/vite", ["preview", "--outDir", build, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { stdio: "ignore" });
      const url = `http://127.0.0.1:${port}/`;
      for (let i = 0; i < 60; i++) { if (await fetch(url).then(response => response.ok, () => false)) break; await new Promise(resolve => setTimeout(resolve, 1000)); }
      const minZoom = minZoomOf(sourceDir);
      for (const scene of scenes as readonly Scene[]) {
        console.log(`== ${new Date().toTimeString().slice(0, 8)} ${scene.id} (${seconds} s)`);
        const steps = "zoom" in scene ? zoomSteps(scene.zoom, minZoom) : { out: 0, in: 0, zoom: null };
        // A zoom below the game's minimum is skipped, not a verdict: it is reported and waits for the game to allow it.
        if (steps === null) { results.push({ scene, summary: null, loadMax: 0, failed: [], invalid: [], skipped: `도달 불가: 게임의 최소 줌이 ${minZoom}이라 ${"zoom" in scene ? scene.zoom : ""}에 닿지 않는다(src/render/camera.ts MIN_ZOOM)` }); continue; }
        const args = ["scripts/perf/hitchAudit.ts", "--url", url, "--scene", scene.id, "--speed", String(scene.speed), "--seconds", String(seconds),
          "--action", scene.action, "--machine", MACHINE, "--out", join(work, "runs"), "--traces", join(work, "records"), "--headed", "--no-trace", "--no-proof", "--zoom-out", String(steps.out), "--zoom-in", String(steps.in),
          ...(scene.save === null ? [] : ["--save", scene.save])];
        // The machine's 1-minute load, every 10 s of the run: another session's tests on this Mac make a run no judgement.
        const loads: number[] = []; let previous = otherCpuSample();
        const sampler = setInterval(() => { const now = otherCpuSample(); loads.push(otherCpuShare(previous, now)); previous = now; }, 10_000);
        const audit = await new Promise<{ status: number | null; stdout: string; stderr: string }>(done => {
          const child = spawn("node_modules/.bin/tsx", args, { env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=8192" } });
          let stdout = ""; let stderr = ""; child.stdout.on("data", data => { stdout += data; }); child.stderr.on("data", data => { stderr += data; });
          child.on("close", status => done({ status, stdout, stderr }));
        });
        clearInterval(sampler);
        const busiest = Math.round(Math.max(0, ...loads) * 100) / 100;   // the busiest 10 s: share of all cores other work took
        const file = join(work, "runs", `${MACHINE}-${scene.id}-x${scene.speed}${scene.action === "none" ? "" : `-${scene.action}`}-notrace-noproof.json`);
        if (audit.status !== 0 || !existsSync(file)) {
          const said = `${audit.stderr}\n${audit.stdout}`.split("\n").find(line => line.startsWith("판정 아님: "));
          results.push({ scene, summary: null, loadMax: busiest, failed: [], invalid: [said !== undefined ? said.slice("판정 아님: ".length)
            : `실행이 끝나지 않았다: ${auditError(audit.stderr || audit.stdout)}`] });
          continue;
        }
        const summary = JSON.parse(readFileSync(file, "utf8")) as Summary;
        const runInvalid: string[] = []; const conditions: string[] = [];
        // Conditions of the run, recorded beside its numbers (nothing is voided by them).
        const p50 = summary.stats.p50 ?? 0;
        if (p50 < 7.9 || p50 > 8.8) conditions.push(`rAF p50 ${p50} ms(120 Hz 아님)`);
        if ((summary.stats.minutes ?? 0) < (seconds / 60) * 0.95) conditions.push(`기록 ${summary.stats.minutes}분`);
        if (busiest > 0.25) conditions.push(`다른 일 CPU 최대 ${Math.round(busiest * 100)}%`);
        const idle = summary.input?.hidIdleAtEnd; const lasted = summary.input?.recordSeconds ?? 0;
        if (idle !== undefined && idle !== null && idle < lasted - 0.5) conditions.push("사람 입력 있음");
        if (summary.moments.some(moment => moment.kind === "not-drawn")) conditions.push("그려지지 않은 구간");
        if (summary.moments.some(moment => moment.kind === "hidden")) conditions.push("창 가려짐");
        if (summary.errors.length > 0) runInvalid.push(`페이지 오류 ${summary.errors.length}: ${summary.errors[0]}`);
        const failed = judgeRun(summary.stats);
        results.push({ scene, summary, loadMax: busiest, failed, invalid: runInvalid, conditions });
        console.log(`   p50 ${summary.stats.p50} p99 ${summary.stats.p99} max ${summary.stats.max} >50 ${summary.stats.over50PerMin}/min >33 ${summary.stats.over33PerMin}/min — ${runInvalid.length ? "무효" : failed.length ? "실패" : "통과"}`);
      }
    }
  } finally {
    preview?.kill(); rmSync(work, { recursive: true, force: true });
  }
  load.push(loadavg()[0] ?? 0);
  const judged = results.filter(result => result.summary !== null).map(result => result.summary!);
  const moments = judgeMoments(judged);
  const allInvalid = [...invalid, ...results.flatMap(result => result.invalid.map(reason => `${result.scene.id}: ${reason}`))];
  if (results.length < scenes.length && invalid.length === 0) allInvalid.push("장면이 모두 돌지 않았다");
  const failures = [...results.flatMap(result => result.failed.map(reason => `${result.scene.id}: ${reason}`)),
    ...moments.rows.filter(row => !row.pass).map(row => `순간 ${row.kind}: ${Math.round(row.share * 100)}% > 기준 ${Math.round(row.baseline * 100)}% (p ${row.pValue.toFixed(3)})`)];
  const partial = only.length > 0;
  const skippedAny = results.some(result => result.skipped !== undefined);
  const verdict = allInvalid.length > 0 ? "판정 아님" : failures.length > 0 ? "실패" : partial ? "통과(일부 장면)" : skippedAny ? "통과(건너뛴 장면 있음)" : "통과";

  const stamp = `${started.toLocaleDateString("sv-SE")}-${started.toTimeString().slice(0, 5).replace(":", "")}-${commit.slice(0, 8)}`;
  mkdirSync(outDir, { recursive: true });
  const record = { gate: "perf:gate stage 1", verdict, commit, dirty, started: started.toISOString(), finished: new Date().toISOString(),
    machine: { platform: process.platform, model, cpus: cpus().length, chrome, loadAverage1m: load.map(value => Math.round(value * 10) / 10) },
    limits: LIMITS, seconds, invalid: allInvalid, failures,
    scenes: results.map(({ scene, summary, loadMax, skipped, failed, invalid: runInvalid, conditions }) => ({ id: scene.id, loadMax, conditions: conditions ?? [], label: scene.label, zoom: "zoom" in scene ? scene.zoom : null, skipped: skipped ?? null, save: scene.save, speed: scene.speed, action: scene.action,
      verdict: skipped !== undefined ? "건너뜀" : runInvalid.length ? "판정 아님" : failed.length ? "실패" : "통과", failed, invalid: runInvalid,
      stats: summary?.stats ?? null, loadSeconds: summary?.loadSeconds ?? null, page: summary?.page ?? null,
      moments: summary === null ? null : Object.fromEntries(["season", "autosave", "dialog", "chapter"].map(kind => [kind, summary.moments.filter(moment => moment.kind === kind).length])),
      worstFrames: summary === null ? [] : [...summary.longFrames].sort((a, b) => b.ms - a.ms).slice(0, 10).map(frame => ({ atSeconds: Math.round((frame.to - (summary.startMarkPageMs ?? 0)) / 100) / 10, ms: Math.round(frame.ms * 10) / 10 })),
      // SMOOTH-2R: what the longest frames spent their time on (Chrome's Long Animation Frame entries, hitchAudit.ts).
      longAnimationFrames: summary === null ? [] : [...(summary.longAnimationFrames ?? [])].sort((a, b) => b.duration - a.duration).slice(0, 10)
        .map(entry => ({ ...entry, atSeconds: Math.round((entry.start - (summary.startMarkPageMs ?? 0)) / 100) / 10 })) })),
    moments: { windows: moments.windows, windowsWithLong: moments.windowsWithLong, baseline: moments.baseline, rows: moments.rows, pass: moments.pass } };
  writeFileSync(join(outDir, `${stamp}.json`), `${JSON.stringify(record, null, 1)}\n`);
  const cell = (value: number | null | undefined) => value === null || value === undefined ? "-" : String(value);
  const lines = [`# perf:gate 1단계 — ${verdict}`, "",
    `- 커밋 \`${commit.slice(0, 8)}\`${dirty ? " (커밋 안 된 변경 있음)" : ""} · ${started.toISOString()} · ${model} · ${chrome} · 1분 부하 ${record.machine.loadAverage1m.join(" → ")}`,
    `- 기준: p99 ≤ ${LIMITS.p99Ms} ms · 최대 ≤ ${LIMITS.maxMs} ms · 50 ms 초과 ≤ ${LIMITS.over50PerMin}/분 · 33 ms 초과 ≤ ${LIMITS.over33PerMin}/분 · 계절 전환·자동 저장 뒤 긴 프레임 비율 ≤ 아무 1.25초 구간(단측 이항 5 %)`,
    ...(allInvalid.length ? ["", "**판정 아님:**", ...allInvalid.map(reason => `- ${reason}`)] : []),
    ...(results.some(result => result.skipped !== undefined) ? ["", "**건너뜀(판정에 넣지 않음):**", ...results.filter(result => result.skipped !== undefined).map(result => `- ${result.scene.id}: ${result.skipped}`)] : []),
    ...(failures.length ? ["", "**실패:**", ...failures.map(reason => `- ${reason}`)] : []),
    "", "| 장면 | 판정 | p50 | p99 | 최대 | 50 ms 초과/분 | 33 ms 초과/분 | 계절·저장·모달 | 환경 | 가장 긴 프레임(기록 시작 뒤 초: ms) |", "|---|---|---:|---:|---:|---:|---:|---|---:|---|",
    ...record.scenes.map(scene => `| ${scene.label} | ${scene.verdict} | ${cell(scene.stats?.p50)} | ${cell(scene.stats?.p99)} | ${cell(scene.stats?.max)} | ${cell(scene.stats?.over50PerMin)} | ${cell(scene.stats?.over33PerMin)} | ${scene.moments ? `${scene.moments.season}·${scene.moments.autosave}·${scene.moments.dialog}` : "-"} | 다른 일 CPU ${Math.round(scene.loadMax * 100)}%${scene.conditions.length ? ` · ${scene.conditions.join(" · ")}` : ""} | ${scene.worstFrames.slice(0, 3).map(frame => `${frame.atSeconds}: ${frame.ms}`).join(", ")} |`),
    "", `순간(실행 합): 아무 1.25초 구간 ${moments.windows}개 중 ${moments.windowsWithLong}개(${Math.round(moments.baseline * 100)}%)에 긴 프레임.`,
    ...moments.rows.map(row => `- ${row.kind}: ${row.seen}번 중 ${row.followedByLongFrame}번(${Math.round(row.share * 100)}%), p ${row.pValue.toFixed(3)} — ${row.pass ? "통과" : "실패"}`), ""];
  writeFileSync(join(outDir, `${stamp}.md`), lines.join("\n"));
  const index = join(outDir, "README.md");
  if (existsSync(index)) appendFileSync(index, `| ${started.toLocaleDateString("sv-SE")} ${started.toTimeString().slice(0, 5)} | \`${commit.slice(0, 8)}\`${dirty ? "*" : ""} | ${verdict} | ${record.scenes.map(scene => `${scene.id} ${scene.verdict}`).join(" · ")} | [${stamp}](${stamp}.md) |\n`);
  console.log(`perf:gate ${verdict} → ${join(outDir, `${stamp}.md`)}`);
  process.exitCode = allInvalid.length > 0 ? 2 : failures.length > 0 ? 1 : 0;
}

if (process.argv[1]?.endsWith("perfGate.ts")) await main();
