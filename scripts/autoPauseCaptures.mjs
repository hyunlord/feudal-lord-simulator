// LM-R3 (lord slice LS-2) evidence of the lord-mode auto-pause in the browser, on the DGX: JPEGs at 1280 × 800 and on the
// tablet (1180 × 820, touch), from scripts/autoPauseStates.ts's states (the lord bot's seed 3, a few ticks before a stop),
// the story quiet (no chip or card opens over the notice). Each notice is measured: its smallest text (≥ 12 px), its
// smallest target (≥ 44 px; 48 on the tablet), its box inside the view, its primaries (one), `title=` attributes (none).
//  - running-<view> / stopped-<view>: `pause-due` run at 1×: time runs (the tick moves), the engine names a reason (a
//    great person's death) and the game stops by itself — the tick stands still, the notice says why; then [계속]: the
//    notice goes and time runs again;
//    The stops fall on a season's turn: a fresh profile's first season card opens too (season-<view>); closed by its
//    [계속], time stays stopped under the notice (the stop is the reason's, not the card's).
//  - suit-stopped / suit-link: `pause-due-suit` run until a suit is judged: the notice's [소송 보기] opens the ledger
//    screen on that suit;
//  - opt-out: `pause-due` with `?auto-pause=off` (the harnesses' query) runs past the stop's tick without stopping.
// results.json beside them.
//   scripts/remote/run.sh render-PAUSE-captures-<sha7> --light -- bash scripts/autoPauseCaptures.sh
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/autoPauseCaptures.mjs)", { remote: "scripts/remote/run.sh render-PAUSE-captures-<sha7> --light -- bash scripts/autoPauseCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const scene = name => JSON.parse(readFileSync(join(flags.states, `${name}.json`), 'utf8'));
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const seatTile = state => { const seat = state.buildings.find(b => b.kind === 'manor_house') ?? state.buildings.find(b => b.kind === 'house') ?? state.buildings[0]; return [seat.tx, seat.ty]; };
const QUIET = '&story-delay=600000';
const QUALITY = 60;
const MAX_BYTES = 600 * 1024;
const VIEWS = [{ name: '1280x800', width: 1280, height: 800, touch: false }, { name: 'tablet', width: 1180, height: 820, touch: true }];
const NOTICE = '.auto-pause-notice';
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const waitFor = (page, selector, timeout) => page.locator(`${selector} >> visible=true`).first().waitFor({ timeout }).then(() => true, () => false);
const tick = page => page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__?.state().tick ?? null);
const measure = page => page.evaluate(sel => {
  const root = [...document.querySelectorAll(sel)].find(el => el.getBoundingClientRect().width > 0) ?? null;
  if (root === null) return null;
  const box = root.getBoundingClientRect();
  const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const texts = [...root.querySelectorAll('*')].filter(el => shown(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== ''));
  const buttons = [...root.querySelectorAll('button')].filter(shown);
  return { text: root.innerText.slice(0, 1200), reasons: root.getAttribute('data-reasons'),
    primary: buttons.filter(button => button.classList.contains('ui-btn--primary')).map(button => button.textContent.trim()),
    links: buttons.filter(button => button.classList.contains('auto-pause-link')).map(button => button.textContent.trim()),
    smallestText: Math.min(...texts.map(el => parseFloat(getComputedStyle(el).fontSize))),
    smallestTarget: Math.min(...buttons.map(button => Math.min(button.getBoundingClientRect().width, button.getBoundingClientRect().height))),
    titles: root.querySelectorAll('[title]').length,
    box: { left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom), inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight } };
}, NOTICE);
const rows = {}; let bytes = 0; const errors = []; let largest = 0;
const shoot = async (page, name) => { const path = join(out, `${name}.jpg`); await page.screenshot({ path, type: 'jpeg', quality: QUALITY }); const size = statSync(path).size; bytes += size; largest = Math.max(largest, size); return size; };
const ok = (card, touch) => card !== null && card.smallestText >= 12 && card.smallestTarget >= (touch ? 48 : 44) && card.box.inside && card.primary.length === 1 && card.titles === 0;
const report = (name, row, extra = true) => { row.pass = extra && (row.card === undefined || ok(row.card, row.touch === true)); rows[name] = row; console.log(`${row.pass ? 'ok ' : 'BAD'} ${name}: ${JSON.stringify(row)}`); };
const open = (name, view, query = QUIET) => { const state = scene(name); return openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: false, initScript: INIT,
  width: view.width, height: view.height, hasTouch: view.touch, isMobile: view.touch, query, loadTimeout: 90_000, zoom: 1.1 }); };
const start = page => page.locator('.speed-seal[data-seal="normal"]').click();
/** The notice or the first season card, whichever shows; the card (shot as `name`) is closed by its [계속]. */
const seasonFirst = async (page, name) => {
  await waitFor(page, `${NOTICE}, .season-ledger-card`, 90_000);
  await page.waitForTimeout(1_200);
  if (await page.locator('.season-ledger-card >> visible=true').count() === 0) return null;
  const bytes = name === null ? 0 : await shoot(page, name);
  const at = await tick(page);
  await page.locator('.season-ledger-resume').first().click();
  return { bytes, at };
};
/** The tick now and after `ms` (time stands still: the same). */
const still = async (page, ms) => { const before = await tick(page); await page.waitForTimeout(ms); return { before, after: await tick(page) }; };

for (const view of VIEWS) {
  const { context, page } = await open('pause-due', view);
  page.on('pageerror', error => errors.push(`${view.name}: ${String(error).slice(0, 300)}`));
  const loaded = await tick(page);
  await start(page);
  await page.waitForTimeout(800);
  const running = { touch: view.touch, loaded, now: await tick(page), notice: await page.locator(NOTICE).count() };
  running.bytes = await shoot(page, `running-${view.name}`);
  report(`running-${view.name}`, running, running.now !== null && running.now > loaded && running.notice === 0);
  // The stop falls on a season's turn: a fresh profile's first season card opens too; closed, time stays stopped.
  const season = await seasonFirst(page, `season-${view.name}`);
  const stopped = { touch: view.touch, season, shown: await waitFor(page, NOTICE, 30_000) };
  await page.waitForTimeout(600);
  stopped.card = await measure(page);
  stopped.time = await still(page, 2_000);
  stopped.bytes = await shoot(page, `stopped-${view.name}`);
  report(`stopped-${view.name}`, stopped, stopped.shown && stopped.time.before === stopped.time.after && stopped.card?.reasons === 'major_death');
  await page.locator(`${NOTICE} .auto-pause-resume`).click();
  await page.waitForTimeout(1_200);
  const resumed = { notice: await page.locator(NOTICE).count(), time: await still(page, 1_000) };
  report(`resumed-${view.name}`, resumed, resumed.notice === 0 && resumed.time.after > resumed.time.before);
  await context.close();
}

{
  const view = VIEWS[0];
  const { context, page } = await open('pause-due-suit', view);
  page.on('pageerror', error => errors.push(`suit: ${String(error).slice(0, 300)}`));
  await start(page);
  const season = await seasonFirst(page, null);
  const stopped = { season, shown: await waitFor(page, NOTICE, 30_000) };
  await page.waitForTimeout(600);
  stopped.card = await measure(page);
  stopped.bytes = await shoot(page, 'suit-stopped');
  report('suit-stopped', stopped, stopped.shown && (stopped.card?.reasons ?? '').includes('judgment') && stopped.card.links.length > 0);
  await page.locator(`${NOTICE} .auto-pause-link`).first().click();
  const link = { opened: await waitFor(page, '.slot-panel.lord-screen', 15_000), notice: await page.locator(NOTICE).count() };
  await page.waitForTimeout(800);
  link.focused = await page.evaluate(() => document.querySelector('.slot-panel.lord-screen')?.innerText.slice(0, 400) ?? null);
  link.time = await still(page, 1_500);
  link.bytes = await shoot(page, 'suit-link');
  report('suit-link', link, link.opened && link.notice === 0 && link.time.before === link.time.after);
  await context.close();
}

{
  const { context, page } = await open('pause-due', VIEWS[0], `${QUIET}&auto-pause=off`);
  const stop = scene('pause-due').tick + 30;
  await start(page);
  const run = { stopTick: stop };
  // The first season card (the season's turn before the stop) stops time as a modal does; its [계속] goes on.
  for (let waited = 0; waited < 30_000 && ((await tick(page)) ?? 0) <= stop + 20; waited += 500) {
    if (await page.locator('.season-ledger-resume >> visible=true').count() > 0) await page.locator('.season-ledger-resume').first().click();
    await page.waitForTimeout(500);
  }
  run.now = await tick(page); run.notice = await page.locator(NOTICE).count();
  report('opt-out', run, run.now > stop + 20 && run.notice === 0);
  await context.close();
}

await browser.close();
const pass = Object.values(rows).every(row => row.pass) && errors.length === 0 && largest <= MAX_BYTES;
writeFileSync(join(out, 'results.json'), JSON.stringify({ pass, rows, bytes, largest, errors }, null, 1));
console.log(`${pass ? 'PASS' : 'FAIL'}: ${Object.keys(rows).length} rows, ${bytes} bytes (largest ${largest}), ${errors.length} page errors`);
process.exit(pass ? 0 : 1);
