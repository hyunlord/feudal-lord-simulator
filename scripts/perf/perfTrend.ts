// docs/verification/perf-trend/: the per-commit trend of the noise-resistant metrics (scripts/perf/trendRun.ts on the
// DGX), newest trunk commit first, with the metrics that got worse marked. The user judges by this page.
//   npm run perf:trend [-- --no-fetch]      fetch ~/fls-runs/_trend/*.json from the DGX, then write the page
// A metric is "나빠짐" when it is above the median of the previous (up to) five measured trunk commits by more than
// max(3 × their median absolute deviation, 10 % of the median, the metric's floor); "좋아짐" the same way below.
// Every metric here is worse when higher.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const DIR = "docs/verification/perf-trend"; const DATA = join(DIR, "data");
const HOST = process.env.FLS_REMOTE_HOST ?? "hyunlord@100.70.109.50";
const TRUNK = "origin/codex/phase15-organic-ground";
// The judged metrics: [key, label, floor (a change smaller than this is never marked)].
export const JUDGED: readonly [string, string, number][] = [
  ["scriptMsPerTick", "스크립트 ms/틱", 0.02], ["heapAllocKBPerTick", "JS 할당 KB/틱", 5], ["canvasPer1kTicks", "캔버스 생성/1천 틱", 1],
  ["gcPerMin", "힙 하락(GC)/분", 3], ["heapEndMB", "JS 힙 끝 MB", 5], ["scriptMsPerFrame", "스크립트 ms/프레임", 0.2],
  ["bitmapPerSec", "비트맵/초", 1], ["getImageDataPerSec", "getImageData/초", 0.5],
];
const INFO = [["p95", "p95 ms(DGX, 참고)"], ["over33PerMin", "33 ms 초과/분(DGX, 참고)"]] as const;

interface Row { commit: string; subject: string; committed: string; measured: string; scenes: Record<string, { runs: number; medians: Record<string, number | null> }> }
const median = (values: readonly number[]) => { const sorted = [...values].sort((a, b) => a - b); return sorted.length === 0 ? null : sorted[Math.floor((sorted.length - 1) / 2)]!; };

export function mark(value: number | null, previous: readonly number[], floor: number): "나빠짐" | "좋아짐" | "" {
  if (value === null || previous.length < 2) return "";
  const base = median(previous)!; const mad = median(previous.map(entry => Math.abs(entry - base)))!;
  const band = Math.max(3 * mad, Math.abs(base) * 0.1, floor);
  return value > base + band ? "나빠짐" : value < base - band ? "좋아짐" : "";
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
    "- **지표**(모두 클수록 나쁨): 틱당 값은 기계가 바빠 틱이 적게 돌아도 흔들리지 않는다. 프레임 시간(p95 등)은 DGX 소프트웨어 래스터라 참고만 한다.",
    "- **표시**: 직전 측정된 본선 커밋(최대 5개)의 중앙값보다 max(3 × 중앙 절대 편차, 10 %, 지표 바닥값)을 넘게 크면 **나빠짐**, 그만큼 작으면 좋아짐.",
    "- **장면**: 가장 큰 도시 5×(`fixtures/perf-gate/ch4-1380`), 새 게임 3×. 각 45초 × 3회, 중앙값. 증명 포트 켬(틱 수).",
    "- **비교가 필요하면**: `npm run perf:ab -- --a <커밋> --b <커밋>`(A-B-A-B 번갈아, 같은 소음을 둘이 같이 맞음).", ""];
  const flagged: string[] = [];
  for (const scene of scenes) {
    lines.push(`## ${scene}`, "", `| 커밋 | 날짜 | ${JUDGED.map(([, label]) => label).join(" | ")} | ${INFO.map(([, label]) => label).join(" | ")} |`,
      `|---|---|${JUDGED.map(() => "---:").join("|")}|${INFO.map(() => "---:").join("|")}|`);
    const history: Record<string, number[]> = Object.fromEntries(JUDGED.map(([key]) => [key, []]));
    const out: string[] = [];
    for (const row of ordered) {
      const medians = row.scenes[scene]?.medians ?? {};
      const cells = JUDGED.map(([key, , floor]) => {
        const value = medians[key] ?? null; const verdict = mark(value, history[key]!.slice(-5), floor);
        if (value !== null) history[key]!.push(value);
        if (verdict === "나빠짐") flagged.push(`${row.commit.slice(0, 8)} ${scene} ${key}`);
        return value === null ? "-" : `${value}${verdict === "" ? "" : verdict === "나빠짐" ? " **나빠짐**" : " 좋아짐"}`;
      });
      out.unshift(`| \`${row.commit.slice(0, 8)}\` ${row.subject.slice(0, 50).replace(/\|/g, "/")} | ${row.committed.slice(0, 16).replace("T", " ")} | ${cells.join(" | ")} | ${INFO.map(([key]) => medians[key] ?? "-").join(" | ")} |`);
    }
    lines.push(...out, "");
  }
  if (offTrunk.length > 0) lines.push("## 본선 밖에서 잰 커밋", "", ...offTrunk.map(row => `- \`${row.commit.slice(0, 8)}\` ${row.subject.slice(0, 80)} (${row.measured.slice(0, 16)})`), "");
  lines.splice(9, 0, flagged.length === 0 ? "**지금 나빠진 지표: 없음.**" : `**나빠진 지표 ${flagged.length}개:** ${flagged.map(entry => `\`${entry}\``).join(" · ")}`, "");
  writeFileSync(join(DIR, "README.md"), lines.join("\n"));
  writeFileSync(join(DIR, "trend.json"), `${JSON.stringify(ordered.map(row => ({ commit: row.commit, subject: row.subject, committed: row.committed, scenes: row.scenes })), null, 1)}\n`);
  console.log(`perf:trend: ${ordered.length} trunk commit(s), ${offTrunk.length} off the trunk, ${flagged.length} flagged → ${join(DIR, "README.md")}`);
}

if (process.argv[1]?.endsWith("perfTrend.ts") && existsSync("package.json")) main();
