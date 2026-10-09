// ER-13 wording variants in the browser, on the DGX, on scripts/variantStates.ts's states: the home petition's card in
// 041 / 048 / 056's words and the registry offer's in 067 / 078's, at 1280 × 800 and on the tablet (1180 × 820, touch),
// as they open by themselves after the world (any other card put off first, as a player would); then, at 1280 × 800, a
// home and a registry card put off ([나중에]) and their chip's card — the same words. Each: the variant's title and body
// on it (the engine's read, `estatePetitionVariantFor` / `registryVariantFor`, on the same state), the answers it
// offers, the smallest text (≥ 12 px), its box inside the view, no primary on the card until an answer is picked (as
// scripts/decCardLordCaptures.mjs) and one on the chip's card, no `title=`. JPEG, captures.json beside them.
//   scripts/remote/run.sh render-VARIANTS-captures-<sha7> --light -- bash scripts/variantCaptures.sh
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 확인(scripts/variantCaptures.mjs)", { remote: "scripts/remote/run.sh render-VARIANTS-captures-<sha7> --light -- bash scripts/variantCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { estatePetitionVariantFor, registryVariantFor } from '../src/engine/registryVariants.ts';
import { openHomePetitions } from '../src/ui/lordCardsModel.ts';
import { openRegistryCards } from '../src/ui/registryCardModel.ts';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const scene = name => JSON.parse(readFileSync(join(flags.states, `${name}.json`), 'utf8'));
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const seatTile = state => { const seat = state.buildings.find(b => b.kind === 'manor_house') ?? state.buildings.find(b => b.kind === 'house') ?? state.buildings[0]; return [seat.tx, seat.ty]; };
const QUALITY = 50;
const VIEWS = { '1280x800': { width: 1280, height: 800, hasTouch: false }, tablet: { width: 1180, height: 820, hasTouch: true } };
mkdirSync(out, { recursive: true });

const HOME = '.story-modal.lord-card[data-home-petition]';
const OFFER = '.story-modal.lord-card[data-registry-offer]';
const SCENES = [
  { name: 'home-041', card: HOME, chip: '.event-chip[data-story="home_petition"]', chipCard: '.event-card[data-story="home_petition"]' },
  { name: 'home-048', card: HOME }, { name: 'home-056', card: HOME },
  { name: 'registry-067', card: OFFER, chip: '.event-chip[data-story="registry_event"]', chipCard: '.event-card[data-story="registry_event"]' },
  { name: 'registry-078', card: OFFER },
];
/** The engine's words for the item the card stands for (the first waiting), on the same state. */
function wordsOf(state, card) {
  if (card === HOME) { const petition = openHomePetitions(state)[0]; return petition === undefined ? null : estatePetitionVariantFor(state, petition.id); }
  const offer = openRegistryCards(state)[0]; return offer === undefined ? null : registryVariantFor(state, offer.occurrence);
}

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const visible = (page, selector) => page.locator(`${selector} >> visible=true`).count().then(count => count > 0);
const waitFor = (page, selector, timeout) => page.locator(`${selector} >> visible=true`).first().waitFor({ timeout }).then(() => true, () => false);
const measure = (page, selector) => page.evaluate(sel => {
  const root = [...document.querySelectorAll(sel)].find(el => el.getBoundingClientRect().width > 0) ?? null;
  if (root === null) return null;
  const box = root.getBoundingClientRect();
  const texts = [...root.querySelectorAll('*')].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== ''));
  return { title: root.querySelector('h2, h3')?.textContent ?? null, text: root.innerText.slice(0, 2000),
    primary: root.querySelectorAll('.ui-btn--primary').length, choices: root.querySelectorAll('.decision-card-choice').length,
    smallestText: Math.min(...texts.map(el => parseFloat(getComputedStyle(el).fontSize))), titles: root.querySelectorAll('[title]').length,
    box: { left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom), inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight } };
}, selector);
const shoot = async (page, name) => { const path = join(out, `${name}.jpg`); await page.screenshot({ path, type: 'jpeg', quality: QUALITY }); return statSync(path).size; };
/** As a player: until the wanted card is up, any other card is put off ([나중에]) or closed ([계속]). */
async function cardUp(page, selector) {
  const putOff = [];
  for (let waited = 0; waited < 60_000; waited += 500) {
    if (await visible(page, selector)) return putOff;
    if (await visible(page, '.story-modal-later')) { putOff.push(await page.locator('.story-modal >> visible=true').first().getAttribute('class')); await page.locator('.story-modal-later >> visible=true').first().click(); }
    else if (await visible(page, '.results-card-continue')) { putOff.push('results'); await page.locator('.results-card-continue >> visible=true').first().click(); }
    await page.waitForTimeout(500);
  }
  return null;
}

const rows = {}; const errors = []; let bytes = 0;
for (const { name, card, chip, chipCard } of SCENES) {
  const state = scene(name);
  const words = wordsOf(state, card);
  for (const [view, size] of Object.entries(VIEWS)) {
    const { context, page } = await openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: false, initScript: INIT, width: size.width, height: size.height,
      hasTouch: size.hasTouch, query: '&story-delay=3000', loadTimeout: 90_000, zoom: 1.1 });
    page.on('pageerror', error => errors.push(`${name} ${view}: ${String(error).slice(0, 300)}`));
    const putOff = await cardUp(page, card);
    await page.waitForTimeout(600);
    const shown = putOff === null ? null : await measure(page, card);
    const row = { state: name, view, variant: words?.variantEntryId ?? null, putOff, card: shown };
    row.words = shown !== null && words !== null && shown.title === words.title && shown.text.includes(words.body);
    row.pass = row.words && shown.smallestText >= 12 && shown.box.inside && shown.primary === 0 && shown.titles === 0 && shown.choices >= 2;
    if (shown !== null) { row.bytes = await shoot(page, `${name}-${view}`); bytes += row.bytes; }
    rows[`${name}-${view}`] = row;
    console.log(`${row.pass ? 'ok ' : 'BAD'} ${name} ${view}: ${JSON.stringify({ ...row, card: shown === null ? null : { ...shown, text: shown.text.slice(0, 200) } })}`);
    if (chip !== undefined && view === '1280x800' && shown !== null) {
      await page.locator(`${card} .story-modal-later >> visible=true`).first().click();
      const chipShown = await waitFor(page, chip, 20_000);
      if (chipShown) { await page.locator(`${chip} >> visible=true`).first().click(); await waitFor(page, chipCard, 10_000); await page.waitForTimeout(600); }
      const opened = chipShown ? await measure(page, chipCard) : null;
      const chipRow = { state: name, view, variant: row.variant, chip: chipShown, card: opened };
      chipRow.words = opened !== null && words !== null && opened.title === words.title && opened.text.includes(words.body);
      chipRow.pass = chipRow.words && opened.smallestText >= 12 && opened.box.inside && opened.primary === 1 && opened.titles === 0;
      if (opened !== null) { chipRow.bytes = await shoot(page, `${name}-chip`); bytes += chipRow.bytes; }
      rows[`${name}-chip`] = chipRow;
      console.log(`${chipRow.pass ? 'ok ' : 'BAD'} ${name} chip: ${JSON.stringify({ ...chipRow, card: opened === null ? null : { ...opened, text: opened.text.slice(0, 200) } })}`);
    }
    await context.close();
  }
}
await browser.close();
const pass = Object.values(rows).every(row => row.pass) && errors.length === 0;
writeFileSync(join(out, 'captures.json'), JSON.stringify({ pass, bytes, errors, rows }, null, 1));
console.log(`${pass ? 'PASS' : 'FAIL'}: ${Object.values(rows).filter(row => row.pass).length}/${Object.keys(rows).length} captures, ${bytes} bytes, ${errors.length} page errors`);
process.exit(pass ? 0 : 1);
