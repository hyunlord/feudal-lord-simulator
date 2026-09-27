// AUDIO-1 gate ③: frame work with the sound on, this build against the trunk before it, on the DGX. The pop176 village
// (two mills, a sawmill, carts: loops at work) and the market-day town (scripts/audio1States.ts), each opened at 1x with
// the audio started (an input intent), 8 s to settle; then two windows of the proof API's last 240 frames of frame work
// (median, p95 of the 480) and the rAF interval. Five rounds, base and this alternating; the gate is the median of this
// build's p95 ≤ 105 % of base's (DGX with DGX; frame times come in 0.1 ms steps, so one step is 3 % of a 3.7 ms p95).
//   PLAYWRIGHT_MODULE=... node scripts/audio1Perf.mjs <out.json> --url <this> --base <base> --states <dir>
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene, rafMedian, sceneStates } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const urls = { base: flag('base'), this: flag('url') };
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required'] });
const cities = await sceneStates();
const market = JSON.parse(readFileSync(join(flag('states'), 'market-day.json'), 'utf8'));
const marketTile = (() => { const building = market.buildings.find(entry => entry.kind === 'market'); return [building.tx, building.ty]; })();
const scenes = [['pop176-village', cities.pop176, [46, 39]], ['market-day', market, marketTile]];
const quantile = (values, q) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? null; };
const rows = [];
const ROUNDS = 5;
for (let round = 0; round < ROUNDS; round += 1) {
  for (const build of ['base', 'this']) {
    for (const [scene, state, tile] of scenes) {
      const { context, page } = await openScene(browser, { state, tile, baseUrl: urls[build], width: 1280, height: 720, zoom: 1.1 });
      await page.keyboard.press('Escape');
      if (await page.locator('.pause-menu').count()) await page.keyboard.press('Escape');
      // Two windows of the proof ring's 240 frames (after 8 s and 4.5 s later): 480 frames a run.
      await page.waitForTimeout(8_000);
      const first = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().work.frameWorkMs);
      await page.waitForTimeout(4_500);
      const work = [...first, ...await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().work.frameWorkMs)];
      const raf = await rafMedian(page, 90);
      const loops = await page.evaluate(async () => { try { const m = await import('/src/audio/audioEngine.ts'); return m.activeLoops?.() ?? []; } catch { return []; } });
      rows.push({ round, build, scene, frames: work.length, frameWorkMedianMs: quantile(work, 0.5), frameWorkP95Ms: quantile(work, 0.95), rafMedianMs: raf.median, rafP95Ms: raf.p95, loops });
      console.log(JSON.stringify(rows.at(-1)));
      await context.close();
    }
  }
}
await browser.close();
const verdict = scenes.map(([scene]) => {
  const pick = build => rows.filter(row => row.build === build && row.scene === scene);
  const p95 = build => quantile(pick(build).map(row => row.frameWorkP95Ms), 0.5);
  const median = build => quantile(pick(build).map(row => row.frameWorkMedianMs), 0.5);
  return { scene, baseP95Ms: p95('base'), thisP95Ms: p95('this'), ratio: Math.round(p95('this') / p95('base') * 1000) / 1000,
    baseMedianMs: median('base'), thisMedianMs: median('this'), rafThis: quantile(pick('this').map(row => row.rafMedianMs), 0.5), rafBase: quantile(pick('base').map(row => row.rafMedianMs), 0.5) };
});
const report = { urls, measuredAt: new Date().toISOString(), verdict, pass: verdict.every(entry => entry.ratio <= 1.05), rows };
writeFileSync(out, `${JSON.stringify(report, null, 1)}\n`);
console.log(JSON.stringify({ verdict, pass: report.pass }));
