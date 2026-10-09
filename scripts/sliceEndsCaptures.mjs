// LM-R3 phase 2a evidence (the lord slice's opening page and its end) in the browser, on the DGX: JPEGs at 1280 × 800 and on
// the tablet (1180 × 820, touch), each with the page's smallest text (≥ 12 px), its smallest target (≥ 44 px), its box
// inside the view, its primaries (one) and `title=` attributes (none):
//  - start-<view>: a new lord-slice game from the welcome (de Haverel) — no page while it stands at tick 0, its opening page
//    once time starts (the first tick), then [다스리기 시작]: not again;
//  - end-<view> / end-shaped-<view>: scripts/sliceEndsStates.ts's `slice-end` (seed 3 at 1320's first tick) — the end page
//    opens by itself after the load, then its decisions part scrolled into view;
//  - end-record: a decision's [연대기에서 이 결정 보기] — the chronicle on that record; closing it comes back to the page;
//  - end-reopen: [계속 다스리기], then the pause menu's [영주의 스무 해 돌아보기] opens it again;
//  - end-live: `slice-eve` (40 ticks before the end) run at 1×: the end page alone, by itself (the user's ruling: it takes
//    the end season's card's and 1319's year card's place); end-live-year-card / end-live-season-card: its two links, and
//    back; end-live-after: [계속 다스리기], then ten seconds of the town with nothing popping (1319's card marked seen).
//    `--only live` runs this part alone (results-live.json).
// results.json beside them.
//   scripts/remote/run.sh render-LMR3-slice-captures-<sha7> --light -- bash scripts/sliceEndsCaptures.sh
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/sliceEndsCaptures.mjs)", { remote: "scripts/remote/run.sh render-LMR3-slice-captures-<sha7> --light -- bash scripts/sliceEndsCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';
import { startFromWelcome } from './welcomeStart.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const scene = name => JSON.parse(readFileSync(join(flags.states, `${name}.json`), 'utf8'));
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const seatTile = state => { const seat = state.buildings.find(b => b.kind === 'manor_house') ?? state.buildings.find(b => b.kind === 'house') ?? state.buildings[0]; return [seat.tx, seat.ty]; };
const QUALITY = 60;
const MAX_BYTES = 600 * 1024;
const VIEWS = [{ name: '1280x800', width: 1280, height: 800, touch: false }, { name: 'tablet', width: 1180, height: 820, touch: true }];
const START = '.slice-page[data-slice="start"]';
const END = '.slice-page[data-slice="end"]';
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const waitFor = (page, selector, timeout) => page.locator(`${selector} >> visible=true`).first().waitFor({ timeout }).then(() => true, () => false);
const visible = (page, selector) => page.locator(`${selector} >> visible=true`).count().then(count => count > 0);
/** The page as shown: its title, text, smallest text and target, its box and its primaries. */
const measure = (page, selector) => page.evaluate(sel => {
  const root = [...document.querySelectorAll(sel)].find(el => el.getBoundingClientRect().width > 0) ?? null;
  if (root === null) return null;
  const box = root.getBoundingClientRect();
  const shown = el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const texts = [...root.querySelectorAll('*')].filter(el => shown(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== ''));
  const buttons = [...root.querySelectorAll('button')].filter(shown);
  const scroll = root.querySelector('.chapter-page-scroll');
  return { title: root.querySelector('h2')?.textContent ?? null, text: root.innerText.slice(0, 2400),
    primary: buttons.filter(button => button.classList.contains('ui-btn--primary')).map(button => button.textContent.trim()),
    smallestText: Math.min(...texts.map(el => parseFloat(getComputedStyle(el).fontSize))),
    smallestTarget: Math.min(...buttons.map(button => Math.min(button.getBoundingClientRect().width, button.getBoundingClientRect().height))),
    titles: root.querySelectorAll('[title]').length,
    scrolls: scroll === null ? null : { scrollHeight: scroll.scrollHeight, clientHeight: scroll.clientHeight },
    box: { left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom), inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight } };
}, selector);
const rows = {}; let bytes = 0; const errors = []; let largest = 0;
const shoot = async (page, name) => { const path = join(out, `${name}.jpg`); await page.screenshot({ path, type: 'jpeg', quality: QUALITY }); const size = statSync(path).size; bytes += size; largest = Math.max(largest, size); return size; };
const ok = card => card !== null && card.smallestText >= 12 && card.smallestTarget >= 44 && card.box.inside && card.primary.length === 1 && card.titles === 0;
const report = (name, row, extra = true) => { row.pass = extra && (row.card === undefined || ok(row.card)); rows[name] = row; console.log(`${row.pass ? 'ok ' : 'BAD'} ${name}: ${JSON.stringify(row)}`); };
const scrollTo = (page, selector) => page.evaluate(sel => { const target = document.querySelector(sel); const scroll = target?.closest('.chapter-page-scroll'); if (target && scroll) scroll.scrollTop = target.offsetTop - scroll.offsetTop - 8; }, selector);

// --only live: the live end alone (the user's ruling's capture).
const liveOnly = flags.only === 'live';
for (const view of liveOnly ? [] : VIEWS) {
  // The opening page: a new game from the welcome.
  {
    const context = await browser.newContext({ viewport: { width: view.width, height: view.height }, hasTouch: view.touch });
    await context.addInitScript(INIT);
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(`start ${view.name}: ${String(error).slice(0, 300)}`));
    await page.routeWebSocket('**', socket => socket.close());
    await page.goto(url, { timeout: 90_000 });
    await page.locator('.welcome-parchment').waitFor({ timeout: 90_000 });
    await page.waitForTimeout(1_200);
    await startFromWelcome(page, 'core:lord_slice');
    // A new game stands at its tick 0 until time starts; the page opens at the first tick (the factions are seated then).
    await page.waitForTimeout(2_000);
    const beforeTime = await visible(page, START);
    await page.locator('.speed-seal[data-seal="normal"]').click();
    const opened = await waitFor(page, START, 30_000);
    await page.waitForTimeout(1_500);
    const row = { view: view.name, beforeTime, opened, card: opened ? await measure(page, START) : null };
    if (opened) row.bytes = await shoot(page, `start-${view.name}`);
    if (opened) {
      await page.locator(`${START} .slice-begin`).click();
      await page.waitForTimeout(4_000);
      row.again = await visible(page, START);
    }
    report(`start-${view.name}`, row, !beforeTime && opened && row.again === false && (row.card?.text ?? '').includes('드 해버럴'));
    await context.close();
  }
  // The end page after a load.
  {
    const state = scene('slice-end');
    const { context, page } = await openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: false, initScript: INIT, width: view.width, height: view.height,
      hasTouch: view.touch, query: '&story-delay=1500', loadTimeout: 90_000, zoom: 1.1 });
    page.on('pageerror', error => errors.push(`end ${view.name}: ${String(error).slice(0, 300)}`));
    const opened = await waitFor(page, END, 30_000);
    await page.waitForTimeout(1_200);
    const row = { view: view.name, opened, card: opened ? await measure(page, END) : null };
    if (opened) row.bytes = await shoot(page, `end-${view.name}`);
    report(`end-${view.name}`, row, opened && (row.card?.text ?? '').includes('이 도시가 내 결정의 결과인가'));
    if (opened) {
      await scrollTo(page, `${END} .slice-shaped`);
      await page.waitForTimeout(400);
      const shaped = { view: view.name, decisions: await page.locator(`${END} .slice-decisions > li`).count(), records: await page.locator(`${END} .slice-record`).count() };
      shaped.bytes = await shoot(page, `end-shaped-${view.name}`);
      report(`end-shaped-${view.name}`, shaped, shaped.decisions > 0 && shaped.records === shaped.decisions);
    }
    if (opened && view.name === '1280x800') {
      // A decision's record in the chronicle, and back.
      const first = await page.locator(`${END} .slice-decisions > li`).first().getAttribute('data-record');
      await page.locator(`${END} .slice-record`).first().click();
      const chronicle = await waitFor(page, '.chronicle-screen', 20_000);
      await page.waitForTimeout(900);
      const picked = await page.locator('.chronicle-card[data-selected="true"]').first().getAttribute('data-record').catch(() => null);
      const record = { first, chronicle, picked };
      if (chronicle) record.bytes = await shoot(page, 'end-record');
      if (chronicle) { await page.locator('.chronicle-close').click(); await page.waitForTimeout(600); }
      record.back = await visible(page, END);
      report('end-record', record, chronicle && picked === first && record.back);
      // [계속 다스리기], then the pause menu opens it again.
      await page.locator(`${END} .slice-continue`).click();
      await page.waitForTimeout(3_000);
      const reopen = { closed: !(await visible(page, END)) };
      await page.keyboard.press('Escape');
      reopen.menu = await waitFor(page, '.pause-menu-slice-end', 5_000);
      if (reopen.menu) { await page.locator('.pause-menu-slice-end').click(); reopen.again = await waitFor(page, END, 5_000); await page.waitForTimeout(600); }
      if (reopen.again) reopen.bytes = await shoot(page, 'end-reopen');
      report('end-reopen', reopen, reopen.closed && reopen.menu && reopen.again === true);
    }
    await context.close();
  }
}

// The end coming live: 40 ticks before it at 1×. The user's ruling (2026-10-09): the end page alone — the end season's card
// and 1319's year card do not open by themselves; both are the page's links, and after [계속 다스리기] 1319's card does not pop.
{
  const state = scene('slice-eve');
  // LM-R3 pauseReasons: time runs on through the end's tick (a rights petition arrives on it; the auto-pause would stop it).
  const { context, page } = await openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: true, initScript: INIT, width: 1280, height: 800,
    query: '&story-delay=1500&auto-pause=off', loadTimeout: 90_000, zoom: 1.1 });
  page.on('pageerror', error => errors.push(`live: ${String(error).slice(0, 300)}`));
  const YEAR_CARD = '.results-card.year-review';
  const SEASON_CARD = '.season-ledger-card';
  const row = { order: [], end: false };
  for (let waited = 0; waited < 180_000 && !row.end; waited += 500) {
    for (const [name, card] of [['season', SEASON_CARD], ['year', YEAR_CARD]]) if (await visible(page, card) && !row.order.includes(name)) row.order.push(name);
    row.end = await visible(page, END);
    if (!row.end) await page.waitForTimeout(500);
  }
  if (row.end) {
    row.order.push('end');
    await page.waitForTimeout(800);
    row.card = await measure(page, END);
    row.lastYear = await page.locator(`${END} .slice-last-year`).getAttribute('data-year').catch(() => null);
    row.bytes = await shoot(page, 'end-live');
  }
  report('end-live', row, row.end && row.order.length === 1 && row.lastYear === '1319');
  if (row.end) {
    // The year card from its link, and back.
    await page.locator(`${END} .slice-year-card`).click();
    const year = { opened: await waitFor(page, YEAR_CARD, 10_000) };
    if (year.opened) {
      await page.waitForTimeout(700);
      year.title = await page.locator(`${YEAR_CARD} h2`).first().textContent();
      year.bytes = await shoot(page, 'end-live-year-card');
      await page.locator(`${YEAR_CARD} .results-card-continue`).click(); await page.waitForTimeout(500);
    }
    year.back = await visible(page, END);
    report('end-live-year-card', year, year.opened && (year.title ?? '').startsWith('1319년') && year.back);
    // The season card from its link, and back.
    await page.locator(`${END} .slice-season-card`).click();
    const season = { opened: await waitFor(page, SEASON_CARD, 10_000) };
    if (season.opened) {
      await page.waitForTimeout(900);
      season.title = await page.locator(`${SEASON_CARD} h2`).first().textContent();
      season.bytes = await shoot(page, 'end-live-season-card');
      await page.locator(`${SEASON_CARD} .season-ledger-resume`).click(); await page.waitForTimeout(500);
    }
    season.back = await visible(page, END);
    report('end-live-season-card', season, season.opened && season.back);
    // [계속 다스리기]: the town runs on at 1×, and 1319's card (marked seen as the page opened) does not pop.
    await page.locator(`${END} .slice-continue`).click();
    const after = { popped: [] };
    for (let waited = 0; waited < 10_000; waited += 500) {
      for (const [name, card] of [['season', SEASON_CARD], ['year', YEAR_CARD], ['end', END]]) if (await visible(page, card) && !after.popped.includes(name)) after.popped.push(name);
      await page.waitForTimeout(500);
    }
    report('end-live-after', after, after.popped.length === 0);
  }
  await context.close();
}

await browser.close();
const pass = Object.values(rows).every(row => row.pass) && errors.length === 0 && largest <= MAX_BYTES;
writeFileSync(join(out, liveOnly ? 'results-live.json' : 'results.json'), JSON.stringify({ pass, rows, bytes, largest, errors }, null, 1));
console.log(`${pass ? 'PASS' : 'FAIL'}: ${Object.keys(rows).length} rows, ${bytes} bytes (largest ${largest}), ${errors.length} page errors`);
process.exit(pass ? 0 : 1);
