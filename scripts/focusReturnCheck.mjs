// TOUCH-1 gate 4: after a button click, a click / tap on the map gives the map the keyboard back at once. For each
// build (--base: trunk before TOUCH-1, --url: this build) and each device (mouse click, touch tap), from the default
// new game, paused: press the "1배속" speed seal, then "일시 정지" (focus stays on that button), press / tap an empty map
// point, then press E (next placement tool). The road tool must be armed and the focus no longer on the button.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/focusReturnCheck.mjs <out.json> --base <url> [--url <url>]
import { writeFile } from 'node:fs/promises';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4291/';
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = [];
for (const [build, base] of [['trunk', flags.base], ['touch1', url]]) {
  for (const device of ['mouse', 'touch']) {
    const { context, page } = await openScene(browser, { state: null, tile: [44, 41], baseUrl: base, run: false, hasTouch: device === 'touch' });
    const cdp = device === 'touch' ? await context.newCDPSession(page) : null;
    const press = async (x, y) => {
      if (device === 'mouse') { await page.mouse.click(x, y); return; }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    for (const name of ['1배속', '일시 정지']) {
      const box = await page.getByRole('button', { name, exact: true }).boundingBox();
      await press(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(150);
    }
    const focusBefore = await page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.getAttribute('aria-label') ?? ''}`);
    await press(420, 330); await page.waitForTimeout(150);
    const focusAfter = await page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.getAttribute('aria-label') ?? ''}`);
    await page.keyboard.press('KeyE'); await page.waitForTimeout(150);
    const roadArmed = await page.evaluate(() => document.querySelector('button[aria-label="길"][aria-pressed="true"]') !== null
      || document.querySelector('.game-canvas--placement-armed') !== null);
    rows.push({ build, device, focusBefore, focusAfter, roadArmedByE: roadArmed });
    await context.close();
  }
}
await browser.close();
await writeFile(out, `${JSON.stringify({ base: flags.base, url, rows }, null, 2)}\n`);
for (const row of rows) console.log(JSON.stringify(row));
