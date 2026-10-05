// EVENT-ART: the registry's event card in the browser, on the DGX, from scripts/eventArtStates.ts's lord-mode state (the
// lord's slice with the first registry offer the engine drew):
//  - the offer as drawn: its card opens by itself after the world (another card that opened first put off), the picture
//    loaded at 960 × 540, why it came, every answer's numbers; an answer through answer_registry_offer (the engine's
//    occurrence answered, its effect on the state, the card gone);
//  - the same offer from its story chip ([결정하기] after [나중에 정하기]);
//  - each shipped picture through the real card: the same state with the open offer's entry set to each registry entry
//    in turn (injected; marked so in captures.json) — the card's picture loaded at 960 × 540 (the scene, a small JPEG);
//  - the card at 1024 × 768 and on the tablet (1180 × 820, touch): inside the view, text ≥ 12 px, answers ≥ 44 px;
//  - lord mode only: the campaign's ui5 merchant town has no registry chip or card.
//   scripts/remote/run.sh render-EVENTART-card -- bash scripts/eventArtCaptures.sh
//   (PLAYWRIGHT_MODULE=… node_modules/.bin/tsx scripts/eventArtCaptures.mjs <out> --url <url> --states <dir> --states5 <dir>)
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 확인(scripts/eventArtCaptures.mjs)", { remote: "scripts/remote/run.sh render-EVENTART-card -- bash scripts/eventArtCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';
import { shippedEventArtIds } from '../src/ui/eventArtSelection.ts';
import { EVENT_ART_IMAGES } from '../src/ui/eventArtManifest.generated.ts';
import { registryEntries } from '../src/engine/registry.ts';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const scene = (dir, name) => JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const seatTile = state => { const seat = state.buildings.find(b => b.kind === 'manor_house') ?? state.buildings.find(b => b.kind === 'house') ?? state.buildings[0]; return [seat.tx, seat.ty]; };
const CARD = '.lord-card[data-registry-offer]';
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const proof = page => page.evaluate(() => {
  const state = window.__FEUDAL_PHASE10_PROOF__.state();
  return { tick: state.tick, treasury: state.treasuryCoin, dues: state.agency?.duesPermille ?? null, policy: state.agency?.policy ?? null,
    occurrences: (state.registry?.occurrences ?? []).map(o => ({ id: o.id, entryId: o.entryId, status: o.status, choiceId: o.choiceId ?? null })) };
});
/** The card as shown: its text, the picture's url loaded to its natural size (or none), the answers. */
const card = page => page.evaluate(async selector => {
  const root = document.querySelector(selector);
  if (root === null) return null;
  const art = root.querySelector('.lord-card-art');
  const background = art === null ? null : getComputedStyle(art).backgroundImage;
  const src = background === null ? null : background.match(/url\("?([^")]+)"?\)/)?.[1] ?? null;
  const loaded = src === null ? null : await new Promise(done => { const image = new Image(); image.onload = () => done([image.naturalWidth, image.naturalHeight]); image.onerror = () => done('error'); image.src = src; });
  const box = root.getBoundingClientRect();
  const artBox = art?.getBoundingClientRect();
  return { entry: root.getAttribute('data-registry-offer'), title: root.querySelector('h2')?.textContent ?? null, court: root.querySelector('.lord-card-court')?.textContent ?? null,
    kicker: root.querySelector('.lord-card-kicker')?.textContent ?? null, body: root.querySelector('h2 + p')?.textContent ?? null,
    why: [...root.querySelectorAll('.registry-card-why li')].map(li => li.textContent), lapse: root.querySelector('.lord-card-precedent')?.textContent ?? null,
    art: art?.getAttribute('data-art') ?? null, src, loaded, artBox: artBox === undefined ? null : [Math.round(artBox.width), Math.round(artBox.height)],
    answers: [...root.querySelectorAll('.registry-card-option')].map(button => ({ choice: button.getAttribute('data-choice'), enabled: button.getAttribute('data-enabled'),
      disabled: button.disabled, primary: button.classList.contains('ui-btn--primary'), text: button.textContent,
      treasury: button.querySelector('.lord-card-forecast')?.getAttribute('data-treasury') ?? null, height: Math.round(button.getBoundingClientRect().height) })),
    later: Math.round(root.querySelector('.story-modal-later')?.getBoundingClientRect().height ?? 0),
    box: { left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom), inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight },
    smallestText: Math.min(...[...root.querySelectorAll('*')].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== '')).map(el => parseFloat(getComputedStyle(el).fontSize))) };
}, CARD);
let bytes = 0;
const shoot = async (page, selector, name, quality) => { const path = join(out, `${name}.jpg`); await page.locator(selector).first().screenshot({ path, type: 'jpeg', quality }); const size = statSync(path).size; bytes += size; return size; };
const open = (state, options = {}) => openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: false, initScript: INIT, width: 1280, height: 800,
  query: '&story-delay=3000', loadTimeout: 90_000, zoom: 1.1, ...options });
/** The registry card; any other card that opened first (a petition, a home petition) put off, as a player would. */
const waitCard = async page => {
  for (let waited = 0; waited < 30_000; waited += 500) {
    if (await page.locator(`${CARD} >> visible=true`).count() > 0) return true;
    const other = page.locator('.petition-card:not([data-registry-offer]) .story-modal-later >> visible=true');
    if (await other.count() > 0) await other.first().click();
    await page.waitForTimeout(500);
  }
  return false;
};
const base = scene(flags.states, 'registry-offer');
const offer = base.registry.occurrences.find(o => o.status === 'offered');
const rows = {};

// 1. The offer as drawn: the card by itself, then an answer through it.
{
  const { context, page } = await open(base);
  const opened = await waitCard(page);
  const shown = await card(page);
  const size = await shoot(page, CARD, `card-${offer.entryId}`, 45);
  const before = await proof(page);
  const choice = shown.answers.find(answer => answer.enabled === 'true');
  await page.locator(`${CARD} .registry-card-option[data-choice="${choice.choice}"]`).first().click(); await page.waitForTimeout(800);
  const after = await proof(page);
  const answered = after.occurrences.find(o => o.id === offer.id);
  rows.drawn = { opened, card: shown, bytes: size, choice: choice.choice, status: answered?.status ?? null, choiceId: answered?.choiceId ?? null,
    dues: [before.dues, after.dues], treasury: after.treasury - before.treasury, shownTreasury: Number(choice.treasury), closed: (await page.locator(CARD).count()) === 0 };
  const ok = opened && Array.isArray(shown.loaded) && shown.loaded[0] === 960 && shown.loaded[1] === 540 && shown.why.length >= 2 && shown.answers.every(answer => !answer.primary)
    && answered?.status === 'answered' && answered.choiceId === choice.choice && rows.drawn.closed;
  rows.drawn.ok = ok;
  console.log(`${ok ? 'ok ' : 'BAD'} drawn ${offer.entryId}: art ${shown.art} ${JSON.stringify(shown.loaded)} why ${JSON.stringify(shown.why)} → ${choice.choice} ${answered?.status} dues ${before.dues}→${after.dues}`);
  await context.close();
}
// 2. The same offer from its chip.
{
  const { context, page } = await open(base);
  await waitCard(page);
  await page.locator(`${CARD} .story-modal-later`).first().click(); await page.waitForTimeout(500);
  const chip = page.locator('.event-chip[data-story="registry_event"]').first();
  const chipShown = await chip.waitFor({ state: 'visible', timeout: 10_000 }).then(() => true, () => false);
  if (chipShown) { await chip.click(); await page.locator('.event-card .event-card-decide').first().click(); }
  const opened = chipShown && await page.locator(`${CARD} >> visible=true`).first().waitFor({ timeout: 10_000 }).then(() => true, () => false);
  rows.chip = { chipShown, opened, ok: chipShown && opened };
  console.log(`${rows.chip.ok ? 'ok ' : 'BAD'} chip: ${JSON.stringify(rows.chip)}`);
  await context.close();
}
// 3. Every shipped picture through the real card (the open offer's entry set to each registry entry in turn).
const shipped = shippedEventArtIds(EVENT_ART_IMAGES);
const entries = registryEntries().filter(entry => entry.generator === undefined);
rows.pictures = {};
for (const entry of entries) {
  const id = entry.artId ?? entry.id;
  if (!shipped.includes(id)) continue;
  const occurrences = base.registry.occurrences.map(o => o.id === offer.id ? { ...o, entryId: entry.id, id: `${o.id}:as:${entry.id}` } : o);
  const { context, page } = await open({ ...base, registry: { ...base.registry, occurrences } });
  const opened = await waitCard(page);
  const shown = await card(page);
  const size = opened ? await shoot(page, `${CARD} .petition-scene`, `picture-${id}`, 40) : 0;
  const ok = opened && shown.entry === entry.id && shown.art === id && shown.src?.endsWith(`assets/event-art/${id}.jpg`) && Array.isArray(shown.loaded) && shown.loaded[0] === 960 && shown.loaded[1] === 540;
  rows.pictures[id] = { injected: true, entry: entry.id, opened, art: shown?.art ?? null, src: shown?.src ?? null, loaded: shown?.loaded ?? null, artBox: shown?.artBox ?? null,
    title: shown?.title ?? null, answers: shown?.answers.map(answer => [answer.choice, answer.enabled]) ?? [], bytes: size, ok };
  console.log(`${ok ? 'ok ' : 'BAD'} picture ${id} (${entry.id}): ${shown?.src} ${JSON.stringify(shown?.loaded)} ${shown?.artBox}`);
  await context.close();
}
// 4. The small view and the tablet.
for (const [name, options] of [['1024x768', { width: 1024, height: 768 }], ['tablet', { width: 1180, height: 820, hasTouch: true }]]) {
  const { context, page } = await open(base, options);
  const opened = await waitCard(page);
  const shown = await card(page);
  const size = await shoot(page, CARD, `card-${name}`, 40);
  const ok = opened && shown.box.inside && shown.smallestText >= 12 && shown.answers.every(answer => answer.height >= 44) && shown.later >= 44;
  rows[name] = { opened, box: shown.box, smallestText: shown.smallestText, answers: shown.answers.map(answer => answer.height), later: shown.later, bytes: size, ok };
  console.log(`${ok ? 'ok ' : 'BAD'} ${name}: ${JSON.stringify(rows[name])}`);
  await context.close();
}
// 5. Lord mode only: a campaign town shows no registry chip, no registry card.
{
  const state = scene(flags.states5, 'merchant-town');
  const { context, page } = await openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: true, initScript: INIT, width: 1280, height: 800, query: '&story-delay=500', loadTimeout: 90_000 });
  await page.waitForTimeout(4_000);
  rows.campaign = { chips: await page.locator('.event-chip[data-story="registry_event"]').count(), cards: await page.locator(CARD).count(), agency: await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().agency !== undefined) };
  rows.campaign.ok = rows.campaign.chips + rows.campaign.cards === 0 && !rows.campaign.agency;
  console.log(`${rows.campaign.ok ? 'ok ' : 'BAD'} campaign: ${JSON.stringify(rows.campaign)}`);
  await context.close();
}
await browser.close();
const pictures = Object.values(rows.pictures);
const ok = rows.drawn.ok && rows.chip.ok && pictures.length === shipped.length && pictures.every(row => row.ok) && rows['1024x768'].ok && rows.tablet.ok && rows.campaign.ok;
writeFileSync(join(out, 'captures.json'), JSON.stringify({ url, ok, bytes, offer: { id: offer.id, entryId: offer.entryId, receipt: offer.receipt }, shipped, rows }, null, 1) + '\n');
console.log(JSON.stringify({ ok, bytes, pictures: pictures.filter(row => row.ok).length }));
if (!ok) process.exitCode = 1;
