// Image loading and decoded image memory at the end of chapter 1 (BUDGET-1).
// Opens a state in the game (scene injection, paused) and walks: load (the chapter page the game shows) → map (the
// page closed with [계속]) → chronicle (ledger dock → 연대기) → factions (its 세력 tab) → faction page (the Crown's,
// else the first row). At each step it records:
//  - every image the page fetched so far (resource timing, buffer raised before the page loads; CSS backgrounds,
//    <img> and canvas Image loads all appear there), sorted with the dist budget's categorize()
//    (scripts/checks/distBudget.config.json), with the bytes fetched;
//  - portraits and illustrations fetched vs. shown: shown = the URL an element renders now (computed
//    background-image of elements and ::before/::after, the image-set entry for this devicePixelRatio, <img>
//    currentSrc), "in DOM" = rendered with a box, "in view" = the box meets the viewport; and which ones this step
//    fetched but does not show (preloading shows up there);
//  - decoded image memory, ESTIMATE: width × height × 4 bytes summed over every distinct image fetched so far (sizes
//    read from the file headers the dev server returns; an SVG counts 0). It is the RGBA size if every fetched image
//    stays decoded at its full size, not what Chrome holds;
//  - Chrome's own numbers, MEASURED: a memory-infra dump (Tracing.requestMemoryDump over a browser CDP session) —
//    per process the top-level allocators (malloc, partition_alloc, blink_gc, v8, skia, discardable, cc, gpu, …)
//    plus cc/image_memory and skia/sk_resource_cache where Chrome reports them — and Performance.getMetrics' JS heap.
// Usage (Vite dev server of this checkout running, e.g. `node_modules/.bin/vite --host 127.0.0.1 --port 4450 --strictPort`):
//   PLAYWRIGHT_MODULE=/abs/path/playwright-core/index.mjs node scripts/imageMemoryProbe.mjs --url http://127.0.0.1:4450/ \
//     --state <dir>/chapter-end.json --out <path>.json [--width 1600 --height 1100 --dpr 1] [--channel chrome]
// The chapter-1-end state: `npx tsx scripts/ui4ChapterStates.ts 2 90000 <dir>` writes <dir>/chapter-end.json (seed 2,
// the guardrail bot, deterministic; chapter 1 ends at tick 77,500, about 2.5 min on the Mac).
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categorize, loadBudgetConfig } from './checks/distBudget.mjs';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag('url') ?? 'http://127.0.0.1:4450/';
const statePath = flag('state');
const out = flag('out');
if (statePath === undefined || out === undefined) throw new Error('Pass --state <chapter-end.json> and --out <result.json>');
const width = Number(flag('width') ?? 1600); const height = Number(flag('height') ?? 1100); const dpr = Number(flag('dpr') ?? 1);
const config = loadBudgetConfig();
const base = new URL(url).pathname;
const IMAGE = /\.(png|jpe?g|webp|gif|avif|svg)$/i;
const WATCHED = ['portraits', 'illustrations'];
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const BUFFER = 'performance.setResourceTimingBufferSize(1000000);';

/** A page URL as a dist-relative path (the site base and any query removed), or null for another origin / data:. */
function distPath(address) {
  if (address.startsWith('data:') || address.startsWith('blob:')) return null;
  const parsed = new URL(address, url);
  if (parsed.origin !== new URL(url).origin) return null;
  const path = decodeURIComponent(parsed.pathname);
  return path.startsWith(base) ? path.slice(base.length) : path.replace(/^\//, '');
}
const categoryOf = path => categorize(path, config)?.category ?? 'other';

/** Width and height from a PNG, JPEG, GIF or WebP header (null for SVG or an unknown format). */
export function imageSize(bytes) {
  const b = Buffer.from(bytes);
  if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length > 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = b.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (chunk === 'VP8L') { const bits = b.readUInt32LE(21); return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }; }
    if (chunk === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < b.length) {
      if (b[offset] !== 0xff) { offset += 1; continue; }
      const marker = b[offset + 1];
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: b.readUInt16BE(offset + 7), height: b.readUInt16BE(offset + 5) };
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { offset += 2; continue; }
      offset += 2 + b.readUInt16BE(offset + 2);
    }
  }
  return null;
}

const sizes = new Map();
async function sizeOf(address) {
  if (!sizes.has(address)) {
    sizes.set(address, (async () => {
      const response = await fetch(address);
      if (!response.ok) return { status: response.status, width: null, height: null, fileBytes: null };
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { status: response.status, ...(imageSize(bytes) ?? { width: null, height: null }), fileBytes: bytes.length };
    })());
  }
  return sizes.get(address);
}

// ---- in the page ----
/** Image resource entries so far: { url, transferSize, encodedBodySize, status }. */
const fetchedImages = page => page.evaluate(pattern => performance.getEntriesByType('resource')
  .filter(entry => new RegExp(pattern, 'i').test(new URL(entry.name).pathname))
  .map(entry => ({ url: entry.name, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, status: entry.responseStatus ?? null })), IMAGE.source);

/** Image URLs elements render now, with whether the box is in the viewport. */
const shownImages = page => page.evaluate(() => {
  const found = new Map();
  const note = (address, element, pseudo) => {
    if (!address) return;
    const absolute = new URL(address, document.baseURI).href;
    const rects = [...element.getClientRects()];
    const inDom = rects.some(rect => rect.width > 0 && rect.height > 0) || (pseudo !== null && rects.length > 0);
    if (!inDom) return;
    const inView = rects.some(rect => rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight);
    const entry = found.get(absolute) ?? { url: absolute, inView: false, elements: 0 };
    entry.inView ||= inView; entry.elements += 1; found.set(absolute, entry);
  };
  // image-set(url(a) 1x, url(b) 2x): the entry for this devicePixelRatio (the smallest one at or above it, else the largest).
  const urlsOf = value => {
    if (!value || value === 'none') return [];
    const picks = [];
    for (const set of value.matchAll(/image-set\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/g)) {
      // Computed style writes the resolutions as dppx (the source's 1x / 2x).
      const options = [...set[1].matchAll(/url\("?([^")]+)"?\)\s*([\d.]+)(?:x|dppx)/g)].map(match => ({ url: match[1], scale: Number(match[2]) })).sort((a, b) => a.scale - b.scale);
      const pick = options.find(option => option.scale >= devicePixelRatio) ?? options.at(-1);
      if (pick !== undefined) picks.push(pick.url);
    }
    const rest = value.replace(/image-set\(((?:[^()]|\((?:[^()]|\([^()]*\))*\))*)\)/g, '');
    for (const match of rest.matchAll(/url\("?([^")]+)"?\)/g)) picks.push(match[1]);
    return picks;
  };
  for (const element of document.querySelectorAll('*')) {
    const style = getComputedStyle(element);
    if (style.visibility === 'hidden') continue;
    for (const address of urlsOf(style.backgroundImage)) note(address, element, null);
    for (const pseudo of ['::before', '::after']) for (const address of urlsOf(getComputedStyle(element, pseudo).backgroundImage)) note(address, element, pseudo);
    if (element instanceof HTMLImageElement && element.complete) note(element.currentSrc || element.src, element, null);
  }
  return [...found.values()];
});

const screenState = page => page.evaluate(() => ({
  modal: document.querySelector('.chronicle-page, .chapter-preview, .petition-card, .famine-card, .chronicle-screen, [role=dialog]')?.getAttribute('aria-label') ?? null,
  chapterPage: document.querySelector('.chronicle-page') !== null,
  chronicle: document.querySelector('.chronicle-tabs') !== null,
  factionRows: document.querySelectorAll('.chronicle-factions-row').length,
  factionPage: document.querySelector('.chronicle-faction')?.getAttribute('data-faction') ?? null,
}));

/** Waits until no new resource entry arrives for `quietMs` and every <img> is complete (at most `maxMs`). */
async function settle(page, quietMs = 1_200, maxMs = 20_000) {
  const started = Date.now(); let count = -1; let since = Date.now();
  while (Date.now() - started < maxMs) {
    const now = await page.evaluate(() => ({ entries: performance.getEntriesByType('resource').length, pending: [...document.images].filter(image => !image.complete).length }));
    if (now.entries !== count) { count = now.entries; since = Date.now(); }
    if (now.pending === 0 && Date.now() - since >= quietMs) return Date.now() - started;
    await page.waitForTimeout(200);
  }
  return Date.now() - started;
}

// ---- Chrome's memory ----
const hexBytes = value => typeof value === 'string' ? parseInt(value, 16) : typeof value === 'number' ? value : 0;
const KEEP = ['cc/image_memory', 'skia/sk_resource_cache', 'gpu/gl', 'gpu/shared_images'];

async function chromeMemory(browser, page) {
  const result = { note: 'Chrome memory-infra dump (MEASURED), bytes per process: top-level allocators and a few image-related children', processes: [] };
  try {
    const cdp = await browser.newBrowserCDPSession();
    const events = [];
    cdp.on('Tracing.dataCollected', event => events.push(...event.value));
    await cdp.send('Tracing.start', { transferMode: 'ReportEvents', traceConfig: { includedCategories: ['disabled-by-default-memory-infra'], excludedCategories: ['*'], memoryDumpConfig: { triggers: [] } } });
    const dump = await cdp.send('Tracing.requestMemoryDump', { deterministic: true, levelOfDetail: 'detailed' });
    const complete = new Promise(done => cdp.once('Tracing.tracingComplete', done));
    await cdp.send('Tracing.end'); await complete; await cdp.detach();
    result.dumpSuccess = dump.success;
    const names = new Map(); const labels = new Map();
    for (const event of events) {
      if (event.ph === 'M' && event.name === 'process_name') names.set(event.pid, event.args?.name);
      if (event.ph === 'M' && event.name === 'process_labels') labels.set(event.pid, event.args?.labels);
    }
    for (const event of events.filter(candidate => candidate.ph === 'v' && candidate.args?.dumps?.allocators)) {
      const allocators = event.args.dumps.allocators;
      const top = {}; const picked = {};
      for (const [name, value] of Object.entries(allocators)) {
        const size = hexBytes(value?.attrs?.size?.value);
        if (!name.includes('/')) top[name] = size;
        const kept = KEEP.find(prefix => name === prefix);
        if (kept !== undefined) picked[name] = size;
      }
      result.processes.push({ pid: event.pid, name: names.get(event.pid) ?? null, labels: labels.get(event.pid) ?? null, allocators: top, imageRelated: picked });
    }
    // The game's renderer: the Renderer process holding the most; the GPU process (textures of uploaded images).
    const total = entry => Object.values(entry.allocators).reduce((sum, size) => sum + size, 0);
    const renderer = result.processes.filter(entry => entry.name === 'Renderer').sort((a, b) => total(b) - total(a))[0];
    const gpu = result.processes.find(entry => entry.name === 'GPU Process');
    const mbOf = size => size === undefined ? null : +(size / 1e6).toFixed(1);
    result.summaryMB = {
      renderer: renderer === undefined ? null : { pid: renderer.pid, 'cc/image_memory': mbOf(renderer.imageRelated['cc/image_memory']), discardable: mbOf(renderer.allocators.discardable),
        canvas: mbOf(renderer.allocators.canvas), gpu: mbOf(renderer.allocators.gpu), web_cache: mbOf(renderer.allocators.web_cache), partition_alloc: mbOf(renderer.allocators.partition_alloc),
        malloc: mbOf(renderer.allocators.malloc), v8: mbOf(renderer.allocators.v8), blink_gc: mbOf(renderer.allocators.blink_gc), total: mbOf(total(renderer)) },
      gpuProcess: gpu === undefined ? null : { 'gpu/shared_images': mbOf(gpu.imageRelated['gpu/shared_images']), gpu: mbOf(gpu.allocators.gpu), skia: mbOf(gpu.allocators.skia), total: mbOf(total(gpu)) },
    };
  } catch (error) {
    result.error = String(error).slice(0, 300);
  }
  try {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    const { metrics } = await cdp.send('Performance.getMetrics');
    await cdp.detach();
    const pick = name => metrics.find(metric => metric.name === name)?.value ?? null;
    result.page = { jsHeapUsedSize: pick('JSHeapUsedSize'), jsHeapTotalSize: pick('JSHeapTotalSize'), nodes: pick('Nodes') };
  } catch (error) {
    result.pageError = String(error).slice(0, 300);
  }
  return result;
}

async function record(name, page, browser, previous) {
  const settleMs = await settle(page);
  const [fetched, shown, screen] = [await fetchedImages(page), await shownImages(page), await screenState(page)];
  const images = new Map();
  for (const entry of fetched) {
    const path = distPath(entry.url);
    if (path === null || images.has(entry.url)) continue;
    images.set(entry.url, { url: entry.url, path, category: categoryOf(path), bytes: entry.encodedBodySize || entry.transferSize, status: entry.status });
  }
  for (const image of images.values()) Object.assign(image, await sizeOf(image.url));
  const decoded = image => image.width === null ? 0 : image.width * image.height * 4;
  const byCategory = {};
  for (const image of images.values()) {
    const row = byCategory[image.category] ??= { fetched: 0, bytes: 0, decodedEstimateBytes: 0 };
    row.fetched += 1; row.bytes += image.bytes ?? 0; row.decodedEstimateBytes += decoded(image);
  }
  const shownPaths = shown.map(entry => ({ ...entry, path: distPath(entry.url) })).filter(entry => entry.path !== null);
  const watched = {};
  for (const category of WATCHED) {
    const fetchedHere = [...images.values()].filter(image => image.category === category);
    const shownHere = shownPaths.filter(entry => categoryOf(entry.path) === category);
    const shownSet = new Set(shownHere.map(entry => entry.url));
    const newThisStep = fetchedHere.filter(image => !previous.has(image.url));
    watched[category] = {
      fetchedSoFar: fetchedHere.length, fetchedThisStep: newThisStep.length,
      shownInDom: shownHere.length, shownInView: shownHere.filter(entry => entry.inView).length,
      fetchedThisStepNotShown: newThisStep.filter(image => !shownSet.has(image.url)).map(image => image.path),
      shownNotFetched: shownHere.filter(entry => !images.has(entry.url)).map(entry => entry.path),
      shown: shownHere.map(entry => `${entry.path}${entry.inView ? '' : ' (out of view)'}`),
      decodedEstimateBytes: fetchedHere.reduce((sum, image) => sum + decoded(image), 0),
      shownDecodedEstimateBytes: fetchedHere.filter(image => shownSet.has(image.url)).reduce((sum, image) => sum + decoded(image), 0),
    };
  }
  const memory = await chromeMemory(browser, page);
  const step = { name, settleMs, screen, fetchedImages: images.size, byCategory, watched,
    decodedEstimate: { bytes: [...images.values()].reduce((sum, image) => sum + decoded(image), 0), note: 'ESTIMATE: sum of width x height x 4 over every distinct image fetched so far' },
    chromeMemory: memory };
  console.log(JSON.stringify({ step: name, screen, fetched: images.size, decodedEstimateMB: +(step.decodedEstimate.bytes / 1e6).toFixed(2),
    portraits: `${watched.portraits.fetchedSoFar} fetched (${watched.portraits.fetchedThisStep} new) / ${watched.portraits.shownInDom} shown`,
    illustrations: `${watched.illustrations.fetchedSoFar} fetched (${watched.illustrations.fetchedThisStep} new) / ${watched.illustrations.shownInDom} shown`,
    chromeMB: memory.summaryMB ?? memory.error }));
  return { step, images };
}

async function main() {
  const stateText = await readFile(resolve(statePath), 'utf8');
  const state = JSON.parse(stateText);
  const inner = typeof state.schemaVersion === 'number' && 'state' in state ? state.state : state;
  const keep = inner.buildings?.find(building => building.kind === 'keep') ?? inner.buildings?.find(building => building.kind === 'house');
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: flag('channel') ?? 'chrome', headless: true });
  const errors = []; const steps = []; const allImages = new Map();
  const { context, page } = await openScene(browser, { state: stateText, tile: keep === undefined ? [40, 40] : [keep.tx, keep.ty], baseUrl: url,
    width, height, dpr, run: false, initScript: `${BUFFER}\n${TUTORIAL_OFF}` });
  page.on('pageerror', error => errors.push(String(error).slice(0, 300)));
  const take = async name => {
    const previous = new Set(allImages.keys());
    const { step, images } = await record(name, page, browser, previous);
    for (const [address, image] of images) allImages.set(address, image);
    steps.push(step);
  };
  const act = async (name, run) => { try { await run(); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); } };
  // Chapter 1's page comes after the story's world-first delay (1.5 s): give it a moment before the first step.
  await page.locator('.chronicle-page').first().waitFor({ timeout: 6_000 }).catch(() => undefined);
  await take('load');
  await act('map', async () => { if (await page.locator('.chronicle-keep').count() > 0) await page.locator('.chronicle-keep').first().click({ timeout: 5_000 }); });
  await take('map');
  await act('chronicle', async () => {
    await page.locator("[data-dock='ledger']").first().click({ timeout: 5_000 }); await page.waitForTimeout(400);
    await page.locator('.ledger-tab--chronicle').first().click({ timeout: 5_000 });
  });
  await take('chronicle');
  // The chronicle's tabs are [기록, 세력]: the second one.
  await act('factions', () => page.locator('.chronicle-tab').nth(1).click({ timeout: 5_000 }));
  await take('factions');
  await act('faction-page', async () => {
    const crown = page.locator(".chronicle-factions-row[data-faction='crown']");
    await (await crown.count() > 0 ? crown : page.locator('.chronicle-factions-row')).first().click({ timeout: 5_000 });
  });
  await take('faction-page');
  await context.close(); await browser.close();
  const sha = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return null; } })();
  const result = { sha, url, state: resolve(statePath), tick: inner.tick ?? null, viewport: { width, height, dpr }, measuredAt: new Date().toISOString(),
    steps, images: [...allImages.values()].sort((a, b) => a.path.localeCompare(b.path)), errors };
  await mkdir(dirname(resolve(out)), { recursive: true });
  await writeFile(out, `${JSON.stringify(result, null, 1)}\n`);
  console.log(JSON.stringify({ out, steps: steps.length, images: allImages.size, errors }));
  process.exitCode = errors.length === 0 ? 0 : 1;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
