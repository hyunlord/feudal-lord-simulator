// DEC-CARD-2 (the result thread) in the browser, on the DGX, at 1280 × 800 (JPEG, the whole view), on
// scripts/deccard2ResultsStates.ts's lord-mode states: "after choosing, I know what changed" —
//  - trace-chip: the season's chip "1300년 당신의 결정 때문에" opened (the decision, what followed, the factions' minds);
//  - trace-chronicle: its [연대기에서 보기] — the chronicle on that decision, its thread beside it;
//  - thread-decision / thread-because: a later season's chip (a suit's turn) opened to the suit's page (what followed, who
//    remembers it), then one of its lines — the turn's record, "1300년 당신의 결정 때문에" and its way back to the suit;
//  - year-lord: the town over 1300's turn at 10× — the year's card on the engine's yearReview, then [계속]: not again;
//  - year-loaded: a played game's save loaded early in 1301 with 1300's card unseen — it opens by itself;
//  - succession: the engine's succession — the house card first, and after [계속] its chip is gone (the read mark).
// Each: the card's smallest text (≥ 12 px), its box inside the view, its primaries. results.json beside them.
//   scripts/remote/run.sh render-DC2-results-captures-<sha7> --light -- bash scripts/deccard2ResultsCaptures.sh
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 확인(scripts/deccard2ResultsCaptures.mjs)", { remote: "scripts/remote/run.sh render-DC2-results-captures-<sha7> --light -- bash scripts/deccard2ResultsCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const scene = name => JSON.parse(readFileSync(join(flags.states, `${name}.json`), 'utf8'));
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const seatTile = state => { const seat = state.buildings.find(b => b.kind === 'manor_house') ?? state.buildings.find(b => b.kind === 'house') ?? state.buildings[0]; return [seat.tx, seat.ty]; };
const QUALITY = 50;
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const open = (state, options = {}) => openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: false, initScript: INIT, width: 1280, height: 800,
  query: '&story-delay=1500', loadTimeout: 90_000, zoom: 1.1, ...options });
const visible = (page, selector) => page.locator(`${selector} >> visible=true`).count().then(count => count > 0);
const waitFor = (page, selector, timeout) => page.locator(`${selector} >> visible=true`).first().waitFor({ timeout }).then(() => true, () => false);
/** The surface as shown: its text, its smallest text, its box and its buttons. */
const measure = (page, selector) => page.evaluate(sel => {
  const root = [...document.querySelectorAll(sel)].find(el => el.getBoundingClientRect().width > 0) ?? null;
  if (root === null) return null;
  const box = root.getBoundingClientRect();
  const texts = [...root.querySelectorAll('*')].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== ''));
  return { title: root.querySelector('h2, h3')?.textContent ?? null, text: root.innerText.slice(0, 1600),
    primary: root.querySelectorAll('.ui-btn--primary').length, buttons: [...root.querySelectorAll('button')].map(button => button.textContent).slice(0, 12),
    smallestText: Math.min(...texts.map(el => parseFloat(getComputedStyle(el).fontSize))),
    titles: root.querySelectorAll('[title]').length,
    box: { left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom), inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight } };
}, selector);
const shoot = async (page, name) => { const path = join(out, `${name}.jpg`); await page.screenshot({ path, type: 'jpeg', quality: QUALITY }); return statSync(path).size; };
const ok = row => row.card !== null && row.card.smallestText >= 12 && row.card.box.inside && row.card.primary === (row.primaries ?? 1) && row.card.titles === 0;
const rows = {}; let bytes = 0; const errors = [];
const report = (name, row, extra = true) => { row.pass = ok(row) && extra; rows[name] = row; console.log(`${row.pass ? 'ok ' : 'BAD'} ${name}: ${JSON.stringify({ ...row, card: row.card === null ? null : { ...row.card } })}`); };
const CHIP = '.event-chip[data-story="decision_trace"]';
const CARD = '.event-card[data-story="decision_trace"]';

// 1–2. The season's chip, its card, and the chronicle on its decision.
{
  const state = scene('trace-season');
  const { context, page } = await open(state);
  page.on('pageerror', error => errors.push(`trace: ${String(error).slice(0, 300)}`));
  const shown = await waitFor(page, CHIP, 30_000);
  const row = { state: 'trace-season', chip: shown, card: null, primaries: 0 };
  if (shown) {
    await page.locator(`${CHIP} >> visible=true`).first().click();
    await waitFor(page, CARD, 10_000);
    row.card = await measure(page, CARD);
    row.bytes = await shoot(page, 'trace-chip'); bytes += row.bytes;
  }
  report('trace-chip', row, shown && (row.card?.text ?? '').includes('당신의 결정 때문에'));
  if (shown) {
    await page.locator(`${CARD} .event-card-chronicle`).click();
    const opened = await waitFor(page, '.chronicle-thread', 20_000);
    await page.waitForTimeout(900);
    const picked = await page.locator('.chronicle-card[data-selected="true"]').first().getAttribute('data-record').catch(() => null);
    const chronicle = { state: 'trace-season', opened, picked, card: opened ? await measure(page, '.chronicle-detail') : null, primaries: 0 };
    if (opened) { chronicle.bytes = await shoot(page, 'trace-chronicle'); bytes += chronicle.bytes; }
    report('trace-chronicle', chronicle, opened && picked !== null);
  }
  await context.close();
}

// 3–4. A later season's chip (a suit's turn) to the suit's page, then one of its lines to the turn's record.
{
  const state = scene('trace-later');
  const { context, page } = await open(state);
  page.on('pageerror', error => errors.push(`thread: ${String(error).slice(0, 300)}`));
  const shown = await waitFor(page, CHIP, 30_000);
  const row = { state: 'trace-later', chip: shown, card: null, primaries: 0 };
  if (shown) {
    await page.locator(`${CHIP} >> visible=true`).first().click();
    await waitFor(page, CARD, 10_000);
    await page.locator(`${CARD} .event-card-chronicle`).click();
    row.opened = await waitFor(page, '.chronicle-thread[data-thread="decision"]', 20_000);
    await page.waitForTimeout(900);
    row.card = await measure(page, '.chronicle-thread[data-thread="decision"]');
    row.links = await page.locator('.chronicle-thread[data-thread="decision"] .chronicle-thread-link').count();
    if (row.opened) { row.bytes = await shoot(page, 'thread-decision'); bytes += row.bytes; }
  }
  report('thread-decision', row, row.opened === true && row.links > 0);
  if (row.opened === true && row.links > 0) {
    await page.locator('.chronicle-thread[data-thread="decision"] .chronicle-thread-link').first().click();
    const because = await waitFor(page, '.chronicle-thread[data-thread="because"]', 10_000);
    await page.waitForTimeout(700);
    const next = { state: 'trace-later', because, card: because ? await measure(page, '.chronicle-thread[data-thread="because"]') : null, primaries: 0 };
    if (because) { next.bytes = await shoot(page, 'thread-because'); bytes += next.bytes; }
    // Back to the decision by its link.
    if (because) { await page.locator('.chronicle-thread[data-thread="because"] .chronicle-thread-link').first().click(); next.back = await waitFor(page, '.chronicle-thread[data-thread="decision"]', 10_000); }
    report('thread-because', next, because && next.back === true && (next.card?.text ?? '').includes('당신의 결정 때문에'));
  }
  await context.close();
}

// 5. The year's card over 1300's turn (live), then [계속]: not again.
{
  const state = scene('year-eve');
  const { context, page } = await open(state, { run: true });
  page.on('pageerror', error => errors.push(`year: ${String(error).slice(0, 300)}`));
  await page.keyboard.press('Digit0');
  const selector = '.results-card.year-review';
  let opened = false; const putOff = [];
  for (let waited = 0; waited < 90_000 && !opened; waited += 500) {
    if (await visible(page, selector)) { opened = true; break; }
    if (await visible(page, '.season-ledger-resume')) { await page.locator('.season-ledger-resume >> visible=true').first().click(); putOff.push('season'); }
    else if (await visible(page, '.story-modal-later')) { const card = await page.locator('.story-modal >> visible=true').first().getAttribute('class'); putOff.push(card); await page.locator('.story-modal-later >> visible=true').first().click(); }
    await page.waitForTimeout(500);
  }
  const row = { state: 'year-eve', opened, putOff, card: opened ? await measure(page, selector) : null };
  if (opened) {
    row.source = await page.locator(selector).first().getAttribute('data-year-source');
    row.bytes = await shoot(page, 'year-lord'); bytes += row.bytes;
    await page.locator(`${selector} .results-card-continue`).click();
    await page.waitForTimeout(5_000);
    row.again = await visible(page, selector);
  }
  report('year-lord', row, opened && row.source === 'engine' && row.again === false);
  await context.close();
}

// 6. A played game's save with 1300's card unseen, loaded early in 1301: it opens by itself.
{
  const state = scene('year-loaded');
  const { context, page } = await open(state, { query: '&story-delay=20000' });
  const opened = await waitFor(page, '.results-card.year-review', 60_000);
  const row = { state: 'year-loaded', opened, card: opened ? await measure(page, '.results-card.year-review') : null };
  if (opened) { row.bytes = await shoot(page, 'year-loaded'); bytes += row.bytes; }
  report('year-loaded', row, opened);
  await context.close();
}

// 7. The engine's succession: the house card first; after [계속] its chip is gone (the save's read mark).
{
  const state = scene('succession');
  const { context, page } = await open(state, { query: '&story-delay=20000' });
  const selector = '.results-card.house-change';
  const opened = await waitFor(page, selector, 60_000);
  const row = { state: 'succession', opened, kind: opened ? await page.locator(selector).first().getAttribute('data-house-change') : null, card: opened ? await measure(page, selector) : null };
  if (opened) {
    row.bytes = await shoot(page, 'succession'); bytes += row.bytes;
    await page.locator(`${selector} .results-card-continue`).click();
    await page.waitForTimeout(3_000);
    row.chipAfter = await visible(page, '.event-chip[data-story="house_change"]');
    row.again = await visible(page, selector);
  }
  report('succession', row, opened && row.chipAfter === false && row.again === false);
  await context.close();
}

await browser.close();
writeFileSync(join(out, 'results.json'), JSON.stringify({ rows, bytes, errors }, null, 1));
if (errors.length > 0) console.log(`page errors: ${errors.join(' | ')}`);
const failed = Object.entries(rows).filter(([, row]) => !row.pass).map(([name]) => name);
console.log(`captures ${Object.keys(rows).length}, ${Math.round(bytes / 1024)} KB${failed.length === 0 ? '' : `; BAD ${failed.join(', ')}`}`);
process.exit(failed.length === 0 ? 0 : 1);
