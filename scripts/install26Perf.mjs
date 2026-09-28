// INSTALL-26~29 gate: the landscape's cost on the DGX, this build against the trunk before it — the house variants and
// their layers, the backyards, the countryside and the water together. The 1340 town (UI-6's seed 2 run: the state
// nearest 1340 in --states), paused (water still moves), at zoom 1.0 over the town and zoom 0.6 over town and country.
// Two windows of the proof API's last 240 frames of frame work (median, p95 of the 480) and the rAF interval. Five
// rounds, the builds alternating; the gate is the median of each view's p95 ≤ 110 % of the base's in the same view
// (DGX with DGX; a run counts only at rAF 16.7 ms, docs: memory "DGX perf validity").
//   PLAYWRIGHT_MODULE=... node scripts/install26Perf.mjs <out.json> --url <this> --base <base> --states <ui6States dir>
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene, rafMedian } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const urls = { base: flag('base'), this: flag('url') };
const statesDir = flag('states');
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const TARGET = 40 * 4000;
const town = readdirSync(statesDir).filter(file => file.endsWith('.json') && !file.startsWith('moments'))
  .map(file => ({ file, state: JSON.parse(readFileSync(join(statesDir, file), 'utf8')) })).filter(entry => typeof entry.state.tick === 'number' && Array.isArray(entry.state.buildings))
  .sort((a, b) => Math.abs(a.state.tick - TARGET) - Math.abs(b.state.tick - TARGET))[0];
const houses = town.state.buildings.filter(building => building.kind === 'house');
const middle = [houses.reduce((sum, house) => sum + house.tx, 0) / houses.length, houses.reduce((sum, house) => sum + house.ty, 0) / houses.length];
const VIEWS = [{ view: 'town-z1.0', zoom: 1 }, { view: 'wide-z0.6', zoom: 0.6 }];
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const quantile = (values, q) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? null; };
const rows = [];
const ROUNDS = 5;
for (let round = 0; round < ROUNDS; round += 1) {
  for (const { view, zoom } of VIEWS) {
    for (const build of ['base', 'this']) {
      const { context, page } = await openScene(browser, { state: town.state, tile: middle, baseUrl: urls[build], width: 1280, height: 720, zoom, run: false, initScript: TUTORIAL_OFF, query: '&story-delay=600000' });
      if (await page.locator('.pause-menu').count()) await page.keyboard.press('Escape');
      await page.waitForTimeout(8_000);
      const first = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().work.frameWorkMs);
      await page.waitForTimeout(4_500);
      const work = [...first, ...await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().work.frameWorkMs)];
      const raf = await rafMedian(page, 90);
      rows.push({ round, build, view, frames: work.length, frameWorkMedianMs: quantile(work, 0.5), frameWorkP95Ms: quantile(work, 0.95), rafMedianMs: raf.median, rafP95Ms: raf.p95 });
      console.log(JSON.stringify(rows.at(-1)));
      await context.close();
    }
  }
}
await browser.close();
const median = values => quantile(values, 0.5);
const valid = (view, build) => rows.filter(row => row.view === view && row.build === build && row.rafMedianMs !== null && row.rafMedianMs <= 17.5);
const summary = {};
for (const { view } of VIEWS) {
  const base = median(valid(view, 'base').map(row => row.frameWorkP95Ms)), mine = median(valid(view, 'this').map(row => row.frameWorkP95Ms));
  summary[view] = { baseP95: base, thisP95: mine, ratio: base > 0 && mine !== null ? Math.round(mine / base * 1000) / 10 : null, valid: [valid(view, 'base').length, valid(view, 'this').length], rounds: ROUNDS };
}
const pass = VIEWS.every(({ view }) => summary[view].ratio !== null && summary[view].ratio <= 110);
writeFileSync(out, JSON.stringify({ urls, state: town.file, tick: town.state.tick, summary, pass, rows }, null, 1) + '\n');
console.log(JSON.stringify({ summary, pass }));
process.exit(pass ? 0 : 1);
