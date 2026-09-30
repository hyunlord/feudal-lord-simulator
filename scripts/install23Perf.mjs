// INSTALL-23 gate ⑥: the weather layer's cost on the DGX, this build against the trunk before it. The pop176 village at
// 1.1x (the village life drawn in both of this build's scenes): this build at the height of a wet season (the storm
// sheet, overcast, fog, sheen and ripples; `&weather=wet&weather-tick=575`), this build in a dry one (dust and cracks;
// `&weather=dry&weather-tick=500`) and, for reference, this build with the weather drawn off (`&weather=none`); the
// base as it is. Two windows of the proof API's last 240 frames of frame work (median, p95 of the 480) and the rAF
// interval. Five rounds, the builds alternating; the gate is the median of each weather scene's p95 ≤ 110 % of the
// base's (DGX with DGX; a run counts only at rAF 16.7 ms, docs: memory "DGX perf validity").
//   PLAYWRIGHT_MODULE=... node scripts/install23Perf.mjs <out.json> --url <this> --base <base>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/install23Perf.mjs)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node scripts/install23Perf.mjs …", entry: import.meta.url });
import { writeFileSync } from 'node:fs';
import { loadChromium, openScene, rafMedian, sceneStates } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const urls = { base: flag('base'), this: flag('url') };
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const SCENES = [
  { scene: 'base', build: 'base', query: '' },
  { scene: 'wet-storm', build: 'this', query: '&weather=wet&weather-tick=575' },
  { scene: 'dry', build: 'this', query: '&weather=dry&weather-tick=500' },
  { scene: 'weather-off', build: 'this', query: '&weather=none' },
];
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const cities = await sceneStates();
const quantile = (values, q) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? null; };
const rows = [];
const ROUNDS = 5;
for (let round = 0; round < ROUNDS; round += 1) {
  for (const { scene, build, query } of SCENES) {
    const { context, page } = await openScene(browser, { state: cities.pop176, tile: [46, 39], baseUrl: urls[build], width: 1280, height: 720, zoom: 1.1, initScript: TUTORIAL_OFF, query: `&story-delay=600000${query}` });
    if (await page.locator('.pause-menu').count()) await page.keyboard.press('Escape');
    await page.waitForTimeout(8_000);
    const first = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().work.frameWorkMs);
    await page.waitForTimeout(4_500);
    const work = [...first, ...await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().work.frameWorkMs)];
    const raf = await rafMedian(page, 90);
    rows.push({ round, build, scene, frames: work.length, frameWorkMedianMs: quantile(work, 0.5), frameWorkP95Ms: quantile(work, 0.95), rafMedianMs: raf.median, rafP95Ms: raf.p95 });
    console.log(JSON.stringify(rows.at(-1)));
    await context.close();
  }
}
await browser.close();
const median = values => quantile(values, 0.5);
const valid = scene => rows.filter(row => row.scene === scene && row.rafMedianMs !== null && row.rafMedianMs <= 17.5);
const p95 = scene => median(valid(scene).map(row => row.frameWorkP95Ms));
const summary = {};
for (const { scene } of SCENES) {
  summary[scene] = { p95: p95(scene), ratio: p95('base') > 0 ? Math.round(p95(scene) / p95('base') * 1000) / 10 : null, valid: valid(scene).length, rounds: ROUNDS };
}
const pass = ['wet-storm', 'dry'].every(scene => summary[scene].ratio !== null && summary[scene].ratio <= 110);
writeFileSync(out, JSON.stringify({ urls, summary, pass, rows }, null, 1) + '\n');
console.log(JSON.stringify({ summary, pass }));
process.exit(pass ? 0 : 1);
