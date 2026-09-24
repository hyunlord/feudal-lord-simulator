// Visual variant evidence (V1). The simulation never starts, so every capture draws the fixture's own tick.
//   capture: PLAYWRIGHT_MODULE=... node scripts/variantEvidence.mjs capture <outDir> --after http://127.0.0.1:4197/ --before http://127.0.0.1:4196/
//     before = the pre-V1 trunk with the curved ground switched on (same ground as after), after = this checkout (defaults).
//   determinism: PLAYWRIGHT_MODULE=... node scripts/variantEvidence.mjs determinism <out.json> --after http://127.0.0.1:4197/
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadChromium, openScene, sceneStates } from './renderCommitProbe.mjs';

const [mode, target] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const TOWNS = [{ name: 'seed2-town', city: 'seed2', tile: [47, 32] }, { name: 'seed3-town', city: 'seed3', tile: [12, 15] }];
// Injected gallery (scripts/variantGalleryState.ts): rows maintained / strained / neglected / vacant.
const CLOSE_UPS = [
  ['building:house_l0', 'pen', 'vacant'], ['building:house_l1', 'garden', 'neglected'], ['building:house_l2', 'weaver', 'strained'],
  ['building:house_l3', 'shop', 'neglected'], ['building:house_l4', 'courtyard', 'vacant'], ['building:house_pair_l4_horizontal', 'hall', 'neglected'],
];
const GALLERY = [[28, 48], [22, 60]].map(([tx, ty], index) => ({ name: `gallery-${index + 1}`, city: 'gallery', tile: [tx, ty] }));

async function open(browser, states, scene, { url, zoom = 1, dpr = 1, query = '' }) {
  const opened = await openScene(browser, { state: states[scene.city], tile: scene.tile, baseUrl: url, dpr, zoom, run: false, query });
  await opened.page.waitForFunction(() => {
    const diagnosis = window.__FEUDAL_PHASE10_PROOF__.diagnosis();
    const variants = diagnosis.variants ?? [];
    return diagnosis.assets.every(asset => asset.status !== 'loading' && asset.status !== 'idle')
      && variants.every(variant => variant.status !== 'loading') && (diagnosis.boundary?.assets ?? []).every(asset => asset.status === 'ready');
  }, null, { timeout: 60_000 });
  await opened.page.waitForTimeout(1_000);
  return opened;
}
const canvasData = (page, type, quality) => page.evaluate(({ type, quality }) => new Promise(done =>
  requestAnimationFrame(() => requestAnimationFrame(() => done(document.querySelector('canvas').toDataURL(type, quality))))), { type, quality });
const bytes = dataUrl => Buffer.from(dataUrl.split(',')[1], 'base64');

async function capture(outDir) {
  await mkdir(outDir, { recursive: true });
  const chromium = await loadChromium(); const states = await sceneStates();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const rows = [];
  const shot = async (scene, label, options) => {
    const { context, page } = await open(browser, states, scene, options);
    const file = `${scene.name}-z${(options.zoom ?? 1).toFixed(1)}-${label}.jpg`;
    const jpeg = bytes(await canvasData(page, 'image/jpeg', 0.72));
    await writeFile(join(outDir, file), jpeg);
    rows.push({ file, bytes: jpeg.length, url: options.url, query: options.query ?? '' });
    console.log(JSON.stringify(rows.at(-1)));
    await context.close();
  };
  for (const town of TOWNS) for (const zoom of [1, 0.6]) {
    await shot(town, 'before', { url: flags.before, zoom, query: '&render-boundary-v2=1' });
    await shot(town, 'after', { url: flags.after, zoom });
  }
  for (const scene of GALLERY) await shot(scene, 'after', { url: flags.after, zoom: 1 });
  // Close-ups of declined houses on different variants (gate 3): the condition overlay must sit on the variant's body.
  for (const [pool, variant, condition] of CLOSE_UPS) {
    const entry = states.galleryEntries.find(candidate => candidate.pool === pool && candidate.variant === variant && candidate.condition === condition);
    if (entry === undefined) throw new Error(`gallery entry ${pool}#${variant} ${condition} missing`);
    const lot = pool.includes('pair') ? 0.5 : 0;
    await shot({ name: `closeup-${pool.replace('building:', '')}-${variant}-${condition}`, city: 'gallery', tile: [entry.tx + lot, entry.ty - 0.6] },
      'after', { url: flags.after, zoom: 3 });
  }
  await browser.close();
  await writeFile(join(outDir, 'captures.json'), `${JSON.stringify({ note: 'fixture states, simulation not started (준비 상태); gallery = injected state (상태 주입)', rows }, null, 2)}\n`);
}

async function determinism(out) {
  const chromium = await loadChromium(); const states = await sceneStates();
  // Software raster: GPU rasterization is not bit-stable between two draws (B11 road-fix-pixels).
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  const rows = [];
  for (const scene of [...TOWNS, GALLERY[1]]) for (const dpr of [1, 2]) {
    const hashes = [];
    for (let run = 0; run < 2; run += 1) {
      const { context, page } = await open(browser, states, scene, { url: flags.after, dpr });
      hashes.push(createHash('sha256').update(bytes(await canvasData(page, 'image/png'))).digest('hex'));
      await context.close();
    }
    rows.push({ scene: scene.name, dpr, first: hashes[0], second: hashes[1], identical: hashes[0] === hashes[1] });
    console.log(JSON.stringify(rows.at(-1)));
  }
  await browser.close();
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify({ url: flags.after, raster: 'software (--disable-gpu)', rows }, null, 2)}\n`);
}

if (mode === 'capture') await capture(target);
else if (mode === 'determinism') await determinism(target);
else throw new Error('Usage: variantEvidence.mjs capture <outDir> | determinism <out.json>');
