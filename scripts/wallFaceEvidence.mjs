// Wall face evidence (D3b). Runs against Vite dev servers of this checkout (--url) and of the baseline (--base).
//   captures: before (--base) / after (--url) at zoom 1.0 and 0.6 (walkers hidden): seed 2 south (the wall on the lake),
//             seed 3 stone town, the seed 2 natural chain (C1e real-input state, finished timber palisade) and the fixed
//             scene with walls under construction (fixtures/construction-reserve/seed2-113040: 5 timber segments
//             finished, 14 being built); plus 2x close-ups of a gate, a tower and a finished / unfinished join.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/wallFaceEvidence.mjs captures <outDir> --base <url> [--url ...]
//   flag:     gate 6, curved ground off (`render-boundary-v2=0`): an FNV-1a hash over the canvas RGBA of the same views
//             in both builds (software raster) must match.
//   PLAYWRIGHT_MODULE=... node scripts/wallFaceEvidence.mjs flag <out.json> --base <url> [--url ...]
//   seams:    join coverage of the face, ridge and shore strips as the game joins them (a | b | c crossfades): the body
//             rows must stay opaque across every join, and the colour step there must not exceed the strip's own.
//   PLAYWRIGHT_MODULE=... node scripts/wallFaceEvidence.mjs seams <out.json> [--url ...]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadChromium, openScene, sceneStates } from './renderCommitProbe.mjs';

const [mode, target] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4213/';
const load = async path => JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));
const ready = page => page.waitForFunction(() => {
  const d = window.__FEUDAL_PHASE10_PROOF__.diagnosis();
  return d.boundary === undefined || d.boundary === null || d.boundary.assets.every(a => a.status === 'ready');
}, null, { timeout: 60_000 }).then(() => page.waitForTimeout(1_800));

async function views() {
  const states = await sceneStates();
  const natural = await load('tests/fixtures/boundary/seed2-arable-scene.json.gz');
  const reserve = await load('fixtures/construction-reserve/seed2-113040.json.gz');
  return [
    ...[1, 0.6].map(zoom => ({ name: `seed2-south-z${zoom.toFixed(2)}`, state: states.seed2, tile: [46, 45], zoom, source: 'seed 2 final (fixture): stone wall on the lake' })),
    ...[1, 0.6].map(zoom => ({ name: `seed3-stone-z${zoom.toFixed(2)}`, state: states.seed3, tile: [14, 14], zoom, source: 'seed 3 final (fixture): stone town' })),
    ...[1, 0.6].map(zoom => ({ name: `natural-timber-z${zoom.toFixed(2)}`, state: natural, tile: [50, 44], zoom, source: 'seed 2 natural chain (C1e real-input state): finished palisade on the lake' })),
    ...[1, 0.6].map(zoom => ({ name: `building-z${zoom.toFixed(2)}`, state: reserve, tile: [58, 49], zoom, source: 'fixtures/construction-reserve/seed2-113040: 5 timber segments finished, 14 being built' })),
    { name: 'seed2-gate-z2.00', state: states.seed2, tile: [53, 26], zoom: 2, clip: { x: 340, y: 150, width: 600, height: 450 }, source: 'seed 2 final: gate' },
    { name: 'seed2-tower-z2.00', state: states.seed2, tile: [44, 46], zoom: 2, clip: { x: 340, y: 150, width: 600, height: 450 }, source: 'seed 2 final: tower on the lake' },
    { name: 'building-join-z2.00', state: reserve, tile: [62, 50], zoom: 2, clip: { x: 340, y: 150, width: 600, height: 450 }, source: 'construction-reserve: finished run ends in a terminal post where the unfinished run starts' },
    { name: 'building-tower-z2.00', state: reserve, tile: [55, 52], zoom: 2, clip: { x: 340, y: 150, width: 600, height: 450 }, source: 'construction-reserve: tower where the finished runs turn' },
  ];
}

async function captures(outDir) {
  await mkdir(outDir, { recursive: true });
  const list = await views();
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const rows = [];
  for (const view of list) {
    for (const [label, base] of [['before', flags.base], ['after', url]]) {
      const { context, page } = await openScene(browser, { state: { ...view.state, walkers: [] }, tile: view.tile, baseUrl: base, dpr: 1, zoom: view.zoom, run: false });
      await ready(page); await page.mouse.move(640, 790); await page.waitForTimeout(600);
      const file = `${view.name}-${label}.jpg`;
      await writeFile(join(outDir, file), await page.screenshot({ type: 'jpeg', quality: 76, ...(view.clip === undefined ? {} : { clip: view.clip }) }));
      rows.push({ file, source: view.source, tile: view.tile, zoom: view.zoom, build: base });
      await context.close();
    }
  }
  await browser.close();
  await writeFile(join(outDir, 'captures.json'), `${JSON.stringify({ walkers: 'hidden', rows }, null, 2)}\n`);
}

async function flag(out) {
  const list = (await views()).filter(view => view.clip === undefined);
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  const hashOf = async (base, view, dpr) => {
    const { context, page } = await openScene(browser, { state: { ...view.state, walkers: [] }, tile: view.tile, baseUrl: base, dpr, zoom: view.zoom, run: false, query: '&render-boundary-v2=0' });
    await page.waitForTimeout(2_500); await page.mouse.move(640, 790); await page.waitForTimeout(800);
    const hash = await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => {
      const canvas = document.querySelector('canvas');
      const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
      let h = 2166136261; for (let i = 0; i < data.length; i += 1) { h ^= data[i]; h = Math.imul(h, 16777619) >>> 0; }
      done(`${canvas.width}x${canvas.height}:${h.toString(16)}`);
    }))));
    const v2 = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().boundary?.enabled ?? null);
    await context.close();
    return { hash, v2 };
  };
  const rows = [];
  for (const view of list) for (const dpr of [1, 2]) {
    const before = await hashOf(flags.base, view, dpr); const after = await hashOf(url, view, dpr);
    rows.push({ view: view.name, dpr, before: before.hash, after: after.hash, flagOn: [before.v2, after.v2], identical: before.hash === after.hash });
    console.log(JSON.stringify(rows.at(-1)));
  }
  await browser.close();
  await writeFile(out, `${JSON.stringify({ url, base: flags.base, query: 'render-boundary-v2=0', raster: 'software (--disable-gpu)', hash: 'FNV-1a over canvas RGBA', identical: rows.filter(row => row.identical).length, of: rows.length, rows }, null, 2)}\n`);
}

async function seams(out) {
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const { page } = await openScene(browser, { state: null, tile: [32, 32], baseUrl: url, dpr: 1, zoom: 1, run: false });
  const rows = await page.evaluate(async () => {
    const { joinStripImages } = await import('/src/render/stripJoin.ts');
    const loadImage = src => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; });
    const sets = [
      ['palisade face', ['wall/palisade_face_a-v1', 'wall/palisade_face_b-v1', 'wall/palisade_face_c-v1'], 512, 128, 48],
      ['stone face', ['wall/stone_face_a-v1', 'wall/stone_face_b-v1', 'wall/stone_face_c-v1'], 512, 128, 48],
      ['shoreline', ['shore/shoreline_a-v1', 'shore/shoreline_b-v1', 'shore/shoreline_c-v1', 'shore/shoreline_d-v1'], 512, 96, 48],
      ...['ploughed', 'seedling', 'growing', 'fallow'].map(state => [`ridge ${state}`, [`fields/ridge_${state}_a-v1`, `fields/ridge_${state}_b-v1`], 512, 64, 40]),
    ];
    const result = [];
    for (const [name, files, width, height, fade] of sets) {
      const images = []; for (const file of files) images.push(await loadImage(`/assets/${file}.png`));
      const joined = joinStripImages(images, width, height, fade);
      const total = width * images.length;
      const data = joined.getContext('2d').getImageData(0, 0, total, height).data;
      const alpha = (x, y) => data[(y * total + x) * 4 + 3];
      // Body rows (opaque across 98% of the first image; not the gaps between stake points or merlons) must stay
      // opaque at every join column.
      // (Taken from the source image, not the joined canvas, so an empty join cannot hide itself.)
      const source = document.createElement('canvas'); source.width = width; source.height = height;
      const sourcePaint = source.getContext('2d'); sourcePaint.drawImage(images[0], 0, 0);
      const sourceData = sourcePaint.getImageData(0, 0, width, height).data;
      const rows = [];
      for (let y = 0; y < height; y += 1) { let opaque = 0; for (let x = 0; x < width; x += 1) if (sourceData[(y * width + x) * 4 + 3] > 200) opaque += 1; if (opaque >= width * 0.98) rows.push(y); }
      let holes = 0;
      for (let index = 0; index < images.length; index += 1) {
        const joinAt = (index + 1) * width % total;
        for (let dx = -fade; dx < fade; dx += 1) { const x = (joinAt + dx + total) % total; for (const y of rows) if (alpha(x, y) < 128) holes += 1; }
      }
      const step = (x0, x1) => { let sum = 0; let n = 0; for (const y of rows) { const a = (y * total + x0) * 4; const b = (y * total + x1) * 4; sum += (Math.abs(data[a] - data[b]) + Math.abs(data[a + 1] - data[b + 1]) + Math.abs(data[a + 2] - data[b + 2])) / 3; n += 1; } return n ? sum / n : 0; };
      const interior = []; for (let x = 0; x < total - 1; x += 1) interior.push(step(x, x + 1)); interior.sort((a, b) => a - b);
      const p95 = interior[Math.floor(interior.length * 0.95)];
      const joins = Array.from({ length: images.length }, (_, index) => { const x = ((index + 1) * width - 1) % total; return Math.round(step(x, (x + 1) % total) * 10) / 10; });
      result.push({ strip: name, opaqueRows: rows.length, holePixelsAtJoins: holes, p95: Math.round(p95 * 10) / 10, joinSteps: joins, seam: holes > 0 || joins.some(v => v > p95) });
    }
    return result;
  });
  await browser.close();
  await writeFile(out, `${JSON.stringify({ url, metric: 'opaque-row coverage across each join (holes) and the colour step at the join vs the strip own p95', seams: rows.filter(row => row.seam).length, rows }, null, 2)}\n`);
  console.log(JSON.stringify(rows, null, 1));
}

if (mode === 'captures') await captures(target);
else if (mode === 'flag') await flag(target);
else if (mode === 'seams') await seams(target);
else throw new Error('Usage: wallFaceEvidence.mjs captures <outDir> --base <url> | flag <out.json> --base <url> | seams <out.json>');
