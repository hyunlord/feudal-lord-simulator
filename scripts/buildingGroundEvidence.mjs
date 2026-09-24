// Building ground evidence (C1d): yards, aprons, contact shadows and the zone brush friction fixes.
//   wedge: gate 1. For every on-screen building apron, the proof port lists the canvas pixels between the frontage
//          edge and the road ribbon's visible edge (every 1/32 tile along each frontage ray). The script reads those
//          pixels from the rendered canvas and counts grass-coloured ones (green channel above red by more than
//          GRASS_MARGIN), on the C25 board and the zoned board at zoom 0.6/1.0/1.35 x DPR 1/2, walkers hidden.
//          With --base <url> the same pixels are read from the baseline build (same state and camera) for the
//          before/after count.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/buildingGroundEvidence.mjs wedge <out.json> [--url ...] [--base ...]
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
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

if (mode === 'wedge') await wedge(target);
else throw new Error('Usage: buildingGroundEvidence.mjs wedge <out.json> [--url ...] [--base ...] [--snapshot state.json[.gz] --tile x,y]');
void createHash; void join;
