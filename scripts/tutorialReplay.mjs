// UX-1 gate 1: cold-start replay. A fresh browser profile opens the game, starts the campaign from the welcome with the
// tutorial on, then presses ONLY the goal card buttons (`[data-tutorial-cta]`) until the 13-step first-session script
// is done. One capture per step (the card it shows), the step order, the press count and the game state at the end.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/tutorialReplay.mjs <outDir> [--url ...] [--width 1280 --height 800]
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4213/';
const width = Number(flags.width ?? 1280); const height = Number(flags.height ?? 800);
const STEPS = ['greet', 'well', 'well_done', 'house', 'road', 'arable', 'arable_limits', 'food_chain', 'granary', 'zone_unlock', 'burgage', 'burgage_done', 'wrap_up'];

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.routeWebSocket('**', socket => socket.close());
await page.goto(`${url}?phase10-proof=1`);
await page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 60_000 });
const startedAt = Date.now();
// New game from the welcome: the tutorial toggle is on by default; the campaign mode button starts it.
await page.locator('.welcome-parchment [data-scenario]').first().click();
await page.waitForTimeout(1_200);
const stepOf = () => page.evaluate(() => document.querySelector('[data-tutorial-cta]')?.getAttribute('data-tutorial-cta') ?? null);
const rows = []; const seen = new Set(); let presses = 0; let last = null;
for (let guard = 0; guard < 80; guard += 1) {
  const step = await stepOf();
  if (step === null || !STEPS.includes(step)) break;
  if (!seen.has(step)) {
    seen.add(step);
    await page.waitForTimeout(400);
    const file = `${String(seen.size).padStart(2, '0')}-${step}.jpg`;
    await writeFile(join(outDir, file), await page.screenshot({ type: 'jpeg', quality: 62 }));
    const card = await page.locator('.goal-card:not(.goal-card--done):not(.goal-card--already)').last().innerText();
    const categories = await page.$$eval('.build-menu-category[data-category]', buttons => buttons.map(button => `${button.getAttribute('data-category')}:${button.getAttribute('aria-disabled') === 'true' ? 'locked' : 'open'}`));
    const layers = await page.$$eval('.control-layer', buttons => buttons.map(button => `${button.getAttribute('data-layer')}:${button.getAttribute('aria-disabled') === 'true' ? 'locked' : 'open'}`));
    const advisor = await page.locator('.steward-line').count() ? await page.locator('.steward-line').innerText() : null;
    rows.push({ step, file, atSeconds: Math.round((Date.now() - startedAt) / 100) / 10, card: card.replace(/\n+/g, ' | '), categories, layers, advisor, pressesBefore: presses });
  }
  const label = await page.locator(`[data-tutorial-cta="${step}"]`).innerText();
  await page.locator(`[data-tutorial-cta="${step}"]`).click();
  presses += 1;
  rows[rows.length - 1].presses = [...(rows[rows.length - 1].presses ?? []), label];
  await page.waitForTimeout(700);
  if (step === last && presses > 70) break;
  last = step;
}
await page.waitForTimeout(1_600);
await writeFile(join(outDir, '14-after.jpg'), await page.screenshot({ type: 'jpeg', quality: 62 }));
const state = await page.evaluate(() => {
  const s = window.__FEUDAL_PHASE10_PROOF__.state();
  return { tick: s.tick, speed: document.querySelector('.speed-seal[aria-pressed="true"]')?.getAttribute('aria-label') ?? null,
    sites: s.constructionSites.map(site => `${site.kind}@${site.tx},${site.ty}`), zones: (s.zones ?? []).map(zone => `${zone.kind}:${zone.membership.length}`),
    buildings: s.buildings.length };
});
const cardsAfter = await page.$$eval('.goal-card', cards => cards.map(card => card.innerText.replace(/\n+/g, ' | ')));
const result = { url, viewport: { width, height }, stepsCompleted: rows.length, allSteps: STEPS.every(step => seen.has(step)), presses, seconds: Math.round((Date.now() - startedAt) / 1000), rows, state, cardsAfter };
await writeFile(join(outDir, 'replay.json'), JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify({ steps: rows.map(row => row.step), presses, allSteps: result.allSteps, state: result.state, cardsAfter }, null, 1));
await browser.close();
