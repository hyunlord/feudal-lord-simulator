// SMOOTH-1 trace analysis: frame pacing and long-frame causes from one hitch-audit run.
// Input: the page's own rAF timestamps (performance.now ms, the frames the player sees) with the moment marks, and the
// Chrome trace (Playwright startTracing: devtools.timeline + the V8 CPU sampler) of the same run. The two clocks are
// joined by the `hitch:start` user-timing mark, which the page sets at its first recorded frame.
//  - frames: rAF intervals; p50 / p95 / p99 / max, frames over 25 / 33 / 50 ms per minute.
//  - long frames (> 33 ms): per frame, the main-thread events that ran inside it (rAF callback, idle callback, timer,
//    GC, image decode, style / layout / paint) and the CPU samples' functions (self and inclusive time).
//  - causes: every function's inclusive time summed over the long frames, with how many long frames it was in.
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";

export interface FrameRecord { readonly t: number; readonly tick?: number }
export interface MomentMark { readonly kind: string; readonly t: number; readonly detail?: string }

const MAIN_EVENTS: Readonly<Record<string, string>> = {
  FireAnimationFrame: "rAF callback", FireIdleCallback: "idle callback", TimerFire: "timer", EventDispatch: "input event",
  // Outer events only: MajorGC holds V8.GC_MARK_COMPACTOR, FunctionCall holds v8.callFunction (counting both doubles).
  FunctionCall: "script", EvaluateScript: "script (evaluate)",
  MinorGC: "GC (minor)", MajorGC: "GC (major)",
  "Decode Image": "image decode", ImageDecodeTask: "image decode", "Decode LazyPixelRef": "image decode",
  UpdateLayoutTree: "style", Layout: "layout", Paint: "paint", PrePaint: "paint", Commit: "commit", ParseHTML: "parse HTML",
  BlinkGC: "GC (blink)",
};

export const percentile = (sorted: readonly number[], p: number): number | null => sorted.length === 0 ? null : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? null;

export function frameStats(frames: readonly FrameRecord[]) {
  const intervals = frames.slice(1).map((frame, index) => frame.t - frames[index]!.t);
  const sorted = [...intervals].sort((a, b) => a - b);
  const minutes = frames.length < 2 ? 0 : (frames.at(-1)!.t - frames[0]!.t) / 60_000;
  const over = (ms: number) => intervals.filter(value => value > ms).length;
  const round = (value: number | null) => value === null ? null : Math.round(value * 10) / 10;
  return {
    frames: intervals.length, minutes: Math.round(minutes * 100) / 100,
    p50: round(percentile(sorted, 0.5)), p95: round(percentile(sorted, 0.95)), p99: round(percentile(sorted, 0.99)), max: round(sorted.at(-1) ?? null),
    over25: over(25), over33: over(33), over50: over(50),
    over25PerMin: minutes > 0 ? round(over(25) / minutes) : null, over33PerMin: minutes > 0 ? round(over(33) / minutes) : null,
    over50PerMin: minutes > 0 ? round(over(50) / minutes) : null,
  };
}

// A 3-minute trace is 0.5–1 GB of JSON (one event per line), past V8's string limit: it is read line by line and only
// what the analysis uses is kept — metadata, marks, CPU sample chunks, complete events of 0.1 ms or more (1 ms or more
// off the main thread is enough for "what ran elsewhere", but the main thread is not known until its mark is read).
async function readTrace(path: string): Promise<{ traceEvents: any[] }> {
  const { createInterface } = await import("node:readline");
  const stream = path.endsWith(".gz") ? createReadStream(path).pipe(createGunzip()) : createReadStream(path);
  const kept: any[] = [];
  for await (const raw of createInterface({ input: stream, crlfDelay: Infinity })) {
    const line = raw.endsWith(",") ? raw.slice(0, -1) : raw;
    if (!line.startsWith("{") || line.startsWith('{"traceEvents"')) continue;
    let event: any; try { event = JSON.parse(line); } catch { continue; }
    if (event.ph === "M" || event.name === "ProfileChunk" || event.name === "Profile" || event.name === "UpdateCounters" || event.name === "V8.GCIncrementalMarkingStart" || String(event.name).startsWith("hitch:")
      || (event.ph === "X" && typeof event.dur === "number" && event.dur >= 100)) kept.push(event);
  }
  return { traceEvents: kept };
}

interface Sample { readonly ts: number; readonly node: number }
interface ProfileNode { readonly id: number; readonly parent?: number; readonly name: string }

export async function analyseRun(input: { readonly frames: readonly FrameRecord[]; readonly marks: readonly MomentMark[];
  readonly startMarkPageMs: number; readonly tracePath: string | null; readonly longMs?: number }) {
  const longMs = input.longMs ?? 33;
  const stats = frameStats(input.frames);
  const longFrames = input.frames.slice(1).map((frame, index) => ({ from: input.frames[index]!.t, to: frame.t, ms: frame.t - input.frames[index]!.t, tick: frame.tick }))
    .filter(frame => frame.ms > longMs);
  const nearMoment = (t: number) => input.marks.filter(mark => Math.abs(mark.t - t) <= 750).map(mark => mark.kind);
  if (input.tracePath === null) return { stats, longFrames: longFrames.map(frame => ({ ...frame, moments: nearMoment(frame.to) })), causes: [] };

  const trace = await readTrace(input.tracePath);
  const events = trace.traceEvents;
  const start = events.find(event => event.name === "hitch:start" && (event.ph === "R" || event.ph === "I" || event.ph === "i" || event.ph === "b" || event.ph === "n"));
  if (start === undefined) throw new Error(`${input.tracePath}: no hitch:start mark`);
  const pid = start.pid; const tid = start.tid;
  const offsetUs = start.ts - input.startMarkPageMs * 1000;       // trace µs = page ms * 1000 + offset
  const main = events.filter(event => event.pid === pid && event.tid === tid && event.ph === "X" && typeof event.dur === "number");
  // Every thread's complete events, sorted by start, for what ran elsewhere (compositor, raster, GPU process).
  const threadNames = new Map<string, string>();
  const processNames = new Map<number, string>();
  for (const event of events) {
    if (event.ph !== "M") continue;
    if (event.name === "thread_name") threadNames.set(`${event.pid}:${event.tid}`, String(event.args?.name ?? event.tid));
    if (event.name === "process_name") processNames.set(event.pid, String(event.args?.name ?? event.pid));
  }
  const WRAPPERS = new Set(["RunTask", "ThreadControllerImpl::RunTask", "ThreadPool_RunTask", "SequenceManager RunTask", "TaskGraphRunner::RunTask",
    "RunNormalPriorityTask", "RealTimeDomain::DelayTillNextTask", "MessageLoop::RunTask", "Scheduler::ProcessTasks"]);
  const everything = events.filter(event => event.ph === "X" && typeof event.dur === "number" && event.dur > 0 && !WRAPPERS.has(event.name))
    .sort((a, b) => a.ts - b.ts);
  const topLevelMain = main.filter(event => WRAPPERS.has(event.name));
  const firstFrom = (fromUs: number) => { let lo = 0, hi = everything.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (everything[mid].ts < fromUs) lo = mid + 1; else hi = mid; } return lo; };

  // CPU samples: Profile / ProfileChunk events of this renderer (the main thread's isolate).
  const nodes = new Map<number, ProfileNode>(); const samples: Sample[] = [];
  let sampleTs = 0;
  for (const event of events) {
    if (event.pid !== pid) continue;
    if (event.name === "Profile") sampleTs = event.args?.data?.startTime ?? sampleTs;
    if (event.name !== "ProfileChunk") continue;
    const data = event.args?.data; const profile = data?.cpuProfile;
    for (const node of profile?.nodes ?? []) {
      const frame = node.callFrame ?? {};
      const url = String(frame.url ?? "").split("/").pop() ?? "";
      const name = `${frame.functionName || "(anonymous)"}${url ? ` ${url}:${(frame.lineNumber ?? -1) + 1}` : ""}`;
      nodes.set(node.id, { id: node.id, parent: node.parent, name });
    }
    const ids: number[] = profile?.samples ?? []; const deltas: number[] = data?.timeDeltas ?? [];
    for (let i = 0; i < ids.length; i++) { sampleTs += deltas[i] ?? 0; samples.push({ ts: sampleTs, node: ids[i]! }); }
  }
  samples.sort((a, b) => a.ts - b.ts);
  const IDLE = new Set(["(idle)", "(program)", "(root)", "(garbage collector)"]);
  const stackOf = (id: number) => { const names: string[] = []; let node = nodes.get(id); let guard = 0;
    while (node !== undefined && guard++ < 400) { names.push(node.name); node = node.parent === undefined ? undefined : nodes.get(node.parent); }
    return names; };

  // GC over the whole run (not only in long frames) and the JS heap the page kept: how often, how long, how big.
  const minutes = stats.minutes || 1;
  const gcOf = (name: string) => { const durations = main.filter(event => event.name === name && event.ts >= offsetUs).map(event => event.dur / 1000).sort((a, b) => a - b);
    const total = durations.reduce((sum, value) => sum + value, 0);
    return { count: durations.length, perMin: Math.round((durations.length / minutes) * 10) / 10, meanMs: durations.length ? Math.round((total / durations.length) * 10) / 10 : null,
      p95Ms: durations.length ? Math.round((percentile(durations, 0.95) ?? 0) * 10) / 10 : null, maxMs: durations.length ? Math.round(durations.at(-1)! * 10) / 10 : null }; };
  const heap = events.filter(event => event.name === "UpdateCounters" && event.pid === pid && typeof event.args?.data?.jsHeapSizeUsed === "number")
    .map(event => event.args.data.jsHeapSizeUsed / 1e6);
  // Why V8 starts marking: the reason and, at that moment, its global budget (JS heap + embedder memory such as canvas
  // backing stores and decoded images) against the old generation alone. A global use near its limit with a small old
  // generation means embedder memory drives the major GCs.
  const starts = events.filter(event => event.name === "V8.GCIncrementalMarkingStart" && event.pid === pid && event.ts >= offsetUs)
    .map(event => event.args?.value ?? event.args?.data ?? {});
  const median = (values: number[]) => { const sorted = values.filter(Number.isFinite).sort((a, b) => a - b); return sorted.length ? Math.round(sorted[Math.floor(sorted.length / 2)]! / 1e6) : null; };
  const reasons: Record<string, number> = {};
  for (const start of starts) reasons[String(start.gc_reason ?? "?")] = (reasons[String(start.gc_reason ?? "?")] ?? 0) + 1;
  const gc = { major: gcOf("MajorGC"), minor: gcOf("MinorGC"),
    // reduce, not Math.min(...heap): a run has one counter event per frame, past the spread's argument limit.
    heapMB: heap.length ? { min: Math.round(heap.reduce((a, b) => Math.min(a, b))), max: Math.round(heap.reduce((a, b) => Math.max(a, b))) } : null,
    marking: { starts: starts.length, reasons, globalConsumedMB: median(starts.map(start => start.global_consumed_bytes)),
      globalLimitMB: median(starts.map(start => start.global_allocation_limit)), oldGenMB: median(starts.map(start => start.old_gen_consumed_bytes)),
      externalMB: median(starts.map(start => (start.global_consumed_bytes ?? NaN) - (start.old_gen_consumed_bytes ?? NaN))) } };
  const causes = new Map<string, { ms: number; frames: number; maxMs: number }>();
  const detailed = longFrames.map(frame => {
    const fromUs = frame.from * 1000 + offsetUs; const toUs = frame.to * 1000 + offsetUs;
    const kinds = new Map<string, number>();
    for (const event of main) {
      const kind = MAIN_EVENTS[event.name]; if (kind === undefined) continue;
      const overlap = Math.min(toUs, event.ts + event.dur) - Math.max(fromUs, event.ts);
      if (overlap > 0) kinds.set(kind, (kinds.get(kind) ?? 0) + overlap / 1000);
    }
    // Main-thread busy time (top-level tasks) and, on every thread, the longest named events inside the frame.
    let busyUs = 0;
    for (const event of topLevelMain) { const overlap = Math.min(toUs, event.ts + event.dur) - Math.max(fromUs, event.ts); if (overlap > 0) busyUs += overlap; }
    const elsewhere = new Map<string, number>();
    for (let i = firstFrom(fromUs - 500_000); i < everything.length && everything[i].ts < toUs; i++) {
      const event = everything[i]; const overlap = Math.min(toUs, event.ts + event.dur) - Math.max(fromUs, event.ts);
      if (overlap <= 0) continue;
      const thread = event.pid === pid && event.tid === tid ? "main" : `${processNames.get(event.pid) ?? event.pid}/${threadNames.get(`${event.pid}:${event.tid}`) ?? event.tid}`;
      const key = `${thread}: ${event.name}`; elsewhere.set(key, Math.max(elsewhere.get(key) ?? 0, overlap / 1000));
    }
    const self = new Map<string, number>(); const inclusive = new Map<string, number>();
    const inWindow = samples.filter(sample => sample.ts >= fromUs && sample.ts < toUs);
    for (let i = 0; i < inWindow.length; i++) {
      const sample = inWindow[i]!; const next = inWindow[i + 1]?.ts ?? Math.min(toUs, sample.ts + 1000);
      const ms = Math.max(0, next - sample.ts) / 1000; const stack = stackOf(sample.node);
      const leaf = stack[0] ?? "(unknown)"; if (IDLE.has(leaf.split(" ")[0]!)) continue;
      self.set(leaf, (self.get(leaf) ?? 0) + ms);
      for (const name of new Set(stack)) if (!IDLE.has(name.split(" ")[0]!)) inclusive.set(name, (inclusive.get(name) ?? 0) + ms);
    }
    for (const [name, ms] of inclusive) { const cause = causes.get(name) ?? { ms: 0, frames: 0, maxMs: 0 };
      causes.set(name, { ms: cause.ms + ms, frames: cause.frames + 1, maxMs: Math.max(cause.maxMs, ms) }); }
    for (const [kind, ms] of kinds) { const name = `[${kind}]`; const cause = causes.get(name) ?? { ms: 0, frames: 0, maxMs: 0 };
      causes.set(name, { ms: cause.ms + ms, frames: cause.frames + 1, maxMs: Math.max(cause.maxMs, ms) }); }
    const top = (map: Map<string, number>, n: number) => [...map].sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, ms]) => ({ name, ms: Math.round(ms * 10) / 10 }));
    return { ...frame, ms: Math.round(frame.ms * 10) / 10, moments: nearMoment(frame.to), mainBusyMs: Math.round(busyUs / 100) / 10,
      main: top(kinds, 6), threads: top(elsewhere, 10), self: top(self, 8), inclusive: top(inclusive, 12) };
  });
  return { stats, gc, longFrames: detailed,
    causes: [...causes].map(([name, cause]) => ({ name, ms: Math.round(cause.ms * 10) / 10, frames: cause.frames, maxMs: Math.round(cause.maxMs * 10) / 10 }))
      .sort((a, b) => b.ms - a.ms).slice(0, 80) };
}
