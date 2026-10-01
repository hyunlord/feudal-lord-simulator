// LAND-UI water evidence, JPEG: the riverside's river arrows (river.flow), the fen's water (reeds, shallow ripples,
// its river) and a fulling mill's race on each, summer, paused (the water moves on the wall clock).
//   PLAYWRIGHT_MODULE=... node scripts/landuiWaterCaptures.mjs <out-dir> --url <url> --states <dir from scripts/landuiWaterStates.ts>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/landuiWaterCaptures.mjs)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node scripts/landuiWaterCaptures.mjs …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag('url') ?? 'http://127.0.0.1:4282/';
const statesDir = flag('states');
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const scenes = JSON.parse(readFileSync(join(statesDir, 'scenes.json'), 'utf8'));
const stateFile = { 'riverside-river': 'riverside-summer', 'fen-river': 'fen-summer', 'fen-mere': 'fen-summer', 'riverside-mill': 'riverside-mill-summer', 'fen-mill': 'fen-mill-summer' };
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { url, errors: [], scenes: {} };
for (const [name, { tile, zoom }] of Object.entries(scenes)) {
  const state = JSON.parse(readFileSync(join(statesDir, `${stateFile[name]}.json`), 'utf8'));
  const { context, page } = await openScene(browser, { state, tile, baseUrl: url, width: 1024, height: 640, zoom, run: false, initScript: TUTORIAL_OFF, query: '&story-delay=600000', loadTimeout: 90_000 });
  page.on('pageerror', error => result.errors.push(`${name}: ${String(error)}`));
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: join(out, `${name}.jpg`), type: 'jpeg', quality: 68 });
  result.scenes[name] = { tile, zoom, state: stateFile[name], tick: await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().tick) };
  await context.close();
}
await browser.close();
writeFileSync(join(out, 'captures.json'), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result));
