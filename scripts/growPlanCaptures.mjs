// GROW-BLOCK (the screen's part) in the browser, on the DGX: lord mode's era console with its palisade plan opened by
// the primary ("마을의 목책 계획"), on the bot's state of each stage (scripts/growPlanStates.ts, ~/fls-growplan-states) and
// the console closed (lmr2 offer-countered), at 1280 × 800 and the tablet (1180 × 820, touch). JPEG of the view.
// Each: one primary in the console, its smallest text (≥ 12 px), its buttons ≥ 44 px tall, no title=, the plan's stage.
// results.json beside them.
//   scripts/remote/run.sh render-GROWPLAN-captures-<sha7> --light -- bash scripts/growPlanCaptures.sh
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 확인(scripts/growPlanCaptures.mjs)", { remote: "scripts/remote/run.sh render-GROWPLAN-captures-<sha7> --light -- bash scripts/growPlanCaptures.sh", entry: import.meta.url });
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const sceneAt = (dir, name) => { const path = join(dir, `${name}.json`); return existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null; };
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const seatTile = state => { const house = state.buildings.find(b => b.kind === 'house') ?? state.buildings[0]; return [house.tx, house.ty]; };
const QUALITY = 50;
const VIEWS = [{ id: '1280x800', width: 1280, height: 800, hasTouch: false }, { id: 'tablet', width: 1180, height: 820, hasTouch: true }];
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const click = (page, selector) => page.locator(`${selector} >> visible=true`).first().click({ timeout: 10_000 }).then(() => true, () => false);
const waitFor = (page, selector, timeout) => page.locator(`${selector} >> visible=true`).first().waitFor({ timeout }).then(() => true, () => false);
/** The console as shown: its stage, its primaries, its smallest text, its buttons' heights, title attributes, its box. */
const measure = page => page.evaluate(() => {
  const root = [...document.querySelectorAll('.era-console')].find(el => el.getBoundingClientRect().width > 0) ?? null;
  if (root === null) return null;
  const texts = [...root.querySelectorAll('*')].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== ''));
  const buttons = [...root.querySelectorAll('button')].filter(button => button.getBoundingClientRect().width > 0);
  const box = root.getBoundingClientRect();
  return { stage: root.querySelector('.wall-plan')?.getAttribute('data-wall-plan-stage') ?? null, text: root.innerText.slice(0, 1600),
    primaries: root.querySelectorAll('.ui-btn--primary').length, smallestText: texts.length === 0 ? null : Math.min(...texts.map(el => parseFloat(getComputedStyle(el).fontSize))),
    buttons: buttons.map(button => ({ text: button.textContent, height: Math.round(button.getBoundingClientRect().height) })), titles: root.querySelectorAll('[title]').length,
    box: { left: Math.round(box.left), width: Math.round(box.width), right: Math.round(box.right), inside: box.left >= 0 && box.right <= innerWidth } };
});
const rows = {}; let bytes = 0; const errors = [];
const SCENES = [
  { name: 'console-closed', dir: flags.lord2, state: 'offer-countered', open: false },
  ...['waiting', 'sites', 'searching', 'asked', 'failed'].map(stage => ({ name: `plan-${stage}`, dir: flags.states, state: `plan-${stage}`, open: true, stage })),
];
for (const scene of SCENES) {
  const state = sceneAt(scene.dir, scene.state);
  if (state === null) { rows[scene.name] = { missing: true, pass: scene.stage === 'searching' || scene.stage === 'asked' }; console.log(`-- ${scene.name}: no state`); continue; }
  for (const view of VIEWS) {
    const { context, page } = await openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: false, initScript: INIT, width: view.width, height: view.height,
      hasTouch: view.hasTouch, query: '&story-delay=600000', loadTimeout: 90_000, zoom: 1.1 });
    page.on('pageerror', error => errors.push(`${scene.name} ${view.id}: ${String(error).slice(0, 300)}`));
    await click(page, '.goal-drawer-toggle'); await page.waitForTimeout(600);
    await click(page, '.settlement-progress > details > summary'); await page.waitForTimeout(600);
    if (scene.open) { await click(page, "[data-wall-plan='open']"); await waitFor(page, '.wall-plan', 10_000); }
    const focus = scene.open ? '.wall-plan' : '.era-console .era-action-reason';
    if (await waitFor(page, focus, 5_000)) { await page.locator(`${focus} >> visible=true`).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(300); }
    const card = await measure(page);
    const name = `${scene.name}-${view.id}`;
    const path = join(out, `${name}.jpg`);
    await page.screenshot({ path, type: 'jpeg', quality: QUALITY });
    const size = statSync(path).size; bytes += size;
    const pass = card !== null && card.primaries === 1 && (card.smallestText ?? 12) >= 12 && card.titles === 0 && card.box.inside && size <= 600 * 1024
      && card.buttons.every(button => button.height >= 44) && (scene.open ? card.stage === scene.stage : card.stage === null);
    rows[name] = { state: scene.state, card, bytes: size, pass };
    console.log(`${pass ? 'ok ' : 'BAD'} ${name}: ${JSON.stringify(rows[name])}`);
    await context.close();
  }
}
await browser.close();
writeFileSync(join(out, 'results.json'), JSON.stringify({ rows, bytes, errors }, null, 1));
if (errors.length > 0) console.log(`page errors: ${errors.join(' | ')}`);
const failed = Object.entries(rows).filter(([, row]) => !row.pass).map(([name]) => name);
console.log(`captures ${Object.keys(rows).length}, ${Math.round(bytes / 1024)} KB${failed.length === 0 ? '' : `; BAD ${failed.join(', ')}`}`);
process.exit(failed.length === 0 && errors.length === 0 ? 0 : 1);
