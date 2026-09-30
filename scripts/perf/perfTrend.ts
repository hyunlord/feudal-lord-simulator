// docs/verification/perf-trend/: the per-commit trend of the noise-resistant metrics (scripts/perf/trendRun.ts on the
// DGX), newest trunk commit first, with the metrics that got worse marked. The user judges by this page.
//   npm run perf:trend [-- --no-fetch]      fetch ~/fls-runs/_trend/*.json from the DGX, then write the page
// A metric is "나빠짐" when its value (the median of the commit's runs) is above the range the comparison commit showed
// across its own runs, "좋아짐" below it (user decision RR7, the same rule as SG4). The comparison commit is the nearest
// earlier measured trunk commit with at least three runs of that metric; without one nothing is marked.
// Every metric here is worse when higher.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "docs/verification/perf-trend"; const DATA = join(DIR, "data");
const HOST = process.env.FLS_REMOTE_HOST ?? "hyunlord@100.70.109.50";
const TRUNK = "origin/codex/phase15-organic-ground";
// The judged metrics (user decision RR6): [key, label]. Rates per
// second, not per tick: a busy DGX runs fewer ticks while the per-frame work goes on, so per-tick values rise with the
// load (big town canvases 194–306 per 1k ticks at one commit, 1.56–1.91 per second).
export const JUDGED: readonly [string, string][] = [
  ["heapAllocMBps", "JS 할당 MB/s"], ["gcPerMin", "힙 하락(GC)/분"], ["canvasPerSec", "캔버스 생성/초"], ["heapAfterGcMB", "GC 뒤 남은 JS 힙 MB"],
];
/** The fewest runs a comparison commit needs for its range to judge by (RR7, as SG4). */
export const MIN_RUNS = 3;
// For the record, beside the load: script time is judged only in perf:ab's paired A-B-A-B (RR6); heapEndMB is wherever
// the GC sawtooth was at the end of a run (61–90 MB within one commit).
const INFO = [["otherCpu", "다른 일 CPU(DGX 전체 코어 중)"], ["scriptMsPerTick", "스크립트 ms/틱(참고)"], ["scriptMsPerFrame", "스크립트 ms/프레임(참고)"],
  ["heapAllocKBPerTick", "JS 할당 KB/틱(참고)"], ["canvasPer1kTicks", "캔버스 생성/1천 틱(참고)"], ["bitmapPerSec", "비트맵/초(참고)"], ["getImageDataPerSec", "getImageData/초(참고)"],
  ["heapEndMB", "JS 힙 끝 MB(참고, GC 톱니 위 한 점)"], ["p95", "p95 ms(DGX, 참고)"], ["over33PerMin", "33 ms 초과/분(DGX, 참고)"]] as const;

interface Row { commit: string; subject: string; committed: string; measured: string; scenes: Record<string, { runs: number; medians: Record<string, number | null>; values?: Record<string, number[]> }> }

export function mark(value: number | null, comparisonRuns: readonly number[]): "나빠짐" | "좋아짐" | "" {
  if (value === null || comparisonRuns.length < MIN_RUNS) return "";
  const low = Math.min(...comparisonRuns); const high = Math.max(...comparisonRuns);
  return value > high ? "나빠짐" : value < low ? "좋아짐" : "";
}

function main() {
  mkdirSync(DATA, { recursive: true });
  if (!process.argv.includes("--no-fetch")) {
    const tar = spawnSync("ssh", ["-o", "BatchMode=yes", HOST, "cd ~/fls-runs/_trend 2>/dev/null && tar cf - *.json 2>/dev/null"], { maxBuffer: 256 * 1024 * 1024 });
    if (tar.status === 0 && tar.stdout.length > 0) spawnSync("tar", ["xf", "-", "-C", DATA], { input: tar.stdout });
    else console.error("perf:trend: nothing fetched from the DGX (offline, or no trend yet); writing from docs/verification/perf-trend/data");
  }
  const rows = new Map<string, Row>();
  for (const file of readdirSync(DATA).filter(name => name.endsWith(".json"))) { const row = JSON.parse(readFileSync(join(DATA, file), "utf8")) as Row; rows.set(row.commit, row); }
  spawnSync("git", ["fetch", "-q", "origin"], { encoding: "utf8" });
  // Every commit the trunk reaches, newest first by commit date (the first-parent path wanders through merged branches:
  // branches merge the trunk in and the trunk then fast-forwards to them).
  const trunk = spawnSync("git", ["rev-list", "--date-order", TRUNK], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stdout.trim().split("\n");
  const ordered = trunk.filter(commit => rows.has(commit)).map(commit => rows.get(commit)!).reverse();   // oldest first
  const offTrunk = [...rows.values()].filter(row => !trunk.includes(row.commit));
  const scenes = [...new Set([...rows.values()].flatMap(row => Object.keys(row.scenes)))];
  const lines = ["# 성능 추이 (커밋마다, DGX)", "",
    "사용자 판정(2026-09-30): 이 표로 판정한다. 본선에 푸시할 때마다 pre-push 훅이 그 커밋을 DGX에서 뒤로 잰다(`scripts/perf/trendRun.ts`, 기다리지 않음). `npm run perf:trend`가 결과를 모아 이 문서를 다시 쓴다.", "",
    "- **판정 지표 넷**(결정 RR6, 모두 클수록 나쁨): JS 할당 MB/s · 힙 하락(GC)/분 · 캔버스 생성/초 · GC 뒤 남은 JS 힙 MB. 초당 값이라 DGX가 바빠 틱이 적게 돌아도 덜 흔들린다.",
    "- **참고 칸**(표시 없음): 스크립트 시간(ms/틱·ms/프레임)은 DGX 부하에 끌려가므로(`a597617b` 큰 도시: 조용할 때 13.5 ms/틱, 전체 시험과 함께 19.9 ms/틱) **다른 일 CPU** 칸과 나란히 적기만 한다. 스크립트 시간은 `npm run perf:ab`의 A-B-A-B 짝 비교에서만 판정한다. JS 힙 끝은 GC 톱니 위 한 점(같은 커밋에서 61~90 MB), 프레임 시간(p95 등)은 DGX 소프트웨어 래스터라 참고만 한다.",
    "- **표시**(결정 RR7, SG4와 같은 규칙): 이 커밋의 값(제 실행들의 중앙값)이 비교 커밋이 제 실행들(최소 세 번)에서 보인 범위보다 크면 **나빠짐**, 작으면 좋아짐, 안이면 같음. 비교 커밋은 그 지표를 세 번 이상 잰 가장 가까운 앞 본선 커밋이다.",
    "- **장면**: 가장 큰 도시 5×(`fixtures/perf-gate/ch4-1380`), 새 게임 3×. 각 45초 × 3회, 중앙값. 증명 포트 켬(틱 수).",
    "- **비교가 필요하면**: `npm run perf:ab -- --a <커밋> --b <커밋>`(A-B-A-B 번갈아, 같은 소음을 둘이 같이 맞음).", ""];
  const flagged: string[] = [];
  for (const scene of scenes) {
    lines.push(`## ${scene}`, "", `| 커밋 | 날짜 | ${JUDGED.map(([, label]) => label).join(" | ")} | ${INFO.map(([, label]) => label).join(" | ")} |`,
      `|---|---|${JUDGED.map(() => "---:").join("|")}|${INFO.map(() => "---:").join("|")}|`);
    // Per metric, the nearest earlier commit with at least MIN_RUNS runs of it: its commit and its runs.
    const comparison: Record<string, { commit: string; runs: number[] } | null> = Object.fromEntries(JUDGED.map(([key]) => [key, null]));
    const out: string[] = [];
    for (const row of ordered) {
      const medians = row.scenes[scene]?.medians ?? {};
      const cells = JUDGED.map(([key]) => {
        const value = medians[key] ?? null; const against = comparison[key];
        const verdict = mark(value, against?.runs ?? []);
        const runs = (row.scenes[scene]?.values?.[key] ?? []).filter(Number.isFinite);
        if (runs.length >= MIN_RUNS) comparison[key] = { commit: row.commit, runs };
        if (verdict === "나빠짐") flagged.push(`${row.commit.slice(0, 8)} ${scene} ${key} ${value}(비교 ${against!.commit.slice(0, 8)} ${Math.min(...against!.runs)}~${Math.max(...against!.runs)})`);
        return value === null ? "-" : `${value}${verdict === "" ? "" : verdict === "나빠짐" ? " **나빠짐**" : " 좋아짐"}`;
      });
      out.unshift(`| \`${row.commit.slice(0, 8)}\` ${row.subject.slice(0, 50).replace(/\|/g, "/")} | ${row.committed.slice(0, 16).replace("T", " ")} | ${cells.join(" | ")} | ${INFO.map(([key]) => medians[key] ?? "-").join(" | ")} |`);
    }
    lines.push(...out, "");
  }
  if (offTrunk.length > 0) lines.push("## 본선 밖에서 잰 커밋", "", ...offTrunk.map(row => `- \`${row.commit.slice(0, 8)}\` ${row.subject.slice(0, 80)} (${row.measured.slice(0, 16)})`), "");
  lines.splice(10, 0, flagged.length === 0 ? "**지금 나빠진 지표: 없음.**" : `**나빠진 지표 ${flagged.length}개:** ${flagged.map(entry => `\`${entry}\``).join(" · ")}`, "");
  writeFileSync(join(DIR, "README.md"), lines.join("\n"));
  writeFileSync(join(DIR, "trend.json"), `${JSON.stringify(ordered.map(row => ({ commit: row.commit, subject: row.subject, committed: row.committed, scenes: row.scenes })), null, 1)}\n`);
  console.log(`perf:trend: ${ordered.length} trunk commit(s), ${offTrunk.length} off the trunk, ${flagged.length} flagged → ${join(DIR, "README.md")}`);
}

if (process.argv[1]?.endsWith("perfTrend.ts") && existsSync("package.json")) main();
