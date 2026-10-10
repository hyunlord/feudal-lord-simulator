// DEC-CARD (campaign) the famine and one political petition per chapter in the heavy decision card, in the browser on
// the DGX, on the campaign's real states (the ui5 / ui6 / ui8 / ui9 / ui10 sets the geometry audit uses): each card
// opens by itself (the story's delay), a 1280×800 JPEG of the view, what it shows (the five parts, the answers, no
// primary button, the smallest text, the body's scroll), then its first answer pressed and the engine's record of it.
// The heir's and the famine's card are also measured at 1024×768 (no picture).
//   scripts/remote/run.sh render-DECCARD-campaign-<sha7> --light -- bash scripts/deccardCampaignCaptures.sh
//   (PLAYWRIGHT_MODULE=… node_modules/.bin/tsx scripts/deccardCampaignCaptures.mjs <out> --url <url> --states5 <dir> --states6 … --extra <dir>)
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 확인(scripts/deccardCampaignCaptures.mjs)", { remote: "scripts/remote/run.sh render-DECCARD-campaign-<sha7> --light -- bash scripts/deccardCampaignCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { closeAnswerReceipt } from './answerReceiptPress.mjs';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const QUALITY = 50;
const CASES = [
  { name: 'famine', dir: 'states5', state: 'famine-arrival', card: '.decision-card.famine-decision', delay: 5000 },
  { name: 'ch1-market_charter', dir: 'states5', state: 'petition-open', card: '.decision-card.petition-decision', delay: 5000 },
  { name: 'ch2-wool_payment', dir: 'states6', state: 'wool_payment', card: '.decision-card.petition-decision', delay: 5000 },
  { name: 'ch3-cash_rent', dir: 'states8', state: 'cash_rent', card: '.decision-card.petition-decision', delay: 3000 },
  { name: 'ch4-guild_charter', dir: 'states9', state: 'guild_charter', card: '.decision-card.petition-decision', delay: 3000 },
  { name: 'ch5-royal_tax', dir: 'states10', state: 'royal_tax', card: '.decision-card.petition-decision', delay: 3000 },
  { name: 'ch5-heir_choice', dir: 'extra', state: 'heir_choice', card: ".decision-card.petition-decision[data-def='heir_choice']", delay: 3000 },
  { name: 'interlude-guild_dispute', dir: 'states10', state: 'guild_dispute', card: '.decision-card.petition-decision', delay: 3000 },
];
const SMALL = ['famine', 'ch5-heir_choice'];
const scene = (dir, name) => JSON.parse(readFileSync(join(flags[dir], `${name}.json`), 'utf8'));
const houseTile = state => { const seat = state.buildings.find(b => b.kind === 'keep') ?? state.buildings.find(b => b.kind === 'house') ?? state.buildings[0]; return [seat.tx, seat.ty]; };
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const proof = page => page.evaluate(() => {
  const state = window.__FEUDAL_PHASE10_PROOF__.state();
  return { tick: state.tick, treasury: state.treasuryCoin, petitions: (state.politics?.petitions ?? []).map(p => ({ id: p.id, defId: p.defId, response: p.response ?? null })),
    famine: (state.events?.records ?? []).find(r => r.defId === 'great_famine')?.response?.choice ?? null };
});
/** What the card shows: its parts, the answers (each one's lines), the buttons, the smallest text, the body's scroll. */
const read = (page, selector) => page.evaluate(sel => {
  const root = document.querySelector(sel);
  if (root === null) return null;
  const body = root.querySelector('.decision-card-body');
  const box = root.getBoundingClientRect();
  const texts = [...root.querySelectorAll('*')].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== '') && el.getClientRects().length > 0);
  const choices = [...root.querySelectorAll('.decision-card-choice')];
  return {
    title: root.querySelector('h2')?.textContent ?? null, court: root.querySelector('.decision-card-court')?.textContent ?? null,
    from: root.querySelector('.decision-card-from')?.textContent ?? null, situation: root.querySelector('.decision-card-situation')?.textContent ?? null,
    stake: root.querySelector('.decision-card-stake')?.textContent ?? null, deadline: root.querySelector('.decision-card-deadline')?.textContent ?? null,
    choices: choices.map(choice => ({ id: choice.getAttribute('data-choice'), label: choice.querySelector('h3')?.textContent ?? null,
      parts: [...choice.querySelectorAll('.decision-card-part')].map(part => [...part.querySelectorAll('li, .decision-card-none')].map(li => li.textContent)),
      top: Math.round(choice.getBoundingClientRect().top), width: Math.round(choice.getBoundingClientRect().width) })),
    rows: new Set(choices.map(choice => Math.round(choice.getBoundingClientRect().top))).size,
    primaries: root.querySelectorAll('.ui-btn--primary').length, titled: root.querySelectorAll('[title]').length,
    heirs: root.querySelectorAll('.petition-heir').length, people: root.querySelectorAll('.petition-people .person-chip').length, steward: root.querySelector('.decision-steward') !== null,
    crest: root.querySelector('.petition-roundel') !== null, art: root.querySelector('.decision-card-art') !== null,
    smallestText: Math.min(...texts.map(el => parseFloat(getComputedStyle(el).fontSize))),
    body: body === null ? null : { scrollHeight: body.scrollHeight, clientHeight: body.clientHeight, scrolls: body.scrollHeight > body.clientHeight + 1 },
    box: { left: Math.round(box.left), top: Math.round(box.top), width: Math.round(box.width), height: Math.round(box.height),
      inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight },
  };
}, selector);
/** As a player (and the geometry audit's `story` step): the card by itself, else the waiting chips in turn — another
 * decision put off, a card that offers none closed. */
const waitCard = async (page, selector) => {
  const shown = item => `${item} >> visible=true`;
  const wanted = () => page.locator(shown(selector)).count().then(count => count > 0);
  if (await page.locator(shown(selector)).first().waitFor({ timeout: 10_000 }).then(() => true, () => false)) return true;
  await page.locator(shown('.event-chip')).first().waitFor({ timeout: 30_000 }).catch(() => undefined);
  for (let chip = 0; chip < 8 && !await wanted(); chip += 1) {
    if (await page.locator(shown('.story-modal')).count() > 0) { await page.locator(shown('.story-modal-later')).first().click({ timeout: 5_000 }).catch(() => undefined); await page.waitForTimeout(500); }
    if (await page.locator(shown('.event-chip')).count() === 0) break;
    await page.locator(shown('.event-chip')).nth(chip % Math.max(1, await page.locator(shown('.event-chip')).count())).click({ timeout: 5_000 }).catch(() => undefined); await page.waitForTimeout(600);
    if (await page.locator(shown('.event-card-decide')).count() > 0) { await page.locator(shown('.event-card-decide')).first().click({ timeout: 5_000 }).catch(() => undefined); await page.waitForTimeout(900); continue; }
    await page.locator(shown('.event-card-actions > button:last-child')).first().click({ timeout: 5_000 }).catch(() => undefined); await page.waitForTimeout(500);
  }
  return page.locator(shown(selector)).first().waitFor({ timeout: 30_000 }).then(() => true, () => false);
};

const rows = {}; let bytes = 0;
for (const entry of CASES) {
  const state = scene(entry.dir, entry.state);
  const { context, page } = await openScene(browser, { state, tile: houseTile(state), baseUrl: url, run: false, initScript: INIT, width: 1280, height: 800,
    query: `&story-delay=${entry.delay}`, loadTimeout: 90_000, zoom: 1.1 });
  const opened = await waitCard(page, entry.card);
  await page.waitForTimeout(800);
  const shown = opened ? await read(page, entry.card) : null;
  const path = join(out, `${entry.name}.jpg`);
  if (opened) { await page.screenshot({ path, type: 'jpeg', quality: QUALITY }); bytes += statSync(path).size; }
  // The first answer pressed: the engine records it and the card turns over to its receipt (RECEIPTS-2), closed with [확인].
  const before = await proof(page);
  if (opened) { await page.locator(`${entry.card} .decision-card-choose`).first().click(); await page.waitForTimeout(800); }
  const receipt = opened && await closeAnswerReceipt(page);
  const after = await proof(page);
  const answered = entry.name === 'famine' ? after.famine : after.petitions.find(p => p.response !== null && before.petitions.find(b => b.id === p.id)?.response === null)?.response ?? null;
  const closed = (await page.locator(`${entry.card} >> visible=true`).count()) === 0;
  const ok = opened && shown !== null && shown.choices.length >= 2 && shown.choices.every(choice => choice.parts.length === 3) && shown.primaries === 0 && shown.titled === 0
    && shown.smallestText >= 12 && shown.box.inside && shown.situation !== null && shown.stake !== null && shown.deadline !== null
    && answered === shown.choices[0].id && receipt && closed && (entry.name !== 'ch5-heir_choice' || shown.heirs >= 2) && (entry.name !== 'famine' || shown.steward);
  rows[entry.name] = { opened, ok, card: shown, answered, receipt, closed, treasury: after.treasury - before.treasury, bytes: opened ? statSync(path).size : 0 };
  console.log(`${ok ? 'ok ' : 'BAD'} ${entry.name}: ${shown?.choices.length} answers in ${shown?.rows} row(s), smallest ${shown?.smallestText}px, body ${JSON.stringify(shown?.body)}, box ${JSON.stringify(shown?.box)}, answered ${answered}, receipt ${receipt}, closed ${closed}`);
  await context.close();
}
// The widest cards at the smallest view (1024×768): measured, no picture.
for (const name of SMALL) {
  const entry = CASES.find(item => item.name === name);
  const state = scene(entry.dir, entry.state);
  const { context, page } = await openScene(browser, { state, tile: houseTile(state), baseUrl: url, run: false, initScript: INIT, width: 1024, height: 768,
    query: `&story-delay=${entry.delay}`, loadTimeout: 90_000, zoom: 1.1 });
  const opened = await waitCard(page, entry.card);
  await page.waitForTimeout(800);
  const shown = opened ? await read(page, entry.card) : null;
  const ok = opened && shown !== null && shown.box.inside && shown.smallestText >= 12;
  rows[`${name}-1024`] = { opened, ok, card: shown };
  console.log(`${ok ? 'ok ' : 'BAD'} ${name}-1024: ${shown?.choices.length} answers in ${shown?.rows} row(s), widths ${JSON.stringify(shown?.choices.map(choice => choice.width))}, body ${JSON.stringify(shown?.body)}, box ${JSON.stringify(shown?.box)}`);
  await context.close();
}
await browser.close();
const ok = Object.values(rows).every(row => row.ok) && bytes <= 600 * 1024;
writeFileSync(join(out, 'captures.json'), JSON.stringify({ url, ok, bytes, rows }, null, 1) + '\n');
console.log(JSON.stringify({ ok, bytes }));
if (!ok) process.exitCode = 1;
