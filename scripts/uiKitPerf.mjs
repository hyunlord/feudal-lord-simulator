// UI-KIT-1 gate ⑥: the kit's cost on the DGX, this build against the trunk before it. The pop176 village at 1x (the
// HUD at rest) and with the build drawer open (the most kit buttons on screen, their 9-slices painted over the map):
// two windows of the proof API's last 240 frames of frame work (median, p95 of the 480) and the rAF interval. Then the
// chronicle opened from the ledger drawer in the seed 1 merchant town: the press to the first record card painted.
// Five rounds, base and this alternating; the gate is the median of this build's p95 ≤ 105 % of base's (DGX with DGX;
// a run counts only at rAF 16.7 ms, docs: memory "DGX perf validity").
//   PLAYWRIGHT_MODULE=... node scripts/uiKitPerf.mjs <out.json> --url <this> --base <base> --states <dir of scripts/ui5States.ts>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene, rafMedian, sceneStates } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const urls = { base: flag('base'), this: flag('url') };
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const cities = await sceneStates();
const town = JSON.parse(readFileSync(join(flag('states'), 'merchant-town.json'), 'utf8'));
const townHouse = town.buildings.find(building => building.kind === 'house');
const quantile = (values, q) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? null; };
const rows = [];
const ROUNDS = 5;
for (let round = 0; round < ROUNDS; round += 1) {
  for (const build of ['base', 'this']) {
    for (const scene of ['hud', 'build-drawer']) {
      // No story modal over the dock while it measures (the pop176 town has a beat due).
      const { context, page } = await openScene(browser, { state: cities.pop176, tile: [46, 39], baseUrl: urls[build], width: 1280, height: 720, zoom: 1.1, initScript: TUTORIAL_OFF, query: '&story-delay=600000' });
      if (await page.locator('.pause-menu').count()) await page.keyboard.press('Escape');
      if (scene === 'build-drawer') await page.locator("[data-dock='build']").click();
      await page.waitForTimeout(8_000);
      const first = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().work.frameWorkMs);
      await page.waitForTimeout(4_500);
      const work = [...first, ...await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().work.frameWorkMs)];
      const raf = await rafMedian(page, 90);
      rows.push({ round, build, scene, frames: work.length, frameWorkMedianMs: quantile(work, 0.5), frameWorkP95Ms: quantile(work, 0.95), rafMedianMs: raf.median, rafP95Ms: raf.p95 });
      console.log(JSON.stringify(rows.at(-1)));
      await context.close();
    }
    // The chronicle: press [연대기] in the ledger drawer, time to the first record card on screen (two animation frames).
    const { context, page } = await openScene(browser, { state: town, tile: [townHouse.tx, townHouse.ty], baseUrl: urls[build], width: 1280, height: 800, zoom: 1.4, run: false, initScript: TUTORIAL_OFF, query: '&story-delay=600000' });
    await page.locator("[data-dock='ledger']").click(); await page.waitForTimeout(600);
    const openMs = await page.evaluate(() => new Promise(resolve => {
      const start = performance.now();
      document.querySelector('.ledger-tab--chronicle').click();
      const wait = () => document.querySelector('.chronicle-card') === null ? requestAnimationFrame(wait)
        : requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - start)));
      requestAnimationFrame(wait);
    }));
    rows.push({ round, build, scene: 'chronicle-open', openMs: Math.round(openMs) });
    console.log(JSON.stringify(rows.at(-1)));
    await context.close();
  }
}
await browser.close();
const median = values => quantile(values, 0.5);
const summary = {};
for (const scene of ['hud', 'build-drawer']) {
  const pick = build => rows.filter(row => row.scene === scene && row.build === build);
  const valid = build => pick(build).filter(row => row.rafMedianMs !== null && row.rafMedianMs <= 17.5);
  const p95 = build => median(valid(build).map(row => row.frameWorkP95Ms));
  summary[scene] = { base: p95('base'), this: p95('this'), ratio: p95('base') > 0 ? Math.round(p95('this') / p95('base') * 1000) / 10 : null,
    valid: { base: valid('base').length, this: valid('this').length }, rounds: ROUNDS };
}
const opens = build => median(rows.filter(row => row.scene === 'chronicle-open' && row.build === build).map(row => row.openMs));
summary['chronicle-open'] = { base: opens('base'), this: opens('this'), ratio: opens('base') > 0 ? Math.round(opens('this') / opens('base') * 1000) / 10 : null };
const pass = ['hud', 'build-drawer'].every(scene => summary[scene].ratio !== null && summary[scene].ratio <= 105);
writeFileSync(out, JSON.stringify({ urls, summary, pass, rows }, null, 1) + '\n');
console.log(JSON.stringify({ summary, pass }));
process.exit(pass ? 0 : 1);
