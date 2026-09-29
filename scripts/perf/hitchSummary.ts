// SMOOTH-1 summary: folds the hitch-audit run summaries of both machines into one JSON and the report's tables.
//   tsx scripts/perf/hitchSummary.ts <summary dir> [<summary dir> ...] --out docs/verification/smooth1/summary.json
//     [--tables docs/verification/smooth1/tables.md]
// Per run: frame pacing (p50 / p95 / p99 / max, frames over 25 / 33 / 50 ms and per minute), the rAF median as the
// validity check (a DGX run whose median is not 16.7 ms measured the machine, not the game), the long frames by moment
// (season change, autosave, chapter change, dialog, none) and the long-frame causes. Across runs: every function's and
// every main-thread event kind's time inside long frames (> 33 ms), with the long frames it was in and its worst frame.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const flag = (name: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : undefined; };
const dirs = argv.filter((arg, i) => !arg.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const out = flag("out")!; const tablesPath = flag("tables");

type Run = Record<string, any>;
const runs: Run[] = dirs.flatMap(dir => readdirSync(dir).filter(file => file.endsWith(".json") && !file.startsWith("summary"))
  .map(file => JSON.parse(readFileSync(join(dir, file), "utf8")) as Run).filter(run => run.stats !== undefined));

// Names every long frame shares (the frame loop itself) say nothing about the cause; they are kept in the per-run
// detail but left out of the cross-run ranking.
const WRAPPER = /^(runFrame|frame|requestAnimationFrame|\(anonymous\)|setInterval|evaluate|v8\.callFunction|[a-z]\b)/;
// One main cause per long frame. Off the main thread when it was busy for under half the frame; GC when GC filled half
// its busy time; otherwise the category whose functions took the most of the frame (inclusive CPU time).
const CATEGORIES: readonly (readonly [string, RegExp])[] = [
  ["시뮬레이션 틱", /^(advanceTick|advanceTicks|tickEconomy|runEconomyTick|advance[A-Z]\w*|settle\w*|season\w*Ledger|autoplay\w*)$/],
  ["React 재렌더", /^(performWorkOnRoot|performSyncWorkOnRoot|renderRootSync|commitRoot\w*|flushSyncWorkAcrossRoots_impl|beginWork|completeWork|flushPassiveEffects\w*)$/],
  ["저장 직렬화", /^(encodeSave|stringify|toSnapshot|stateChecksum|saveAutosave|autosave\w*)$/],
  ["지면 그리기", /^(ground|drawTerrain|drawTerrainBoundaryV2|drawGroundBoundaries|drawArableFields|groundChunk\w*|rebuild\w*Chunk\w*|rasteri[sz]e\w*)$/],
  ["주민·수레 그리기", /^(residentWalkers|withResidentWalkers|drawWalkers|walker\w*|drawCarts\w*)$/],
  ["건물·물체 그리기", /^(objects|drawObjectRenderItems|drawBuildings|drawWallFaces|buildObjectRenderItems)$/],
  ["입력·카메라", /^(canvasToWorld|computeVisibleTileRange|roadPull|nearestPointOnPolyline|handle\w*Pointer\w*|onPointer\w*|onWheel\w*)$/],
];
const plain = (name: string) => String(name).replace(/ index-[\w-]+\.js:\d+$/, "");
export function primaryCause(frame: any): string {
  // No event at all in the frame: the trace buffer had filled (Chrome stops recording), so the cause is unknown.
  if (!(frame.main ?? []).length && !(frame.threads ?? []).length) return "원인 미기록(추적 버퍼 끝)";
  const busy = frame.mainBusyMs ?? frame.ms;
  if (busy < frame.ms * 0.5) return "메인 스레드 밖(합성·GPU·OS)";
  const gc = (frame.main ?? []).filter((item: any) => String(item.name).startsWith("GC")).reduce((sum: number, item: any) => sum + item.ms, 0);
  if (gc >= busy * 0.5) return (frame.main ?? []).some((item: any) => item.name === "GC (major)") ? "GC(major)" : "GC(minor)";
  if ((frame.main ?? []).some((item: any) => item.name === "image decode" && item.ms >= busy * 0.3)) return "그림 디코드";
  let best: [string, number] = ["기타", 0];
  for (const [category, pattern] of CATEGORIES) {
    const ms = Math.max(0, ...(frame.inclusive ?? []).filter((item: any) => pattern.test(plain(item.name))).map((item: any) => item.ms));
    if (ms > best[1]) best = [category, ms];
  }
  return best[0];
}
const categories = new Map<string, { frames: number; over100: number; ms: number; maxMs: number; scenes: Set<string>; machines: Set<string> }>();
const momentHits = new Map<string, { seen: number; hit: number; worstMs: number }>();
const causes = new Map<string, { ms: number; frames: number; runs: Set<string>; maxMs: number }>();
const rows = runs.map(run => {
  const byMoment: Record<string, { frames: number; maxMs: number }> = {};
  for (const mark of run.moments ?? []) {
    const after = run.longFrames.filter((frame: any) => frame.to >= mark.t - 250 && frame.to <= mark.t + 1000);
    const key = `${run.machine}|${mark.kind}`;
    const entry = momentHits.get(key) ?? { seen: 0, hit: 0, worstMs: 0 };
    momentHits.set(key, { seen: entry.seen + 1, hit: entry.hit + (after.length > 0 ? 1 : 0), worstMs: Math.max(entry.worstMs, ...after.map((frame: any) => frame.ms)) });
  }
  for (const frame of run.longFrames) {
    // A --no-trace control has frames but no trace: it counts for pacing, not for causes.
    if (run.control === "no-trace") { frame.cause = "대조(추적 없음)"; continue; }
    const category = primaryCause(frame); frame.cause = category;
    const entry = categories.get(`${run.machine}|${category}`) ?? { frames: 0, over100: 0, ms: 0, maxMs: 0, scenes: new Set<string>(), machines: new Set<string>() };
    entry.frames += 1; if (frame.ms > 100) entry.over100 += 1; entry.ms += frame.ms; entry.maxMs = Math.max(entry.maxMs, frame.ms); entry.scenes.add(`${run.scene}×${run.speed}`); entry.machines.add(run.machine);
    categories.set(`${run.machine}|${category}`, entry);
    const kinds = frame.moments.length === 0 ? ["none"] : [...new Set<string>(frame.moments)];
    for (const kind of kinds) { const entry = byMoment[kind] ?? { frames: 0, maxMs: 0 }; byMoment[kind] = { frames: entry.frames + 1, maxMs: Math.max(entry.maxMs, frame.ms) }; }
    const seen = new Set<string>();
    for (const item of [...(frame.inclusive ?? []), ...(frame.main ?? []).map((main: any) => ({ name: `[${main.name}]`, ms: main.ms })),
      ...(frame.threads ?? []).filter((thread: any) => !thread.name.startsWith("main:")).map((thread: any) => ({ name: `{${thread.name}}`, ms: thread.ms }))]) {
      const name = String(item.name).replace(/ index-[\w-]+\.js:\d+$/, ""); if (WRAPPER.test(name) || seen.has(name)) continue; seen.add(name);
      const cause = causes.get(name) ?? { ms: 0, frames: 0, runs: new Set<string>(), maxMs: 0 };
      cause.ms += item.ms; cause.frames += 1; cause.runs.add(run.run); cause.maxMs = Math.max(cause.maxMs, item.ms); causes.set(name, cause);
    }
  }
  const moments: Record<string, number> = {};
  for (const mark of run.moments ?? []) moments[mark.kind] = (moments[mark.kind] ?? 0) + 1;
  return { run: run.run, machine: run.machine, scene: run.scene, speed: run.speed, action: run.action, seconds: run.seconds,
    population: run.page?.population ?? null, buildings: run.page?.buildings ?? null, dpr: run.page?.dpr ?? null,
    // A run is valid when its rAF median is one 60 Hz (or faster) frame: over 16.8 ms the machine, not the game, set
    // the pace (docs: memory "DGX perf validity").
    ...run.stats, valid: (run.stats.p50 ?? 99) <= 16.8, gc: run.gc ?? null, control: run.control ?? null, momentsSeen: moments, longFramesByMoment: byMoment, errors: (run.errors ?? []).length,
    causes: Object.fromEntries([...run.longFrames.reduce((map: Map<string, number>, frame: any) => map.set(frame.cause, (map.get(frame.cause) ?? 0) + 1), new Map<string, number>())]),
    worst: [...run.longFrames].sort((a: any, b: any) => b.ms - a.ms).slice(0, 3).map((frame: any) => ({ ms: frame.ms, mainBusyMs: frame.mainBusyMs ?? null,
      moments: frame.moments, top: (frame.inclusive ?? []).map((item: any) => String(item.name).replace(/ index-[\w-]+\.js:\d+$/, "")).filter((name: string) => !WRAPPER.test(name)).slice(0, 4),
      threads: (frame.threads ?? []).slice(0, 3) })) };
}).sort((a, b) => `${a.machine}${a.scene}${a.speed}`.localeCompare(`${b.machine}${b.scene}${b.speed}`));
const ranked = [...causes].map(([name, cause]) => ({ name, ms: Math.round(cause.ms), frames: cause.frames, runs: cause.runs.size, maxMs: Math.round(cause.maxMs * 10) / 10 }))
  .sort((a, b) => b.ms - a.ms).slice(0, 60);
// The baseline for the moments: the share of all 1.25 s windows of a machine's runs that hold a long frame.
const windows = new Map<string, { windows: number; withLong: number }>();
for (const run of runs) {
  const span = (run.stats.minutes ?? 0) * 60_000; const count = Math.floor(span / 1250); if (count === 0) continue;
  const buckets = new Set(run.longFrames.map((frame: any) => Math.floor(frame.to / 1250)));
  const entry = windows.get(run.machine) ?? { windows: 0, withLong: 0 };
  windows.set(run.machine, { windows: entry.windows + count, withLong: entry.withLong + Math.min(count, buckets.size) });
}
const categoryRows = [...categories].map(([key, entry]) => ({ machine: key.split("|")[0]!, category: key.split("|")[1]!, frames: entry.frames, over100: entry.over100, ms: Math.round(entry.ms), maxMs: Math.round(entry.maxMs),
  scenes: [...entry.scenes].sort() })).sort((a, b) => a.machine.localeCompare(b.machine) || b.frames - a.frames);
const momentRows = [...momentHits].map(([key, entry]) => ({ machine: key.split("|")[0]!, kind: key.split("|")[1]!, seen: entry.seen,
  baselineShare: windows.has(key.split("|")[0]!) ? Math.round((windows.get(key.split("|")[0]!)!.withLong / windows.get(key.split("|")[0]!)!.windows) * 100) : null, followedByLongFrame: entry.hit, share: entry.seen ? Math.round((entry.hit / entry.seen) * 100) : null, worstMs: Math.round(entry.worstMs) }));
writeFileSync(out, `${JSON.stringify({ generatedFrom: dirs.length, runs: rows, categories: categoryRows, moments: momentRows, causes: ranked }, null, 1)}\n`);

if (tablesPath !== undefined) {
  const fmt = (value: unknown) => value === null || value === undefined ? "—" : String(value);
  const lines = ["| 기계 | 장면 | 조작 | 배속 | 유효 | 끝 인구 | 프레임 | p50 | p95 | p99 | 최대 | >25 | >33 | >50 | >33/분 | 긴 프레임 순간 |", "|---|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|"];
  for (const row of rows) lines.push(`| ${row.machine} | ${row.scene}${row.control === "no-trace" ? " (추적 없음)" : ""} | ${row.action} | ${row.speed}× | ${row.valid ? "○" : "× rAF p50"} | ${fmt(row.population)} | ${row.frames} | ${fmt(row.p50)} | ${fmt(row.p95)} | ${fmt(row.p99)} | ${fmt(row.max)} | ${row.over25} | ${row.over33} | ${row.over50} | ${fmt(row.over33PerMin)} | ${Object.entries(row.longFramesByMoment).map(([kind, entry]: [string, any]) => `${kind} ${entry.frames}(${Math.round(entry.maxMs)})`).join(" · ") || "—"} |`);
  lines.push("", "| 기계 | 주원인(긴 프레임마다 하나) | 긴 프레임 수 | 그중 100 ms 넘음 | 합계 ms | 최대 ms |", "|---|---|---:|---:|---:|---:|");
  for (const row of categoryRows) lines.push(`| ${row.machine} | ${row.category} | ${row.frames} | ${row.over100} | ${row.ms} | ${row.maxMs} |`);
  lines.push("", "| 기계 | 순간 | 본 횟수 | 1초 안에 긴 프레임 | 비율 | 아무 1.25초 구간 비율(기준) | 최악 ms |", "|---|---|---:|---:|---:|---:|---:|");
  for (const row of momentRows) lines.push(`| ${row.machine} | ${row.kind} | ${row.seen} | ${row.followedByLongFrame} | ${row.share}% | ${row.baselineShare}% | ${row.worstMs} |`);
  lines.push("", "| 원인(함수·이벤트) | 긴 프레임 안 합계 ms | 긴 프레임 수 | 실행 수 | 한 프레임 최대 ms |", "|---|---:|---:|---:|---:|");
  for (const cause of ranked.slice(0, 40)) lines.push(`| \`${cause.name.replace(/\|/g, "\\|")}\` | ${cause.ms} | ${cause.frames} | ${cause.runs} | ${cause.maxMs} |`);
  writeFileSync(tablesPath, `${lines.join("\n")}\n`);
}
console.log(`runs ${rows.length}, causes ${ranked.length}`);
