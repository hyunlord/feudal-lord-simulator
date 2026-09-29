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
import { MODAL, SEASON_TEXT, TUTORIAL_OFF, closeModals as closeSceneModals, loadChromium, openScene, windowReady, type PageWindow } from "./scenePage";
import { holderText, takeMachineLock } from "./machineLock";

const argv = process.argv.slice(2);
const flag = (name: string, fallback?: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const url = flag("url")!; const scene = flag("scene")!; const save = flag("save"); const speed = Number(flag("speed", "1"));
const seconds = Number(flag("seconds", "180")); const action = flag("action", "none")!; const headed = argv.includes("--headed");
const machine = flag("machine", headed ? "mac-chrome-window" : "dgx-headless")!; const out = flag("out")!; const traces = flag("traces")!;
const noProof = argv.includes("--no-proof");
const lockWait = Number(flag("lock-wait", "30")); const focusWait = Number(flag("focus-wait", "60"));   // minutes · seconds   // the page as a player gets it: no proof port and its render recorders
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
  // One measurement at a time on this machine (scripts/perf/machineLock.ts); inside perf:gate the gate holds it.
  const lock = await takeMachineLock(`hitchAudit ${scene} x${speed}`, lockWait, holder => console.error(`측정 잠금을 기다린다: ${holderText(holder)}`));
  if (!lock.held) { console.error(`판정 아님: 다른 측정이 돌고 있다 — ${holderText(lock.holder)}`); process.exitCode = 3; return; }
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: "chrome", headless: !headed,
    args: headed ? [`--window-size=${width},${height + 90}`, "--window-position=40,40"] : [] });
  const context = await browser.newContext(headed ? { viewport: null } : { viewport: { width, height }, deviceScaleFactor: 1 });
  await context.addInitScript(TUTORIAL_OFF); await context.addInitScript(OBSERVE);
  const page = await context.newPage();
  const errors: string[] = []; page.on("pageerror", (error: Error) => errors.push(error.message));
  const load0 = Date.now();
  await openScene(page, { url, speed, proof: !noProof, ...(save === undefined ? {} : { save }) });
  const closeModals = () => closeSceneModals(page);
  const loadSeconds = (Date.now() - load0) / 1000;
  await page.waitForTimeout(1_000);
  if (headed) {
    const notReady = await windowReady(browser, page, focusWait);
    if (notReady !== null) { console.error(`판정 아님: ${notReady}`); await browser.close(); process.exitCode = 3; return; }
  }

  const rawTrace = join(traces, `${runName}.json`);
  if (!noTrace) await browser.startTracing(page, { path: rawTrace, screenshots: false,
    categories: ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-v8.cpu_profiler", "blink.user_timing", "v8.execute", "v8"] });
  await page.waitForTimeout(2_000);   // tracing's own start-up stall stays out of the recorded frames
  // The recorder: every rAF's timestamp, and every 250 ms the proof port's tick, chapter, season and weather.
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
  const recorded = await page.evaluate(() => { const hitch = (window as unknown as PageWindow).__hitch; hitch.recording = false; clearInterval(hitch.poll);
    const state = (window as unknown as PageWindow).__FEUDAL_PHASE10_PROOF__?.state();
    return { frames: hitch.frames, marks: hitch.marks, loaf: hitch.loaf ?? [], tick: state?.tick ?? null, population: state?.population ?? null, buildings: state?.buildings.length ?? null,
      dpr: devicePixelRatio, viewport: [innerWidth, innerHeight] }; });
  if (!noTrace) await browser.stopTracing();
  await browser.close();

  // The page's record first, beside the trace: an analysis that fails can be redone from these two files.
  writeFileSync(join(traces, `${runName}.record.json`), JSON.stringify({ startMarkPageMs, loadSeconds, ...recorded, actions: [...new Set(actionLog)], errors }));
  const gz = `${rawTrace}.gz`;
  if (!noTrace) { await pipeline(createReadStream(rawTrace), createGzip({ level: 6 }), createWriteStream(gz)); rmSync(rawTrace); }
  const analysis = await analyseRun({ frames: recorded.frames as FrameRecord[], marks: recorded.marks as MomentMark[], startMarkPageMs, tracePath: noTrace ? null : gz });
  const summary = { run: runName, machine, scene, speed, action, seconds, url, save: save ?? null, loadSeconds, startMarkPageMs,
    page: { dpr: recorded.dpr, viewport: recorded.viewport, tickEnd: recorded.tick, population: recorded.population, buildings: recorded.buildings },
    trace: noTrace ? null : { file: gz, bytes: statSync(gz).size }, moments: recorded.marks, actions: [...new Set(actionLog)], errors,
    longAnimationFrames: recorded.loaf,
    ...analysis };
  writeFileSync(join(out, `${runName}.json`), `${JSON.stringify(summary, null, 1)}\n`);
  const s = analysis.stats;
  console.log(`${runName}: frames ${s.frames} p50 ${s.p50} p95 ${s.p95} p99 ${s.p99} max ${s.max} >33ms ${s.over33} (${s.over33PerMin}/min) >50ms ${s.over50} moments ${recorded.marks.length} errors ${errors.length}`);
}
await main();
