// The telemetry's own cost (requirement: ≤ 1 %): two dev servers of this checkout, telemetry off (FLS_TELEMETRY=0) and
// on, the same scene A-B-A-B (hitchAudit, no trace, no proof port), paired differences of Chrome's main-thread time.
//   PLAYWRIGHT_MODULE=… tsx scripts/telemetry/overhead.ts [--rounds 4] [--seconds 30] [--scene new-game-x3] [--headed]
import { spawnSync } from "node:child_process";
import { spawnServer } from "../serverProcess";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { paired } from "../perf/perfAB";
import { SCENES } from "../perf/perfGate";
import { freePort } from "../perf/freePort";

const argv = process.argv.slice(2);
const flag = (name: string, fallback: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] ?? fallback : fallback; };
const rounds = Number(flag("rounds", "4")); const seconds = Number(flag("seconds", "30")); const headed = argv.includes("--headed");
const scene = SCENES.find(entry => entry.id === flag("scene", "new-game-x3"))!;
const work = mkdtempSync(join(tmpdir(), "fls-tele-overhead-"));
const servers = [["off", await freePort(), "0"], ["on", await freePort(), "1"]] as const;
const children = servers.map(([, port, telemetry]) => spawnServer("node_modules/.bin/vite", ["--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  { stdio: "ignore", env: { ...process.env, FLS_TELEMETRY: telemetry, FLS_TELEMETRY_DIR: join(work, "store") } }));
try {
  for (const [, port] of servers) for (let i = 0; i < 60; i++) { if (await fetch(`http://127.0.0.1:${port}/`).then(response => response.ok, () => false)) break; await new Promise(done => setTimeout(done, 1000)); }
  const values: Record<"off" | "on", { script: number[]; task: number[] }> = { off: { script: [], task: [] }, on: { script: [], task: [] } };
  for (let round = 1; round <= rounds; round++) for (const [side, port] of servers) {
    const run = `tele-${side}${round}`;
    const audit = spawnSync("node_modules/.bin/tsx", ["scripts/perf/hitchAudit.ts", "--url", `http://127.0.0.1:${port}/`, "--scene", run, "--speed", String(scene.speed),
      "--seconds", String(seconds), "--action", scene.action, "--machine", "m", "--out", join(work, "runs"), "--traces", join(work, "rec"), "--no-trace", "--no-proof",
      ...(headed ? ["--headed"] : []), ...(scene.save === null ? [] : ["--save", scene.save])], { encoding: "utf8" });
    const file = join(work, "runs", `m-${run}-x${scene.speed}-notrace-noproof.json`);
    if (audit.status !== 0 || !existsSync(file)) { console.log(`${run}: failed`); continue; }
    const metrics = JSON.parse(readFileSync(file, "utf8")).metrics;
    values[side].script.push(metrics.scriptMsPerFrame); values[side].task.push(metrics.taskMsPerFrame);
    console.log(`${run}: script ${metrics.scriptMsPerFrame} ms/frame, task ${metrics.taskMsPerFrame} ms/frame`);
  }
  for (const key of ["script", "task"] as const) {
    const n = Math.min(values.off[key].length, values.on[key].length);
    const result = paired(values.off[key].slice(0, n), values.on[key].slice(0, n));
    console.log(`${key} ms/frame: off ${result.meanA.toFixed(3)} → on ${result.meanB.toFixed(3)} · ${result.percent?.toFixed(2)} % ± ${(result.band / result.meanA * 100).toFixed(2)} % (${result.verdict})`);
  }
} finally { for (const child of children) child.kill(); rmSync(work, { recursive: true, force: true }); }
