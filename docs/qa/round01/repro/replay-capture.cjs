// Read-only fixture replay into an isolated browser profile; never edits the game or source save.
const fs = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function checkLock() {
  if (await fs.stat('/tmp/fls-perf-measure.lock').then(() => true, () => false)) throw Error('Performance lock present; wait before QA.');
}
(async () => {
  await checkLock();
  const source = process.argv[2];
  const out = process.argv[3];
  if (!source || !out) throw Error('Usage: node replay-capture.cjs ORIGINAL_SAVE OUTPUT_DIRECTORY [1|3|5|paused]');
  const speed = process.argv[4] || 'paused';
  const raw = await fs.readFile(source);
  const bytes = source.endsWith('.gz') ? zlib.gunzipSync(raw) : raw;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4400/');
    await page.evaluate(async payload => {
      const { openSaveDatabase, IndexedDbSaveStorage } = await import('/src/platform/indexedDbSaveStorage.ts');
      const db = await openSaveDatabase(indexedDB, 5000);
      try { await new IndexedDbSaveStorage(db).write('manual', new Uint8Array(payload)); } finally { db.close(); }
    }, Array.from(bytes));
    await page.reload();
    await page.getByRole('button', { name: '이어하기', exact: true }).click();
    await page.waitForTimeout(800);
    const control = page.getByRole('button', { name: speed === 'paused' ? '일시 정지' : speed + '배속', exact: true });
    if (await control.getAttribute('aria-pressed') !== 'true') await control.click();
    await page.waitForTimeout(300);
    await fs.mkdir(out, { recursive: true });
    const start = Date.now(); const times = [];
    for (let i = 0; i < 20; i++) {
      await checkLock(); await pause(Math.max(0, start + i * 100 - Date.now()));
      const actualMs = Date.now() - start;
      await page.screenshot({ path: path.join(out, String(i).padStart(2, '0') + '.jpg'), type: 'jpeg', quality: 74 });
      times.push({ i, actualMs, endMs: Date.now() - start });
    }
    await fs.writeFile(path.join(out, 'capture.json'), JSON.stringify({ source, url: page.url(), speed, visibleText: await page.locator('body').innerText(), times }, null, 2));
  } finally { await browser.close(); }
})();
