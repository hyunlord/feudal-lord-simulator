// UX-1 gate 3 in the browser: (a) the tutorial stopped mid-script, saved, the page reloaded and the save continued
// shows the same goal card and the same locks; (b) switching the tutorial off in the settings opens every category and
// the zone layer at once, and switching it back on restores the card.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/tutorialOffResume.mjs <out.json> [--url ...] [--presses 11]
import { writeFile } from 'node:fs/promises';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4213/';
const presses = Number(flags.presses ?? 11);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
await page.routeWebSocket('**', socket => socket.close());
const ready = async () => { await page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 60_000 }); await page.waitForTimeout(1_000); };
const snapshot = () => page.evaluate(() => ({
  card: document.querySelector('[data-tutorial-cta]')?.getAttribute('data-tutorial-cta') ?? null,
  cardText: [...document.querySelectorAll('.goal-card:not(.goal-card--done):not(.goal-card--already) .goal-card-title')].map(node => node.textContent).join(' / '),
  categories: [...document.querySelectorAll('.build-menu-category[data-category]')].map(button => `${button.getAttribute('data-category')}:${button.getAttribute('aria-disabled') === 'true' ? 'locked' : 'open'}`),
  layers: [...document.querySelectorAll('.control-layer')].map(button => `${button.getAttribute('data-layer')}:${button.getAttribute('aria-disabled') === 'true' ? 'locked' : 'open'}`),
  // Tutorial locks only (a building the settlement stage has not opened keeps its era lock with the tutorial off).
  lockedTools: [...document.querySelectorAll('.build-tool[data-locked="tutorial"], .zone-tool.build-tool--locked')].length,
  eraLockedTools: [...document.querySelectorAll('.build-tool[data-locked="era"]')].length,
  tick: window.__FEUDAL_PHASE10_PROOF__.state().tick,
}));
await page.goto(`${url}?phase10-proof=1`); await ready();
await page.locator('.welcome-parchment [data-scenario]').first().click(); await page.waitForTimeout(800);
for (let i = 0; i < presses; i += 1) { await page.locator('[data-tutorial-cta]').first().click(); await page.waitForTimeout(600); }
await page.waitForTimeout(1_600);
const beforeSave = await snapshot();
await page.locator('.settings-disclosure > summary').click();
await page.getByRole('button', { name: '지금 저장' }).click(); await page.waitForTimeout(800);
await page.reload(); await ready();
await page.getByRole('button', { name: '이어하기' }).click(); await page.waitForTimeout(2_000);
const afterResume = await snapshot();
// (b) off, then on again.
await page.locator('.settings-disclosure > summary').click();
await page.locator('.hud-time-cluster .tutorial-switch').click(); await page.waitForTimeout(600);
const off = await snapshot();
await page.locator('.hud-time-cluster .tutorial-switch').click(); await page.waitForTimeout(600);
const onAgain = await snapshot();
const strip = value => ({ card: value.card, categories: value.categories, layers: value.layers });
const result = {
  url, presses, beforeSave, afterResume, off, onAgain,
  resumeIdentical: JSON.stringify(strip(beforeSave)) === JSON.stringify(strip(afterResume)),
  offOpensAll: off.categories.every(item => item.endsWith(':open')) && off.layers.includes('zone:open') && off.lockedTools === 0,
  onRestores: JSON.stringify(strip(onAgain)) === JSON.stringify(strip(afterResume)),
};
await writeFile(out, JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify({ resumeIdentical: result.resumeIdentical, offOpensAll: result.offOpensAll, onRestores: result.onRestores, before: strip(beforeSave), after: strip(afterResume), off: strip(off), offLocked: off.lockedTools }, null, 1));
await browser.close();
