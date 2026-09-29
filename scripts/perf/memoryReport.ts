// SMOOTH-G: the memory holders table from scripts/perf/memoryHolders.ts runs (<scene>.memory.json) and their heap
// snapshots read by scripts/perf/heapSnapshot.ts (<scene>.heap.json).
//   tsx scripts/perf/memoryReport.ts <run dir> --out <summary.json> --tables <tables.md>
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dir] = process.argv.slice(2);
const flag = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
if (dir === undefined) throw new Error("Usage: memoryReport.ts <run dir> --out <json> --tables <md>");

// The caches SMOOTH-2R will bound, by the src/ file that asks for their pixels.
const CACHES: readonly [RegExp, string][] = [
  [/src\/render\/walkerComposer\.ts/, "걷는 사람 합성 캐시"],
  [/src\/render\/groundChunkCache\.ts/, "지면 청크 캐시"],
  [/src\/render\/worldRasterCache\.ts/, "worldRasterCache(그림 래스터)"],
  [/src\/render\/worldAssetScaleCache\.ts/, "그림 축척 캐시"],
  [/src\/render\/worldSprite\.ts/, "스프라이트 색조 캐시"],
  [/src\/render\/(drawWallFaces|timberWallAssets|stoneWallAssets|gateArtAssets)\.ts/, "벽 캐시"],
  [/src\/render\/(seasonFx|seasonArt|weatherArt)\.ts/, "계절·날씨 그림"],
  [/src\/ui\/(portraitArt|portraitSilhouette)\.ts|assets\/.*portrait/, "초상"],
  [/src\/ui\/(wave21Art|wave31Art|uiArt)\.ts|src\/ui\/chronicle|assets\/wave2[01]|assets\/wave31/, "삽화·UI 그림"],
  [/src\/ui\/heraldry/, "문장"],
];
const cacheOf = (file: string, source: string) => CACHES.find(([pattern]) => pattern.test(file) || pattern.test(source))?.[1] ?? null;
const mb = (bytes: number) => Math.round(bytes / 1e5) / 10;

interface Group { kind: string; source: string; onScreen: boolean; count: number; bytes: number; empty: number; largest: number; largestSize: string; file: string; fn: string; line: number; via: string | null; frames: string[] }
const runs = readdirSync(dir).filter(name => name.endsWith(".memory.json")).sort().map(name => JSON.parse(readFileSync(join(dir, name), "utf8")));
const summary = runs.map(run => {
  const heapFile = join(dir, `${run.scene}.heap.json`); const heap = existsSync(heapFile) ? JSON.parse(readFileSync(heapFile, "utf8")) : null;
  const points = run.points.map((point: any) => {
    const groups = point.pixels.groups as Group[];
    // By holder: the creating src/ file (and, for images React made, the asset folder).
    const holders = new Map<string, { holder: string; cache: string | null; kinds: Set<string>; count: number; bytes: number; largest: number; largestSize: string; fns: Map<string, number> }>();
    for (const group of groups) {
      const key = group.file.startsWith("src/") ? group.file : `${group.file} ${group.source}`.trim();
      const holder = holders.get(key) ?? { holder: key, cache: cacheOf(group.file, group.source), kinds: new Set(), count: 0, bytes: 0, largest: 0, largestSize: "", fns: new Map() };
      holder.kinds.add(group.onScreen ? "화면 캔버스" : group.kind); holder.count += group.count - group.empty; holder.bytes += group.bytes;
      if (group.largest > holder.largest) { holder.largest = group.largest; holder.largestSize = group.largestSize; }
      holder.fns.set(`${group.fn}${group.via ? ` ← ${group.via}` : ""}`, (holder.fns.get(`${group.fn}${group.via ? ` ← ${group.via}` : ""}`) ?? 0) + group.bytes);
      holders.set(key, holder);
    }
    const rows = [...holders.values()].sort((a, b) => b.bytes - a.bytes).map(holder => ({ holder: holder.holder, cache: holder.cache, kinds: [...holder.kinds], live: holder.count, MB: mb(holder.bytes),
      largest: holder.largestSize, by: [...holder.fns].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([fn, bytes]) => `${fn} ${mb(bytes)}`) }));
    const caches = new Map<string, number>(); for (const row of rows) caches.set(row.cache ?? "(그 밖)", (caches.get(row.cache ?? "(그 밖)") ?? 0) + row.MB);
    return { label: point.label, state: point.state, heapUsageMB: point.heapUsageMB, rssMB: point.rssMB, gc: point.gc, domCounters: point.domCounters, callsPerSecond: point.callsPerSecond ?? {},
      pixelsMB: point.pixels.liveMB, pixelOwnersCreated: point.pixels.created, holders: rows, caches: Object.fromEntries([...caches].map(([key, value]) => [key, Math.round(value * 10) / 10])) };
  });
  return { scene: run.scene, save: run.save, speed: run.speed, errors: run.errors, points, heap };
});
writeFileSync(flag("out") ?? join(dir, "memory-summary.json"), `${JSON.stringify(summary, null, 1)}\n`);

const lines: string[] = [];
for (const run of summary) {
  lines.push(`## ${run.scene}`, "");
  lines.push("| 시점 | 날짜 | 픽셀(살아 있는 캔버스·비트맵·그림) MB | JS 힙(강제 GC 뒤) MB | Blink 힙(강제 GC 뒤) MB | GC 예산: 전역 소비 / 한도 / old gen MB | Blink 쪽 할당 MB/s | major GC(30초) | 렌더러 RSS MB | GPU RSS MB |", "|---|---|---:|---:|---:|---|---:|---:|---:|---:|");
  for (const point of run.points) {
    const rss = Object.entries(point.rssMB as Record<string, number>);
    const renderer = rss.filter(([key]) => key.startsWith("renderer")).map(([, value]) => value).sort((a, b) => b - a)[0] ?? "-";
    const gpu = rss.filter(([key]) => key.startsWith("GPU")).map(([, value]) => value)[0] ?? "-";
    const budget = point.gc.medianMB as Record<string, number | null>;
    lines.push(`| ${point.label} | ${point.state.date ?? point.state.tick} | ${point.pixelsMB} | ${point.heapUsageMB.usedSize} | ${point.heapUsageMB.embedderHeapUsedSize ?? "-"} | ${budget.global_consumed_bytes ?? "-"} / ${budget.global_allocation_limit ?? "-"} / ${budget.old_gen_consumed_bytes ?? "-"} | ${point.gc.embedderAllocMBps ?? "-"} | ${point.gc.majorGC} | ${renderer} | ${gpu} |`);
  }
  lines.push("", "Blink 객체를 만드는 호출(초당, 30초 창):", "");
  for (const point of run.points) lines.push(`- ${point.label}: ${Object.entries(point.callsPerSecond as Record<string, { perSecond: number; MBps: number }>).slice(0, 8).map(([name, entry]) => `\`${name}\` ${entry.perSecond}/초${entry.MBps ? ` (${entry.MBps} MB/s)` : ""}`).join(" · ") || "-"}`);
  const last = run.points.at(-1)!;
  lines.push("", `### 픽셀 붙잡이 (${last.label})`, "", "| # | 붙잡이(만든 src 파일) | 캐시 | 종류 | 살아 있는 수 | MB | 가장 큰 것 | 만든 함수(← 부른 곳) MB |", "|---:|---|---|---|---:|---:|---|---|");
  last.holders.slice(0, 20).forEach((row: any, index: number) => lines.push(`| ${index + 1} | \`${row.holder}\` | ${row.cache ?? ""} | ${row.kinds.join(", ")} | ${row.live} | ${row.MB} | ${row.largest} | ${row.by.join("; ")} |`));
  lines.push("", "### 캐시별 픽셀 MB (시점마다)", "", `| 캐시 | ${run.points.map((point: any) => point.label).join(" | ")} |`, `|---|${run.points.map(() => "---:").join("|")}|`);
  const cacheNames: string[] = [...new Set<string>(run.points.flatMap((point: any) => Object.keys(point.caches)))];
  for (const name of cacheNames) lines.push(`| ${name} | ${run.points.map((point: any) => point.caches[name] ?? 0).join(" | ")} |`);
  if (run.heap !== null) {
    lines.push("", `### JS 힙 붙잡이 (힙 스냅숏, 자기 크기 합 ${run.heap.totalSelfMB} MB, 살아 있는 게임 상태 ${run.heap.stateCount}개)`, "",
      "가장 짧은 경로의 앞 이름별 자기 크기(모듈 변수 → 필드):", "", "| # | 경로 | MB | 객체 수 |", "|---:|---|---:|---:|");
    run.heap.byPath.slice(0, 15).forEach((row: any, index: number) => lines.push(`| ${index + 1} | \`${row.path.replace(/^__FEUDAL_PHASE10_PROOF__ → tileClientPoint → /, "")}\` | ${row.selfMB} | ${row.count} |`));
    lines.push("", "지금 게임 상태의 필드별 크기(먼저 닿은 필드에 셈):", "", "| 필드 | MB | 객체 수 |", "|---|---:|---:|");
    for (const row of run.heap.stateFields.filter((row: any) => row.MB >= 0.5)) lines.push(`| ${row.field} | ${row.MB} | ${row.objects} |`);
    lines.push("", "| # | 모듈 변수 | 종류 | 유지 MB |", "|---:|---|---|---:|");
    run.heap.holders.slice(0, 10).forEach((row: any, index: number) => lines.push(`| ${index + 1} | \`${row.names.join(", ")}\` | ${row.type} ${row.constructor} | ${row.retainedMB} |`));
    lines.push("", "| 노드 종류 | 이름 | 수 | 자기 MB |", "|---|---|---:|---:|");
    for (const row of run.heap.kinds.slice(0, 12)) lines.push(`| ${row.type} | ${row.name || "-"} | ${row.count} | ${row.selfMB} |`);
  }
  lines.push("");
}
writeFileSync(flag("tables") ?? join(dir, "memory-tables.md"), lines.join("\n"));
console.log(`memoryReport: ${summary.length} run(s)`);
