// The always-on telemetry (~/.fls-telemetry, scripts/telemetry/vitePlugin.ts) split by the conditions each window ran
// under — nothing is thrown away, noisy windows are a group of their own. Per group: frames, the frame distribution
// (from the histograms), 33 / 50 ms per minute, heap falls (GC) per minute, pixel owners made, moments, and our
// functions in the long frames (Long Animation Frame scripts, by total time).
//   npm run telemetry:report [-- --days 1] [--commit <sha>] [--by cpu,input,visible,speed,population,commit,host] [--out <file.md>]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const argv = process.argv.slice(2);
const flag = (name: string, fallback: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] ?? fallback : fallback; };
const DIR = process.env.FLS_TELEMETRY_DIR ?? join(homedir(), ".fls-telemetry");
const days = Number(flag("days", "1")); const onlyCommit = flag("commit", ""); const by = flag("by", "cpu,input,visible,speed,population").split(",");
const BUCKETS = [9, 17, 25, 33, 50, 100, 250, Infinity];

// The condition keys: each window lands in one group per key combination.
export function conditions(sample: any): Record<string, string> {
  const cpu = sample.machine?.otherCpu; const idle = sample.machine?.hidIdleSeconds; const seconds = sample.seconds ?? 10;
  const population = Number(String(sample.env?.population ?? "").replace(/[^\d]/g, ""));
  return {
    cpu: cpu === null || cpu === undefined ? "CPU ?" : cpu < 0.1 ? "다른 CPU <10%" : cpu < 0.3 ? "다른 CPU 10~30%" : "다른 CPU ≥30%",
    input: idle === null || idle === undefined ? "입력 ?" : idle < seconds ? "사람 입력 있음" : "입력 없음",
    visible: sample.env?.visible === false || (sample.window?.hidden ?? 0) > 0 ? "창 가려짐" : sample.env?.focus === false ? "보임·초점 없음" : "보임·초점",
    speed: sample.env?.speed ?? "배속 ?",
    population: !Number.isFinite(population) || population === 0 ? "인구 ?" : population < 200 ? "인구 <200" : population < 600 ? "인구 200~599" : "인구 ≥600",
    commit: `${sample.commit ?? "?"}${sample.dirty ? "*" : ""}`, host: sample.host ?? "?", zoom: sample.env?.zoom === null || sample.env?.zoom === undefined ? "줌 ?" : `줌 ${Math.round(sample.env.zoom * 10) / 10}`,
  };
}

/** The value below which `share` of the frames fall, from a bucket histogram (the bucket's upper bound). */
export function histogramPercentile(histogram: readonly number[], share: number): number | null {
  const total = histogram.reduce((sum, count) => sum + count, 0); if (total === 0) return null;
  let seen = 0; for (let i = 0; i < histogram.length; i++) { seen += histogram[i]!; if (seen >= total * share) return BUCKETS[i]!; }
  return null;
}

function main() {
  if (!existsSync(DIR)) { console.log(`telemetry: nothing in ${DIR} yet`); return; }
  const since = Date.now() - days * 86_400_000;
  const samples: any[] = [];
  for (const day of readdirSync(DIR).filter(name => /^\d{4}-\d\d-\d\d$/.test(name)).sort()) {
    if (new Date(`${day}T23:59:59`).getTime() < since) continue;
    for (const file of readdirSync(join(DIR, day)).filter(name => name.endsWith(".jsonl")))
      for (const line of readFileSync(join(DIR, day, file), "utf8").split("\n")) {
        if (line.trim() === "") continue;
        try { const sample = JSON.parse(line); if ((sample.sent ?? 0) >= since && (onlyCommit === "" || String(sample.commit).startsWith(onlyCommit))) samples.push(sample); } catch { /* a torn line */ }
      }
  }
  const groups = new Map<string, any[]>();
  for (const sample of samples) { const c = conditions(sample); const key = by.map(name => c[name] ?? "?").join(" · "); (groups.get(key) ?? groups.set(key, []).get(key)!).push(sample); }
  const lines = [`# 텔레메트리 — 지난 ${days}일, 창 ${samples.length}개(10초 단위), 조건별`, "", `나눈 기준: ${by.join(", ")} · 자료 ${DIR}`, "",
    "| 조건 | 창 | 분 | 프레임 | p50 | p95 | p99 | 최대 ms | 33 ms 초과/분 | 50 ms 초과/분 | GC/분 | 캔버스+비트맵/분 | 계절·저장 | 텔레메트리 자기 시간 ms/s |", "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|"];
  const functions = new Map<string, Map<string, { ms: number; count: number }>>();
  for (const [key, list] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    const histogram = BUCKETS.map((_, i) => list.reduce((sum, sample) => sum + (sample.window?.histogram?.[i] ?? 0), 0));
    const minutes = list.reduce((sum, sample) => sum + (sample.seconds ?? 10), 0) / 60;
    const sum = (read: (sample: any) => number) => list.reduce((total, sample) => total + (read(sample) || 0), 0);
    const frames = sum(sample => sample.window?.frames); const max = Math.max(0, ...list.map(sample => sample.window?.max ?? 0));
    const perMin = (value: number) => minutes === 0 ? "-" : String(Math.round((value / minutes) * 10) / 10);
    lines.push(`| ${key} | ${list.length} | ${Math.round(minutes * 10) / 10} | ${frames} | ≤${histogramPercentile(histogram, 0.5)} | ≤${histogramPercentile(histogram, 0.95)} | ≤${histogramPercentile(histogram, 0.99)} | ${Math.round(max)} | ${perMin(sum(sample => sample.window?.over33))} | ${perMin(sum(sample => sample.window?.over50))} | ${perMin(sum(sample => sample.window?.heap?.gcs))} | ${perMin(sum(sample => (sample.window?.made?.canvas ?? 0) + (sample.window?.made?.offscreen ?? 0) + (sample.window?.made?.bitmap ?? 0)))} | ${sum(sample => sample.window?.moments?.season)}·${sum(sample => sample.window?.moments?.autosave)} | ${minutes === 0 ? "-" : Math.round(sum(sample => sample.window?.selfMs) / (minutes * 60) * 100) / 100} |`);
    const table = functions.get(key) ?? new Map(); functions.set(key, table);
    for (const sample of list) for (const frame of sample.window?.longFrames ?? []) for (const script of frame.scripts ?? []) {
      const name = `${script.fn || "(익명)"} ${script.url || ""}`.trim(); const entry = table.get(name) ?? { ms: 0, count: 0 }; entry.ms += script.ms; entry.count += 1; table.set(name, entry);
    }
  }
  lines.push("", "## 긴 프레임의 우리 함수(조건별 상위 8, Long Animation Frame 스크립트 시간 합)", "");
  for (const [key, table] of functions) {
    const top = [...table].sort((a, b) => b[1].ms - a[1].ms).slice(0, 8); if (top.length === 0) continue;
    lines.push(`- **${key}**: ${top.map(([name, entry]) => `\`${name}\` ${entry.ms} ms(${entry.count})`).join(" · ")}`);
  }
  const text = lines.join("\n"); const out = flag("out", "");
  if (out !== "") writeFileSync(out, `${text}\n`); console.log(text);
}

if (process.argv[1]?.endsWith("report.ts")) main();
