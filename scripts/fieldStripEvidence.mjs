// Field strip, yard prop and variant evidence (C1e). Runs against a Vite dev server of this checkout.
//   arable:   gate 1's scene, by real mouse and keyboard input only (the script reads the proof port, it never edits
//             state): on the C1d seed 2 zone scene (C1b natural snapshot + real-input cottages), paint an arable
//             rectangle outside the wall over the three outside wheat farms and the empty ground east of them (polygon
//             tool), run at 5x and pause as soon as the zone's strips show all four crop states, then save the state and log.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/fieldStripEvidence.mjs arable <outDir> --snapshot <state.json.gz> [--url ...]
//   captures: reopens saved states at exact zooms (walkers hidden): the arable scene at 1.0 / 0.6, house yards (croft
//             beds, hurdles, and the spots that want a gate / corner / half panel marked) at 1.0 / 0.6, and the earth
//             road v1 vs v3 on the 24-lot town (fixtures/determinism/seed1) at 1.0 / 0.6.
//   PLAYWRIGHT_MODULE=... node scripts/fieldStripEvidence.mjs captures <outDir> --arable <state.json.gz> --yard <state.json.gz> [--url ...]
//   seams:    gate 2, the colour step across every ridge / road v3 strip wrap and every joined a | b ridge join.
//   PLAYWRIGHT_MODULE=... node scripts/fieldStripEvidence.mjs seams <out.json> [--url ...]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { loadChromium, openScene, sceneStates } from './renderCommitProbe.mjs';

const [mode, target] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4213/';

/**
 * Arable rectangle (tile-centre coordinates of its corners): cells x 47..56, y 49..60, taller than wide, so the strips
 * run along y and each of the three outside farms (x 47, 49, 51; 2x2) lends its state to its own two strips, while
 * x 53..56 has no farm (fallow). The farms cycle through their production thirds at 5x.
 */
const ARABLE_POLYGON = [[46.5, 48.5], [56.5, 48.5], [56.5, 60.5], [46.5, 60.5]];

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
const ready = page => page.waitForFunction(() => {
  const d = window.__FEUDAL_PHASE10_PROOF__.diagnosis();
  return d.boundary?.assets.every(a => a.status === 'ready') && d.zones.assets.every(a => a.status === 'ready' || a.status === 'missing');
}, null, { timeout: 60_000 });

/** The arable strips' crop states, read through the engine's own read model (module import from the dev server). */
const stripStates = page => page.evaluate(async () => {
  const { arableStripStates } = await import('/src/zones/arableStrips.ts');
  const state = window.__FEUDAL_PHASE10_PROOF__.state();
  return (state.zones ?? []).filter(zone => zone.kind === 'arable').map(zone => {
    const layout = arableStripStates(zone, state);
    return { zone: zone.id, axis: layout.axis, strips: layout.strips.map(strip => ({ id: strip.id, state: strip.state, farm: strip.farmId, cells: strip.cells.length })) };
  });
});

async function arable(outDir) {
  await mkdir(outDir, { recursive: true });
  const raw = await readFile(flags.snapshot);
  const snapshot = JSON.parse(gunzipSync(raw).toString('utf8'));
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const { page } = await openScene(browser, { state: snapshot, tile: [51, 53], baseUrl: url, dpr: 1, zoom: 1, run: false });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const started = Date.now(); const log = [];
  const note = entry => { log.push({ atS: Math.round((Date.now() - started) / 1000), ...entry }); console.log(JSON.stringify(log.at(-1))); };
  const snap = () => page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.snapshot());
  note({ step: 'opened', tick: (await snap()).tick });

  // 1. Arable rectangle with the polygon tool: click the corners, double-click the last to close.
  await page.getByRole('button', { name: '구역', exact: true }).click();
  await page.locator('[data-zone-tool="arable"]').click();
  await page.getByRole('button', { name: '다각형' }).click();
  await panTo(page, 51.5, 54.5);
  for (const [index, corner] of ARABLE_POLYGON.entries()) {
    const p = await client(page, ...corner);
    if (index < ARABLE_POLYGON.length - 1) await page.mouse.click(p.clientX, p.clientY);
    else await page.mouse.dblclick(p.clientX, p.clientY);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(300);
  note({ step: 'arable polygon', zones: (await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().zones ?? [])).map(zone => ({ id: zone.id, kind: zone.kind, cells: zone.membership.length })) });
  await page.keyboard.press('Escape');

  // 2. Run at 5x until the strips show all four states, then pause.
  await page.getByRole('button', { name: '5배속', exact: true }).click();
  const deadline = Date.now() + 240_000;
  let seen = null;
  while (Date.now() < deadline) {
    const zones = await stripStates(page);
    const states = new Set(zones.flatMap(zone => zone.strips.map(strip => strip.state)));
    if (['ploughed', 'seedling', 'growing', 'fallow'].every(state => states.has(state))) {
      await page.getByRole('button', { name: '일시 정지', exact: true }).click();
      await page.waitForTimeout(300);
      seen = await stripStates(page);
      const after = new Set(seen.flatMap(zone => zone.strips.map(strip => strip.state)));
      if (['ploughed', 'seedling', 'growing', 'fallow'].every(state => after.has(state))) break;
      await page.getByRole('button', { name: '5배속', exact: true }).click();
      seen = null;
    }
    await page.waitForTimeout(120);
  }
  if (seen === null) { await page.getByRole('button', { name: '일시 정지', exact: true }).click(); seen = await stripStates(page); }
  note({ step: 'paused with the strips in these states', tick: (await snap()).tick, strips: seen });
  await panTo(page, 51.5, 54.5); await page.mouse.move(640, 790); await page.waitForTimeout(1_200);
  await writeFile(join(outDir, 'seed2-arable-scene.jpg'), await page.screenshot({ type: 'jpeg', quality: 80 }));
  const played = await page.evaluate(() => JSON.stringify(window.__FEUDAL_PHASE10_PROOF__.state()));
  await writeFile(join(outDir, 'seed2-arable-scene-state.json.gz'), gzipSync(played));
  await browser.close();
  await writeFile(join(outDir, 'scene-log.json'), `${JSON.stringify({ url, snapshot: flags.snapshot, input: 'real mouse and keyboard only', polygon: ARABLE_POLYGON, log, errors }, null, 2)}\n`);
}

/** Marks the listed tile points on the page (evidence overlay only, over the canvas; the game never sees it). */
async function markPoints(page, points) {
  const located = [];
  for (const point of points) located.push({ ...point, ...(await client(page, point.x, point.y)) });
  await page.evaluate(marks => {
    for (const mark of marks) {
      const dot = document.createElement('div');
      dot.className = 'evidence-mark';
      dot.textContent = mark.label;
      Object.assign(dot.style, { position: 'fixed', left: `${mark.clientX - 11}px`, top: `${mark.clientY - 11}px`, width: '22px', height: '22px',
        border: `3px solid ${mark.color}`, borderRadius: '50%', color: '#fff', font: 'bold 12px sans-serif', textAlign: 'center', lineHeight: '16px',
        textShadow: '0 0 3px #000', pointerEvents: 'none', zIndex: 9999 });
      document.body.appendChild(dot);
    }
  }, located);
}

async function captures(outDir) {
  await mkdir(outDir, { recursive: true });
  const load = async path => JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));
  const arableState = await load(flags.arable); const yardState = await load(flags.yard);
  const states = await sceneStates();
  const views = [
    { name: 'arable-z1.00', state: arableState, tile: [51.5, 54.5], zoom: 1, source: 'seed 2 arable scene (natural snapshot + C1d and C1e real-input play)' },
    { name: 'arable-z0.60', state: arableState, tile: [51.5, 54.5], zoom: 0.6, source: 'seed 2 arable scene (natural snapshot + C1d and C1e real-input play)' },
    { name: 'arable-z2.00-closeup', state: arableState, tile: [50.5, 51.5], zoom: 2, source: 'seed 2 arable scene', clip: { x: 240, y: 150, width: 800, height: 500 } },
    { name: 'yard-z1.00', state: yardState, tile: [37.5, 44], zoom: 1, source: 'seed 2 zone scene (C1d real-input cottages)', wants: true },
    { name: 'yard-z0.60', state: yardState, tile: [37.5, 44], zoom: 0.6, source: 'seed 2 zone scene (C1d real-input cottages)' },
    { name: 'yard-z2.00-closeup', state: yardState, tile: [37.5, 43.8], zoom: 2, source: 'seed 2 zone scene (C1d real-input cottages)', wants: true, clip: { x: 240, y: 120, width: 800, height: 520 } },
    ...['v1', 'v3'].flatMap(strip => [1, 0.6].map(zoom => ({ name: `road-${strip}-z${zoom.toFixed(2)}`, state: states.lots24, tile: [37, 31], zoom,
      query: `&road-strip=${strip}`, source: '24-lot town (fixtures/determinism/seed1 final state)' }))),
  ];
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const rows = [];
  for (const view of views) {
    const { context, page } = await openScene(browser, { state: { ...view.state, walkers: [] }, tile: view.tile, baseUrl: url, dpr: 1, zoom: view.zoom, run: false, query: view.query ?? '' });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await ready(page); await page.mouse.move(640, 790); await page.waitForTimeout(1_200);
    let wants = null;
    if (view.wants === true) {
      wants = await page.evaluate(async () => {
        const { groundBoundaryScene } = await import('/src/render/groundBoundaryScene.ts');
        return groundBoundaryScene(window.__FEUDAL_PHASE10_PROOF__.state()).yardProps.wants;
      });
      const colour = { gate: '#e0b030', corner: '#d04040', half: '#40a0e0' };
      await markPoints(page, wants.map(want => ({ x: want.at.x, y: want.at.y, label: want.kind[0].toUpperCase(), color: colour[want.kind] })));
    }
    const file = `${view.name}.jpg`;
    await writeFile(join(outDir, file), await page.screenshot({ type: 'jpeg', quality: 80, ...(view.clip === undefined ? {} : { clip: view.clip }) }));
    rows.push({ file, source: view.source, tile: view.tile, zoom: view.zoom, query: view.query ?? null, wants, errors });
    await context.close();
  }
  await browser.close();
  await writeFile(join(outDir, 'captures.json'), `${JSON.stringify({ url, walkers: 'hidden', marks: 'G gate (frontage) · C corner the set lacks · H half panel', rows }, null, 2)}\n`);
}

/**
 * Gate 2 seams, in the browser: for every ridge strip, the earth road v3 strips, and the joined a | b ridge canvases
 * the rows repeat, the colour step across each wrap / join (mean RGB difference between the two columns, opaque rows)
 * against the image's own column-to-column steps. A seam shows as a step above the image's own 95th percentile.
 */
async function seams(out) {
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const { page } = await openScene(browser, { state: null, tile: [32, 32], baseUrl: url, dpr: 1, zoom: 1, run: false });
  const rows = await page.evaluate(async () => {
    const { ZONE_ASSETS, ZONE_VARIANTS } = await import('/src/render/zoneAssetManifest.ts');
    const { BOUNDARY_ASSETS } = await import('/src/render/boundaryAssetManifest.ts');
    const { joinRidgeStripsForProof } = await import('/src/render/drawArableFields.ts');
    const load = src => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; });
    const measure = (source, width, height, joins) => {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const paint = canvas.getContext('2d'); paint.drawImage(source, 0, 0);
      const data = paint.getImageData(0, 0, width, height).data;
      const step = (x0, x1) => { let sum = 0; let n = 0;
        for (let y = 0; y < height; y += 1) { const a = (y * width + x0) * 4; const b = (y * width + x1) * 4;
          if (data[a + 3] < 200 || data[b + 3] < 200) continue; sum += (Math.abs(data[a] - data[b]) + Math.abs(data[a + 1] - data[b + 1]) + Math.abs(data[a + 2] - data[b + 2])) / 3; n += 1; }
        return n === 0 ? 0 : sum / n; };
      const interior = []; for (let x = 0; x < width - 1; x += 1) if (!joins.includes(x)) interior.push(step(x, x + 1));
      interior.sort((a, b) => a - b);
      const p95 = interior[Math.floor(interior.length * 0.95)]; const median = interior[Math.floor(interior.length / 2)];
      const at = joins.map(x => ({ x, step: Math.round(step(x, (x + 1) % width) * 10) / 10 }));
      return { median: Math.round(median * 10) / 10, p95: Math.round(p95 * 10) / 10, joins: at, seam: at.some(join => join.step > p95) };
    };
    const result = [];
    const ridgeKeys = Object.values(ZONE_VARIANTS.ridge).flat();
    for (const key of ridgeKeys) {
      const asset = ZONE_ASSETS.find(entry => entry.key === key);
      const image = await load(`/${asset.url}`);
      result.push({ piece: key, kind: 'wrap', ...measure(image, asset.width, asset.height, [asset.width - 1]) });
    }
    for (const asset of BOUNDARY_ASSETS.filter(entry => entry.key.endsWith('_v3'))) {
      const image = await load(`/${asset.url}`);
      result.push({ piece: asset.key, kind: 'wrap', ...measure(image, asset.width, asset.height, [asset.width - 1]) });
    }
    for (const [state, pair] of Object.entries(ZONE_VARIANTS.ridge)) {
      const images = [];
      for (const key of pair) images.push(await load(`/${ZONE_ASSETS.find(entry => entry.key === key).url}`));
      const joined = joinRidgeStripsForProof(images);
      result.push({ piece: `${state} a|b`, kind: 'joined pair', ...measure(joined, 1024, 64, [511, 1023]) });
    }
    return result;
  });
  await browser.close();
  const failing = rows.filter(row => row.seam);
  await writeFile(out, `${JSON.stringify({ url, metric: 'mean RGB step across the wrap / join vs the image own column steps (opaque rows)', seams: failing.length, rows }, null, 2)}\n`);
  console.log(JSON.stringify({ seams: failing.length, failing }, null, 1));
}

if (mode === 'arable') await arable(target);
else if (mode === 'seams') await seams(target);
else if (mode === 'captures') await captures(target);
else throw new Error('Usage: fieldStripEvidence.mjs arable <outDir> --snapshot <state.json.gz> | captures <outDir> --arable <s> --yard <s>');
