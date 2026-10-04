import { refuseHeavyOnMac } from './remote/localGuard.mjs';
refuseHeavyOnMac('브라우저 캡처(scripts/artContractCaptures.mjs)', { entry: import.meta.url });
// DGX: tsx scripts/artContractCaptures.mjs capture --states DIR --views views.json --out DIR
// views: [{name,state,season,tile:[x,y],zoom,width,height,dpr:1,expectedRequests:['/assets/...png']}]
// State is an unchanged NAT5 state file; season is a label checked against its calendar, never injected.
// Produces actual full canvas PNG + context JPEG, two independent opens per view (A/A gate).
import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { spawnServer } from './serverProcess.ts';
import { loadChromium, openScene } from './renderCommitProbe.mjs';
import { compareRgba } from './artPixelCompare.mjs';

export function packCanvasPixels(canvas) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Game canvas 2D context missing');
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let binary = '';
  for (let offset = 0; offset < rgba.length; offset += 32768) binary += String.fromCharCode(...rgba.subarray(offset, offset + 32768));
  return { dimensions: { width: canvas.width, height: canvas.height }, rgbaBase64: btoa(binary), png: canvas.toDataURL('image/png') };
}

export async function capturePhase(name, operation, options) {
  options.progress({ phase: name, status: 'started' });
  let timer;
  try {
    const value = await Promise.race([operation(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Capture phase timed out: ${name} (${options.timeoutMs}ms)`)), options.timeoutMs); })]);
    options.progress({ phase: name, status: 'finished' });
    return value;
  } catch (error) { options.progress({ phase: name, status: 'failed', error: String(error) }); throw error; }
  finally { clearTimeout(timer); }
}

export function initializeCaptureDocument() {
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
  localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] }));
  const images = new Set();
  const draws = new Set();
  const source = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
  Object.defineProperty(HTMLImageElement.prototype, 'src', { ...source, set(value) { images.add(this); source.set.call(this, value); } });
  const lineage = new WeakMap();
  const sources = image => image instanceof HTMLImageElement
    ? new Set([new URL(image.currentSrc || image.src, location.href).pathname])
    : lineage.get(image) ?? new Set();
  const observe = prototype => {
    const originalDraw = prototype.drawImage;
    prototype.drawImage = function(image, ...args) {
      const result = originalDraw.call(this, image, ...args);
      if (this.globalAlpha === 0 || this.globalCompositeOperation === 'destination-out') return result;
      const urls = sources(image);
      const target = lineage.get(this.canvas) ?? new Set();
      for (const url of urls) target.add(url);
      lineage.set(this.canvas, target);
      if (this.canvas === document.querySelector('canvas')) for (const url of urls) draws.add(url);
      return result;
    };
    const originalClear = prototype.clearRect;
    prototype.clearRect = function(x, y, width, height) {
      const result = originalClear.call(this, x, y, width, height);
      const t = this.getTransform();
      if (t.a === 1 && t.b === 0 && t.c === 0 && t.d === 1 && t.e === 0 && t.f === 0
        && x <= 0 && y <= 0 && x + width >= this.canvas.width && y + height >= this.canvas.height) lineage.delete(this.canvas);
      return result;
    };
  };
  observe(CanvasRenderingContext2D.prototype);
  if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') observe(OffscreenCanvasRenderingContext2D.prototype);
  for (const constructor of [HTMLCanvasElement, ...(typeof OffscreenCanvas === 'undefined' ? [] : [OffscreenCanvas])]) {
    for (const key of ['width', 'height']) {
      const property = Object.getOwnPropertyDescriptor(constructor.prototype, key);
      if (property?.set) Object.defineProperty(constructor.prototype, key, { ...property, set(value) { property.set.call(this, value); lineage.delete(this); } });
    }
  }
  window.__ART_CAPTURE__ = { images, draws };
}

export function routeCaptureWebSocket(socket, httpOrigin, fallback) {
  const url = new URL(socket.url());
  const origin = new URL(httpOrigin);
  if (url.protocol === (origin.protocol === 'https:' ? 'wss:' : 'ws:') && url.host === origin.host
    && url.pathname === '/' && url.searchParams.get('token') && [...url.searchParams.keys()].every(key => key === 'token')) {
    socket.connectToServer();
  } else fallback(socket);
}

export function expectedArtIssues(expectedRequests, evidence) {
  const issues = [];
  for (const expected of expectedRequests) {
    if (!evidence.requestPaths.has(expected)) issues.push(`Expected URL was not requested: ${expected}`);
    if (!evidence.decoded.some(image => image.url === expected && image.decoded && image.width > 0 && image.height > 0)) issues.push(`Expected URL was not decoded: ${expected}`);
    if (!evidence.draws.includes(expected)) issues.push(`Expected URL was not drawn: ${expected}`);
  }
  return issues;
}

async function main() {
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const flags = Object.fromEntries(process.argv.slice(3).reduce((pairs, value, i, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[i + 1]]] : pairs, []));
if (process.argv[2] !== 'capture' || !flags.states || !flags.views || !flags.out) throw new Error('Usage: tsx scripts/artContractCaptures.mjs capture --states DIR --views JSON --out DIR');
const views = JSON.parse(readFileSync(flags.views, 'utf8'));
const safeName = value => typeof value === 'string' && /^[a-zA-Z0-9_-]+$/.test(value);
if (!Array.isArray(views) || views.length === 0 || new Set(views.map(view => view.name)).size !== views.length) throw new Error('Views must be nonempty with unique names');
for (const view of views) {
  if (!safeName(view.name) || !safeName(view.state) || !['summer', 'winter'].includes(view.season)
    || !Array.isArray(view.tile) || view.tile.length !== 2 || !view.tile.every(Number.isFinite)
    || ![1, 0.6].includes(view.zoom) || ![view.width, view.height].every(value => Number.isInteger(value) && value > 0)
    || !Number.isFinite(view.dpr ?? 1) || (view.dpr ?? 1) <= 0
    || !Array.isArray(view.expectedRequests) || view.expectedRequests.length === 0
    || !view.expectedRequests.every(url => typeof url === 'string' && url.startsWith('/assets/') && !url.includes('..') && !url.includes('?'))) throw new Error(`Invalid view: ${view.name}`);
  for (const url of view.expectedRequests) if (!existsSync(join('public', url))) throw new Error(`Expected asset absent: ${url}`);
}
const port = Number(flags.port ?? process.env.FLS_REMOTE_PORT ?? 4391);
if (!Number.isInteger(port) || port < 4300 || port > 4399) throw new Error('Capture port must be 4300..4399');
const out = resolve(flags.out);
mkdirSync(out, { recursive: true });
mkdirSync(join(out, 'repeat'), { recursive: true });
const result = { pass: false, commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), views: [], errors: [], coverageScope: 'Expected URLs must be requested, decoded, and observed in drawImage lineage reaching the captured canvas; coverage set is explicit per view, not a claim of final visible pixels or occlusion.' };
const progress = event => { const row = { time: new Date().toISOString(), ...event }; appendFileSync(join(out, 'progress.jsonl'), `${JSON.stringify(row)}\n`); console.log(JSON.stringify(row)); };
const phase = (name, operation, timeoutMs = 90000) => capturePhase(name, operation, { timeoutMs, progress });
const FROZEN = { date: 1700000000000, performance: 12345 };


async function capture(browser, view, repetition) {
  const step = (name, operation, timeout) => phase(`${view.name}/${repetition}/${name}`, operation, timeout);
  const raw = readFileSync(join(flags.states, `${view.state}.json`));
  const state = JSON.parse(raw);
  const requests = [], errors = [], responses = [], failed = [];
  // openScene owns creation/navigation; wrapping context creation installs listeners before it creates its page.
  const observedBrowser = { newContext: async options => {
    context = await browser.newContext(options);
    context.setDefaultTimeout(60000);
    context.setDefaultNavigationTimeout(90000);
    context.on('page', page => {
      const routeWebSocket = page.routeWebSocket.bind(page);
      page.routeWebSocket = (pattern, handler) => routeWebSocket(pattern, socket => routeCaptureWebSocket(socket, `http://127.0.0.1:${port}/`, handler));
      page.on('request', request => requests.push({ url: request.url(), type: request.resourceType() }));
      page.on('requestfailed', request => failed.push({ url: request.url(), error: request.failure()?.errorText }));
      page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${response.url()}`); responses.push({ url: response.url(), status: response.status() }); });
      page.on('pageerror', error => errors.push(String(error)));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    });
    return context;
  } };
  let context;
  try {
    const scene = await step('open', () => openScene(observedBrowser, { state, tile: view.tile, baseUrl: `http://127.0.0.1:${port}/`, width: view.width, height: view.height, dpr: view.dpr ?? 1,
      zoom: view.zoom, run: false, initScript: initializeCaptureDocument, query: '&story-delay=600000', loadTimeout: 90000 }), 150000);
    context = scene.context;
    const page = scene.page;
    await step('readiness', () => page.waitForFunction(() => {
      const assets = window.__FEUDAL_PHASE10_PROOF__.diagnosis().assets;
      return assets.length > 0 && assets.every(asset => asset.status !== 'loading' && asset.status !== 'idle')
        && [...window.__ART_CAPTURE__.images].every(image => image.complete);
    }, null, { timeout: 60000 }));
    const decoded = await step('decode-fonts', () => page.evaluate(async () => {
      await document.fonts.ready;
      return Promise.all([...new Set([...window.__ART_CAPTURE__.images, ...document.images])].filter(image => image.src).map(async image => {
        const url = new URL(image.currentSrc || image.src, location.href).pathname;
        try { await image.decode(); return { url, decoded: true, width: image.naturalWidth, height: image.naturalHeight }; }
        catch (error) { return { url, decoded: false, error: String(error) }; }
      }));
    }));
    // Loader retries/readiness use real clocks; freeze only after initial loading and decode have finished.
    await step('freeze', () => page.evaluate(time => { Date.now = () => time.date; performance.now = () => time.performance; }, FROZEN));
    const snapshot = () => step('snapshot', async () => {
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      const packed = await page.locator('canvas').first().evaluate(packCanvasPixels);
      const metadata = await page.evaluate(() => ({ tick: window.__FEUDAL_PHASE10_PROOF__.state().tick,
        assets: window.__FEUDAL_PHASE10_PROOF__.diagnosis().assets, draws: [...window.__ART_CAPTURE__.draws].sort() }));
      return { ...packed, ...metadata, rgba: Buffer.from(packed.rgbaBase64, 'base64') };
    });
    let previous = await snapshot(), current;
    let stable = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      await page.waitForTimeout(100);
      current = await snapshot();
      if (compareRgba(previous, current).pass) { stable = true; break; }
      previous = current;
    }
    if (!stable) errors.push('Canvas did not stabilize after freezing visual clocks');
    const observedPaths = new Set(requests.map(request => new URL(request.url).pathname));
    errors.push(...expectedArtIssues(view.expectedRequests, { requestPaths: observedPaths, decoded, draws: current.draws }));
    for (const image of decoded) if (!image.decoded || image.width === 0) errors.push(`Image decode failed: ${image.url}`);
    for (const asset of current.assets) if (asset.status !== 'ready') errors.push(`Asset not ready: ${JSON.stringify(asset)}`);
    for (const request of failed) errors.push(`Request failed: ${JSON.stringify(request)}`);
    const injectedState = state.state ?? state;
    if (current.tick !== injectedState.tick) errors.push(`Simulation tick changed: ${injectedState.tick} -> ${current.tick}`);
    // Compare real engine calendar to the explicit season label without editing the input save.
    const season = await step('season', () => page.evaluate(async () => {
      const module = await import('/src/engine/scenarioState.ts');
      return module.stateCalendar(window.__FEUDAL_PHASE10_PROOF__.state()).season;
    }));
    if (season !== (view.season === 'summer' ? 1 : 3)) errors.push(`State season ${season} differs from ${view.season}`);
    const identity = { state: view.state, savedStateSHA: hash(raw), tick: current.tick, season: view.season, tile: view.tile, zoom: view.zoom,
      width: view.width, height: view.height, dpr: view.dpr ?? 1, browser: browser.version(), renderer: 'headless-disable-gpu', visualTime: FROZEN, captureProtocol: 3, expectedRequests: [...view.expectedRequests].sort() };
    const jpeg = await step('jpeg', () => page.screenshot({ type: 'jpeg', quality: 72, timeout: 60000 }));
    return { name: view.name, identity, errors, requests, responses, decoded, draws: current.draws, stable, pixels: current, jpeg };
  } finally { if (context) await step('close-context', () => context.close(), 30000); }
}
const server = spawnServer('node_modules/.bin/vite', ['--config', 'scripts/remote/viteNoWatch.config.ts', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], { stdio: 'ignore', env: { ...process.env, FLS_TELEMETRY: '0' } });
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt++) {
    if (server.exitCode !== null) throw new Error(`Vite exited: ${server.exitCode}`);
    try { ready = (await fetch(`http://127.0.0.1:${port}/`)).ok; } catch (error) { if (!(error instanceof TypeError)) throw error; }
    if (ready) break;
    await new Promise(done => setTimeout(done, 1000));
  }
  if (!ready) throw new Error('Vite did not become ready');
  const chromium = await loadChromium();
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  for (const view of views) {
    const first = await capture(browser, view, 'first');
    const second = await capture(browser, view, 'repeat');
    const repeat = compareRgba(first.pixels, second.pixels);
    if (!repeat.pass || JSON.stringify(first.identity) !== JSON.stringify(second.identity)) result.errors.push(`${view.name}: independent A/A repeat failed`);
    result.errors.push(...[...first.errors, ...second.errors].map(error => `${view.name}: ${error}`));
    writeFileSync(join(out, `${view.name}.png`), Buffer.from(first.pixels.png.split(',')[1], 'base64'));
    writeFileSync(join(out, `${view.name}.jpg`), first.jpeg);
    writeFileSync(join(out, 'repeat', `${view.name}.png`), Buffer.from(second.pixels.png.split(',')[1], 'base64'));
    writeFileSync(join(out, 'repeat', `${view.name}.jpg`), second.jpeg);
    const { pixels, jpeg, ...evidence } = first;
    result.views.push({ ...evidence, repeat, repeatErrors: second.errors, repeatRgbaSHA: hash(second.pixels.rgba), rgbaSHA: hash(pixels.rgba) });
    writeFileSync(join(out, 'captures.json'), `${JSON.stringify(result, null, 2)}\n`);
    progress({ view: view.name, phase: 'view-complete', repeatPass: repeat.pass, completed: result.views.length, total: views.length });
  }
  result.pass = result.errors.length === 0 && result.views.length === views.length;
} catch (error) { result.errors.push(String(error)); }
finally {
  try { if (browser) await phase('close-browser', () => browser.close(), 30000); }
  catch (error) { result.pass = false; result.errors.push(String(error)); }
  finally { server.kill(); writeFileSync(join(out, 'captures.json'), `${JSON.stringify(result, null, 2)}\n`); }
}
console.log(JSON.stringify({ pass: result.pass, views: result.views.length, errors: result.errors }));
process.exitCode = result.pass ? 0 : 1;

}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
