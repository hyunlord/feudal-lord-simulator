// Curved-ground evidence (D1a): JPEG captures with RENDER_BOUNDARY_V2 off/on at zoom 1.0 and 0.6, and the browser
// determinism check (same state drawn twice, the second time from a scene rebuilt from tiles in reverse order).
// The simulation never starts, so every capture draws the fixture's own tick.
//   PLAYWRIGHT_MODULE=/abs/path/playwright-core/index.mjs node scripts/boundaryEvidence.mjs capture <outDir> [--url http://127.0.0.1:4195/]
//   PLAYWRIGHT_MODULE=... node scripts/boundaryEvidence.mjs determinism <out.json> [--url ...]
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadChromium, openScene, sceneStates } from './renderCommitProbe.mjs';

const [mode, target] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4195/';
export const EVIDENCE_SCENES = [
  { name: 'fixed12', city: 'fixed12', tile: [42, 56] },
  { name: 'seed2-town', city: 'seed2', tile: [47, 32] },
];

async function open(browser, states, scene, { flag, zoom, dpr = 1 }) {
  const opened = await openScene(browser, { state: states[scene.city], tile: scene.tile, baseUrl: url, dpr, zoom, run: false,
    query: `&render-boundary-v2=${flag ? 1 : 0}` });
  await opened.page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().assets.every(asset => asset.status !== 'loading' && asset.status !== 'idle'), null, { timeout: 60_000 });
  if (flag) await opened.page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().boundary?.assets.every(asset => asset.status === 'ready'), null, { timeout: 60_000 });
  await opened.page.waitForTimeout(1_000);
  return opened;
}

const canvasData = (page, type = 'image/png', quality = undefined) => page.evaluate(({ type, quality }) => new Promise(done =>
  requestAnimationFrame(() => requestAnimationFrame(() => done(document.querySelector('canvas').toDataURL(type, quality))))), { type, quality });
const bytes = dataUrl => Buffer.from(dataUrl.split(',')[1], 'base64');
const sha = buffer => createHash('sha256').update(buffer).digest('hex');

async function capture(outDir) {
  await mkdir(outDir, { recursive: true });
  const chromium = await loadChromium(); const states = await sceneStates();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const rows = [];
  for (const scene of EVIDENCE_SCENES) for (const zoom of [1, 0.6]) for (const flag of [false, true]) {
    const { context, page } = await open(browser, states, scene, { flag, zoom });
    const file = `${scene.name}-z${zoom.toFixed(1)}-${flag ? 'on' : 'off'}.jpg`;
    const jpeg = bytes(await canvasData(page, 'image/jpeg', 0.82));
    await writeFile(join(outDir, file), jpeg);
    const boundary = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().boundary);
    rows.push({ file, bytes: jpeg.length, chunks: boundary?.chunks ?? null, scene: boundary?.scene ?? null });
    console.log(JSON.stringify(rows.at(-1)));
    await context.close();
  }
  await browser.close();
  await writeFile(join(outDir, 'captures.json'), `${JSON.stringify({ url, note: 'fixture states, simulation not started (준비 상태)', rows }, null, 2)}\n`);
}

async function determinism(out) {
  const chromium = await loadChromium(); const states = await sceneStates();
  // Software raster: GPU rasterization is not bit-stable between two draws of the same canvas (B11 road-fix-pixels).
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  const rows = [];
  for (const scene of EVIDENCE_SCENES) for (const dpr of [1, 2]) {
    const first = await open(browser, states, scene, { flag: true, zoom: 1, dpr });
    const forward = sha(bytes(await canvasData(first.page)));
    await first.page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.resetBoundary(true));
    await first.page.waitForTimeout(500);
    const reversed = sha(bytes(await canvasData(first.page)));
    const rebuilt = await first.page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().boundary);
    await first.page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.resetBoundary(false));
    await first.context.close();
    const second = await open(browser, states, scene, { flag: true, zoom: 1, dpr });
    const reload = sha(bytes(await canvasData(second.page)));
    await second.context.close();
    rows.push({ scene: scene.name, dpr, forward, reversedInput: reversed, secondPage: reload,
      identical: forward === reversed && forward === reload, sceneBuildsAfterReverse: rebuilt?.scene?.builds ?? null });
    console.log(JSON.stringify(rows.at(-1)));
  }
  await browser.close();
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify({ url, raster: 'software (--disable-gpu)', rows }, null, 2)}\n`);
}

if (mode === 'capture') await capture(target);
else if (mode === 'determinism') await determinism(target);
else throw new Error('Usage: boundaryEvidence.mjs capture <outDir> | determinism <out.json>');
