// Building ground evidence (C1d): yards, aprons, contact shadows and the zone brush friction fixes.
//   wedge: gate 1. For every on-screen building apron, the proof port lists the canvas pixels between the frontage
//          edge and the road ribbon's visible edge (every 1/32 tile along each frontage ray). The script reads those
//          pixels from the rendered canvas and counts grass-coloured ones (green channel above red by more than
//          GRASS_MARGIN), on the C25 board and the zoned board at zoom 0.6/1.0/1.35 x DPR 1/2, walkers hidden.
//          With --base <url> the same pixels are read from the baseline build (same state and camera) for the
//          before/after count.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/buildingGroundEvidence.mjs wedge <out.json> [--url ...] [--base ...]
//          [--snapshot state.json[.gz] --tile x,y]
//   scene: gate 1's third scene, by real mouse input only (the script reads the proof port, it never edits state): on
//          the C1b seed 2 natural snapshot, paint plots along the curved road outside the wall (the C1b plan stroke),
//          place four cottages on plot frontage cells, run at 5x until they stand, pause, then capture the scene and
//          run the wedge check (full frame and ground layer) on that page. Walkers stay (ground layer skips them).
//   PLAYWRIGHT_MODULE=... node scripts/buildingGroundEvidence.mjs scene <outDir> --snapshot <state.json.gz> --plan <plan.json> [--url ...]
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import { loadChromium, openScene, sceneStates } from './renderCommitProbe.mjs';

const [mode, target] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4200/';
/**
 * A pixel is grass when green exceeds red by more than GRASS_MARGIN and blue by more than GRASS_BLUE_MARGIN (road
 * earth and stone have red >= green; the blue excludes ultramarine map markers drawn over the ground).
 */
const GRASS_MARGIN = 3;
const GRASS_BLUE_MARGIN = 10;

const ready = page => page.waitForFunction(() => {
  const d = window.__FEUDAL_PHASE10_PROOF__.diagnosis();
  return d.boundary?.assets.every(a => a.status === 'ready') && d.zones.assets.every(a => a.status !== 'loading');
}, null, { timeout: 60_000 });

/** Reads the listed device pixels of the game canvas after two animation frames; returns the grass hits. */
const grassAt = (page, samples) => page.evaluate(([samples, margin, blueMargin]) => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => {
  const canvas = document.querySelector('canvas');
  const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  const hits = [];
  for (const sample of samples) {
    const at = (sample.y * canvas.width + sample.x) * 4;
    const [r, g, b] = [data[at], data[at + 1], data[at + 2]];
    if (g - r > margin && g - b > blueMargin) hits.push({ ...sample, rgb: [r, g, b] });
  }
  done(hits);
}))), [samples, GRASS_MARGIN, GRASS_BLUE_MARGIN]);

async function wedgeView(browser, state, tile, zoom, dpr, base) {
  const opened = await openScene(browser, { state, tile, baseUrl: url, dpr, zoom, run: false, query: '&render-boundary-v2=1' });
  await ready(opened.page); await opened.page.mouse.move(640, 790); await opened.page.waitForTimeout(1_200);
  const probe = await opened.page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.wedgeProbe());
  const hits = await grassAt(opened.page, probe.samples);
  await opened.page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.groundOnly(true));
  const groundHits = await grassAt(opened.page, probe.samples);
  await opened.context.close();
  let baseHits = null;
  if (base !== undefined) {
    const old = await openScene(browser, { state, tile, baseUrl: base, dpr, zoom, run: false, query: '&render-boundary-v2=1' });
    await old.page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().boundary?.assets.every(a => a.status === 'ready'), null, { timeout: 60_000 });
    await old.page.mouse.move(640, 790); await old.page.waitForTimeout(1_200);
    baseHits = await grassAt(old.page, probe.samples);
    await old.context.close();
  }
  // A frame hit over ground that is not grass is a sprite drawn on top (field crops, a tree), not a ground wedge.
  const groundKeys = new Set(groundHits.map(hit => `${hit.x},${hit.y}`));
  const spriteHits = hits.filter(hit => !groundKeys.has(`${hit.x},${hit.y}`));
  const byBuilding = list => { const counts = {}; for (const hit of list) counts[hit.building] = (counts[hit.building] ?? 0) + 1; return counts; };
  return { aprons: probe.aprons, rays: probe.rays, raysWithoutRibbon: probe.raysWithoutRibbon, raysBeyondTarget: probe.raysBeyondTarget,
    pixels: probe.samples.length,
    // Ground layer alone (object pass skipped): what the yards, aprons and ribbons leave between house and road.
    groundGrassPixels: groundHits.length, groundGrassByBuilding: byBuilding(groundHits), groundHits: groundHits.slice(0, 12),
    // Full frame as the player sees it: sprites drawn over the same pixels (baked lawns in house art, field crops) count here.
    grassPixels: hits.length, grassByBuilding: byBuilding(hits), firstHits: hits.slice(0, 12), frameHitsOverNonGrassGround: spriteHits.length,
    ...(baseHits === null ? {} : { baselineGrassPixels: baseHits.length }) };
}

async function wedge(out) {
  const chromium = await loadChromium(); const states = await sceneStates();
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  const scenes = [['c25', states.seed2, [44, 38]], ['c25-zoned', states.c25zoned, [44, 38]]];
  if (flags.snapshot !== undefined) {
    const raw = await readFile(flags.snapshot);
    const snapshot = JSON.parse((flags.snapshot.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8'));
    scenes.push(['seed2-natural-zoned', snapshot, (flags.tile ?? '47,41').split(',').map(Number)]);
  }
  const rows = [];
  for (const [name, state, tile] of scenes) for (const zoom of [0.6, 1, 1.35]) for (const dpr of [1, 2]) {
    const row = { scene: name, view: `z${zoom.toFixed(2)}-dpr${dpr}`, ...(await wedgeView(browser, { ...state, walkers: [] }, tile, zoom, dpr, flags.base)) };
    rows.push(row);
    console.log(JSON.stringify({ scene: row.scene, view: row.view, aprons: row.aprons, pixels: row.pixels, ground: row.groundGrassPixels, frame: row.grassPixels, baseline: row.baselineGrassPixels ?? null }));
  }
  await browser.close();
  const total = { ground: rows.reduce((sum, row) => sum + row.groundGrassPixels, 0), frame: rows.reduce((sum, row) => sum + row.grassPixels, 0),
    baselineFrame: rows.reduce((sum, row) => sum + (row.baselineGrassPixels ?? 0), 0) };
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify({ url, base: flags.base ?? null, raster: 'software (--disable-gpu)', grassMargin: GRASS_MARGIN, grassBlueMargin: GRASS_BLUE_MARGIN, walkers: 'hidden', totalGrassPixels: total, rows }, null, 2)}\n`);
}

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
/** Cottages to place: plot frontage cells along the curved road where a house may go (planned in Node from the same stroke). */
const COTTAGES = [[46, 49], [38, 44], [37, 43], [37, 41]];

async function scene(outDir) {
  await mkdir(outDir, { recursive: true });
  const raw = await readFile(flags.snapshot);
  const snapshot = JSON.parse((flags.snapshot.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8'));
  const plan = JSON.parse(await readFile(flags.plan, 'utf8'));
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const { page } = await openScene(browser, { state: snapshot, tile: plan.camera, baseUrl: url, dpr: 1, zoom: 1.2, run: false });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const started = Date.now(); const log = [];
  const note = entry => { log.push({ atS: Math.round((Date.now() - started) / 1000), ...entry }); console.log(JSON.stringify(log.at(-1))); };
  const houseAt = async ([tx, ty]) => page.evaluate(([tx, ty]) => window.__FEUDAL_PHASE10_PROOF__.snapshot().buildings.some(b => b.kind === 'house' && b.tx === tx && b.ty === ty), [tx, ty]);
  await page.getByRole('button', { name: '구역', exact: true }).click();
  await page.locator('[data-zone-tool="burgage"]').click();
  await panTo(page, ...plan.camera);
  let p = await client(page, ...plan.plotStroke[0]); await page.mouse.move(p.clientX, p.clientY); await page.mouse.down();
  for (const q of plan.plotStroke.slice(1)) { p = await client(page, ...q); await page.mouse.move(p.clientX, p.clientY, { steps: 4 }); }
  await page.mouse.up(); await page.waitForTimeout(300);
  note({ step: 'plots painted', zones: await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().zones) });
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '주택', exact: true }).click();
  await page.getByRole('button', { name: '오두막', exact: true }).first().click();
  for (const cell of COTTAGES) {
    await panTo(page, ...cell);
    const before = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.snapshot().constructionSites.length);
    p = await client(page, ...cell); await page.mouse.move(p.clientX, p.clientY); await page.waitForTimeout(150);
    await page.mouse.click(p.clientX, p.clientY); await page.waitForTimeout(250);
    note({ step: `cottage at ${cell}`, sitesAdded: (await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.snapshot().constructionSites.length)) - before });
  }
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '5배속', exact: true }).click();
  const deadline = Date.now() + 300_000;
  let standing = [];
  while (Date.now() < deadline) {
    standing = []; for (const cell of COTTAGES) if (await houseAt(cell)) standing.push(cell);
    if (standing.length === COTTAGES.length) break;
    await page.waitForTimeout(2_000);
  }
  await page.getByRole('button', { name: '일시 정지', exact: true }).click();
  note({ step: 'ran at 5x until the cottages stood', standing, tick: await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.snapshot().tick) });
  await panTo(page, 41, 45);
  await page.mouse.move(640, 790); await page.waitForTimeout(1_500);
  await writeFile(join(outDir, 'seed2-zone-scene.jpg'), await page.screenshot({ type: 'jpeg', quality: 80 }));
  const probe = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.wedgeProbe());
  const frameHits = await grassAt(page, probe.samples);
  await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.groundOnly(true));
  const groundHits = await grassAt(page, probe.samples);
  await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.groundOnly(false));
  const cottageIds = await page.evaluate(cells => window.__FEUDAL_PHASE10_PROOF__.snapshot().buildings.filter(b => cells.some(([x, y]) => b.tx === x && b.ty === y)).map(b => b.id), COTTAGES);
  const wedge = { aprons: probe.aprons, rays: probe.rays, raysWithoutRibbon: probe.raysWithoutRibbon, raysBeyondTarget: probe.raysBeyondTarget, pixels: probe.samples.length,
    cottagePixels: probe.samples.filter(sample => cottageIds.includes(sample.building)).length,
    groundGrassPixels: groundHits.length, frameGrassPixels: frameHits.length, groundHits: groundHits.slice(0, 12), frameHits: frameHits.slice(0, 12) };
  note({ step: 'wedge check on this page', ...wedge, groundHits: undefined, frameHits: undefined });
  const played = await page.evaluate(() => JSON.stringify(window.__FEUDAL_PHASE10_PROOF__.state()));
  await writeFile(join(outDir, 'seed2-zone-scene-state.json.gz'), gzipSync(played));
  await browser.close();
  await writeFile(join(outDir, 'scene-log.json'), `${JSON.stringify({ url, snapshot: flags.snapshot, input: 'real mouse and keyboard only', cottages: COTTAGES, cottageIds, wedge, log, errors }, null, 2)}\n`);
}

/** House-road junction close-ups, before (--base build) and after, same state and camera, walkers hidden. */
async function captures(outDir) {
  await mkdir(outDir, { recursive: true });
  const states = await sceneStates();
  const raw = await readFile(flags.state);
  const played = JSON.parse(gunzipSync(raw).toString('utf8'));
  const views = [
    { name: '01-stone-lane-houses', state: states.seed2, tile: [45, 38], zoom: 2, source: 'C25 board (seed 2 final, fixture)' },
    { name: '02-diagonal-road-facilities', state: states.seed2, tile: [41.5, 36.5], zoom: 2, source: 'C25 board (seed 2 final, fixture)' },
    { name: '03-earth-corner-cottages', state: played, tile: [38.2, 43.6], zoom: 2, source: 'seed 2 zone scene (natural snapshot + real-input play)' },
    { name: '04-earth-road-cottage', state: played, tile: [46.2, 48.6], zoom: 2, source: 'seed 2 zone scene (natural snapshot + real-input play)' },
    { name: '05-seed2-zone-scene', state: played, tile: [41, 45], zoom: 1.2, source: 'seed 2 zone scene (natural snapshot + real-input play)', full: true },
  ];
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const rows = [];
  for (const view of views) {
    for (const [label, base] of [['before', flags.base], ['after', url]]) {
      const { context, page } = await openScene(browser, { state: { ...view.state, walkers: [] }, tile: view.tile, baseUrl: base, dpr: 1, zoom: view.zoom, run: false });
      await page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().boundary?.assets.every(a => a.status === 'ready'), null, { timeout: 60_000 });
      await page.mouse.move(640, 790); await page.waitForTimeout(1_200);
      const file = `${view.name}-${label}.jpg`;
      const clip = view.full === true ? undefined : { x: 400, y: 250, width: 480, height: 300 };
      await writeFile(join(outDir, file), await page.screenshot({ type: 'jpeg', quality: 80, ...(clip === undefined ? {} : { clip }) }));
      rows.push({ file, source: view.source, tile: view.tile, zoom: view.zoom, build: base });
      await context.close();
    }
  }
  await browser.close();
  await writeFile(join(outDir, 'captures.json'), `${JSON.stringify({ walkers: 'hidden', rows }, null, 2)}\n`);
}

/**
 * Zone brush controls (gate 4) by real input on the C25 board fixture: the wheel zooms with a zone tool armed (brush
 * radius unchanged), hover shows only the cursor ring (no prediction text), a drag shows cells and text, an arable
 * stroke away from roads hatches and counts its cells without road access, and a stroke over the wall is red only
 * inside it.
 */
async function controls(outDir) {
  await mkdir(outDir, { recursive: true });
  const states = await sceneStates();
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const { page } = await openScene(browser, { state: states.seed2, tile: [36, 42], baseUrl: url, dpr: 1, zoom: 1, run: false });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const prediction = () => page.evaluate(() => [...document.querySelectorAll('.prediction-panel, [class*="prediction"]')].map(node => node.textContent?.trim()).filter(Boolean).join(' | '));
  const radius = () => page.evaluate(() => document.querySelector('.zone-radius [aria-pressed="true"]')?.textContent ?? null);
  const zoom = () => page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().camera.zoom);
  const log = [];
  const shot = async name => { await page.waitForTimeout(300); await writeFile(join(outDir, `${name}.jpg`), await page.screenshot({ type: 'jpeg', quality: 78 })); return `${name}.jpg`; };
  await page.getByRole('button', { name: '구역', exact: true }).click();
  await page.locator('[data-zone-tool="burgage"]').click();
  let p = await client(page, 36, 42); await page.mouse.move(p.clientX, p.clientY); await page.waitForTimeout(300);
  const zoomBefore = await zoom(); const radiusBefore = await radius();
  await page.mouse.wheel(0, -240); await page.waitForTimeout(400);
  log.push({ step: 'wheel with the plot tool armed', zoomBefore, zoomAfter: await zoom(), radiusBefore, radiusAfter: await radius() });
  await page.keyboard.press('BracketRight'); await page.waitForTimeout(150);
  log.push({ step: '] key', radiusAfter: await radius() });
  p = await client(page, 36, 42); await page.mouse.move(p.clientX, p.clientY); await page.waitForTimeout(300);
  log.push({ step: 'hover only', prediction: await prediction(), capture: await shot('c1-hover-ring-only') });
  await page.mouse.down();
  for (const [x, y] of [[36.5, 42.5], [37, 43.5], [37.5, 44.5]]) { p = await client(page, x, y); await page.mouse.move(p.clientX, p.clientY, { steps: 4 }); }
  log.push({ step: 'dragging', prediction: await prediction(), capture: await shot('c2-drag-preview') });
  await page.keyboard.press('Escape'); await page.mouse.up();
  await page.getByRole('button', { name: '구역', exact: true }).click();
  await page.locator('[data-zone-tool="arable"]').click();
  p = await client(page, 29, 45); await page.mouse.move(p.clientX, p.clientY); await page.mouse.down();
  for (const [x, y] of [[30, 45.5], [31, 46], [32, 46.5]]) { p = await client(page, x, y); await page.mouse.move(p.clientX, p.clientY, { steps: 4 }); }
  log.push({ step: 'arable stroke away from roads', prediction: await prediction(), capture: await shot('c3-arable-no-road-access') });
  await page.keyboard.press('Escape'); await page.mouse.up();
  if (await page.locator('[data-zone-tool="arable"][aria-pressed="true"]').count() === 0) {
    await page.getByRole('button', { name: '구역', exact: true }).click();
    await page.locator('[data-zone-tool="arable"]').click();
  }
  // Row ty = 40 is outside the wall up to tx = 37 and inside from tx = 38: the stroke starts outside, ends inside.
  p = await client(page, 34.5, 40); await page.mouse.move(p.clientX, p.clientY); await page.mouse.down();
  for (const [x, y] of [[36, 40], [37.5, 40], [39, 40]]) { p = await client(page, x, y); await page.mouse.move(p.clientX, p.clientY, { steps: 4 }); }
  log.push({ step: 'arable stroke over the wall', prediction: await prediction(), capture: await shot('c4-arable-over-wall') });
  await page.keyboard.press('Escape'); await page.mouse.up();
  await browser.close();
  await writeFile(join(outDir, 'controls-log.json'), `${JSON.stringify({ url, state: 'C25 board fixture (seed 2 final)', input: 'real mouse and keyboard', log, errors }, null, 2)}\n`);
  console.log(JSON.stringify(log, null, 1));
}

if (mode === 'wedge') await wedge(target);
else if (mode === 'captures') await captures(target);
else if (mode === 'controls') await controls(target);
else if (mode === 'scene') await scene(target);
else throw new Error('Usage: buildingGroundEvidence.mjs wedge <out.json> [--url ...] [--base ...] [--snapshot state.json[.gz] --tile x,y] | scene <outDir> --snapshot <s> --plan <p>');
void createHash;
