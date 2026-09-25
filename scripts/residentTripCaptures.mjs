// MOVE-1 street captures (report: weekday, market day, winter). Runs against a Vite dev server of this checkout (--url)
// and, for the before shots, of the trunk before MOVE-1 (--base). Paused, so the residents stand where the state's tick
// puts them.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/residentTripCaptures.mjs <outDir> --base <url> [--url ...]
// Scenes (docs/verification/move1-residents/scene/, from scripts/residentTripEvidence.ts): the C3 seed 2 city on its
// first summer weekday and market day with residents on screen, and its first winter sample.
//  - town: the whole 1280 x 800 view at zoom 1 centred on the market / mill quarter (48,35);
//  - street: the V2 street clip at zoom 2, DPR 2 (500 x 375 CSS px).
// The looks on screen (proof port walkerLooks) are written next to the shots.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4292/';
const ROOT = resolve(new URL('..', import.meta.url).pathname);
const load = async path => JSON.parse(gunzipSync(await readFile(join(ROOT, path))).toString('utf8'));
const STREET = { x: 390, y: 200, width: 500, height: 375 };

const ready = page => page.waitForFunction(() => {
  const d = window.__FEUDAL_PHASE10_PROOF__.diagnosis();
  const walkerImages = d.walkers?.images ?? [];
  return (d.boundary === undefined || d.boundary === null || d.boundary.assets.every(a => a.status === 'ready'))
    && walkerImages.every(image => image.status !== 'loading');
}, null, { timeout: 60_000 }).then(() => page.waitForTimeout(2_500));

await mkdir(outDir, { recursive: true });
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = [];
try {
  for (const scene of ['weekday', 'marketday', 'winter']) {
    const state = await load(`docs/verification/move1-residents/scene/seed2-${scene}.json.gz`);
    for (const [label, base] of [...(flags.base ? [['before', flags.base]] : []), ['after', url]]) {
      for (const [view, zoom, dpr, clip] of [['town', 1, 1, undefined], ['street', 2, 2, STREET]]) {
        const { context, page } = await openScene(browser, { state, tile: [48, 35], baseUrl: base, dpr, zoom, run: false });
        await ready(page); await page.mouse.move(640, 790); await page.waitForTimeout(400);
        const file = `${view}-${scene}-${label}.jpg`;
        await writeFile(join(outDir, file), await page.screenshot({ type: 'jpeg', quality: view === 'town' ? 62 : 74, ...(clip === undefined ? {} : { clip }) }));
        const looks = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.walkerLooks());
        rows.push({ scene, label, view, file, tick: state.tick, walkers: looks.length, residents: looks.filter(look => look.id.startsWith('resident-')).length,
          sheets: [...new Set(looks.map(look => look.sheetId))].length });
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
await writeFile(join(outDir, 'captures.json'), `${JSON.stringify(rows, null, 1)}\n`);
process.stdout.write(`${JSON.stringify(rows)}\n`);
