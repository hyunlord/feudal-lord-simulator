// RECEIPTS (renderer A): a heavy answer's receipt in the browser on real states — the card as the player reaches it, one
// answer pressed, and the receipt that takes the card's place: the home petition granted (~/fls-lmr1-petition-states
// home-boundary_dispute), the audit's finding punished (~/fls-lmr2-states audit-pending), the off-map petition refused
// (inherited) and the registry offer's court roll paid for (~/fls-lord-states registry-offer-hold). Each is shot before
// and after at 1280 × 800 and 1180 × 820 (JPEG) and checked: the receipt has rows, no text under 12 px, inside the view,
// one primary (its close), no title attribute; closing it closes the modal.
//   scripts/remote/run.sh render-RECEIPTS-captures --light -- bash scripts/receiptsCaptures.sh [out]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/receiptsCaptures.mjs)", { remote: "scripts/remote/run.sh render-RECEIPTS-captures --light -- bash scripts/receiptsCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const scene = (dir, name) => JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const seatTile = state => { const seat = state.buildings.find(b => b.kind === 'manor_house') ?? state.buildings.find(b => b.kind === 'house') ?? state.buildings[0]; return [seat.tx + 1, seat.ty + 1]; };
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let bytes = 0;
const shoot = async (page, name) => { const path = join(out, `${name}.jpg`); await page.screenshot({ path, type: 'jpeg', quality: 30 }); const size = statSync(path).size; bytes += size; return size; };
const VIEWS = [{ id: '1280x800', width: 1280, height: 800 }, { id: 'tablet', width: 1180, height: 820 }];
const RECEIPT = '.story-modal.answer-receipt';

/** The receipt as shown: its rows, the smallest text, its box, the primary buttons, title attributes. */
const facts = page => page.evaluate(root => {
  const node = document.querySelector(root);
  if (node === null) return null;
  const box = node.getBoundingClientRect();
  const texts = [...node.querySelectorAll('*')].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== '') && el.getClientRects().length > 0);
  const close = node.querySelector('.answer-receipt-close')?.getBoundingClientRect();
  return {
    answer: node.querySelector('.answer-receipt-answer')?.textContent ?? null,
    rows: [...node.querySelectorAll('.answer-receipt-row')].map(el => `${el.querySelector('.answer-receipt-what')?.textContent} | ${el.querySelector('.answer-receipt-change')?.textContent}`),
    later: [...node.querySelectorAll('.answer-receipt-later li')].map(el => el.textContent),
    primaries: node.querySelectorAll('.ui-btn--primary').length, titles: node.querySelectorAll('[title]').length,
    smallestText: Math.min(...texts.map(el => parseFloat(getComputedStyle(el).fontSize))),
    closeHeight: close === undefined ? 0 : Math.round(close.height),
    box: { left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom), inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight },
  };
}, RECEIPT);

/** Waits for `card`: by itself, or through a chip of `story` and its [결정하기]; anything else that opened is put off. */
async function reach(page, card, story) {
  for (let waited = 0; waited < 40_000; waited += 500) {
    if (await page.locator(`${card} >> visible=true`).count() > 0) return true;
    const later = page.locator(`.story-modal:not(${card}) .story-modal-later >> visible=true`);
    if (await later.count() > 0) { await later.first().click(); await page.waitForTimeout(300); continue; }
    for (const selector of ['.season-ledger-resume', '.chronicle-page .chronicle-keep', '.results-card-continue']) {
      const other = page.locator(`${selector} >> visible=true`); if (await other.count() > 0) await other.first().click();
    }
    // Another modal with none of those buttons (it holds the screen): Esc puts it away, as a player would.
    if (await page.locator(`.story-modal-backdrop:not(:has(${card})) >> visible=true`).count() > 0) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); continue; }
    const chips = page.locator(`.event-chip[data-story="${story}"] >> visible=true`);
    const count = await chips.count();
    for (let index = 0; index < count; index += 1) {
      if (!await chips.nth(index).click({ timeout: 5_000 }).then(() => true, () => false)) break;
      await page.waitForTimeout(300);
      const decide = page.locator('.event-card .event-card-decide >> visible=true');
      if (await decide.count() > 0) { await decide.first().click({ timeout: 5_000 }).catch(() => undefined); await page.waitForTimeout(500); }
      if (await page.locator(`${card} >> visible=true`).count() > 0) return true;
    }
    await page.waitForTimeout(500);
  }
  return false;
}

const ANSWERS = [
  { name: 'home-grant', dir: flags.petitions, state: 'home-boundary_dispute', card: '.decision-card.lord-card[data-home-petition]', story: 'home_petition', choice: 'grant' },
  { name: 'audit-punish', dir: flags.lord2, state: 'audit-pending', card: ".decision-card.lord-card[data-lord-decision='audit']", story: 'lord_decision', choice: 'punish' },
  { name: 'offmap-refuse', dir: flags.lord2, state: 'inherited', card: ".decision-card.lord-card[data-lord-decision='estate_petition_offmap']", story: 'lord_decision', choice: 'refuse' },
  { name: 'registry-roll', dir: flags.lord, state: 'registry-offer-hold', card: '.decision-card.lord-card[data-registry-offer]', story: 'registry_event', choice: 'roll' },
];
const rows = {};
for (const entry of ANSWERS) for (const view of VIEWS) {
  const state = scene(entry.dir, entry.state);
  const { context, page } = await openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: false, initScript: INIT, width: view.width, height: view.height,
    query: '&story-delay=8000', loadTimeout: 90_000, zoom: 1.1 });
  const key = `${entry.name}-${view.id}`;
  const opened = await reach(page, entry.card, entry.story);
  const before = opened ? await shoot(page, `${key}-before`) : 0;
  if (opened) await page.locator(`${entry.card} [data-choose='${entry.choice}']`).first().click();
  const shownUp = opened && await page.locator(`${RECEIPT} >> visible=true`).first().waitFor({ timeout: 20_000 }).then(() => true, () => false);
  if (shownUp) await page.waitForTimeout(600);
  const shown = shownUp ? await facts(page) : null;
  const after = shownUp ? await shoot(page, `${key}-after`) : 0;
  let closed = false;
  if (shownUp) { await page.locator(`${RECEIPT} .answer-receipt-close`).click(); await page.waitForTimeout(500); closed = await page.locator(`${RECEIPT} >> visible=true`).count() === 0; }
  const ok = shown !== null && shown.rows.length > 0 && shown.smallestText >= 12 && shown.box.inside && shown.primaries === 1 && shown.titles === 0 && shown.closeHeight >= 44 && closed;
  rows[key] = { opened, ...shown, closed, bytes: before + after, ok };
  console.log(`${ok ? 'ok ' : 'BAD'} ${key}: ${JSON.stringify({ opened, rows: shown?.rows, smallestText: shown?.smallestText, box: shown?.box, primaries: shown?.primaries, closed, bytes: before + after })}`);
  await context.close();
}
await browser.close();
const ok = Object.values(rows).every(row => row.ok) && bytes <= 3 * 1024 * 1024;
writeFileSync(join(out, 'captures.json'), JSON.stringify({ url, ok, bytes, rows }, null, 1) + '\n');
console.log(JSON.stringify({ ok, bytes }));
if (!ok) process.exitCode = 1;
