// DEC-CARD (renderer A, lord cards): the lord-mode decision cards in the heavy layout, in the browser on real states —
// the home petition (~/fls-lmr1-petition-states home-boundary_dispute; DEC-CARD-2), the town's request (the same
// folder's request), the registry offer and its hold (~/fls-lord-states registry-offer, registry-offer-hold), the father's will, the contested inheritance, the audit and the off-map petition
// (~/fls-lmr2-states), and the negotiation counter's answers on the lord screen (lord2 offer-countered). Each card is
// reached as a player reaches it (by itself, or its chip and [결정하기]), shot at 1280 × 800 (JPEG), and checked: the
// headings (무슨 일인가, 걸린 것, and per answer 지금 / 나중에 / 기억하는 이), no text under 12 px, inside the view, and no
// primary button but the contested card's one way to its suit.
//   scripts/remote/run.sh render-DECCARD-lordcards-<sha7> --light -- bash scripts/decCardLordCaptures.sh [out]
//   (PLAYWRIGHT_MODULE=… node_modules/.bin/tsx scripts/decCardLordCaptures.mjs <out> --url <url> --lord <dir> --petitions <dir> --lord2 <dir>)
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/decCardLordCaptures.mjs)", { remote: "scripts/remote/run.sh render-DECCARD-lordcards-<sha7> --light -- bash scripts/decCardLordCaptures.sh", entry: import.meta.url });
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
/** The whole 1280 × 800 view with the card up (the town dimmed under it), a small JPEG (the eight stay under 600 KB). */
const shoot = async (page, name) => { const path = join(out, `${name}.jpg`); await page.screenshot({ path, type: 'jpeg', quality: 30 }); const size = statSync(path).size; bytes += size; return size; };
const open = (state, delay) => openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: false, initScript: INIT, width: 1280, height: 800,
  query: `&story-delay=${delay}`, loadTimeout: 90_000, zoom: 1.1 });

/** The card as shown: its parts' headings, the smallest text, its box, the primary buttons. */
const facts = (page, selector) => page.evaluate(root => {
  const node = document.querySelector(root);
  if (node === null) return null;
  const box = node.getBoundingClientRect();
  const texts = [...node.querySelectorAll('*')].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== '') && el.getClientRects().length > 0);
  return {
    heads: [...node.querySelectorAll('.decision-card-part-head')].map(el => el.textContent),
    choices: [...node.querySelectorAll('.decision-card-choice, .lord-neg-outlook-answer')].map(el => ({ id: el.getAttribute('data-choice') ?? el.getAttribute('data-answer-outlook'),
      refused: el.getAttribute('data-refused'), text: el.textContent.replace(/\s+/g, ' ').trim() })),
    situation: node.querySelector('.decision-card-situation')?.textContent ?? null, stake: node.querySelector('.decision-card-stake')?.textContent ?? null,
    deadline: node.querySelector('.decision-card-deadline')?.textContent ?? null,
    primaries: node.querySelectorAll('.ui-btn--primary').length, titles: node.querySelectorAll('[title]').length,
    smallestText: Math.min(...texts.map(el => parseFloat(getComputedStyle(el).fontSize))),
    box: { left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom), inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight },
  };
}, selector);

/** Waits for `card`: by itself, or through a chip of `story` and its [결정하기]; anything else that opened is put off. */
async function reach(page, card, story) {
  const others = ['.season-ledger-resume', '.chronicle-page .chronicle-keep'];
  for (let waited = 0; waited < 40_000; waited += 500) {
    if (await page.locator(`${card} >> visible=true`).count() > 0) return true;
    const later = page.locator(`.story-modal:not(${card}) .story-modal-later >> visible=true`);
    if (await later.count() > 0) { await later.first().click(); await page.waitForTimeout(300); continue; }
    for (const selector of others) { const other = page.locator(`${selector} >> visible=true`); if (await other.count() > 0) await other.first().click(); }
    const chips = page.locator(`.event-chip[data-story="${story}"] >> visible=true`);
    const count = await chips.count();
    for (let index = 0; index < count; index += 1) {
      await chips.nth(index).click(); await page.waitForTimeout(300);
      const decide = page.locator('.event-card .event-card-decide >> visible=true');
      if (await decide.count() > 0) { await decide.first().click(); await page.waitForTimeout(500); }
      if (await page.locator(`${card} >> visible=true`).count() > 0) return true;
    }
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: join(out, `debug-${story}.jpg`), type: 'jpeg', quality: 30 });
  return false;
}

const HEADS = ['지금', '나중에', '기억하는 이'];
const CARDS = [
  // DEC-CARD-2: the home petition (its answers from the engine's outlook, the kind's standing policy in 나중에).
  { name: 'home-petition', dir: flags.petitions, state: 'home-boundary_dispute', card: '.decision-card.lord-card[data-home-petition]', story: 'home_petition', delay: 1500 },
  { name: 'request', dir: flags.petitions, state: 'request', card: '.decision-card.lord-card[data-lord-request]', story: 'lord_request', delay: 1500 },
  { name: 'registry', dir: flags.lord, state: 'registry-offer', card: '.decision-card.lord-card[data-registry-offer]', story: 'registry_event', delay: 3000 },
  { name: 'registry-hold', dir: flags.lord, state: 'registry-offer-hold', card: '.decision-card.lord-card[data-registry-offer]', story: 'registry_event', delay: 3000 },
  { name: 'will-change', dir: flags.lord2, state: 'will-change', card: ".decision-card.lord-card[data-lord-decision='will_change']", story: 'lord_decision', delay: 3000 },
  { name: 'contested', dir: flags.lord2, state: 'contested', card: ".decision-card.lord-card[data-lord-decision='contested']", story: 'lord_decision', delay: 3000, primaries: 1, answers: false },
  { name: 'audit', dir: flags.lord2, state: 'audit-pending', card: ".decision-card.lord-card[data-lord-decision='audit']", story: 'lord_decision', delay: 3000 },
  { name: 'offmap-petition', dir: flags.lord2, state: 'inherited', card: ".decision-card.lord-card[data-lord-decision='estate_petition_offmap']", story: 'lord_decision', delay: 3000 },
];
const rows = {};
for (const entry of CARDS) {
  const { context, page } = await open(scene(entry.dir, entry.state), entry.delay);
  const opened = await reach(page, entry.card, entry.story);
  const shown = opened ? await facts(page, entry.card) : null;
  const size = opened ? await shoot(page, `card-${entry.name}`) : 0;
  const answers = entry.answers !== false;
  const ok = opened && shown !== null && shown.situation !== null && shown.stake !== null && shown.smallestText >= 12 && shown.box.inside && shown.titles === 0
    && shown.primaries === (entry.primaries ?? 0) && (!answers || (shown.choices.length >= 1 && HEADS.every(head => shown.heads.filter(text => text === head).length === shown.choices.length)));
  rows[entry.name] = { opened, ...shown, bytes: size, ok };
  console.log(`${ok ? 'ok ' : 'BAD'} ${entry.name}: ${JSON.stringify({ opened, choices: shown?.choices.map(choice => choice.id), smallestText: shown?.smallestText, box: shown?.box, primaries: shown?.primaries, bytes: size })}`);
  await context.close();
}
// The negotiation counter: the lord screen's 혼인 item, each answer's now / later / who remembers inside the treaty.
{
  const { context, page } = await open(scene(flags.lord2, 'offer-countered'), 600_000);
  for (const selector of ["[data-dock='ledger']", "[data-ledger-tab='lord']", '[data-lord-open]', "[data-lord-nav='marriage']"]) {
    await page.locator(`${selector} >> visible=true`).first().click({ timeout: 15_000 }); await page.waitForTimeout(500);
  }
  const panel = '.slot-panel.lord-screen';
  const opened = await page.locator('.lord-neg-outlook >> visible=true').count() > 0;
  if (opened) await page.locator('.lord-neg-outlook').first().scrollIntoViewIfNeeded();
  const shown = opened ? await facts(page, panel) : null;
  const size = opened ? await shoot(page, 'counter') : 0;
  const ok = opened && shown !== null && shown.choices.length === 2 && HEADS.every(head => shown.heads.filter(text => text === head).length === 2) && shown.smallestText >= 12 && shown.primaries === 0;
  rows.counter = { opened, ...shown, bytes: size, ok };
  console.log(`${ok ? 'ok ' : 'BAD'} counter: ${JSON.stringify({ opened, choices: shown?.choices.map(choice => choice.id), smallestText: shown?.smallestText, bytes: size })}`);
  await context.close();
}
await browser.close();
const ok = Object.values(rows).every(row => row.ok) && bytes <= 600 * 1024;
writeFileSync(join(out, 'captures.json'), JSON.stringify({ url, ok, bytes, rows }, null, 1) + '\n');
console.log(JSON.stringify({ ok, bytes }));
if (!ok) process.exitCode = 1;
