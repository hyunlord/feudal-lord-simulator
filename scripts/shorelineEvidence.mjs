// Shoreline evidence (D3a). Runs against Vite dev servers of this checkout (--url) and of the baseline (--base).
//   bridges:  gate 3's scenes, by real mouse input only (the script reads the proof port, it never edits state): the
//             road tool dragged across water builds bridges, on the seed 2 natural chain (C1e arable scene state: the
//             west water, a y bridge) and on the 24-lot town fixture (the river: an x and a y bridge). Saves both states.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/shorelineEvidence.mjs bridges <outDir> --seed2 <state.json.gz> [--url ...]
//   captures: before (--base) / after (--url) at zoom 1.0 and 0.6, walkers hidden: the seed 2 lake (fixture), the seed 2
//             bridge and the 24-lot river with its bridges (saved bridge states), plus 2x close-ups of the bridge ends.
//   PLAYWRIGHT_MODULE=... node scripts/shorelineEvidence.mjs captures <outDir> --seed2Bridge <s> --riverBridges <s> --base <url> [--url ...]
//   flag:     gate 5, curved ground off (`render-boundary-v2=0`): canvas SHA-256 of the same views in both builds must match.
//   PLAYWRIGHT_MODULE=... node scripts/shorelineEvidence.mjs flag <out.json> --seed2Bridge <s> --riverBridges <s> --base <url> [--url ...]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { loadChromium, openScene, sceneStates } from './renderCommitProbe.mjs';

const [mode, target] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4213/';

const client = (page, tx, ty) => page.evaluate(([tx, ty]) => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint({ tx, ty }), [tx, ty]);
async function panTo(page, tx, ty) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const p = await client(page, tx, ty);
    if (p.clientX > 300 && p.clientX < 980 && p.clientY > 220 && p.clientY < 520) return;
    const dx = Math.max(-480, Math.min(480, p.clientX - 640)); const dy = Math.max(-260, Math.min(260, p.clientY - 380));
    await page.mouse.move(640, 380); await page.mouse.down({ button: 'middle' });
    await page.mouse.move(640 - dx, 380 - dy, { steps: 8 }); await page.mouse.up({ button: 'middle' });
    await page.waitForTimeout(150);
  }
}
const load = async path => JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));
const ready = page => page.waitForFunction(() => {
  const d = window.__FEUDAL_PHASE10_PROOF__.diagnosis();
  return d.boundary === undefined || d.boundary === null || d.boundary.assets.every(a => a.status === 'ready');
}, null, { timeout: 60_000 }).then(() => page.waitForTimeout(1_500));

/** Road tool drag from one bank to the other; returns the bridge tiles the state now has. */
async function dragRoad(page, from, to) {
  await page.getByRole('button', { name: '도로', exact: true }).click();
  await panTo(page, (from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
  let p = await client(page, ...from); await page.mouse.move(p.clientX, p.clientY); await page.mouse.down();
  p = await client(page, ...to); await page.mouse.move(p.clientX, p.clientY, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  return page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().tiles.filter(t => t.terrain === 'water' && t.hasRoad).map(t => [t.tx, t.ty]));
}

async function bridges(outDir) {
  await mkdir(outDir, { recursive: true });
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const states = await sceneStates();
  const plans = [
    { name: 'seed2-bridge', state: await load(flags.seed2), source: 'C1e seed 2 arable scene (C1b natural snapshot + C1d / C1e real-input play)', roads: [[[5, 44], [5, 48]]] },
    { name: 'river-bridges', state: states.lots24, source: '24-lot town fixture (fixtures/determinism/seed1 final state)', roads: [[[22, 8], [26, 8]], [[17, 3], [17, 7]]] },
  ];
  const log = [];
  for (const plan of plans) {
    const { context, page } = await openScene(browser, { state: plan.state, tile: plan.roads[0][0], baseUrl: url, dpr: 1, zoom: 1, run: false });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const timberBefore = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().treasuryTimber);
    const steps = [];
    for (const [from, to] of plan.roads) steps.push({ drag: [from, to], bridgeTiles: await dragRoad(page, from, to) });
    const played = await page.evaluate(() => JSON.stringify(window.__FEUDAL_PHASE10_PROOF__.state()));
    await writeFile(join(outDir, `${plan.name}-state.json.gz`), gzipSync(played));
    log.push({ scene: plan.name, source: plan.source, input: 'real mouse input (road tool drag)', timberBefore,
      timberAfter: await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().treasuryTimber), steps, errors });
    console.log(JSON.stringify(log.at(-1)));
    await context.close();
  }
  await browser.close();
  await writeFile(join(outDir, 'bridges-log.json'), `${JSON.stringify({ url, log }, null, 2)}\n`);
}

function views(states, seed2Bridge, riverBridges) {
  return [
    ...[1, 0.6].map(zoom => ({ name: `seed2-lake-z${zoom.toFixed(2)}`, state: states.seed2, tile: [50, 42], zoom, source: 'seed 2 final (fixture)' })),
    ...[1, 0.6].map(zoom => ({ name: `seed2-bridge-z${zoom.toFixed(2)}`, state: seed2Bridge, tile: [5, 46], zoom, source: 'seed 2 bridge (real-input road across the west water)' })),
    ...[1, 0.6].map(zoom => ({ name: `river-z${zoom.toFixed(2)}`, state: riverBridges, tile: [22, 7], zoom, source: '24-lot town river with two real-input bridges' })),
    { name: 'seed2-bridge-z2.00-closeup', state: seed2Bridge, tile: [5, 46], zoom: 2, clip: { x: 340, y: 150, width: 600, height: 500 }, source: 'seed 2 bridge' },
    { name: 'river-x-bridge-z2.00-closeup', state: riverBridges, tile: [24, 8], zoom: 2, clip: { x: 290, y: 200, width: 700, height: 400 }, source: '24-lot river x bridge' },
    { name: 'river-y-bridge-z2.00-closeup', state: riverBridges, tile: [17, 5], zoom: 2, clip: { x: 390, y: 150, width: 500, height: 500 }, source: '24-lot river y bridge' },
  ];
}

async function captures(outDir) {
  await mkdir(outDir, { recursive: true });
  const states = await sceneStates();
  const list = views(states, await load(flags.seed2Bridge), await load(flags.riverBridges));
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const rows = [];
  for (const view of list) {
    for (const [label, base] of [['before', flags.base], ['after', url]]) {
      const { context, page } = await openScene(browser, { state: { ...view.state, walkers: [] }, tile: view.tile, baseUrl: base, dpr: 1, zoom: view.zoom, run: false });
      await ready(page); await page.mouse.move(640, 790); await page.waitForTimeout(600);
      const file = `${view.name}-${label}.jpg`;
      await writeFile(join(outDir, file), await page.screenshot({ type: 'jpeg', quality: 78, ...(view.clip === undefined ? {} : { clip: view.clip }) }));
      rows.push({ file, source: view.source, tile: view.tile, zoom: view.zoom, build: base });
      await context.close();
    }
  }
  await browser.close();
  await writeFile(join(outDir, 'captures.json'), `${JSON.stringify({ walkers: 'hidden', rows }, null, 2)}\n`);
}

/** Gate 5: with the flag off, the frame is byte-identical between the baseline and this build (software raster). */
async function flag(out) {
  const states = await sceneStates();
  const list = views(states, await load(flags.seed2Bridge), await load(flags.riverBridges)).filter(view => view.clip === undefined);
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  const shaOf = async (base, view, dpr) => {
    const { context, page } = await openScene(browser, { state: { ...view.state, walkers: [] }, tile: view.tile, baseUrl: base, dpr, zoom: view.zoom, run: false, query: '&render-boundary-v2=0' });
    await page.waitForTimeout(2_500); await page.mouse.move(640, 790); await page.waitForTimeout(800);
    const sha = await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => {
      const canvas = document.querySelector('canvas');
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let h = 2166136261; for (let i = 0; i < data.length; i += 1) { h ^= data[i]; h = Math.imul(h, 16777619) >>> 0; }
      done(`${canvas.width}x${canvas.height}:${h.toString(16)}`);
    }))));
    const v2 = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().boundary?.enabled ?? null);
    await context.close();
    return { sha, v2 };
  };
  const rows = [];
  for (const view of list) for (const dpr of [1, 2]) {
    const before = await shaOf(flags.base, view, dpr); const after = await shaOf(url, view, dpr);
    rows.push({ view: view.name, dpr, before: before.sha, after: after.sha, flagOn: [before.v2, after.v2], identical: before.sha === after.sha });
    console.log(JSON.stringify(rows.at(-1)));
  }
  await browser.close();
  await writeFile(out, `${JSON.stringify({ url, base: flags.base, query: 'render-boundary-v2=0', raster: 'software (--disable-gpu)', hash: 'FNV-1a over canvas RGBA', identical: rows.filter(row => row.identical).length, of: rows.length, rows }, null, 2)}\n`);
}

if (mode === 'bridges') await bridges(target);
else if (mode === 'captures') await captures(target);
else if (mode === 'flag') await flag(target);
else throw new Error('Usage: shorelineEvidence.mjs bridges <outDir> --seed2 <s> | captures <outDir> --seed2Bridge <s> --riverBridges <s> --base <url> | flag <out.json> ...');
