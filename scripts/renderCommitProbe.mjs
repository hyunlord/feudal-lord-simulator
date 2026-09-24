// P-F1 probe: is "draw 5–20 ms but frame interval 150–200 ms" (main thread waiting in compositor Commit)
// reproducible outside headless Chrome, and with GPU vs software rendering?
// For each browser mode × scene it measures the rAF interval median over 120 frames (1× game speed) and a
// 3-second devtools.timeline trace of the renderer main thread (Commit vs FunctionCall time).
//
// Usage (Vite dev server of this checkout running, e.g. `npx vite --host 127.0.0.1 --port 4194 --strictPort`):
//   PLAYWRIGHT_MODULE=/abs/path/playwright-core/index.mjs node scripts/renderCommitProbe.mjs \
//     [--url http://127.0.0.1:4194/] [--modes headless-gpu,headless-software,headed-gpu,headed-software] \
//     [--scenes pop176-village,pop176-empty,newgame-village,lots24-town] [--out docs/verification/b11-render-metrics/p-f1.json]
// Headed modes open a visible Chrome window; keep it on screen (occluded windows stop producing frames).
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4194/';
const out = resolve(flags.out ?? 'docs/verification/b11-render-metrics/p-f1.json');

/** Loads playwright-core from --playwright or PLAYWRIGHT_MODULE (the repository does not depend on it). */
export async function loadChromium(path = flags.playwright ?? process.env.PLAYWRIGHT_MODULE) {
  if (!path) throw new Error('Pass --playwright or PLAYWRIGHT_MODULE (absolute path to playwright-core index.mjs)');
  return (await import(path.startsWith('/') ? pathToFileURL(path).href : path)).chromium;
}

/** Benchmark cities migrated to the current save schema (scripts/renderFixtureStates.ts via tsx). */
export async function sceneStates() {
  const { execFileSync } = await import('node:child_process');
  const tsx = resolve(ROOT, 'node_modules/.bin/tsx');
  return JSON.parse(execFileSync(tsx, [resolve(ROOT, 'scripts/renderFixtureStates.ts')], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 2 ** 20 }));
}
const SCENES = {
  'pop176-village': { city: 'pop176', tile: [46, 39] },
  'pop176-empty': { city: 'pop176', tile: [12, 12] },
  'newgame-village': { city: 'newgame', tile: [45, 41] },
  'newgame-empty': { city: 'newgame', tile: [12, 12] },
  'lots24-town': { city: 'lots24', tile: [45, 37] },
};
const MODES = {
  'headless-gpu': { headless: true, args: [] },
  'headless-software': { headless: true, args: ['--disable-gpu'] },
  'headed-gpu': { headless: false, args: [] },
  'headed-software': { headless: false, args: ['--disable-gpu'] },
};
const WIDTH = 1280, HEIGHT = 800;

/** Opens the game with an injected state (null = DEFAULT_GAME_STATE) centred on a tile, 1× speed running. */
export async function openScene(browser, { state, tile, baseUrl, width = WIDTH, height = HEIGHT, dpr = 1, rewrite = [], query = '', run = true, zoom = 1 }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr });
  const page = await context.newPage();
  await page.routeWebSocket('**', socket => socket.close());
  if (state !== null) {
    const source = JSON.stringify(state);
    await page.route('**/src/state/gameStore.ts*', async route => {
      const response = await route.fetch(); const text = await response.text(); const anchor = 'useState(DEFAULT_GAME_STATE)';
      if (!text.includes(anchor)) throw new Error('State injection anchor changed');
      await route.fulfill({ response, body: text.replace(anchor, `useState(${source})`) });
    });
  }
  const camera = { zoom, panX: width / 2 - (tile[0] - tile[1]) * 32 * zoom, panY: height / 2 - (tile[0] + tile[1]) * 16 * zoom };
  await page.route('**/src/render/canvasRuntime.ts*', async route => {
    const response = await route.fetch(); const text = await response.text(); const anchor = 'const house = startingHouse(state.buildings);';
    if (!text.includes(anchor)) throw new Error('Camera injection anchor changed');
    await route.fulfill({ response, body: text.replace(anchor, `return ${JSON.stringify(camera)};` + anchor) });
  });
  for (const { pattern, from, to } of rewrite) {
    await page.route(pattern, async route => {
      const response = await route.fetch(); const text = await response.text();
      if (!text.includes(from)) throw new Error(`Rewrite anchor missing in ${pattern}: ${from}`);
      await route.fulfill({ response, body: text.replace(from, to) });
    });
  }
  await page.goto(`${baseUrl}?phase10-proof=1${query}`);
  await page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 60_000 });
  if (await page.locator('.welcome-dismiss-layer').count()) await page.locator('.welcome-dismiss-layer').click();
  await page.keyboard.press('Escape');
  if (run) await page.getByRole('button', { name: '1배속', exact: true }).click();
  await page.waitForTimeout(1_500);
  return { context, page };
}

export const rafMedian = (page, frames = 120) => page.evaluate(count => new Promise(done => {
  const gaps = []; let last;
  const frame = now => { if (last !== undefined) gaps.push(now - last); last = now; if (gaps.length < count) requestAnimationFrame(frame); else { gaps.sort((a, b) => a - b); done({ median: gaps[Math.floor(gaps.length / 2)], p95: gaps[Math.floor(gaps.length * 0.95)] }); } };
  requestAnimationFrame(frame);
}), frames);

/** devtools.timeline trace of the renderer main thread; returns summed durations per top-level event name. */
export async function traceMainThread(page, ms = 3_000) {
  const cdp = await page.context().newCDPSession(page);
  const events = [];
  cdp.on('Tracing.dataCollected', event => events.push(...event.value));
  const done = new Promise(resolveDone => cdp.once('Tracing.tracingComplete', resolveDone));
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
  await page.waitForTimeout(ms);
  await cdp.send('Tracing.end'); await done; await cdp.detach();
  const main = events.find(event => event.name === 'thread_name' && event.args?.name === 'CrRendererMain');
  const totals = {};
  for (const event of events) {
    if (event.ph !== 'X' || event.tid !== main?.tid || event.pid !== main?.pid || !event.dur) continue;
    totals[event.name] = (totals[event.name] ?? 0) + event.dur / 1000;
  }
  const pick = name => Math.round(totals[name] ?? 0);
  return { windowMs: ms, commitMs: pick('Commit'), functionCallMs: pick('FunctionCall'), animationFrameMs: pick('FireAnimationFrame'), paintMs: pick('Paint'), layoutMs: pick('Layout'), runTaskMs: pick('RunTask') };
}

/**
 * Main-thread split of a trace window: canvas rAF callbacks (render loop + fixed tick loop), script outside rAF
 * (React render/commit via the scheduler, timers), compositor Commit, style/layout/paint, and idle.
 */
export async function traceMainThreadSplit(page, ms = 3_000) {
  const cdp = await page.context().newCDPSession(page);
  const events = [];
  cdp.on('Tracing.dataCollected', event => events.push(...event.value));
  const done = new Promise(resolveDone => cdp.once('Tracing.tracingComplete', resolveDone));
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
  await page.waitForTimeout(ms);
  await cdp.send('Tracing.end'); await done; await cdp.detach();
  const main = events.find(event => event.name === 'thread_name' && event.args?.name === 'CrRendererMain');
  const onMain = events.filter(event => event.ph === 'X' && event.tid === main?.tid && event.pid === main?.pid && event.dur);
  const rafs = onMain.filter(event => event.name === 'FireAnimationFrame');
  const insideRaf = event => rafs.some(raf => event.ts >= raf.ts && event.ts + event.dur <= raf.ts + raf.dur);
  const sum = list => Math.round(list.reduce((total, event) => total + event.dur, 0) / 1000);
  const scripts = onMain.filter(event => ['FunctionCall', 'TimerFire', 'EvaluateScript', 'EventDispatch'].includes(event.name) && !insideRaf(event));
  const topScripts = scripts.filter(event => !scripts.some(other => other !== event && event.ts >= other.ts && event.ts + event.dur <= other.ts + other.dur));
  const busy = sum(onMain.filter(event => event.name === 'RunTask'));
  return {
    windowMs: ms, busyMs: busy, idleMs: Math.max(0, ms - busy),
    canvasRafMs: sum(rafs), scriptOutsideRafMs: sum(topScripts), commitMs: sum(onMain.filter(event => event.name === 'Commit')),
    styleLayoutPaintMs: sum(onMain.filter(event => ['UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize'].includes(event.name))),
    gcMs: sum(onMain.filter(event => event.name === 'MinorGC' || event.name === 'MajorGC')),
    rafCount: rafs.length,
  };
}

async function gpuStatus(browser) {
  const page = await browser.newPage();
  await page.goto('chrome://gpu'); await page.waitForTimeout(1_000);
  const text = await page.evaluate(() => { const root = document.querySelector('info-view')?.shadowRoot; return (root ? root.textContent : document.body.innerText).replace(/\s+/g, ' '); });
  await page.close();
  const field = key => { const index = text.indexOf(key); return index < 0 ? null : text.slice(index + key.length, index + key.length + 40).trim().split('*')[0].trim(); };
  return { canvas: field('Canvas:'), rasterization: field('Rasterization:'), compositing: field('Compositing:'), glRenderer: (text.match(/GL_RENDERER\s*:?\s*([^]*?)(GL_VERSION|$)/)?.[1] ?? '').slice(0, 80).trim() };
}

async function main() {
  const chromium = await loadChromium();
  const states = await sceneStates();
  const modes = (flags.modes ?? Object.keys(MODES).join(',')).split(',');
  const scenes = (flags.scenes ?? 'pop176-village,pop176-empty,newgame-village,lots24-town').split(',');
  const rows = [];
  for (const mode of modes) {
    const browser = await chromium.launch({ channel: 'chrome', headless: MODES[mode].headless,
      args: [...MODES[mode].args, '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', `--window-size=${WIDTH},${HEIGHT + 120}`, '--window-position=40,40'] });
    const gpu = await gpuStatus(browser);
    for (const scene of scenes) {
      const { city, tile } = SCENES[scene];
      const { context, page } = await openScene(browser, { state: states[city], tile, baseUrl: url });
      const raf = await rafMedian(page);
      const trace = await traceMainThread(page);
      const work = await page.evaluate(() => { const w = window.__FEUDAL_PHASE10_PROOF__.diagnosis().work; const s = [...w.frameWorkMs].sort((a, b) => a - b); return { frameWorkMedian: s[Math.floor(s.length / 2)] ?? null }; });
      rows.push({ mode, scene, gpu, rafMedianMs: raf.median, rafP95Ms: raf.p95, ...work, ...trace });
      console.log(JSON.stringify(rows.at(-1)));
      await context.close();
    }
    await browser.close();
  }
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify({ url, viewport: { width: WIDTH, height: HEIGHT, dpr: 1 }, measuredAt: new Date().toISOString(), rows }, null, 2)}\n`);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
