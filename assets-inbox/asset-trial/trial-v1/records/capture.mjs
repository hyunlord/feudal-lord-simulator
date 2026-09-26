import { chromium } from '/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = process.env.TRIAL_URL || 'http://127.0.0.1:3201/';
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
const entries = [];
const assets = ['buildings/house_l0.png', 'foliage/tree_oak_large.png', 'terrain/grass.png'];
try {
  for (const width of [1440, 768, 375]) {
    for (const variant of ['baseline', 'candidate']) {
      const height = width === 1440 ? 900 : width === 768 ? 1024 : 812;
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      const errors = [], routeHits = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      await page.addInitScript(() => localStorage.setItem('feudal-lord-simulator:welcome-dismissed:v1', '1'));
      if (variant === 'candidate') for (const asset of assets) {
        await page.route('**/assets/' + asset, async route => {
          routeHits.push(asset);
          await route.fulfill({ path: path.join(root, 'candidates', path.basename(asset)), contentType: 'image/png' });
        });
      }
      await page.goto(baseUrl + '?phase10-proof=1', { waitUntil: 'networkidle' });
      await page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__?.diagnosis().assets.every(asset => asset.status === 'ready'));
      const welcome = page.locator('.welcome-dismiss-layer');
      if (await welcome.count()) await welcome.click();
      await page.waitForTimeout(600);
      const point = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint({ tx: 46, ty: 40 }));
      const from = { x: width * 0.4, y: height * 0.4 };
      await page.mouse.move(from.x, from.y);
      await page.mouse.down({ button: 'middle' });
      await page.mouse.move(from.x + width * 0.60 - point.clientX, from.y + height * 0.52 - point.clientY, { steps: 6 });
      await page.mouse.up({ button: 'middle' });
      await page.mouse.move(width * 0.5, height - 80);
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const proof = await page.evaluate(() => ({
        state: window.__FEUDAL_PHASE10_PROOF__.snapshot(),
        render: window.__FEUDAL_PHASE10_PROOF__.diagnosis(),
        cottage: window.__FEUDAL_PHASE10_PROOF__.tileClientPoint({ tx: 46, ty: 40 }),
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      assert.equal(proof.state.tick, 0, 'Comparison must stay paused');
      assert.equal(errors.length, 0, 'Browser errors: ' + errors.join('; '));
      if (variant === 'candidate') assert.deepEqual([...new Set(routeHits)].sort(), [...assets].sort());
      const prefix = variant + '-' + width;
      await page.screenshot({ path: path.join(root, 'evidence', prefix + '.png') });
      if (width === 1440) {
        await page.keyboard.press('o');
        await page.screenshot({ path: path.join(root, 'evidence', prefix + '-outline.png') });
        await page.keyboard.press('o');
        await page.mouse.move(proof.cottage.clientX, proof.cottage.clientY - 20);
        await page.screenshot({ path: path.join(root, 'evidence', prefix + '-hover.png') });
      }
      entries.push({ variant, width, height, routeHits, errors, ...proof });
      await page.close();
    }
    const pair = entries.filter(entry => entry.width === width);
    assert.deepEqual(pair[0].state, pair[1].state, 'Scene snapshots must match');
    assert.deepEqual(pair[0].render.camera, pair[1].render.camera, 'Camera must match');
    assert.ok(Math.abs(pair[0].cottage.clientX - pair[1].cottage.clientX) < 1 && Math.abs(pair[0].cottage.clientY - pair[1].cottage.clientY) < 1, 'Camera anchor must match: ' + JSON.stringify(pair.map(entry => entry.cottage)));
  }
  await writeFile(path.join(root, 'evidence/browser-proof.json'), JSON.stringify(entries, null, 2));
  console.log(JSON.stringify(entries.map(entry => ({ variant: entry.variant, width: entry.width, tick: entry.state.tick, routeHits: entry.routeHits, errors: entry.errors, overflow: entry.overflow, drawn: [...new Set(entry.render.spriteDraws.recent.filter(draw => draw.drawn).map(draw => draw.key))] })), null, 2));
} finally { await browser.close(); }
