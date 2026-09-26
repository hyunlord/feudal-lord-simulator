// R0-1 evidence: the new-game opening village (trunk vs this build), paused at tick 0 and after 3 s at 1x, around the
// four opening houses. Before, their empty larders raised three cold-house rings at once; now S2 / S4 / S8 wait one
// distribution cycle (250 ticks).
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/newGameSignCaptures.mjs <outDir> --base <url> --url <url>
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const CLIP = { x: 340, y: 175, width: 600, height: 450 };
await mkdir(outDir, { recursive: true });
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const [label, url] of [['before', flags.base], ['after', flags.url]]) {
  const { context, page } = await openScene(browser, { state: null, tile: [45, 41], baseUrl: url, dpr: 1, zoom: 1.35, run: false });
  await page.waitForTimeout(2_500); await page.mouse.move(640, 790); await page.waitForTimeout(300);
  await writeFile(join(outDir, `newgame-tick0-${label}.jpg`), await page.screenshot({ type: 'jpeg', quality: 72, clip: CLIP }));
  await context.close();
}
await browser.close();
console.log('newgame-tick0-before.jpg newgame-tick0-after.jpg');
