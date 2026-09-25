// F0-V gate 1: one building site watched from placement to completion in a fresh campaign game (tutorial on, goal
// card buttons only, 1x). The tutorial's well is placed first; then the replay continues to the food-chain step and
// its barn (timber 20: several carter arrivals). The camera zooms in on the watched site. A capture is taken
// whenever the site's delivered share or stage changes, and at 0.3 / 0.7 / 1.1 s after it completes. The site
// history (delivered, builder ticks, stall per 100 ms sample) is written next to the captures.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/constructionObservation.mjs <outDir> [--url ...] [--kind farmstead]
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4241/';
const kind = flags.kind ?? 'farmstead';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.routeWebSocket('**', socket => socket.close());
await page.goto(`${url}?phase10-proof=1`);
await page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 60_000 });
await page.locator('.welcome-parchment [data-scenario]').first().click();
await page.waitForTimeout(1_200);
const sites = () => page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().constructionSites.map(site => ({ id: site.id, kind: site.kind, tx: site.tx, ty: site.ty,
  delivered: site.delivered, required: site.required, builderTicks: site.builderTicks, requiredBuilderTicks: site.requiredBuilderTicks, stall: site.stall, builders: site.assignedBuilders })));
// Press goal-card buttons until a site of the watched kind exists; the press that places it is followed at once by
// a click on the pause seal (Space would press the focused card button again), so the camera is set before the
// carters arrive. The camera zooms in to its limit (1.35).
let watched = null;
for (let guard = 0; guard < 60 && watched === null; guard += 1) {
  const cta = page.locator('[data-tutorial-cta]').first();
  if (await cta.count() === 0) break;
  await cta.click();
  watched = (await sites()).find(site => site.kind === kind) ?? null;
  if (watched !== null) { await page.getByRole('button', { name: '일시 정지', exact: true }).click(); break; }
  await page.waitForTimeout(600);
}
if (watched === null) throw new Error(`no ${kind} site`);
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
// Drag the site to the view's centre, then zoom 2 on it (wheel notches at its point).
const at = () => page.evaluate(tile => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), { tx: watched.tx, ty: watched.ty });
let point = await at();
await page.mouse.move(point.clientX + 90, point.clientY + 60); await page.mouse.down(); await page.mouse.move(650, 480, { steps: 8 }); await page.mouse.up();
for (let i = 0; i < 4; i += 1) { point = await at(); await page.mouse.move(point.clientX, point.clientY); await page.mouse.wheel(0, -240); await page.waitForTimeout(150); }
point = await at();
await page.mouse.move(point.clientX + 90, point.clientY + 60); await page.mouse.down(); await page.mouse.move(650, 500, { steps: 8 }); await page.mouse.up();
await page.mouse.move(20, 700);
watched = (await sites()).find(site => site.id === watched.id);
const clip = async () => {
  const point = await page.evaluate(tile => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), { tx: watched.tx, ty: watched.ty });
  return { x: Math.max(0, Math.round(point.clientX - 180)), y: Math.max(0, Math.round(point.clientY - 170)), width: 360, height: 250 };
};
const rows = []; const shots = [];
const shot = async (name, note) => { const file = `${String(shots.length + 1).padStart(2, '0')}-${name}.jpg`; await writeFile(join(outDir, file), await page.screenshot({ type: 'jpeg', quality: 70, clip: await clip() })); shots.push({ file, note }); };
const shareOf = site => { const req = Object.values(site.required).reduce((a, b) => a + b, 0); const del = Object.entries(site.required).reduce((a, [r, n]) => a + Math.min(n, site.delivered[r] ?? 0), 0); return req === 0 ? 1 : del / req; };
const stageOf = site => { const p = site.requiredBuilderTicks === 0 ? 1 : site.builderTicks / site.requiredBuilderTicks; return p < 0.25 ? 0 : p < 0.55 ? 1 : p < 0.85 ? 2 : 3; };
let last = null; const started = Date.now();
await page.waitForTimeout(600);
await shot('placed', `site placed (paused), delivered ${JSON.stringify(watched.delivered)} of ${JSON.stringify(watched.required)}`);
await page.getByRole('button', { name: '1배속', exact: true }).click();
for (let t = 0; t < 900; t += 1) {
  const site = (await sites()).find(candidate => candidate.id === watched.id);
  const tick = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().tick);
  if (site === undefined) {
    rows.push({ ms: Date.now() - started, tick, completed: true });
    for (const [ms, name] of [[300, 'complete-0.3s'], [700, 'complete-0.7s'], [1100, 'complete-1.1s']]) { await page.waitForTimeout(ms - (ms === 300 ? 0 : ms === 700 ? 300 : 700)); await shot(name, `completion sequence +${ms} ms`); }
    break;
  }
  const key = { share: Math.round(shareOf(site) * 1000) / 1000, stage: stageOf(site) };
  rows.push({ ms: Date.now() - started, tick, delivered: site.delivered, builderTicks: site.builderTicks, builders: site.builders, stall: site.stall, ...key });
  if (last === null || key.share !== last.share || key.stage !== last.stage) {
    await shot(key.share < 1 ? `delivery-${Math.round(key.share * 100)}` : `stage-${key.stage}`, key.share !== last?.share ? `delivered share ${key.share}` : `stage ${key.stage}`);
    last = key;
  }
  await page.waitForTimeout(100);
}
await browser.close();
await writeFile(join(outDir, 'observation.json'), JSON.stringify({ url, kind, site: watched, shots, rows }, null, 1) + '\n');
console.log(JSON.stringify({ shots: shots.map(s => s.file), samples: rows.length }));
