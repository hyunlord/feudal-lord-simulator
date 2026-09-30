// SMOOTH-1 hitch audit: does a frame ever stutter? One run = one scene at one speed for N seconds in Chrome, with the
// page's own rAF timestamps (what the player sees), the moments it passed (season change, autosave, chapter change,
// = weather change, a modal opening) and a Chrome trace (devtools.timeline + the V8 CPU sampler) for the causes.
// Scenes load the way a player loads them: a save file written into the game's IndexedDB slot, then 이어하기, on a
// production build (vite build --minify false: production React, readable function names). No game code is changed;
// the page is only observed (a rAF recorder, an IndexedDB put wrapper, a MutationObserver for dialogs).
//   PLAYWRIGHT_MODULE=... tsx scripts/perf/hitchAudit.ts --url <build url> --scene <name> [--save <file.save.json>]
//     --speed 1|3|5 [--seconds 180] [--action none|camera|placement|drawers] [--headed] [--machine <label>]
//     --out <summary dir> --traces <trace dir outside the repository>
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { createGzip } from "node:zlib";
import { createReadStream, createWriteStream, rmSync } from "node:fs";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import { analyseRun, type FrameRecord, type MomentMark } from "./hitchTrace";
import { MODAL, SEASON_TEXT, TUTORIAL_OFF, closeModals as closeSceneModals, hidIdleSeconds, loadChromium, openScene, windowReady, zoomWithKeys, type PageWindow } from "./scenePage";

const argv = process.argv.slice(2);
const flag = (name: string, fallback?: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const url = flag("url")!; const scene = flag("scene")!; const save = flag("save"); const speed = Number(flag("speed", "1"));
const seconds = Number(flag("seconds", "180")); const action = flag("action", "none")!; const headed = argv.includes("--headed");
const machine = flag("machine", headed ? "mac-chrome-window" : "dgx-headless")!; const out = flag("out")!; const traces = flag("traces")!;
const noProof = argv.includes("--no-proof");   // the page as a player gets it: no proof port and its render recorders
const zoomOut = Number(flag("zoom-out", "0")); const zoomIn = Number(flag("zoom-in", "0"));   // wheel steps before recording
const noTrace = argv.includes("--no-trace");   // control: the same run without tracing (does tracing cause the hitches?)
const width = Number(flag("width", "1600")); const height = Number(flag("height", "1000"));
if (!url || !scene || !out || !traces || ![1, 3, 5].includes(speed)) throw new Error("--url --scene --speed 1|3|5 --out --traces are required");
mkdirSync(out, { recursive: true }); mkdirSync(traces, { recursive: true });
const runName = `${machine}-${scene}-x${speed}${action === "none" ? "" : `-${action}`}${noTrace ? "-notrace" : ""}${noProof ? "-noproof" : ""}`;

// In the page, before the app: autosave writes and dialogs become marks; nothing in the game is replaced.
// tsx (esbuild keepNames) wraps functions handed to page.evaluate in __name(); the page gets a pass-through.
const OBSERVE = `(() => {
  globalThis.__name = globalThis.__name || ((fn) => fn);
  window.__hitch = { marks: [], frames: [], recording: false };
  // Pixel owners made while recording (a cache rebuilding makes them again): counts only, no stacks — cheap.
  const made = window.__made = { canvas: 0, offscreen: 0, bitmap: 0, getImageData: 0 };
  const count = (kind) => { if (window.__hitch.recording) made[kind] += 1; };
  const createElement = Document.prototype.createElement;
  Document.prototype.createElement = function (name, options) { const element = createElement.call(this, name, options); if (String(name).toLowerCase() === 'canvas') count('canvas'); return element; };
  if (globalThis.OffscreenCanvas) { const Offscreen = globalThis.OffscreenCanvas; const Wrapped = function OffscreenCanvas(w, h) { count('offscreen'); return new Offscreen(w, h); }; Wrapped.prototype = Offscreen.prototype; globalThis.OffscreenCanvas = Wrapped;
    const transfer = Offscreen.prototype.transferToImageBitmap; Offscreen.prototype.transferToImageBitmap = function () { count('bitmap'); return transfer.call(this); }; }
  const createBitmap = globalThis.createImageBitmap; globalThis.createImageBitmap = function (...args) { count('bitmap'); return createBitmap.apply(this, args); };
  for (const proto of [CanvasRenderingContext2D.prototype, globalThis.OffscreenCanvasRenderingContext2D && OffscreenCanvasRenderingContext2D.prototype].filter(Boolean)) {
    const read = proto.getImageData; proto.getImageData = function (...args) { count('getImageData'); return read.apply(this, args); }; }
  const mark = (kind, detail) => { if (!window.__hitch.recording) return; const t = performance.now(); window.__hitch.marks.push({ kind, t, detail }); performance.mark('hitch:' + kind); };
  window.__hitchMark = mark;
  // SMOOTH-2R: Chrome's Long Animation Frame entries (cheap, no tracing) say what a long frame spent its time on in
  // untraced runs too: scripts (with their function and file), style and layout, and what was left (outside the page).
  window.__hitch.loaf = [];
  try { new PerformanceObserver(list => { if (!window.__hitch.recording) return; for (const entry of list.getEntries()) if (entry.duration > 50) window.__hitch.loaf.push({
    start: entry.startTime, duration: entry.duration, blocking: entry.blockingDuration, renderStart: entry.renderStart, styleAndLayoutStart: entry.styleAndLayoutStart,
    scripts: (entry.scripts || []).map(script => ({ invoker: script.invoker, fn: script.sourceFunctionName, url: (script.sourceURL || '').split('/').pop(), charPosition: script.sourceCharPosition,
      duration: Math.round(script.duration), forcedStyleAndLayout: Math.round(script.forcedStyleAndLayoutDuration || 0) })) }); }).observe({ type: 'long-animation-frame', buffered: false }); } catch (error) { void error; }
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args) { if (this.name === 'slots') mark('autosave', String(args[1] ?? '')); return put.apply(this, args); };
  const observer = new MutationObserver(records => { for (const record of records) for (const node of record.addedNodes) {
    if (node.nodeType === 1 && (node.matches?.('[role="dialog"],[aria-modal="true"]') || node.querySelector?.('[role="dialog"],[aria-modal="true"]'))) mark('dialog', node.getAttribute?.('aria-label') ?? String(node.className ?? ''));
  } });
  document.addEventListener('DOMContentLoaded', () => observer.observe(document.documentElement, { childList: true, subtree: true }));
  // A covered window stops drawing; a run that loses its window is no judgement (perf:gate reads these marks).
  document.addEventListener('visibilitychange', () => mark(document.visibilityState === 'hidden' ? 'hidden' : 'visible'));
  window.addEventListener('blur', () => mark('blur')); window.addEventListener('focus', () => mark('focus'));
  // Chrome under Playwright keeps drawing a hidden or minimised window, but a sleeping display, a locked screen or
  // another Space stop rAF while timers still run. A 250 ms timer that twice in a row finds no rAF for 500 ms marks
  // "not-drawn" (a long task cannot fake it: after one, rAF comes within a frame, before the second check).
  window.__lastRaf = performance.now();
  const beat = () => { window.__lastRaf = performance.now(); requestAnimationFrame(beat); }; requestAnimationFrame(beat);
  let previous = { stale: false, raf: 0 }; let open = false;
  setInterval(() => { const raf = window.__lastRaf; const stale = performance.now() - raf > 500;
    if (stale && previous.stale && previous.raf === raf) { if (!open) { mark('not-drawn', String(Math.round(performance.now() - raf))); open = true; } }
    else if (!stale) open = false;
    previous = { stale, raf }; }, 250);
})();`;

async function main() {
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: "chrome", headless: !headed,
    args: headed ? [`--window-size=${width},${height + 90}`, "--window-position=40,40"] : [] });
  const context = await browser.newContext(headed ? { viewport: null } : { viewport: { width, height }, deviceScaleFactor: 1 });
  await context.addInitScript(TUTORIAL_OFF); await context.addInitScript(OBSERVE);
  const page = await context.newPage();
  // Noise-resistant metrics beside the frames (perf:ab, the per-commit trend): Chrome's own script / task / layout time
  // and the JS heap sampled every 250 ms from outside the page (allocation = the rises, a GC = a fall of 1 MB or more).
  const cdp = await context.newCDPSession(page); await cdp.send("Performance.enable");
  const cdpMetrics = async () => Object.fromEntries(((await cdp.send("Performance.getMetrics")).metrics as { name: string; value: number }[]).map(metric => [metric.name, metric.value]));
  const heap = { samples: 0, rises: 0, falls: 0, gcs: 0, last: null as number | null, sampler: null as ReturnType<typeof setInterval> | null };
  const errors: string[] = []; page.on("pageerror", (error: Error) => errors.push(error.message));
  const load0 = Date.now();
  await openScene(page, { url, speed, proof: !noProof, ...(save === undefined ? {} : { save }) });
  const closeModals = () => closeSceneModals(page);
  const loadSeconds = (Date.now() - load0) / 1000;
  await page.waitForTimeout(1_000);
  let windowAtStart: string | null = null;
  if (headed) {
    windowAtStart = await windowReady(browser, page, 0);   // brought to front; its state is recorded, never waited for
  }
  const zoomOf = () => page.evaluate(() => (window as unknown as PageWindow).__FEUDAL_PHASE10_PROOF__?.diagnosis().camera.zoom ?? null);
  const zoomBefore: number | null = await zoomOf();
  if (zoomOut > 0 || zoomIn > 0) await zoomWithKeys(page, { out: zoomOut, in: zoomIn });
  const zoomRecorded: number | null = await zoomOf();   // read only with the proof port; the gate knows it from the steps

  const rawTrace = join(traces, `${runName}.json`);
  if (!noTrace) await browser.startTracing(page, { path: rawTrace, screenshots: false,
    categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-v8.cpu_profiler", "blink.user_timing", "v8.execute", "v8"] });
  await page.waitForTimeout(2_000);   // tracing's own start-up stall stays out of the recorded frames
  // The recorder: every rAF's timestamp, and every 250 ms the proof port's tick, chapter, season and weather.
  const metricsStart = await cdpMetrics();
  const tickStart: number | null = await page.evaluate(() => (window as unknown as PageWindow).__FEUDAL_PHASE10_PROOF__?.state().tick ?? null);
  heap.sampler = setInterval(() => { cdp.send("Runtime.getHeapUsage").then((usage: { usedSize: number }) => {
    if (heap.last !== null) { const change = usage.usedSize - heap.last; if (change > 0) heap.rises += change; else if (change < -1e6) { heap.falls -= change; heap.gcs += 1; } }
    heap.last = usage.usedSize; heap.samples += 1; }, () => {}); }, 250);
  const startMarkPageMs: number = await page.evaluate((seasonText: string) => {
    const hitch = (window as unknown as PageWindow).__hitch; hitch.recording = true;
    const proof = (window as unknown as PageWindow).__FEUDAL_PHASE10_PROOF__;
    const seasonWord = () => /봄|여름|가을|겨울/.exec(document.querySelector(seasonText)?.textContent ?? "")?.[0] ?? null;
    let lastWord = seasonWord();
    const t0 = performance.now(); performance.mark("hitch:start");
    const frame = (t: number) => { if (!hitch.recording) return; hitch.frames.push({ t }); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    let last: { tick: number; chapter: number; season: number } | null = null;
    hitch.poll = setInterval(() => {
      if (proof === undefined) {   // no proof port: the HUD's season word
        const word = seasonWord(); if (word !== null && lastWord !== null && word !== lastWord) (window as unknown as PageWindow).__hitchMark("season", `${lastWord}->${word}`);
        if (word !== null) lastWord = word; return;
      }
      const state = proof.state(); const tick = state.tick;
      // The weather belongs to its season (events.types EV-3), so a weather change is a season change.
      const now = { tick, chapter: state.politics?.chapter?.number ?? 1, season: Math.floor(((tick % 4000) * 4) / 4000) };
      if (last !== null) {
        if (now.season !== last.season) (window as unknown as PageWindow).__hitchMark("season", `${last.season}->${now.season} @${tick}`);
        if (now.chapter !== last.chapter) (window as unknown as PageWindow).__hitchMark("chapter", `${last.chapter}->${now.chapter} @${tick}`);
      }
      hitch.frames.at(-1) && (hitch.frames.at(-1).tick = tick);
      last = now;
    }, 250);
    return t0;
  }, SEASON_TEXT);

  const deadline = Date.now() + seconds * 1000;
  const box = await page.locator("canvas").first().boundingBox();
  const cx = (box?.x ?? 0) + (box?.width ?? width) / 2; const cy = (box?.y ?? 0) + (box?.height ?? height) / 2;
  const actionLog: string[] = [];
  const buttons = async (pattern: RegExp) => { const found = [];
    for (const button of await page.getByRole("button").all()) {
      const name = (await button.getAttribute("aria-label")) ?? (await button.innerText().catch(() => ""));
      if (pattern.test(name) && await button.isVisible().catch(() => false)) found.push({ button, name: name.trim().slice(0, 30) });
    } return found; };
  while (Date.now() < deadline) {
    if (action === "camera") {
      await page.mouse.move(cx - 200, cy); await page.mouse.down();
      for (let i = 0; i <= 40 && Date.now() < deadline; i++) await page.mouse.move(cx - 200 + i * 10, cy + Math.sin(i / 6) * 80, { steps: 2 });
      await page.mouse.up();
      for (let i = 0; i < 6 && Date.now() < deadline; i++) { await page.mouse.wheel(0, i < 3 ? -240 : 240); await page.waitForTimeout(120); }
    } else if (action === "placement") {
      // A tool from its layer (건설 → 길 / 오두막, 구역 → a zone), a drag across the map with its preview, then cancel.
      for (const [layer, tool] of [[/^건설$/, /^길$/], [/^건설$/, /오두막|^집/], [/^구역$/, /필지|경작지|목초지|과수원/]] as const) {
        const layers = await buttons(layer); if (layers.length > 0) await layers[0]!.button.click().catch(() => {});
        await page.waitForTimeout(200);
        const found = await buttons(tool); if (found.length === 0) continue;
        await found[0]!.button.click().catch(() => {}); actionLog.push(found[0]!.name);
        await page.mouse.move(cx - 220, cy - 40); await page.mouse.down();
        for (let i = 0; i <= 44 && Date.now() < deadline; i++) await page.mouse.move(cx - 220 + i * 10, cy - 40 + (i % 12) * 6, { steps: 2 });
        await page.keyboard.press("Escape"); await page.mouse.up(); await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
      }
    } else if (action === "drawers") {
      for (const pattern of [/연대기|목표 기록/, /인구 기록|가계|가문/, /^장부$|자원 장부/, /계절 띠/]) {
        const found = await buttons(pattern); if (found.length === 0) continue;
        await found[0]!.button.click().catch(() => {}); actionLog.push(found[0]!.name);
        await page.waitForTimeout(2_500); await page.keyboard.press("Escape"); await page.waitForTimeout(1_000);
        if (Date.now() >= deadline) break;
      }
    } else {
      await page.waitForTimeout(Math.min(5_000, Math.max(0, deadline - Date.now())));
    }
    // A modal pauses the game by design; a run records its opening, then answers nothing and resumes the speed.
    if (await page.locator(MODAL).count() > 0) {
      await page.waitForTimeout(action === "none" ? 3_000 : 500); await closeModals();
      await page.getByRole("button", { name: `${speed}배속`, exact: true }).click({ timeout: 2_000 }).catch(() => {});
    }
  }
  clearInterval(heap.sampler!); const metricsEnd = await cdpMetrics();
  const madeCounts = await page.evaluate(() => (window as unknown as PageWindow).__made) as Record<string, number>;
  const recorded = await page.evaluate(() => { const hitch = (window as unknown as PageWindow).__hitch; hitch.recording = false; clearInterval(hitch.poll);
    const state = (window as unknown as PageWindow).__FEUDAL_PHASE10_PROOF__?.state();
    return { frames: hitch.frames, marks: hitch.marks, loaf: hitch.loaf ?? [], tick: state?.tick ?? null, population: state?.population ?? null, buildings: state?.buildings.length ?? null,
      dpr: devicePixelRatio, viewport: [innerWidth, innerHeight] }; });
  if (!noTrace) await browser.stopTracing();
  // What the page keeps: the heap after forced GCs, once the recording is over. heapEndMB is wherever the GC sawtooth
  // happened to be at the end (61–90 MB within one commit on the DGX), so trends judge this one.
  const heapAfterGc: number | null = await (async () => { for (let i = 0; i < 2; i++) await cdp.send("HeapProfiler.collectGarbage");
    return ((await cdp.send("Runtime.getHeapUsage")) as { usedSize: number }).usedSize; })().catch(() => null);
  await browser.close();
  const recordSeconds = ((recorded.frames.at(-1)?.t ?? 0) - (recorded.frames[0]?.t ?? 0)) / 1000;
  const frameCount = Math.max(1, recorded.frames.length - 1);
  const perFrame = (name: string) => Math.round((((metricsEnd[name] ?? 0) - (metricsStart[name] ?? 0)) * 1000 / frameCount) * 1000) / 1000;
  const perSecond = (value: number) => Math.round((value / Math.max(1, recordSeconds)) * 100) / 100;
  const metrics = { scriptMsPerFrame: perFrame("ScriptDuration"), taskMsPerFrame: perFrame("TaskDuration"), layoutMsPerFrame: perFrame("LayoutDuration"),
    styleMsPerFrame: perFrame("RecalcStyleDuration"), heapAllocMBps: Math.round((heap.rises / 1e6 / Math.max(1, recordSeconds)) * 10) / 10,
    gcPerMin: Math.round((heap.gcs / Math.max(1 / 60, recordSeconds / 60)) * 10) / 10, heapEndMB: heap.last === null ? null : Math.round(heap.last / 1e5) / 10,
    heapAfterGcMB: heapAfterGc === null ? null : Math.round(heapAfterGc / 1e5) / 10,
    canvasPerSec: perSecond(madeCounts.canvas ?? 0), offscreenPerSec: perSecond(madeCounts.offscreen ?? 0), bitmapPerSec: perSecond(madeCounts.bitmap ?? 0),
    getImageDataPerSec: perSecond(madeCounts.getImageData ?? 0), heapSamples: heap.samples,
    // Per game tick (with the proof port): a busy machine runs fewer ticks, so these hold still where per-second ones fall.
    ticks: tickStart === null || recorded.tick === null ? null : recorded.tick - tickStart,
    scriptMsPerTick: tickStart === null || recorded.tick === null || recorded.tick <= tickStart ? null : Math.round((((metricsEnd.ScriptDuration ?? 0) - (metricsStart.ScriptDuration ?? 0)) * 1000 / (recorded.tick - tickStart)) * 1000) / 1000,
    heapAllocKBPerTick: tickStart === null || recorded.tick === null || recorded.tick <= tickStart ? null : Math.round(heap.rises / 1e3 / (recorded.tick - tickStart) * 10) / 10,
    canvasPer1kTicks: tickStart === null || recorded.tick === null || recorded.tick <= tickStart ? null : Math.round(((madeCounts.canvas ?? 0) + (madeCounts.offscreen ?? 0)) * 1000 / (recorded.tick - tickStart) * 10) / 10 };
  const hidIdleAtEnd = headed ? hidIdleSeconds() : null;   // < recordSeconds: a person touched the Mac during the run

  // The page's record first, beside the trace: an analysis that fails can be redone from these two files.
  writeFileSync(join(traces, `${runName}.record.json`), JSON.stringify({ startMarkPageMs, loadSeconds, ...recorded, actions: [...new Set(actionLog)], errors }));
  const gz = `${rawTrace}.gz`;
  if (!noTrace) { await pipeline(createReadStream(rawTrace), createGzip({ level: 6 }), createWriteStream(gz)); rmSync(rawTrace); }
  const analysis = await analyseRun({ frames: recorded.frames as FrameRecord[], marks: recorded.marks as MomentMark[], startMarkPageMs, tracePath: noTrace ? null : gz });
  const summary = { run: runName, machine, scene, speed, action, seconds, url, save: save ?? null, loadSeconds, startMarkPageMs,
    zoom: { before: zoomBefore, recorded: zoomRecorded, keys: { out: zoomOut, in: zoomIn } }, input: { hidIdleAtEnd, recordSeconds }, windowAtStart, metrics,
    page: { dpr: recorded.dpr, viewport: recorded.viewport, tickEnd: recorded.tick, population: recorded.population, buildings: recorded.buildings },
    trace: noTrace ? null : { file: gz, bytes: statSync(gz).size }, moments: recorded.marks, actions: [...new Set(actionLog)], errors,
    longAnimationFrames: recorded.loaf,
    ...analysis };
  writeFileSync(join(out, `${runName}.json`), `${JSON.stringify(summary, null, 1)}\n`);
  const s = analysis.stats;
  console.log(`${runName}: frames ${s.frames} p50 ${s.p50} p95 ${s.p95} p99 ${s.p99} max ${s.max} >33ms ${s.over33} (${s.over33PerMin}/min) >50ms ${s.over50} moments ${recorded.marks.length} errors ${errors.length}`);
}
await main();
