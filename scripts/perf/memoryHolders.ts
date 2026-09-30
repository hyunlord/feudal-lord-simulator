// SMOOTH-G: what holds the memory behind SMOOTH-1's major GCs (V8's global budget 1.2–1.8 GB above the old generation
// in the towns). One run = one scene, measured at a few points (loaded, after playing, after camera moves), each after
// a forced GC:
//  - pixels: every canvas, OffscreenCanvas, ImageBitmap and image the page creates is recorded with the stack that
//    created it (an init script wraps the constructors and the width/height setters; no game code is changed). Live
//    ones are summed at w x h x 4 bytes (a canvas only once it has a context and until it hands its pixels over with
//    transferToImageBitmap; a bitmap until close(); an image once decoded), grouped by the first src/ frame of the
//    creating stack, resolved through the build's source map: that frame is the cache that asked for the pixels.
//  - V8 and Blink: Runtime.getHeapUsage, Memory.getDOMCounters, the renderer's and GPU process's resident memory, and
//    the V8.GCIncrementalMarkingStart budget of the GCs in a 30 s trace.
//  - JS heap: a heap snapshot at the last point (outside the repository), read by scripts/perf/heapSnapshot.ts.
//   PLAYWRIGHT_MODULE=... tsx scripts/perf/memoryHolders.ts --scene big-town [--save fixtures/perf-gate/ch4-1380.save.json.gz]
//     [--speed 5] [--play-seconds 120] [--camera-seconds 60] [--commit <sha>] --out <summary dir> --raw <dir outside the repository>
//   --commit builds that commit (a temporary worktree, scripts/perf/sourceTree.ts) instead of this checkout.
import { spawn, spawnSync } from "node:child_process";
import { createReadStream, createWriteStream, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { freePort } from "./freePort";
import { sourceTree } from "./sourceTree";
import { SEASON_TEXT, TUTORIAL_OFF, MODAL, closeModals, loadChromium, openScene, type PageWindow } from "./scenePage";

const argv = process.argv.slice(2);
const flag = (name: string, fallback?: string) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv[i + 1] : fallback; };
const scene = flag("scene")!; const save = flag("save"); const speed = Number(flag("speed", "5"));
const playSeconds = Number(flag("play-seconds", "120")); const cameraSeconds = Number(flag("camera-seconds", "60"));
const out = flag("out")!; const raw = flag("raw")!; const fixedPort = flag("port"); const commit = flag("commit");
const noProof = argv.includes("--no-proof"); const noSnapshot = argv.includes("--no-snapshot");   // the page as a player gets it (no proof port and its render recorders)
if (!scene || !out || !raw) throw new Error("--scene --out --raw are required");
mkdirSync(out, { recursive: true }); mkdirSync(raw, { recursive: true });

// In the page, before the app. Every pixel owner is kept by WeakRef: the registry never keeps one alive.
const RECORD = `(() => {
  globalThis.__name = globalThis.__name || ((fn) => fn);
  Error.stackTraceLimit = 40;   // deep enough to reach the cache that asked, past the helpers
  const entries = []; const stackIds = new Map(); const stacks = [];
  const tracked = new WeakMap();
  const gone = new FinalizationRegistry(index => { entries[index].gone = true; });
  const stackId = () => { const text = new Error().stack || ''; let id = stackIds.get(text); if (id === undefined) { id = stacks.length; stackIds.set(text, id); stacks.push(text); } return id; };
  const track = (object, kind) => { const index = entries.length; entries.push({ ref: new WeakRef(object), kind, stack: stackId(), context: false, transferred: false, closed: false, gone: false }); gone.register(object, index); tracked.set(object, index); };
  const createElement = Document.prototype.createElement;
  Document.prototype.createElement = function (name, options) {
    const element = createElement.call(this, name, options); const lower = String(name).toLowerCase();
    if (lower === 'canvas') track(element, 'canvas'); else if (lower === 'img') track(element, 'image');
    return element;
  };
  const Offscreen = globalThis.OffscreenCanvas;
  if (Offscreen) {
    const Wrapped = function OffscreenCanvas(width, height) { const canvas = new Offscreen(width, height); track(canvas, 'offscreen'); return canvas; };
    Wrapped.prototype = Offscreen.prototype; globalThis.OffscreenCanvas = Wrapped;
    const transfer = Offscreen.prototype.transferToImageBitmap;
    Offscreen.prototype.transferToImageBitmap = function () { const bitmap = transfer.call(this); const index = tracked.get(this); if (index !== undefined) entries[index].transferred = true; track(bitmap, 'bitmap'); return bitmap; };
  }
  const Img = globalThis.Image;
  globalThis.Image = function Image(width, height) { const image = new Img(width, height); track(image, 'image'); return image; };
  globalThis.Image.prototype = Img.prototype;
  for (const proto of [HTMLCanvasElement.prototype, Offscreen && Offscreen.prototype].filter(Boolean)) {
    const getContext = proto.getContext;
    proto.getContext = function (...args) { const index = tracked.get(this); if (index !== undefined) { entries[index].context = true; entries[index].transferred = false; entries[index].pixels = this.width * this.height; } return getContext.apply(this, args); };
  }
  const createBitmap = globalThis.createImageBitmap;
  globalThis.createImageBitmap = function (...args) { const id = stackId(); return createBitmap.apply(this, args).then(bitmap => { track(bitmap, 'bitmap'); entries[entries.length - 1].stack = id; return bitmap; }); };
  const close = ImageBitmap.prototype.close;
  ImageBitmap.prototype.close = function () { const index = tracked.get(this); if (index !== undefined) entries[index].closed = true; return close.call(this); };
  // Calls that make Blink (Oilpan) objects or pixel copies, counted between two reads: the embedder churn behind V8's
  // global budget. getImageData also counts its bytes.
  const calls = {}; const count = (name, bytes) => { const entry = calls[name] ?? (calls[name] = { calls: 0, bytes: 0 }); entry.calls += 1; entry.bytes += bytes || 0; };
  const wrap = (proto, name, bytesOf) => { if (!proto || typeof proto[name] !== 'function') return; const original = proto[name];
    proto[name] = function (...args) { count((proto === Element.prototype ? 'Element' : proto.constructor.name) + '.' + name, bytesOf ? bytesOf(args) : 0); return original.apply(this, args); }; };
  for (const proto of [CanvasRenderingContext2D.prototype, globalThis.OffscreenCanvasRenderingContext2D && OffscreenCanvasRenderingContext2D.prototype]) {
    wrap(proto, 'getImageData', args => (args[2] | 0) * (args[3] | 0) * 4); wrap(proto, 'createImageData', args => (args[0] | 0) * (args[1] | 0) * 4);
    // Every other method of the 2D context too (save() makes a state object, drawImage and fill may not).
    if (proto) for (const name of Object.getOwnPropertyNames(proto)) { if (name === 'getImageData' || name === 'createImageData' || name === 'constructor') continue;
      const descriptor = Object.getOwnPropertyDescriptor(proto, name); if (descriptor && typeof descriptor.value === 'function') wrap(proto, name); }
  }
  wrap(Element.prototype, 'getBoundingClientRect'); wrap(Element.prototype, 'getClientRects');
  const getComputed = window.getComputedStyle; window.getComputedStyle = function (...args) { count('getComputedStyle', 0); return getComputed.apply(this, args); };
  for (const name of ['DOMMatrix', 'Path2D', 'ImageData', 'DOMRect', 'DOMPoint']) { const Original = globalThis[name]; if (!Original) continue;
    const Wrapped = function (...args) { count('new ' + name, name === 'ImageData' ? (args[1] | 0) * (args[2] | 0) * 4 || (args[0] && args[0].length) || 0 : 0); return new Original(...args); };
    Wrapped.prototype = Original.prototype; Object.setPrototypeOf(Wrapped, Original); globalThis[name] = Wrapped; }
  window.__calls = () => { const snapshot = JSON.parse(JSON.stringify(calls)); for (const key of Object.keys(calls)) delete calls[key]; return snapshot; };
  window.__pixels = () => {
    const groups = new Map();
    for (const entry of entries) {
      if (entry.gone) continue; const object = entry.ref.deref(); if (object === undefined) { entry.gone = true; continue; }
      let width = 0, height = 0, bytes = 0, source = '';
      if (entry.kind === 'image') { width = object.naturalWidth; height = object.naturalHeight; bytes = object.complete ? width * height * 4 : 0; source = (object.currentSrc || object.src || '').replace(/^https?:\\/\\/[^/]+\\//, '').replace(/[^/]*$/, ''); }
      else if (entry.kind === 'bitmap') { width = object.width; height = object.height; bytes = entry.closed ? 0 : width * height * 4; }
      else { width = object.width; height = object.height; bytes = entry.context && !entry.transferred ? width * height * 4 : 0; }
      const onScreen = entry.kind === 'canvas' && object.isConnected;
      const key = entry.stack + '|' + entry.kind + '|' + source + '|' + (onScreen ? 1 : 0);
      const group = groups.get(key) ?? { stack: entry.stack, kind: entry.kind, source, onScreen, count: 0, bytes: 0, empty: 0, largest: 0, largestSize: '' };
      group.count += 1; group.bytes += bytes; if (bytes === 0) group.empty += 1;
      if (bytes > group.largest) { group.largest = bytes; group.largestSize = width + 'x' + height; }
      groups.set(key, group);
    }
    const list = [...groups.values()];
    // Everything created since the last read, dead or alive, by stack: the churn (pixels = w x h when it got a context).
    const made = new Map();
    for (let index = window.__madeFrom || 0; index < entries.length; index++) { const entry = entries[index];
      const key = entry.stack + '|' + entry.kind; const row = made.get(key) ?? { stack: entry.stack, kind: entry.kind, count: 0, pixels: 0 }; row.count += 1; row.pixels += entry.pixels || 0; made.set(key, row); }
    window.__madeFrom = entries.length;
    const churn = [...made.values()].sort((a, b) => b.count - a.count).slice(0, 12);
    for (const row of churn) list.push({ stack: row.stack, kind: 'made:' + row.kind, source: '', onScreen: false, count: row.count, bytes: 0, empty: row.count, largest: row.pixels * 4, largestSize: 'sum' });
    return { groups: list, stacks: Object.fromEntries([...new Set(list.map(group => group.stack))].map(id => [id, stacks[id]])), created: entries.length };
  };
})();`;

interface PixelGroup { stack: number; kind: string; source: string; onScreen: boolean; count: number; bytes: number; empty: number; largest: number; largestSize: string }

// Stack frames of the production bundle → the src/ file and function that created the pixels.
async function stackResolver(buildDir: string) {
  const { SourceMapConsumer } = await import("source-map-js");
  const consumers = new Map<string, InstanceType<typeof SourceMapConsumer>>();
  for (const file of readdirSync(join(buildDir, "assets")).filter(name => name.endsWith(".js.map")))
    consumers.set(file.replace(/\.map$/, ""), new SourceMapConsumer(JSON.parse(readFileSync(join(buildDir, "assets", file), "utf8"))));
  const FRAME = /at (?:(?<fn>[^\s(]+(?: \[as [^\]]+\])?) \()?(?<url>https?:\/\/[^)\s]+\/assets\/(?<file>[^/:)]+\.js)):(?<line>\d+):(?<column>\d+)\)?/;
  return (stack: string) => {
    const frames: { file: string; fn: string; line: number }[] = [];
    for (const text of stack.split("\n")) {
      const match = FRAME.exec(text); if (match?.groups === undefined) continue;
      const consumer = consumers.get(match.groups.file!); if (consumer === undefined) continue;
      const position = consumer.originalPositionFor({ line: Number(match.groups.line), column: Number(match.groups.column) - 1 });
      if (position.source === null) continue;
      // The map names sources by absolute path: keep them from the repository's src/ (or node_modules/).
      const file = position.source.replace(/^.*?\/(?=(src|node_modules)\/)/, "").replace(/^(\.\.\/)+/, "");
      frames.push({ file, fn: match.groups.fn ?? "(anonymous)", line: position.line ?? 0 });
    }
    const own = frames.filter(frame => frame.file.startsWith("src/"));
    const first = own[0];
    const via = own.find(frame => first !== undefined && frame.file !== first.file);
    return { file: first?.file ?? (frames[0]?.file ?? "(no src frame)"), fn: first?.fn ?? frames[0]?.fn ?? "", line: first?.line ?? 0,
      via: via === undefined ? null : `${via.file}:${via.fn}`, frames: own.slice(0, 6).map(frame => `${frame.file}:${frame.line} ${frame.fn}`) };
  };
}

async function gcBudget(browser: any, page: any, file: string, seconds: number) {
  await browser.startTracing(page, { path: file, categories: ["v8", "disabled-by-default-v8.gc"] });
  await page.waitForTimeout(seconds * 1000);
  await browser.stopTracing();
  const starts: Record<string, number>[] = []; let majorGC = 0; let minorGC = 0;
  // Each GC's start: embedder bytes = global consumed − old generation consumed; between two scavenges (no mark-compact
  // between them) its growth is what the embedder allocated.
  const gcs: { ts: number; kind: string; embedder: number; oldGen: number }[] = [];
  for await (const line of createInterface({ input: createReadStream(file) })) {
    const text = line.trim().replace(/,$/, ""); if (!text.startsWith("{") || text.startsWith('{"traceEvents"')) continue;
    let event: any; try { event = JSON.parse(text); } catch { continue; }
    if (event.name === "V8.GCIncrementalMarkingStart") starts.push(event.args?.value ?? event.args ?? {});
    if (event.name === "MajorGC" && event.ph === "X") majorGC += 1;
    if (event.name === "V8.GCTraceGCNVP") { try { const value = JSON.parse(event.args?.value ?? "{}");
      if (typeof value.start_global_consumed_size === "number") gcs.push({ ts: event.ts, kind: value.gc, embedder: value.start_global_consumed_size - value.start_old_gen_consumed_size, oldGen: value.start_old_gen_consumed_size }); } catch { /* not a GC line */ } }
    if (event.name === "MinorGC" && event.ph === "X") minorGC += 1;
  }
  const mb = (key: string) => { const values = starts.map(args => args[key]).filter((value): value is number => typeof value === "number").sort((a, b) => a - b);
    return values.length === 0 ? null : Math.round(values[Math.floor(values.length / 2)]! / 1e5) / 10; };
  const keys = [...new Set(starts.flatMap(args => Object.keys(args)))];
  gcs.sort((a, b) => a.ts - b.ts); const rates: number[] = [];
  for (let i = 1; i < gcs.length; i++) if (gcs[i - 1]!.kind === "s" && gcs[i]!.embedder >= gcs[i - 1]!.embedder && gcs[i]!.ts > gcs[i - 1]!.ts)
    rates.push((gcs[i]!.embedder - gcs[i - 1]!.embedder) / ((gcs[i]!.ts - gcs[i - 1]!.ts) / 1e6));
  rates.sort((a, b) => a - b);
  const embedderAllocMBps = rates.length === 0 ? null : Math.round(rates[Math.floor(rates.length / 2)]! / 1e5) / 10;
  return { seconds, majorGC, minorGC, markingStarts: starts.length, embedderAllocMBps, gcCount: gcs.length,
    embedderAtGcMB: gcs.length === 0 ? null : { min: Math.round(Math.min(...gcs.map(gc => gc.embedder)) / 1e5) / 10, max: Math.round(Math.max(...gcs.map(gc => gc.embedder)) / 1e5) / 10 }, reasons: [...new Set(starts.map(args => String(args.reason ?? args.epoch ?? "")))],
    medianMB: Object.fromEntries(keys.filter(key => /bytes|limit|size/.test(key)).map(key => [key, mb(key)])) };
}

async function main() {
  const work = mkdtempSync(join(tmpdir(), "fls-memory-")); const build = join(work, "build");
  const tree = commit === undefined ? null : sourceTree(".", commit);
  const built = spawnSync(join(tree ?? ".", "node_modules/.bin/vite"), ["build", "--minify", "false", "--sourcemap", "true", "--outDir", build, "--emptyOutDir"], { encoding: "utf8", cwd: tree ?? "." });
  if (tree !== null) spawnSync("git", ["worktree", "remove", "--force", tree], { encoding: "utf8" });
  if (built.status !== 0) throw new Error(`vite build failed:\n${built.stdout}\n${built.stderr}`);
  const port = fixedPort === undefined ? await freePort() : Number(fixedPort);   // never a port another session may hold
  const preview = spawn("node_modules/.bin/vite", ["preview", "--outDir", build, "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { stdio: "ignore" });
  const url = `http://127.0.0.1:${port}/`;
  for (let i = 0; i < 60; i++) { if (await fetch(url).then(response => response.ok, () => false)) break; await new Promise(resolve => setTimeout(resolve, 1000)); }
  const resolve = await stackResolver(build);
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--window-size=1600,1090", "--window-position=40,40"] });
  const points: Record<string, unknown>[] = [];
  try {
    const context = await browser.newContext({ viewport: null });
    await context.addInitScript(TUTORIAL_OFF); await context.addInitScript(RECORD);
    const page = await context.newPage();
    const errors: string[] = []; page.on("pageerror", (error: Error) => errors.push(error.message));
    const cdp = await context.newCDPSession(page); const browserCdp = await browser.newBrowserCDPSession();
    await cdp.send("HeapProfiler.enable");
    await openScene(page, { url, speed, proof: !noProof, ...(save === undefined ? {} : { save }) });

    const keepPlaying = async (ms: number, camera: boolean) => {
      const deadline = Date.now() + ms;
      const box = await page.locator("canvas").first().boundingBox(); const cx = (box?.x ?? 0) + (box?.width ?? 1600) / 2; const cy = (box?.y ?? 0) + (box?.height ?? 1000) / 2;
      while (Date.now() < deadline) {
        if (camera) {
          // Across the town and back, zooming out and in: the chunks, rasters and sprites of every part and zoom.
          await page.mouse.move(cx - 300, cy); await page.mouse.down();
          for (let i = 0; i <= 30 && Date.now() < deadline; i++) await page.mouse.move(cx - 300 + i * 20, cy + Math.sin(i / 5) * 120, { steps: 2 });
          await page.mouse.up();
          for (let i = 0; i < 8 && Date.now() < deadline; i++) { await page.mouse.wheel(0, i < 4 ? 240 : -240); await page.waitForTimeout(150); }
        } else await page.waitForTimeout(Math.min(3_000, Math.max(0, deadline - Date.now())));
        if (await page.locator(MODAL).count() > 0) { await closeModals(page); await page.getByRole("button", { name: `${speed}배속`, exact: true }).click({ timeout: 2_000 }).catch(() => {}); }
      }
    };
    const measure = async (label: string) => {
      const gcTrace = join(raw, `${scene}-${label}.gc-trace.json`);
      await page.evaluate(() => (window as unknown as PageWindow).__calls());   // counts from here
      const gc = await gcBudget(browser, page, gcTrace, 30);
      const callCounts = await page.evaluate(() => (window as unknown as PageWindow).__calls()) as Record<string, { calls: number; bytes: number }>;
      const callsPerSecond = Object.fromEntries(Object.entries(callCounts).sort((a, b) => b[1].calls - a[1].calls)
        .map(([name, entry]) => [name, { perSecond: Math.round(entry.calls / gc.seconds), MBps: Math.round(entry.bytes / gc.seconds / 1e5) / 10 }]));
      for (let i = 0; i < 3; i++) { await cdp.send("HeapProfiler.collectGarbage"); await page.waitForTimeout(300); }
      const heap = await cdp.send("Runtime.getHeapUsage"); const dom = await cdp.send("Memory.getDOMCounters");
      const processes = ((await browserCdp.send("SystemInfo.getProcessInfo")).processInfo ?? []) as { type: string; id: number }[];
      const rssMB = Object.fromEntries(processes.map(process => [`${process.type}-${process.id}`,
        Math.round(Number(spawnSync("ps", ["-o", "rss=", "-p", String(process.id)], { encoding: "utf8" }).stdout.trim() || 0) / 1024)]));
      const pixels = await page.evaluate(() => (window as unknown as PageWindow).__pixels());
      const state = await page.evaluate((dateText: string) => { const proof = (window as unknown as PageWindow).__FEUDAL_PHASE10_PROOF__?.state();
        return { date: document.querySelector(dateText)?.textContent ?? null, tick: proof?.tick ?? null, population: proof?.population ?? null, buildings: proof?.buildings.length ?? null }; }, SEASON_TEXT);
      const groups = (pixels.groups as PixelGroup[]).map(group => ({ ...group, ...resolve(String(pixels.stacks[group.stack] ?? "")) }));
      const totalMB = groups.reduce((sum, group) => sum + group.bytes, 0) / 1e6;
      points.push({ label, at: new Date().toISOString(), state, heapUsageMB: Object.fromEntries(Object.entries(heap).map(([key, value]) => [key, Math.round(Number(value) / 1e5) / 10])),
        domCounters: dom, rssMB, gc, callsPerSecond, pixels: { created: pixels.created, liveMB: Math.round(totalMB * 10) / 10, groups: groups.sort((a, b) => b.bytes - a.bytes) } });
      console.log(`${scene} ${label}: ${state.date} tick ${state.tick} pixels ${totalMB.toFixed(1)} MB in ${groups.length} groups; heap used ${(Number(heap.usedSize) / 1e6).toFixed(1)} MB; GC budget ${JSON.stringify(gc.medianMB)}; embedder ${gc.embedderAllocMBps} MB/s; calls ${JSON.stringify(Object.entries(callsPerSecond).slice(0, 4))}`);
    };

    await page.waitForTimeout(10_000); await measure("loaded");
    await keepPlaying(playSeconds * 1000, false); await measure("played");
    if (cameraSeconds > 0) { await keepPlaying(cameraSeconds * 1000, true); await measure("camera"); }
    // The JS heap at the last point, streamed to a file outside the repository (scripts/perf/heapSnapshot.ts reads it).
    const snapshotFile = noSnapshot ? null : join(raw, `${scene}.heapsnapshot`);
    if (snapshotFile !== null) {
      const stream = createWriteStream(snapshotFile);
      cdp.on("HeapProfiler.addHeapSnapshotChunk", (event: { chunk: string }) => { stream.write(event.chunk); });
      await cdp.send("HeapProfiler.takeHeapSnapshot", { reportProgress: false, captureNumericValue: false });
      await new Promise<void>(done => stream.end(done));
    }
    writeFileSync(join(out, `${scene}.memory.json`), `${JSON.stringify({ scene, commit: commit ?? null, save: save ?? null, speed, proof: !noProof, playSeconds, cameraSeconds, errors, snapshot: snapshotFile, points }, null, 1)}\n`);
    console.log(`${scene}: wrote ${join(out, `${scene}.memory.json`)}, snapshot ${snapshotFile}`);
  } finally {
    await browser.close(); preview.kill(); rmSync(work, { recursive: true, force: true });
  }
}
await main();
