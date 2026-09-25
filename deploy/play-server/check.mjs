// Browser check of the play server (PLAY-1 gates 1 and 5), run from any machine on the tailnet with Chrome:
//   ssh -N -L 4174:100.70.109.50:4173 hyunlord@100.70.109.50 &     (the proof port only opens on localhost)
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node deploy/play-server/check.mjs \
//     [http://100.70.109.50:4173/] [outDir] [http://127.0.0.1:4174/]
//  - Gate 1: opens the same served build through the tunnel with ?phase10-proof=1 (the proof port records per-frame
//    work), starts a new game if the first screen offers one, lets it run 12 s and reads frameWorkMs (median / p95
//    of the last 240 frames).
//  - Gate 5: on the real address (IndexedDB is per origin): starts a new game, lets it run, sends the page to the
//    background (the game saves on `hidden`), reads the save store, reloads and reads it again.
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const url = process.argv[2] ?? 'http://100.70.109.50:4173/';
const outDir = process.argv[3] ?? null;
const proofBase = process.argv[4] ?? 'http://127.0.0.1:4174/';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright-core');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const proofUrl = `${proofBase}?phase10-proof=1`;
await page.goto(proofUrl, { waitUntil: 'load' });
await page.waitForTimeout(3000);
const clickSpeed = async name => {
  const button = page.getByRole('button', { name, exact: true });
  if (await button.count() === 0) return false;
  await button.first().click(); await page.waitForTimeout(300); return true;
};
const clickNewGame = async () => {
  for (const name of ['목표형으로 시작', '새 게임', '새 게임 시작']) {
    const button = page.getByRole('button', { name, exact: true });
    if (await button.count() > 0 && await button.first().isVisible()) { await button.first().click(); await page.waitForTimeout(1500); return name; }
  }
  return null;
};
const started = await clickNewGame();
await page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 30_000 });
const running = await clickSpeed('1배속');
await page.waitForTimeout(12_000);
const work = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().work);
const percentile = (values, p) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]; };
const frames = work.frameWorkMs;
const gate1 = { frames: frames.length, frameCount: work.frameCount, medianMs: percentile(frames, 0.5), p95Ms: percentile(frames, 0.95), tick: await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().tick) };
const badge = await page.evaluate(() => document.getElementById('fls-play-build')?.textContent ?? null);
const loaded = await page.evaluate(() => ({ canvas: document.querySelectorAll('canvas').length, title: document.title }));
if (outDir !== null) { await mkdir(outDir, { recursive: true }); await page.screenshot({ path: join(outDir, 'new-game.jpg'), type: 'jpeg', quality: 70 }); }

// Gate 5 on the real origin.
await page.goto(url, { waitUntil: 'load' });
await page.waitForTimeout(3000);
const startedReal = await clickNewGame();
const runningReal = await clickSpeed('5배속');
await page.waitForTimeout(8000);
// Pausing saves (autosave reason `pause`), as does sending the page to the background.
const paused = await clickSpeed('일시 정지');
const readSaves = () => page.evaluate(() => new Promise(resolve => {
  const request = indexedDB.open('feudal-lord-simulator-saves');
  request.onerror = () => resolve({ error: String(request.error) });
  request.onsuccess = () => {
    const db = request.result; const stores = [...db.objectStoreNames]; const out = {};
    if (stores.length === 0) { resolve({ stores }); return; }
    const tx = db.transaction(stores, 'readonly'); let pending = stores.length;
    for (const store of stores) {
      const keys = tx.objectStore(store).getAllKeys();
      keys.onsuccess = () => { out[store] = keys.result.map(String); if (--pending === 0) resolve({ stores, keys: out }); };
    }
  };
}));
await page.waitForTimeout(3000);
await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
await page.waitForTimeout(2500);
const beforeReload = await readSaves();
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(3000);
const afterReload = await readSaves();
const firstScreen = await page.evaluate(() => [...document.querySelectorAll('button')].map(button => button.textContent?.trim()).filter(Boolean).slice(0, 12));
if (outDir !== null) await page.screenshot({ path: join(outDir, 'after-reload.jpg'), type: 'jpeg', quality: 70 });
await browser.close();
const result = { url, proofUrl, started, running, startedReal, runningReal, paused, badge, loaded, gate1, gate5: { beforeReload, afterReload, firstScreenButtons: firstScreen }, errors };
console.log(JSON.stringify(result, null, 2));
if (outDir !== null) await writeFile(join(outDir, 'check.json'), `${JSON.stringify(result, null, 2)}\n`);
