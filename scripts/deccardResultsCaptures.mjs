// DEC-CARD (result side) in the browser, on the DGX, at 1280 × 800 (JPEG, the whole view): "after choosing, I know what
// changed" —
//  - house-wardship: the lord's wardship begun on the tick the boundary dispute came (LM-R1 petitions set) — the house card
//    opens first, the petition's card after [계속] (Astra A3: before the petitions);
//  - house-lord-died: the lord dead (1304, the petitions set's pannage state);
//  - house-inherited: the neighbour's estate inherited (Wave 40 moments set), then its next act opens the estates screen
//    on that estate;
//  - actual-in: a big decision's actual written (scripts/deccardResultsStates.ts) — its chip and card;
//  - year-lord: the lord slice over a year's turn at 10× (the year's card at the next year's first tick, after the season's
//    card and any petition put off), then [계속]: the card does not come again;
//  - year-campaign: the 1302 campaign town over its turn (ui5 aging-eve).
// Each: the card's smallest text (≥ 12 px), its box inside the view, one primary button. results.json beside them.
//   scripts/remote/run.sh render-DECCARD-results-<sha7> --light -- bash scripts/deccardResultsCaptures.sh
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 확인(scripts/deccardResultsCaptures.mjs)", { remote: "scripts/remote/run.sh render-DECCARD-results-<sha7> --light -- bash scripts/deccardResultsCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const scene = (dir, name) => JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const seatTile = state => { const seat = state.buildings.find(b => b.kind === 'manor_house') ?? state.buildings.find(b => b.kind === 'house') ?? state.buildings[0]; return [seat.tx, seat.ty]; };
const QUALITY = 50;
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const open = (state, options = {}) => openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: false, initScript: INIT, width: 1280, height: 800,
  query: '&story-delay=3000', loadTimeout: 90_000, zoom: 1.1, ...options });
const visible = (page, selector) => page.locator(`${selector} >> visible=true`).count().then(count => count > 0);
/** The card as shown: its text, its smallest text, its box and its buttons. */
const measure = (page, selector) => page.evaluate(sel => {
  const root = document.querySelector(sel);
  if (root === null) return null;
  const box = root.getBoundingClientRect();
  const texts = [...root.querySelectorAll('*')].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== ''));
  return { title: root.querySelector('h2')?.textContent ?? null, text: root.innerText.slice(0, 1600),
    primary: root.querySelectorAll('.ui-btn--primary').length, buttons: [...root.querySelectorAll('button')].map(button => button.textContent),
    smallestText: Math.min(...texts.map(el => parseFloat(getComputedStyle(el).fontSize))),
    box: { left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom), inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight } };
}, selector);
const shoot = async (page, name) => { const path = join(out, `${name}.jpg`); await page.screenshot({ path, type: 'jpeg', quality: QUALITY }); return statSync(path).size; };
/** Shown whole, text 12 px or more, its primaries as expected (the cards one; the actual's story card none: no decision). */
const ok = row => row.card !== null && row.card.smallestText >= 12 && row.card.box.inside && row.card.primary === (row.primaries ?? 1);
const rows = {}; let bytes = 0; const errors = [];
const report = (name, row, extra = true) => { row.pass = ok(row) && extra; rows[name] = row; console.log(`${row.pass ? 'ok ' : 'BAD'} ${name}: ${JSON.stringify({ ...row, card: row.card === null ? null : { ...row.card, text: undefined } })}`); };

// 1–3. The house cards.
for (const [name, dir, file, kind] of [['house-wardship', flags.petitions, 'home-boundary_dispute', 'wardship_begun'], ['house-lord-died', flags.petitions, 'home-pannage', 'lord_died'],
  ['house-inherited', flags.moments, 'inheritance_fealty', 'inherited']]) {
  const state = scene(dir, file);
  // The house card opens first of the scene's cards: the delay outlasts the load (openScene's opening Escape would close it).
  const { context, page } = await open(state, { query: '&story-delay=20000' });
  page.on('pageerror', error => errors.push(`${name}: ${String(error).slice(0, 300)}`));
  const selector = `.results-card.house-change[data-house-change="${kind}"]`;
  const opened = await page.locator(`${selector} >> visible=true`).first().waitFor({ timeout: 60_000 }).then(() => true, () => false);
  const petitionFirst = await visible(page, '.lord-card[data-home-petition]');
  const row = { state: file, opened, petitionFirst, card: opened ? await measure(page, selector) : null };
  if (opened) { row.bytes = await shoot(page, name); bytes += row.bytes; }
  if (name === 'house-wardship' && opened) {
    // A3: the petition of the same tick comes after the house card is read.
    await page.locator(`${selector} .results-card-continue`).click();
    row.petitionAfter = await page.locator('.lord-card[data-home-petition] >> visible=true').first().waitFor({ timeout: 15_000 }).then(() => true, () => false);
    row.houseAgain = await visible(page, selector);
  }
  if (name === 'house-inherited' && opened) {
    await page.locator(`${selector} .house-change-next`).click();
    row.estates = await page.locator('.lord-screen[data-lord-screen="estates"] >> visible=true').first().waitFor({ timeout: 15_000 }).then(() => true, () => false);
    if (row.estates) { await page.waitForTimeout(600); row.estatesBytes = await shoot(page, `${name}-estates`); bytes += row.estatesBytes; }
  }
  report(name, row, !petitionFirst && (name !== 'house-wardship' || (row.petitionAfter === true && row.houseAgain === false)) && (name !== 'house-inherited' || row.estates === true));
  await context.close();
}

// 4. The actual's chip and its card.
{
  const state = scene(flags.results, 'actual-in');
  const { context, page } = await open(state, { query: '&story-delay=1500' });
  const chip = page.locator('.event-chip[data-story="decision_actual"]').first();
  const shown = await chip.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true, () => false);
  const row = { state: 'actual-in', chip: shown, card: null, primaries: 0 };
  if (shown) {
    await chip.click();
    await page.locator('.event-card[data-story="decision_actual"]').first().waitFor({ timeout: 10_000 });
    row.card = await measure(page, '.event-card[data-story="decision_actual"]');
    row.line = row.card?.text.split('\n').slice(0, 3);
    row.bytes = await shoot(page, 'actual-in'); bytes += row.bytes;
  }
  report('actual-in', row, shown && /예상 .+ \/ 실제 /.test(row.card?.text ?? ''));
  await context.close();
}

// 5–6. The year's card over a year's turn: the season's card closed, any card put off, until the year's card shows.
for (const [name, dir, file] of [['year-lord', flags.results, 'year-eve'], ['year-campaign', flags.states5, 'aging-eve']]) {
  const state = scene(dir, file);
  const { context, page } = await open(state, { run: true, query: '&story-delay=1500&auto-pause=off' }); // LM-R3: time runs on to the year's turn
  await page.keyboard.press('Digit0');
  const selector = '.results-card.year-review';
  let opened = false; const putOff = [];
  for (let waited = 0; waited < 90_000 && !opened; waited += 500) {
    if (await visible(page, selector)) { opened = true; break; }
    if (await visible(page, '.season-ledger-resume')) { await page.locator('.season-ledger-resume >> visible=true').first().click(); putOff.push('season'); }
    else if (await visible(page, '.story-modal-later')) { const card = await page.locator('.story-modal >> visible=true').first().getAttribute('class'); putOff.push(card); await page.locator('.story-modal-later >> visible=true').first().click(); }
    await page.waitForTimeout(500);
  }
  const row = { state: file, opened, putOff, card: opened ? await measure(page, selector) : null };
  if (opened) {
    row.bytes = await shoot(page, name); bytes += row.bytes;
    await page.locator(`${selector} .results-card-continue`).click();
    await page.waitForTimeout(5_000);
    row.again = await visible(page, selector);
  }
  report(name, row, opened && row.again === false);
  await context.close();
}

await browser.close();
writeFileSync(join(out, 'results.json'), JSON.stringify({ rows, bytes, errors }, null, 1));
if (errors.length > 0) console.log(`page errors: ${errors.join(' | ')}`);
const failed = Object.entries(rows).filter(([, row]) => !row.pass).map(([name]) => name);
console.log(`captures ${Object.keys(rows).length}, ${Math.round(bytes / 1024)} KB${failed.length === 0 ? '' : `; BAD ${failed.join(', ')}`}`);
process.exit(failed.length === 0 ? 0 : 1);
