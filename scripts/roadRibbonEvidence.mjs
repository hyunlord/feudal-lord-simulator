// Road ribbon evidence (D1a-2): JPEG captures for the width and strip decisions, before/after close-ups of a
// junction, a bridge and gates (before = the D1a trunk served separately), and the C25 board browser SHAs.
// The simulation never starts, so every capture draws the fixture's own tick.
//   PLAYWRIGHT_MODULE=/abs/path/playwright-core/index.mjs node scripts/roadRibbonEvidence.mjs captures <outDir> \
//     [--url http://127.0.0.1:4196/] [--before-url http://127.0.0.1:4197/]
//   PLAYWRIGHT_MODULE=... node scripts/roadRibbonEvidence.mjs c25 <out.json> [--url ...]
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadChromium, openScene, sceneStates } from './renderCommitProbe.mjs';

const [mode, target] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4196/';
const beforeUrl = flags['before-url'] ?? null;
const C25 = { city: 'seed2', tile: [44, 38] };
const CLOSE_UPS = [
  { name: 'junction-t', city: 'fixed12', tile: [39, 57] },
  { name: 'bridge', city: 'fixed12', tile: [45, 53] },
  { name: 'junction-town', city: 'lots24', tile: [46, 34] },
  { name: 'gate-seed3', city: 'seed3', tile: [24, 18] },
  { name: 'gate-seed4', city: 'seed4', tile: [7, 34] },
];

async function open(browser, states, scene, { zoom, dpr = 1, query = '', base = url }) {
  const opened = await openScene(browser, { state: states[scene.city], tile: scene.tile, baseUrl: base, dpr, zoom, run: false,
    query: `&render-boundary-v2=1${query}` });
  await opened.page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().assets.every(asset => asset.status !== 'loading' && asset.status !== 'idle'), null, { timeout: 60_000 });
  await opened.page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().boundary?.assets.every(asset => asset.status === 'ready'), null, { timeout: 60_000 });
  await opened.page.waitForTimeout(1_000);
  return opened;
}
const canvasData = (page, type = 'image/png', quality = undefined) => page.evaluate(({ type, quality }) => new Promise(done =>
  requestAnimationFrame(() => requestAnimationFrame(() => done(document.querySelector('canvas').toDataURL(type, quality))))), { type, quality });
const bytes = dataUrl => Buffer.from(dataUrl.split(',')[1], 'base64');
const sha = buffer => createHash('sha256').update(buffer).digest('hex');
/** Centre crop (CSS px) as JPEG, via an offscreen canvas in the page. */
const cropData = (page, width, height, quality) => page.evaluate(({ width, height, quality }) => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => {
  const source = document.querySelector('canvas'); const ratio = source.width / source.clientWidth;
  const out = document.createElement('canvas'); out.width = width * ratio; out.height = height * ratio;
  out.getContext('2d').drawImage(source, (source.width - out.width) / 2, (source.height - out.height) / 2, out.width, out.height, 0, 0, out.width, out.height);
  done(out.toDataURL('image/jpeg', quality));
}))), { width, height, quality });

async function captures(outDir) {
  await mkdir(outDir, { recursive: true });
  const chromium = await loadChromium(); const states = await sceneStates();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const rows = [];
  const shot = async (file, scene, options, crop = null) => {
    const { context, page } = await open(browser, states, scene, options);
    const jpeg = bytes(crop === null ? await canvasData(page, 'image/jpeg', 0.8) : await cropData(page, crop[0], crop[1], 0.85));
    await writeFile(join(outDir, file), jpeg);
    rows.push({ file, bytes: jpeg.length, scene, zoom: options.zoom, dpr: options.dpr ?? 1, query: options.query ?? '', server: options.base ?? url });
    console.log(JSON.stringify(rows.at(-1)));
    await context.close();
  };
  const lots24 = { city: 'lots24', tile: [45, 37] }; const fixed12 = { city: 'fixed12', tile: [42, 56] };
  // Width decision: 24 lots at 0.55 / 0.65 / 0.75.
  for (const width of ['0.55', '0.65', '0.75']) await shot(`width-${width}-lots24-z1.0.jpg`, lots24, { zoom: 1, query: `&road-ribbon-width=${width}` });
  // Strip decision: v1 against v2 (a/b alternating), 24 lots and the fixed scene, zoom 1.0 and 0.6.
  for (const scene of [['lots24', lots24], ['fixed12', fixed12]]) for (const zoom of [1, 0.6]) for (const strip of ['v1', 'v2']) {
    await shot(`strip-${strip}-${scene[0]}-z${zoom.toFixed(1)}.jpg`, scene[1], { zoom, query: `&road-strip=${strip}` });
  }
  // Before (D1a trunk) / after close-ups, DPR 2, zoom 1.35, 440x280 CSS px.
  for (const scene of CLOSE_UPS) {
    if (beforeUrl !== null) await shot(`closeup-${scene.name}-before.jpg`, scene, { zoom: 1.35, dpr: 2, base: beforeUrl }, [440, 280]);
    await shot(`closeup-${scene.name}-after.jpg`, scene, { zoom: 1.35, dpr: 2 }, [440, 280]);
  }
  // Earth <-> stone blend at a gate (seed 3), zoom 2 would be clearer but 1.35 is the game's maximum.
  await shot('c25-board-z1.0.jpg', C25, { zoom: 1 });
  await browser.close();
  await writeFile(join(outDir, 'captures.json'), `${JSON.stringify({ url, beforeUrl, note: 'fixture states, simulation not started (준비 상태)', rows }, null, 2)}\n`);
}

async function c25(out) {
  const chromium = await loadChromium(); const states = await sceneStates();
  // Software raster: GPU rasterization is not bit-stable between two draws of the same canvas (B11 road-fix-pixels).
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  const rows = [];
  for (const zoom of [0.6, 1, 1.35]) for (const dpr of [1, 2]) {
    const shas = [];
    for (let run = 0; run < 2; run += 1) {
      const { context, page } = await open(browser, states, C25, { zoom, dpr });
      shas.push(sha(bytes(await canvasData(page))));
      await context.close();
    }
    rows.push({ view: `z${zoom.toFixed(2)}-dpr${dpr}`, sha256: shas[0], secondPage: shas[1], identical: shas[0] === shas[1] });
    console.log(JSON.stringify(rows.at(-1)));
  }
  await browser.close();
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify({ url, board: C25, raster: 'software (--disable-gpu)', rows }, null, 2)}\n`);
}

if (mode === 'captures') await captures(target);
else if (mode === 'c25') await c25(target);
else throw new Error('Usage: roadRibbonEvidence.mjs captures <outDir> | c25 <out.json>');
