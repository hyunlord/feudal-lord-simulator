// UX-1 captures: the HUD before (trunk, --base) / after (this build) on a new game, the build menu before / after
// (production category open; this build with the tutorial off so every card shows), and the tutorial's well step at
// 1280x800, 1920x1080 and a 1024x768 tablet.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/ux1Captures.mjs <outDir> --base <url> [--url ...]
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4213/';
const OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const open = async (base, { width = 1280, height = 800, tutorialOff = false } = {}) => {
  const context = await browser.newContext({ viewport: { width, height } });
  if (tutorialOff) await context.addInitScript(OFF);
  const page = await context.newPage();
  await page.routeWebSocket('**', socket => socket.close());
  await page.goto(`${base}?phase10-proof=1`);
  await page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 60_000 });
  await page.locator('.welcome-parchment [data-scenario]').first().click();
  await page.waitForTimeout(1_500);
  return { context, page };
};
const shot = async (page, name) => writeFile(join(outDir, name), await page.screenshot({ type: 'jpeg', quality: 60 }));
const rows = [];
for (const [label, base] of [['before', flags.base], ['after', url]]) {
  const hud = await open(base);
  await shot(hud.page, `hud-${label}.jpg`); rows.push({ file: `hud-${label}.jpg`, build: base, view: 'new game, first frame after the welcome' });
  await hud.context.close();
  const menu = await open(base, { tutorialOff: true });
  await menu.page.locator('button.build-menu-category', { hasText: /^(생산|생업)/ }).first().click(); await menu.page.waitForTimeout(500);
  await shot(menu.page, `menu-${label}.jpg`); rows.push({ file: `menu-${label}.jpg`, build: base, view: 'production category open (this build: tutorial off, every card)' });
  await menu.context.close();
}
for (const [width, height] of [[1280, 800], [1920, 1080], [1024, 768]]) {
  const { context, page } = await open(url, { width, height });
  for (let i = 0; i < 2; i += 1) { await page.locator('[data-tutorial-cta]').first().click(); await page.waitForTimeout(700); }
  const name = `tutorial-well-${width}x${height}.jpg`;
  await shot(page, name); rows.push({ file: name, build: url, view: 'tutorial step 2 (well): card, steward, pulse, halo' });
  await context.close();
}
await browser.close();
await writeFile(join(outDir, 'captures.json'), JSON.stringify(rows, null, 1) + '\n');
console.log(rows.map(row => row.file).join(' '));
