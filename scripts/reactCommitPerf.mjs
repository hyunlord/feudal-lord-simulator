// CODE-1c gate: React commits per second and frame cost at 5x in the pop176 village, this build against the trunk
// before it. A stub of the React DevTools hook (installed before React loads) counts every commit; the proof API gives
// the last 240 frames of frame work; the game's tick shows how fast the town ran. Five rounds, base and this
// alternating; a round counts only at rAF 16.7 ms (DGX perf validity).
//   PLAYWRIGHT_MODULE=... node scripts/reactCommitPerf.mjs <out.json> --url <this> --base <base>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/reactCommitPerf.mjs)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node scripts/reactCommitPerf.mjs …", entry: import.meta.url });
import { writeFileSync } from 'node:fs';
import { loadChromium, openScene, rafMedian, sceneStates } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const urls = { base: flag('base'), this: flag('url') };
const ROUNDS = Number(flag('rounds') ?? 5);
const WINDOW_MS = 10_000;
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
// React DOM injects itself into this hook when it exists before it loads, and calls onCommitFiberRoot once per commit.
const COMMIT_HOOK = `window.__FLS_COMMITS__ = 0; window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, renderers: new Map(), isDisabled: false,
  inject(renderer) { const id = this.renderers.size + 1; this.renderers.set(id, renderer); return id; }, checkDCE() {},
  onScheduleFiberRoot() {}, onCommitFiberRoot() { window.__FLS_COMMITS__ += 1; }, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {} };`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const cities = await sceneStates();
const quantile = (values, q) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? null; };
const rows = [];
for (let round = 0; round < ROUNDS; round += 1) {
  for (const build of ['base', 'this']) {
    const { context, page } = await openScene(browser, { state: cities.pop176, tile: [46, 39], baseUrl: urls[build], width: 1280, height: 720, zoom: 1.1,
      initScript: `${TUTORIAL_OFF}\n${COMMIT_HOOK}`, query: '&story-delay=600000', run: false });
    if (await page.locator('.pause-menu').count()) await page.keyboard.press('Escape');
    await page.getByRole('button', { name: '5배속', exact: true }).click();
    await page.waitForTimeout(4_000);
    const start = await page.evaluate(() => ({ commits: window.__FLS_COMMITS__, tick: window.__FEUDAL_PHASE10_PROOF__.state().tick, at: performance.now() }));
    await page.waitForTimeout(WINDOW_MS);
    const end = await page.evaluate(() => ({ commits: window.__FLS_COMMITS__, tick: window.__FEUDAL_PHASE10_PROOF__.state().tick, at: performance.now(),
      work: window.__FEUDAL_PHASE10_PROOF__.diagnosis().work.frameWorkMs }));
    const raf = await rafMedian(page, 90);
    const seconds = (end.at - start.at) / 1000;
    rows.push({ round, build, seconds: Math.round(seconds * 10) / 10, commitsPerSecond: Math.round((end.commits - start.commits) / seconds * 10) / 10,
      ticksPerSecond: Math.round((end.tick - start.tick) / seconds), frames: end.work.length, frameWorkMedianMs: quantile(end.work, 0.5),
      frameWorkP95Ms: quantile(end.work, 0.95), rafMedianMs: raf.median, rafP95Ms: raf.p95 });
    console.log(JSON.stringify(rows.at(-1)));
    await context.close();
  }
}
await browser.close();
const median = values => quantile(values, 0.5);
const valid = build => rows.filter(row => row.build === build && row.rafMedianMs !== null && row.rafMedianMs <= 17.5);
const pick = (build, key) => median(valid(build).map(row => row[key]));
const summary = Object.fromEntries(['commitsPerSecond', 'ticksPerSecond', 'frameWorkP95Ms', 'frameWorkMedianMs'].map(key => [key, { base: pick('base', key), this: pick('this', key),
  ratio: pick('base', key) > 0 ? Math.round(pick('this', key) / pick('base', key) * 1000) / 10 : null }]));
summary.valid = { base: valid('base').length, this: valid('this').length, rounds: ROUNDS };
writeFileSync(out, JSON.stringify({ urls, summary, rows }, null, 1) + '\n');
console.log(JSON.stringify({ summary }));
