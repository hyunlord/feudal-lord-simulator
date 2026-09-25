// Wall strips v2 and water evidence (D3b-2). Runs against Vite dev servers of this checkout (--url) and of the
// baseline trunk before D3b-2 (--base), walkers hidden, paused.
//   triple:  gate 2, the same views three ways: the per-edge pieces (baseline, default), the D3b v1 strips (baseline,
//            `render-wall-strips=1`) and the v2 strips (this build, `render-wall-strips=1`): seed 3 stone town (zoom 1,
//            0.6), seed 2 south (stone wall on the lake, a corner tower), the seed 2 natural chain (C1e real-input
//            state: timber palisade), and 2x close-ups of the stone gate, the stone tower and the timber gate.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/wallStripsV2Evidence.mjs triple <outDir> --base <url> [--url ...] [--query ...]
//   water:   gate 3, the lakes before (baseline) / after (this build) at zoom 1 and 2, and the rendered colour of the
//            water at the bank (0.08 / 0.2 / 0.35 tile in from straight banks) against the deep water (3+ tiles from
//            land): CIE L* difference (a light rim is a positive one) and CIE76 difference.
//   PLAYWRIGHT_MODULE=... node scripts/wallStripsV2Evidence.mjs water <outDir> --base <url> [--url ...]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadChromium, openScene, sceneStates } from './renderCommitProbe.mjs';

const [mode, target] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4261/';
const strips = flags.query ?? '&render-wall-strips=1';
const load = async path => { const raw = JSON.parse(gunzipSync(await readFile(path)).toString('utf8')); return raw.state ?? raw; };
const CLIP = { x: 340, y: 150, width: 600, height: 450 };

async function views() {
  const states = await sceneStates();
  const natural = await load('tests/fixtures/boundary/seed2-arable-scene.json.gz');
  return [
    ...[1, 0.6].map(zoom => ({ name: `seed3-stone-z${zoom.toFixed(2)}`, state: states.seed3, tile: [14, 14], zoom, source: 'seed 3 final (fixture): stone town' })),
    { name: 'seed2-south-z1.00', state: states.seed2, tile: [46, 45], zoom: 1, source: 'seed 2 final (fixture): stone wall on the lake' },
    ...[1, 0.6].map(zoom => ({ name: `natural-timber-z${zoom.toFixed(2)}`, state: natural, tile: [50, 44], zoom, source: 'seed 2 natural chain (C1e real-input state): timber palisade on the lake' })),
    { name: 'stone-gate-z2.00', state: states.seed2, tile: [53, 26], zoom: 2, clip: CLIP, source: 'seed 2 final: stone gate' },
    { name: 'stone-tower-z2.00', state: states.seed2, tile: [44, 46], zoom: 2, clip: CLIP, source: 'seed 2 final: corner tower on the lake' },
    { name: 'timber-gate-z2.00', state: natural, tile: [52.5, 46.5], zoom: 2, clip: CLIP, source: 'seed 2 natural chain: timber gate' },
  ];
}

const ready = page => page.waitForFunction(() => {
  const d = window.__FEUDAL_PHASE10_PROOF__.diagnosis();
  return d.boundary === undefined || d.boundary === null || d.boundary.assets.every(a => a.status === 'ready');
}, null, { timeout: 60_000 }).then(() => page.waitForTimeout(2_000));

async function shot(browser, view, base, query, file) {
  const { context, page } = await openScene(browser, { state: { ...view.state, walkers: [] }, tile: view.tile, baseUrl: base, dpr: 1, zoom: view.zoom, run: false, query });
  await ready(page); await page.mouse.move(640, 790); await page.waitForTimeout(500);
  await writeFile(file, await page.screenshot({ type: 'jpeg', quality: 72, ...(view.clip === undefined ? {} : { clip: view.clip }) }));
  return { context, page };
}

async function triple(outDir) {
  await mkdir(outDir, { recursive: true });
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const rows = [];
  for (const view of await views()) {
    for (const [label, base, query] of [['pieces', flags.base, ''], ['v1', flags.base, strips], ['v2', url, strips]]) {
      const file = `${view.name}-${label}.jpg`;
      const { context } = await shot(browser, view, base, query, join(outDir, file));
      await context.close();
      rows.push({ file, view: view.name, render: label, build: base, query, source: view.source, tile: view.tile, zoom: view.zoom });
    }
  }
  await browser.close();
  await writeFile(join(outDir, 'triple.json'), `${JSON.stringify({ walkers: 'hidden', renders: { pieces: 'baseline default (per-edge pieces)', v1: 'baseline + render-wall-strips=1 (D3b strips)', v2: 'this build + render-wall-strips=1 (D3b-2 strips)' }, rows }, null, 2)}\n`);
}

/**
 * The water as drawn, measured at the shore and far from it: for every on-screen water tile with land on exactly one
 * side (a straight bank), 3x3 canvas patches on the line from that bank into the water at EDGE_DEPTHS tiles; deep =
 * water tiles 3+ tiles from any land, at their centre.
 */
const EDGE_DEPTHS = [0.08, 0.2, 0.35];
async function waterColour(page) {
  return page.evaluate(depths => {
    const port = window.__FEUDAL_PHASE10_PROOF__; const state = port.state();
    const canvas = document.querySelector('canvas'); const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect(); const scale = canvas.width / rect.width;
    const water = (x, y) => x < 0 || y < 0 || x >= state.width || y >= state.height ? true : state.tiles[y * state.width + x]?.terrain === 'water';
    const farFromLand = (x, y) => { for (let dy = -3; dy <= 3; dy += 1) for (let dx = -3; dx <= 3; dx += 1) if (!water(x + dx, y + dy)) return false; return true; };
    const sums = Object.fromEntries([...depths.map(depth => [`edge${depth}`, [0, 0, 0, 0]]), ['deep', [0, 0, 0, 0]]]);
    const sample = (key, tx, ty) => {
      const p = port.tileClientPoint({ tx, ty }); const x = Math.round((p.clientX - rect.left) * scale); const y = Math.round((p.clientY - rect.top) * scale);
      if (x < 3 || x > canvas.width - 4 || y < 80 * scale || y > canvas.height - 180 * scale) return;
      const data = context.getImageData(x - 1, y - 1, 3, 3).data;
      for (let i = 0; i < data.length; i += 4) { sums[key][0] += data[i]; sums[key][1] += data[i + 1]; sums[key][2] += data[i + 2]; sums[key][3] += 1; }
    };
    for (const tile of state.tiles) {
      if (tile.terrain !== 'water' || tile.hasRoad) continue;
      if (farFromLand(tile.tx, tile.ty)) { sample('deep', tile.tx, tile.ty); continue; }
      const land = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !water(tile.tx + dx, tile.ty + dy));
      if (land.length !== 1) continue;
      const [dx, dy] = land[0];
      // The tile edge toward the bank is at +0.5 from the centre; depth d into the water = 0.5 - d from the centre.
      for (const depth of depths) sample(`edge${depth}`, tile.tx + dx * (0.5 - depth), tile.ty + dy * (0.5 - depth));
    }
    return Object.fromEntries(Object.entries(sums).map(([key, sum]) => [key, sum[3] === 0 ? null : { rgb: [sum[0] / sum[3], sum[1] / sum[3], sum[2] / sum[3]].map(value => Math.round(value * 10) / 10), patches: sum[3] / 9 }]));
  }, EDGE_DEPTHS);
}

function summary(colour) {
  if (colour.deep === null) return { ...colour, rim: null };
  const deepLab = lab(colour.deep.rgb);
  const edges = EDGE_DEPTHS.map(depth => colour[`edge${depth}`]).filter(entry => entry !== null);
  const lightness = edges.map(entry => Math.round((lab(entry.rgb)[0] - deepLab[0]) * 10) / 10);
  return { ...colour, deepLightness: Math.round(deepLab[0] * 10) / 10, edgeMinusDeepLightness: lightness,
    edgeDeltaE: edges.map(entry => deltaE(entry.rgb, colour.deep.rgb)), rimLightness: Math.max(...lightness) };
}

function lab([r, g, b]) {
  const lin = value => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const xyz = [(0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, 0.2126 * R + 0.7152 * G + 0.0722 * B, (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883];
  const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
  const [fx, fy, fz] = xyz.map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
const deltaE = (a, b) => { const p = lab(a); const q = lab(b); return Math.round(Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]) * 10) / 10; };

async function water(outDir) {
  await mkdir(outDir, { recursive: true });
  const states = await sceneStates();
  const natural = await load('tests/fixtures/boundary/seed2-arable-scene.json.gz');
  const lakes = [
    { name: 'lake-seed2-z1.00', state: states.seed2, tile: [50, 40], zoom: 1, source: 'seed 2 final: the lake inside the stone wall' },
    { name: 'lake-seed2-z2.00', state: states.seed2, tile: [52, 42], zoom: 2, source: 'seed 2 final: lake edge, reeds and stones' },
    { name: 'lake-natural-z1.00', state: natural, tile: [50, 40], zoom: 1, source: 'seed 2 natural chain: lake and river with bridges' },
    { name: 'river-x-bridge-z2.00', state: await load('docs/verification/d3a-shoreline/scene/river-bridges-state.json.gz'), tile: [24, 8], zoom: 2, clip: { x: 290, y: 200, width: 700, height: 400 }, source: '24-lot river x bridge (D3a real-input state): back NW and front SE abutments' },
    { name: 'river-y-bridge-z2.00', state: await load('docs/verification/d3a-shoreline/scene/river-bridges-state.json.gz'), tile: [17, 5], zoom: 2, clip: { x: 390, y: 150, width: 500, height: 500 }, source: '24-lot river y bridge (D3a real-input state): back NE and front SW (mirrored SE) abutments' },
  ];
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const rows = [];
  for (const view of lakes) {
    const row = { view: view.name, source: view.source, tile: view.tile, zoom: view.zoom };
    for (const [label, base, query] of [['before', flags.base, ''], ['after', url, '']]) {
      const { context, page } = await shot(browser, view, base, query, join(outDir, `${view.name}-${label}.jpg`));
      row[label] = summary(await waterColour(page));
      await context.close();
    }
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  await browser.close();
  await writeFile(join(outDir, 'water-colour.json'), `${JSON.stringify({ walkers: 'hidden', method: 'mean RGB of 3x3 canvas patches: edge = 0.08 / 0.2 / 0.35 tile into the water from a straight bank (water tiles with land on one side), deep = centres of water tiles 3+ tiles from land; lightness = CIE L* difference to deep, deltaE = CIE76 to deep, rim = largest edge lightness difference', rows }, null, 2)}\n`);
}

if (mode === 'triple') await triple(target);
else if (mode === 'water') await water(target);
else throw new Error('mode: triple | water');
