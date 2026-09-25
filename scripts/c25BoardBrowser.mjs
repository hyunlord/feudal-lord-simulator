// C25 board in the browser (software raster): the seed 2 final state at (44, 38), zoom 0.6 / 1 / 1.35 x DPR 1 / 2,
// walkers hidden, paused. Each view is opened twice (two pages) and the canvas pixels hashed (SHA-256 of the PNG
// screenshot); with --base the trunk build is hashed too.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/c25BoardBrowser.mjs <out.json> [--url ...] [--base ...]
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { openScene, sceneStates } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4213/';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
const state = { ...(await sceneStates()).seed2, walkers: [] };
const ready = page => page.waitForFunction(() => {
  const d = window.__FEUDAL_PHASE10_PROOF__.diagnosis();
  return d.boundary === undefined || d.boundary === null || d.boundary.assets.every(a => a.status === 'ready');
}, null, { timeout: 60_000 }).then(() => page.waitForTimeout(2_000));
const hash = async (base, zoom, dpr) => {
  const { context, page } = await openScene(browser, { state, tile: [44, 38], baseUrl: base, dpr, zoom, run: false });
  await ready(page); await page.mouse.move(640, 790); await page.waitForTimeout(500);
  const digest = createHash('sha256').update(await page.locator('canvas').first().screenshot({ type: 'png' })).digest('hex');
  await context.close();
  return digest;
};
const rows = [];
for (const zoom of [0.6, 1, 1.35]) for (const dpr of [1, 2]) {
  const first = await hash(url, zoom, dpr); const second = await hash(url, zoom, dpr);
  const trunk = flags.base === undefined ? null : await hash(flags.base, zoom, dpr);
  rows.push({ view: `z${zoom.toFixed(2)}-dpr${dpr}`, sha256: first, secondPage: second, identical: first === second, trunk, equalsTrunk: trunk === null ? null : trunk === first });
}
await browser.close();
await writeFile(out, JSON.stringify({ url, base: flags.base ?? null, board: { city: 'seed2', tile: [44, 38] }, raster: 'software (--disable-gpu)', rows }, null, 2) + '\n');
console.log(rows.map(row => `${row.view} ${row.identical} trunk=${row.equalsTrunk}`).join('\n'));
