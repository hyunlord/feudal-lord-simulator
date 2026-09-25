// Farmstead / field / farm prop evidence (C1f). Runs against a Vite dev server of this checkout (--url) and, for the
// before shots, of the trunk before C1f (--base), walkers hidden, paused.
// Scenes (docs/verification/c1f-farmstead/scene/): the C1e real-input seed 2 scene (tests/fixtures/boundary/
// seed2-arable-scene.json.gz, v9) migrated to v10 (21 wheat farms -> arable fields + 5 farmsteads), then simulated
// without input: +800 ticks (spring: ploughed, sown, fallow strips) and +2500 ticks (harvest: ripe, growing, sown,
// fallow, harvested strips; every farmstead harvesting), a prepared five-state board, and the C25 zoned board (pasture).
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/farmsteadEvidence.mjs <outDir> --base <url> [--url ...]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4271/';
const ROOT = resolve(new URL('..', import.meta.url).pathname);
const load = async path => JSON.parse(gunzipSync(await readFile(join(ROOT, path))).toString('utf8'));
const CLIP = { x: 340, y: 150, width: 600, height: 450 };

async function views() {
  const spring = await load('docs/verification/c1f-farmstead/scene/arable-spring.json.gz');
  const harvest = await load('docs/verification/c1f-farmstead/scene/arable-harvest.json.gz');
  // Prepared: the harvest scene with the big field's ten strips set two by two to ploughed / sown / growing /
  // harvested / fallow (arableFields records edited, nothing else), for the five-state board.
  const five = await load('docs/verification/c1f-farmstead/scene/arable-five-states.json.gz');
  const c25 = JSON.parse(execFileSync(resolve(ROOT, 'node_modules/.bin/tsx'), ['-e', 'import("./scripts/c25Board.ts").then(m => process.stdout.write(JSON.stringify(m.c25ZonedState())))'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 2 ** 20 }));
  return [
    { name: 'barn-idle-z2.00', state: spring, tile: [42, 36], zoom: 2, clip: CLIP, before: true, source: 'spring (+800): farmstead 41,34 (variant a), granary 42,34 and storehouse 41,37 beside it for comparison' },
    { name: 'barn-working-z2.00', state: harvest, tile: [42, 36], zoom: 2, clip: CLIP, source: 'harvest (+2500): the same farmstead with ripe strips -> farmstead_working, hay cart' },
    { name: 'fields-spring-z1.00', state: spring, tile: [52, 36], zoom: 1, before: true, source: 'spring: ploughed / seedling / fallow strips, plough teams' },
    { name: 'fields-spring-z0.60', state: spring, tile: [52, 38], zoom: 0.6, before: true, source: 'spring at zoom 0.6 (state wash)' },
    { name: 'fields-harvest-z1.00', state: harvest, tile: [52, 36], zoom: 1, before: true, source: 'harvest: growing (ripe) / seedling / fallow / harvested (stubble) strips, hay carts' },
    { name: 'fields-harvest-z0.60', state: harvest, tile: [52, 38], zoom: 0.6, before: true, source: 'harvest at zoom 0.6 (state wash)' },
    ...[1, 0.6].map(zoom => ({ name: `five-states-z${zoom.toFixed(2)}`, state: five, tile: [52, 55], zoom, source: 'prepared five-state board: strips ploughed / seedling / growing / stubble / fallow (x2 each, west to east)' })),
    { name: 'pasture-z2.00', state: c25, tile: [32, 46], zoom: 2, clip: CLIP, source: 'C25 zoned board: pasture with cattle' },
  ];
}

const ready = page => page.waitForFunction(() => {
  const d = window.__FEUDAL_PHASE10_PROOF__.diagnosis();
  const zones = d.zones?.assets ?? [];
  return (d.boundary === undefined || d.boundary === null || d.boundary.assets.every(a => a.status === 'ready')) && zones.every(a => a.status !== 'loading');
}, null, { timeout: 60_000 }).then(() => page.waitForTimeout(2_500));

await mkdir(outDir, { recursive: true });
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = [];
for (const view of await views()) {
  for (const [label, base] of [...(view.before && flags.base ? [['before', flags.base]] : []), ['after', url]]) {
    const { context, page } = await openScene(browser, { state: { ...view.state, walkers: [] }, tile: view.tile, baseUrl: base, dpr: 1, zoom: view.zoom, run: false });
    await ready(page); await page.mouse.move(640, 790); await page.waitForTimeout(400);
    const file = `${view.name}-${label}.jpg`;
    await writeFile(join(outDir, file), await page.screenshot({ type: 'jpeg', quality: 72, ...(view.clip === undefined ? {} : { clip: view.clip }) }));
    rows.push({ file, source: view.source, tile: view.tile, zoom: view.zoom, build: base });
    await context.close();
  }
}
await browser.close();
await writeFile(join(outDir, 'captures.json'), `${JSON.stringify({ walkers: 'hidden', provenance: 'migrated real-input scene + simulated ticks without input (see header); C25 board is a prepared state', rows }, null, 2)}\n`);
