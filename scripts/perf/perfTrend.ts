// docs/verification/perf-trend/: the per-commit trend of the noise-resistant metrics (scripts/perf/trendRun.ts on the
// DGX), newest trunk commit first, with the metrics that got worse marked. The user judges by this page.
//   npm run perf:trend [-- --no-fetch]      fetch ~/fls-runs/_trend/*.json from the DGX, then write the page
// The judgement (decisions RR6, RR7) is scripts/perf/trendRule.ts: a value outside the comparison commit's widened range
// is only a suspicion ("의심"); the DGX runner then runs perf:ab for it, and the page marks "나빠짐" only when that
// paired A-B-A-B confirms it (the difference's 95 % t band above zero). Confirmations are ~/fls-runs/_trend/ab/*.json.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { confirmationName, JUDGED, MIN_RUNS, settledVerdict, suspect } from "./trendRule";

const DIR = "docs/verification/perf-trend"; const DATA = join(DIR, "data"); const AB = join(DATA, "ab");
const HOST = process.env.FLS_REMOTE_HOST ?? "hyunlord@100.70.109.50";
const TRUNK = "origin/codex/phase15-organic-ground";
// For the record, beside the load: script time is judged only in perf:ab's paired A-B-A-B (RR6); heapEndMB is wherever
// the GC sawtooth was at the end of a run (61–90 MB within one commit).
const INFO = [["otherCpu", "다른 일 CPU(DGX 전체 코어 중)"], ["scriptMsPerTick", "스크립트 ms/틱(참고)"], ["scriptMsPerFrame", "스크립트 ms/프레임(참고)"],
  ["heapAllocKBPerTick", "JS 할당 KB/틱(참고)"], ["canvasPer1kTicks", "캔버스 생성/1천 틱(참고)"], ["bitmapPerSec", "비트맵/초(참고)"], ["getImageDataPerSec", "getImageData/초(참고)"],
  ["heapEndMB", "JS 힙 끝 MB(참고, GC 톱니 위 한 점)"], ["p95", "p95 ms(DGX, 참고)"], ["over33PerMin", "33 ms 초과/분(DGX, 참고)"]] as const;

interface CodeBudgets { budgets: Record<string, { label: string; budgetMs: number; values: number[]; median: number | null }>; otherCpu: number[] }
interface Row { commit: string; subject: string; committed: string; measured: string; scenes: Record<string, { runs: number; medians: Record<string, number | null>; values?: Record<string, number[]> }>; codeBudgets?: CodeBudgets }


function main() {
  mkdirSync(AB, { recursive: true });
  if (!process.argv.includes("--no-fetch")) {
    const tar = spawnSync("ssh", ["-o", "BatchMode=yes", HOST, "cd ~/fls-runs/_trend 2>/dev/null && tar cf - *.json $(ls ab/*.json 2>/dev/null) 2>/dev/null"], { maxBuffer: 256 * 1024 * 1024 });
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
    "- **표시**(결정 RR7): ① 이 커밋의 값(제 실행들의 중앙값)이 비교 커밋(잰 커밋 가운데 가장 가까운 조상 — DGX 실행과 같은 커밋)이 제 실행들에서 보인 범위를 그 폭만큼 양쪽으로 넓힌 범위 밖이면 **의심**이다. ② 의심이 뜨면 DGX가 비교 커밋과 이 커밋을 같은 장면에서 A-B-A-B(`perf:ab`, 45초 × 4쌍)로 자동으로 돌린다. ③ 짝 차이의 95 % 폭(쌍 수에 맞춘 t 분포, 4쌍이면 ±3.18 표준오차)이 0 위에 있으면 A-B를 한 번 더 돌리고, 두 번 모두 그럴 때만 **나빠짐**, 아래면 좋아짐, 걸치면 같음으로 끝난다. 추이는 커밋마다 다른 시간(다른 부하)에 재서 범위 규칙만으로는 흔들리고, A-B-A-B는 같은 소음을 둘이 같이 맞는다.",
    "- **장면**: 가장 큰 도시 5×(`fixtures/perf-gate/ch4-1380`), 새 게임 3×. 각 45초 × 3회, 중앙값. 증명 포트 켬(틱 수).",
    "- **비교가 필요하면**: `npm run perf:ab -- --a <커밋> --b <커밋>`(A-B-A-B 번갈아, 같은 소음을 둘이 같이 맞음).", ""];
  const confirmations = new Map<string, any>();
  for (const file of readdirSync(AB).filter(name => name.endsWith(".json"))) confirmations.set(file, JSON.parse(readFileSync(join(AB, file), "utf8")));
  const flagged: string[] = []; const pending: string[] = []; const cleared: string[] = [];
  // The comparison commit is the one the DGX runner used (trendRun.ts confirm): the nearest measured *ancestor*, not
  // the previous trunk commit by date — a branch merged after another lies beside it, not after it (20eec341 was
  // compared with ba52bae3 here and with aa6aadbc on the DGX, so its A-B records were never found).
  const comparisonOf = new Map<string, Row | null>();
  for (const row of ordered) {
    const ancestors = spawnSync("git", ["rev-list", "--date-order", `${row.commit}^@`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).stdout.split("\n");
    const earlier = ancestors.find(commit => commit !== "" && rows.has(commit));
    comparisonOf.set(row.commit, earlier === undefined ? null : rows.get(earlier)!);
  }
  for (const scene of scenes) {
    lines.push(`## ${scene}`, "", `| 커밋 | 날짜 | ${JUDGED.map(([, label]) => label).join(" | ")} | ${INFO.map(([, label]) => label).join(" | ")} |`,
      `|---|---|${JUDGED.map(() => "---:").join("|")}|${INFO.map(() => "---:").join("|")}|`);
    const out: string[] = [];
    for (const row of ordered) {
      const medians = row.scenes[scene]?.medians ?? {};
      const base = comparisonOf.get(row.commit) ?? null;
      const cells = JUDGED.map(([key]) => {
        const value = medians[key] ?? null;
        const againstRuns = (base?.scenes[scene]?.values?.[key] ?? []).filter(Number.isFinite);
        const against = base === null || againstRuns.length < MIN_RUNS ? null : { commit: base.commit, runs: againstRuns };
        const suspicion = suspect(value, against?.runs ?? []);
        if (value === null) return "-";
        if (suspicion === "") return String(value);
        const low = Math.min(...against!.runs); const high = Math.max(...against!.runs);
        const where = `${row.commit.slice(0, 8)} ${scene} ${key} ${value}(비교 ${against!.commit.slice(0, 8)} ${low}~${high})`;
        const verdict = settledVerdict(confirmations.get(confirmationName(against!.commit, row.commit, scene)), key);
        if (verdict === null) { pending.push(where); return `${value} 의심(A-B 대기)`; }
        if (verdict === "재확인 대기") { pending.push(`${where} → 첫 A-B 나빠짐, 두 번째 A-B 대기`); return `${value} 의심(두 번째 A-B 대기)`; }
        // The A-B settles a suspected metric either way: it is the only comparison that takes the same noise on both sides.
        if (verdict === "나빠짐") { flagged.push(`${where} → A-B 두 번 모두 나빠짐`); return `${value} **나빠짐**(A-B 두 번)`; }
        if (verdict === "좋아짐") return `${value} 좋아짐(A-B)`;
        cleared.push(`${where} → A-B ${verdict}`);
        return `${value} 의심→같음(A-B)`;
      });
      out.unshift(`| \`${row.commit.slice(0, 8)}\` ${row.subject.slice(0, 50).replace(/\|/g, "/")} | ${row.committed.slice(0, 16).replace("T", " ")} | ${cells.join(" | ")} | ${INFO.map(([key]) => medians[key] ?? "-").join(" | ")} |`);
    }
    lines.push(...out, "");
  }
  // The code budgets moved out of the regression tests (docs/verification/wall-clock-tests.md): reference only, beside the load.
  const budgeted = ordered.filter(row => row.codeBudgets !== undefined);
  const budgetIds = [...new Set(budgeted.flatMap(row => Object.keys(row.codeBudgets!.budgets)))];
  const overBudget: string[] = [];
  if (budgetIds.length > 0) {
    const first = budgeted[0]!.codeBudgets!.budgets;
    lines.push("## 코드 시간 예산(회귀 시험에서 옮김, 참고)", "",
      "벽시계 예산이라 DGX가 바쁘면 회귀 시험을 떨어뜨렸다(`docs/verification/wall-clock-tests.md`). 그 시험들은 이제 결과만 보고, 시간은 커밋마다 여기에 적는다(세 번의 중앙값 ms, 괄호는 예산). 예산을 넘은 칸은 \"예산 넘음\"이다. 다른 일 CPU가 높으면 기계 탓일 수 있다.", "",
      `| 커밋 | ${budgetIds.map(id => `${first[id]?.label ?? id}(${first[id]?.budgetMs ?? "?"})`).join(" | ")} | 다른 일 CPU |`, `|---|${budgetIds.map(() => "---:").join("|")}|---:|`);
    for (const row of [...budgeted].reverse()) {
      const budgets = row.codeBudgets!.budgets;
      const cells = budgetIds.map(id => {
        const entry = budgets[id]; if (entry === undefined || entry.median === null) return "-";
        if (entry.median > entry.budgetMs) { overBudget.push(`${row.commit.slice(0, 8)} ${id} ${entry.median} ms > ${entry.budgetMs}`); return `${entry.median} **예산 넘음**`; }
        return String(entry.median);
      });
      const cpu = row.codeBudgets!.otherCpu;
      lines.push(`| \`${row.commit.slice(0, 8)}\` | ${cells.join(" | ")} | ${cpu.length === 0 ? "-" : Math.max(...cpu)} |`);
    }
    lines.push("");
  }
  if (offTrunk.length > 0) lines.push("## 본선 밖에서 잰 커밋", "", ...offTrunk.map(row => `- \`${row.commit.slice(0, 8)}\` ${row.subject.slice(0, 80)} (${row.measured.slice(0, 16)})`), "");
  lines.splice(10, 0, flagged.length === 0 ? "**지금 나빠진 지표(A-B 확정): 없음.**" : `**나빠진 지표 ${flagged.length}개(A-B 확정):** ${flagged.map(entry => `\`${entry}\``).join(" · ")}`, "",
    pending.length === 0 ? "A-B를 기다리는 의심: 없음." : `A-B를 기다리는 의심 ${pending.length}개: ${pending.map(entry => `\`${entry}\``).join(" · ")}`, "",
    overBudget.length === 0 ? "코드 시간 예산을 넘은 칸(참고): 없음." : `코드 시간 예산을 넘은 칸(참고) ${overBudget.length}개: ${overBudget.map(entry => `\`${entry}\``).join(" · ")}`, "",
    cleared.length === 0 ? "A-B가 같음으로 끝낸 의심: 없음." : `A-B가 같음으로 끝낸 의심 ${cleared.length}개: ${cleared.map(entry => `\`${entry}\``).join(" · ")}`, "");
  writeFileSync(join(DIR, "README.md"), lines.join("\n"));
  writeFileSync(join(DIR, "trend.json"), `${JSON.stringify(ordered.map(row => ({ commit: row.commit, subject: row.subject, committed: row.committed, scenes: row.scenes })), null, 1)}\n`);
  console.log(`perf:trend: ${ordered.length} trunk commit(s), ${offTrunk.length} off the trunk, ${flagged.length} worse (A-B confirmed), ${pending.length} suspicion(s) awaiting A-B, ${cleared.length} cleared → ${join(DIR, "README.md")}`);
}

if (process.argv[1]?.endsWith("perfTrend.ts") && existsSync("package.json")) main();
