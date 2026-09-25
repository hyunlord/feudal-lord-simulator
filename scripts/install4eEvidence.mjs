// INSTALL-4e captures: before (--base, the trunk) / after (--url, this build), paused, walkers hidden, zoom 2 close-ups
// (600 x 450 CSS px around the view's centre). Scenes: seed fixtures (renderFixtureStates / boundaryFixtureStates), the
// C1f arable scene and docs/verification/install4e/scene/ (scripts/install4eScenes.ts).
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/install4eEvidence.mjs <outDir> --base <url> [--url ...]
// Writes <view>-before.jpg / <view>-after.jpg and captures.json (the views, their tiles and sources).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadChromium, openScene, sceneStates } from './renderCommitProbe.mjs';

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4213/';
const load = async path => JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));
const ready = page => page.waitForFunction(() => {
  const d = window.__FEUDAL_PHASE10_PROOF__.diagnosis();
  return d.boundary === undefined || d.boundary === null || d.boundary.assets.every(a => a.status === 'ready');
}, null, { timeout: 60_000 }).then(() => page.waitForTimeout(2_000));
const CLIP = { x: 340, y: 175, width: 600, height: 450 };

const states = await sceneStates();
const natural = await load('tests/fixtures/boundary/seed2-arable-scene.json.gz');
const pasture = await load('docs/verification/install4e/scene/pasture-seed4.json.gz');
const yard = await load('docs/verification/install4e/scene/yard-seed5.json.gz');
const winter = await load('docs/verification/c1f-farmstead/scene/arable-spring.json.gz');
const views = [
  { name: 'gate-stone-nwse', state: states.seed3, tile: [2.5, 5.5], source: 'seed 3 final: stone gate on a NW-SE (x) wall, gate v2 as painted; ashlar faces beside it' },
  { name: 'gate-stone-nesw', state: states.seed3, tile: [15.5, 7.5], source: 'seed 3 final: stone gate on a NE-SW (y) wall, gate v2 mirrored' },
  { name: 'gate-timber', state: natural, tile: [52.5, 46.5], source: 'seed 2 natural chain: palisade gate v2' },
  { name: 'tower-seed3-west', state: states.seed3, tile: [4.5, 25.5], source: 'seed 3 final: corner towers (drum / square b by corner hash) and 135 degree pillars' },
  { name: 'tower-seed2-north', state: states.seed2, tile: [40.5, 26.5], source: 'seed 2 final: corner towers and pillars along the north wall' },
  { name: 'yard-ring', state: yard, tile: [39, 5.5], source: 'seed 5 final: yard closed by a straight panel, the short gate and a half panel (construction-site-000027)' },
  { name: 'pasture-sheep', state: pasture, tile: [41, 9], source: 'seed 4 final + a painted pasture (install4eScenes): sheep flocks a / b / c and cattle' },
  { name: 'forest-pigs', state: pasture, tile: [27, 5], source: 'seed 4 final: pig pair on the forest edge (no woodland common zone)' },
  { name: 'barn-winter', state: winter, tile: [46, 28], source: 'C1f arable-spring scene (calendar winter, day 351): farmstead, winter barn after' },
];
await mkdir(outDir, { recursive: true });
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = [];
for (const view of views) {
  for (const [label, base] of [['before', flags.base], ['after', url]]) {
    const { context, page } = await openScene(browser, { state: { ...view.state, walkers: [] }, tile: view.tile, baseUrl: base, dpr: 1, zoom: 2, run: false });
    await ready(page); await page.mouse.move(640, 790); await page.waitForTimeout(500);
    const file = `${view.name}-${label}.jpg`;
    await writeFile(join(outDir, file), await page.screenshot({ type: 'jpeg', quality: 72, clip: CLIP }));
    rows.push({ file, source: view.source, tile: view.tile, zoom: 2, build: base });
    await context.close();
  }
}
await browser.close();
await writeFile(join(outDir, 'captures.json'), JSON.stringify(rows, null, 1) + '\n');
