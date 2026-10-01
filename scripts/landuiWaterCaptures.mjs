// LAND-UI water evidence, JPEG: the riverside's river arrows (river.flow), the fen's water (reeds, shallow ripples,
// its river) and a fulling mill's race on each, summer, paused (the water moves on the wall clock).
// With --base <url> (scripts/remote/with-base-build.sh), the riverside's river scenes also from the base build, as
// <scene>-before.jpg: the riverside must look the same apart from the arrows (LU-D2).
//   PLAYWRIGHT_MODULE=... node scripts/landuiWaterCaptures.mjs <out-dir> --url <url> [--base <url>] --states <dir from scripts/landuiWaterStates.ts>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/landuiWaterCaptures.mjs)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node scripts/landuiWaterCaptures.mjs …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag('url') ?? 'http://127.0.0.1:4282/';
const base = flag('base');
const statesDir = flag('states');
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const scenes = JSON.parse(readFileSync(join(statesDir, 'scenes.json'), 'utf8'));
const stateFile = { 'riverside-river': 'riverside-summer', 'riverside-river-close': 'riverside-summer', 'fen-river': 'fen-summer', 'fen-mere': 'fen-summer', 'riverside-mill': 'riverside-mill-summer', 'fen-mill': 'fen-mill-summer' };
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { url, errors: [], scenes: {} };
const runs = Object.entries(scenes).flatMap(([name, scene]) => [[name, scene, url], ...(base !== undefined && name.startsWith('riverside-river') ? [[`${name}-before`, scene, base]] : [])]);
// The same wall-clock moment in every shot (the water's frames): each page's clock is held at one time.
const FROZEN = 'Date.now = () => 1_700_000_000_000; performance.now = () => 12_345;';
for (const [name, { tile, zoom }, baseUrl] of runs) {
  const file = stateFile[name.replace(/-before$/, '')];
  const state = JSON.parse(readFileSync(join(statesDir, `${file}.json`), 'utf8'));
  const { context, page } = await openScene(browser, { state, tile, baseUrl, width: 1024, height: 640, zoom, run: false, initScript: TUTORIAL_OFF, query: '&story-delay=600000', loadTimeout: 90_000 });
  page.on('pageerror', error => result.errors.push(`${name}: ${String(error)}`));
  await page.waitForTimeout(3_000);
  await page.evaluate(FROZEN); await page.waitForTimeout(500);
  const close = zoom >= 2;
  await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 68, ...(close ? { clip: { x: 192, y: 120, width: 640, height: 400 } } : {}) });
  result.scenes[name] = { tile, zoom, state: file, server: baseUrl, tick: await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().tick) };
  await context.close();
}
await browser.close();
writeFileSync(join(out, 'captures.json'), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result));
