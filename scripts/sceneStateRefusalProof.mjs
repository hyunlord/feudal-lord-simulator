// RES-REG: in a real page, the scene injection refuses an old bare save and admits a current one.
//   node scripts/sceneStateRefusalProof.mjs <out.json> --url <game url> --old <bare old state .json> --current <current state .json>
import { readFileSync, writeFileSync } from 'node:fs';
import { loadChromium } from './renderCommitProbe.mjs';
import { routeSceneState, sceneStateRefusal } from './sceneInjection.mjs';

const [out, ...rest] = process.argv.slice(2);
const flag = name => { const at = rest.indexOf(`--${name}`); return at < 0 ? undefined : rest[at + 1]; };
const url = flag('url'); const oldPath = flag('old'); const currentPath = flag('current');
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { url, old: { path: oldPath }, current: { path: currentPath } };
async function attempt(target, path) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('pageerror', error => errors.push(`pageerror: ${String(error).slice(0, 300)}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text().slice(0, 300)}`); });
  await page.routeWebSocket('**', socket => socket.close());
  await routeSceneState(page, readFileSync(path, 'utf8'));
  const refused = sceneStateRefusal(page);
  const started = Date.now();
  await page.goto(`${url}?phase10-proof=1`);
  try {
    await Promise.race([page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 60_000 }), refused]);
    target.admitted = true;
    target.tick = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().tick);
  } catch (error) {
    target.admitted = false; target.error = String(error).slice(0, 400);
  }
  target.seconds = Math.round((Date.now() - started) / 100) / 10;
  target.pageErrors = errors.slice(0, 6);
  await page.close();
}
await attempt(result.old, oldPath);
await attempt(result.current, currentPath);
await browser.close();
result.pass = result.old.admitted === false && /StaleSceneStateError/.test(result.old.error ?? '') && result.current.admitted === true;
writeFileSync(out, JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify(result));
process.exitCode = result.pass ? 0 : 1;
