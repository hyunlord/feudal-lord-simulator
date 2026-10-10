// MARKET-TOWN in the browser, on the DGX: the lord's town after the market charter's proclamation (scripts/marketTownStates.ts,
// ~/fls-market-states — one season after it, four years after it) at 1280 × 800 and the tablet (1180 × 820, touch), JPEG
// of the view: the town as it comes up (the HUD: the pill, the chips the state holds), the era console with the palisade
// plan's past line, the lord screen host on its first open page. Each: at most one primary in what is measured, its smallest
// text (≥ 12 px), its buttons ≥ 44 px tall (the tablet's 48), no title=; beside them the chips shown and the lord menu's
// open items. results.json beside them.
//   scripts/remote/run.sh render-MARKET-captures-<sha7> --light -- bash scripts/marketTownCaptures.sh
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 확인(scripts/marketTownCaptures.mjs)", { remote: "scripts/remote/run.sh render-MARKET-captures-<sha7> --light -- bash scripts/marketTownCaptures.sh", entry: import.meta.url });
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const seatTile = state => { const house = state.buildings.find(b => b.kind === 'house') ?? state.buildings[0]; return [house.tx, house.ty]; };
const QUALITY = 50;
const VIEWS = [{ id: '1280x800', width: 1280, height: 800, hasTouch: false }, { id: 'tablet', width: 1180, height: 820, hasTouch: true }];
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const click = (page, selector) => page.locator(`${selector} >> visible=true`).first().click({ timeout: 10_000 }).then(() => true, () => false);
const waitFor = (page, selector, timeout) => page.locator(`${selector} >> visible=true`).first().waitFor({ timeout }).then(() => true, () => false);
/** What a view shows under `root`: its primaries, smallest text, buttons' heights, title attributes, its box; and the HUD's chips and the lord menu. */
const measure = (page, root) => page.evaluate(selector => {
  const visible = el => { const box = el.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
  const host = [...document.querySelectorAll(selector)].find(visible) ?? null;
  const chips = [...document.querySelectorAll('.event-chip')].filter(visible).map(chip => chip.getAttribute('data-chip-id') ?? chip.getAttribute('data-story') ?? chip.textContent.trim());
  const nav = [...document.querySelectorAll('[data-lord-nav]')].map(item => ({ id: item.getAttribute('data-lord-nav'), open: !item.disabled }));
  if (host === null) return { found: false, chips, nav };
  const texts = [...host.querySelectorAll('*')].filter(el => visible(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== ''));
  const buttons = [...host.querySelectorAll('button')].filter(visible);
  const box = host.getBoundingClientRect();
  return { found: true, text: host.innerText.slice(0, 1200), primaries: host.querySelectorAll('.ui-btn--primary').length,
    smallestText: texts.length === 0 ? null : Math.min(...texts.map(el => parseFloat(getComputedStyle(el).fontSize))),
    buttons: buttons.map(button => ({ text: button.textContent.trim().slice(0, 40), height: Math.round(button.getBoundingClientRect().height) })),
    titles: host.querySelectorAll('[title]').length, pastLine: document.querySelector('.era-plan-done')?.textContent ?? null,
    box: { left: Math.round(box.left), top: Math.round(box.top), width: Math.round(box.width), height: Math.round(box.height), inside: box.left >= 0 && box.right <= innerWidth && box.bottom <= innerHeight },
    chips, nav };
}, root);
/** What each capture opens and measures. `town`: the view as it comes up (the HUD's pill measured). */
const SHOTS = [
  { name: 'town', root: '.status-pill', open: async () => {} },
  { name: 'era-console', root: '.era-console', open: async page => {
    await click(page, '.goal-drawer-toggle'); await page.waitForTimeout(600);
    await click(page, '.settlement-progress > details > summary'); await page.waitForTimeout(600);
    if (await waitFor(page, '.era-plan-done', 5_000)) { await page.locator('.era-plan-done >> visible=true').first().scrollIntoViewIfNeeded(); await page.waitForTimeout(300); }
  } },
  { name: 'lord-screen', root: '.slot-panel.lord-screen', open: async page => {
    await click(page, "[data-dock='ledger']"); await click(page, "[data-ledger-tab='lord']"); await click(page, '[data-lord-open]'); await page.waitForTimeout(800);
  } },
];
const rows = {}; let bytes = 0; const errors = [];
for (const name of ['market-proclaimed', 'market-years']) {
  const path = join(flags.states, `${name}.json`);
  if (!existsSync(path)) { rows[name] = { missing: true, pass: false }; console.log(`-- ${name}: no state`); continue; }
  const state = JSON.parse(readFileSync(path, 'utf8'));
  for (const view of VIEWS) for (const shot of SHOTS) {
    const { context, page } = await openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: false, initScript: INIT, width: view.width, height: view.height,
      hasTouch: view.hasTouch, query: '&story-delay=0', loadTimeout: 90_000, zoom: 1.1 });
    page.on('pageerror', error => errors.push(`${name} ${shot.name} ${view.id}: ${String(error).slice(0, 300)}`));
    // The chips the state holds come after the story's delay; a card that opened by itself is put off first.
    await page.waitForTimeout(4_000);
    await click(page, '.story-modal-later'); await click(page, '.season-ledger-resume'); await page.waitForTimeout(400);
    await shot.open(page);
    const seen = await measure(page, shot.root);
    const id = `${name}-${shot.name}-${view.id}`;
    const file = join(out, `${id}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: QUALITY });
    const size = statSync(file).size; bytes += size;
    const touch = view.hasTouch ? 48 : 44;
    const pass = seen.found && seen.primaries <= 1 && (seen.smallestText ?? 12) >= 12
      && seen.titles === 0 && size <= 600 * 1024 && seen.buttons.every(button => button.height >= touch) && (shot.name !== 'era-console' || seen.pastLine !== null);
    rows[id] = { state: name, shot: shot.name, view: view.id, measured: seen, bytes: size, pass };
    console.log(`${pass ? 'ok ' : 'BAD'} ${id}: ${JSON.stringify(rows[id])}`);
    await context.close();
  }
}
await browser.close();
writeFileSync(join(out, 'results.json'), JSON.stringify({ rows, bytes, errors }, null, 1));
if (errors.length > 0) console.log(`page errors: ${errors.join(' | ')}`);
const failed = Object.entries(rows).filter(([, row]) => !row.pass).map(([name]) => name);
console.log(`captures ${Object.keys(rows).length}, ${Math.round(bytes / 1024)} KB${failed.length === 0 ? '' : `; BAD ${failed.join(', ')}`}`);
process.exit(failed.length === 0 && errors.length === 0 ? 0 : 1);
