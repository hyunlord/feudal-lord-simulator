// EVENT-ART: the registry's event card in the browser, on the DGX, from scripts/eventArtStates.ts's lord-mode states (the
// lord's slice with the first content canon v4 offer the registry drew, and the first with a hold):
//  - the offer as drawn: its card opens by itself after the world (another card that opened first put off), the picture
//    loaded at 960 × 540, why it came, every answer's tradeoff; an answer through answer_registry_offer (the engine's
//    occurrence answered, the treasury moved as the card said, the card gone);
//  - the same offer from its story chip ([결정하기] after [나중에 정하기]);
//  - a hold: its card says what holding costs; held, the occurrence keeps that cost (ER-19);
//  - (each live event's picture through the real card: `npm run eventart:auto`, scripts/eventArtAutoCapture.mjs — EVA-AUTO);
//  - the card at 1024 × 768 and on the tablet (1180 × 820, touch): inside the view, text ≥ 12 px, answers ≥ 44 px;
//  - lord mode only: the campaign's ui5 merchant town has no registry chip or card.
//   scripts/remote/run.sh render-EVENTART-card -- bash scripts/eventArtCaptures.sh
//   (PLAYWRIGHT_MODULE=… node_modules/.bin/tsx scripts/eventArtCaptures.mjs <out> --url <url> --states <dir> --states5 <dir>)
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 확인(scripts/eventArtCaptures.mjs)", { remote: "scripts/remote/run.sh render-EVENTART-card -- bash scripts/eventArtCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

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
    occurrences: (state.registry?.occurrences ?? []).map(o => ({ id: o.id, entryId: o.entryId, status: o.status, choiceId: o.choiceId ?? null, hold: o.hold ?? null })) };
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
  return { entry: root.getAttribute('data-registry-offer'), occurrence: root.getAttribute('data-occurrence'), title: root.querySelector('h2')?.textContent ?? null, court: root.querySelector('.lord-card-court')?.textContent ?? null,
    kicker: root.querySelector('.lord-card-kicker')?.textContent ?? null, body: root.querySelector('h2 + p')?.textContent ?? null,
    why: [...root.querySelectorAll('.registry-card-why li')].map(li => li.textContent), lapse: root.querySelector('.lord-card-precedent')?.textContent ?? null,
    art: art?.getAttribute('data-art') ?? null, src, loaded, artBox: artBox === undefined ? null : [Math.round(artBox.width), Math.round(artBox.height)],
    answers: [...root.querySelectorAll('.registry-card-option')].map(button => ({ choice: button.getAttribute('data-choice'), enabled: button.getAttribute('data-enabled'),
      hold: button.getAttribute('data-hold'), cost: button.querySelector('.registry-card-hold')?.textContent ?? null, line: button.querySelector('.lord-card-forecast')?.textContent ?? null,
      disabled: button.disabled, primary: button.classList.contains('ui-btn--primary'), text: button.textContent,
      treasury: button.querySelector('.lord-card-forecast')?.getAttribute('data-treasury') ?? null, height: Math.round(button.getBoundingClientRect().height) })),
    later: Math.round(root.querySelector('.story-modal-later')?.getBoundingClientRect().height ?? 0),
    box: { left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom), inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight },
    smallestText: Math.min(...[...root.querySelectorAll('*')].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== '')).map(el => parseFloat(getComputedStyle(el).fontSize))) };
}, CARD);
let bytes = 0;
const shoot = async (page, selector, name, quality) => { const path = join(out, `${name}.jpg`); await page.locator(selector).first().screenshot({ path, type: 'jpeg', quality }); const size = statSync(path).size; bytes += size; return size; };
const open = (state, options = {}, delay = 8000) => openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: false, initScript: INIT, width: 1280, height: 800,
  // 8 s: on a cold dev server the card can open before openScene's own Escape (after the load), which puts it off as a
  // player's Escape does — then it would not open by itself again (the probe saw this on a run folder's first load). The
  // pictures' loads come after the server is warm (4 s).
  query: `&story-delay=${delay}`, loadTimeout: 90_000, zoom: 1.1, ...options });
/** The registry card; anything that opened first (the season's card, a petition, a home petition) put off or closed, as a
 *  player would. Not opened: a picture of the page for the record. */
const OTHERS = ['.petition-card:not([data-registry-offer]) .story-modal-later', '.season-ledger-resume', '.chronicle-page .chronicle-keep'];
const waitCard = async (page, name = 'unopened') => {
  for (let waited = 0; waited < 30_000; waited += 500) {
    if (await page.locator(`${CARD} >> visible=true`).count() > 0) return true;
    for (const selector of OTHERS) {
      const other = page.locator(`${selector} >> visible=true`);
      if (await other.count() > 0) { console.log(`  (${name}) put off ${selector} at ${waited} ms`); await other.first().click(); break; }
    }
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: join(out, `debug-${name}.jpg`), type: 'jpeg', quality: 30 });
  console.log(`not opened (${name}): modals ${JSON.stringify(await page.locator('.story-modal, .season-ledger-card, [role=dialog]').evaluateAll(nodes => nodes.map(node => node.className)))}`
    + ` chips ${JSON.stringify(await page.locator('.event-chip').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-story'))))}`);
  return false;
};
const base = scene(flags.states, 'registry-offer');
const offer = base.registry.occurrences.find(o => o.status === 'offered' && o.source === 'v4');
const rows = {};

// 1. The offer as drawn: the card by itself, then an answer through it.
{
  const { context, page } = await open(base);
  const opened = await waitCard(page, 'drawn');
  if (!opened) { await browser.close(); process.exit(1); }
  const shown = await card(page);
  const size = await shoot(page, CARD, `card-${offer.entryId}`, 45);
  const before = await proof(page);
  const choice = shown.answers.find(answer => answer.enabled === 'true' && answer.hold !== 'true');
  await page.locator(`${CARD} .registry-card-option[data-choice="${choice.choice}"]`).first().click(); await page.waitForTimeout(800);
  const after = await proof(page);
  const answered = after.occurrences.find(o => o.id === offer.id);
  rows.drawn = { opened, card: shown, bytes: size, choice: choice.choice, status: answered?.status ?? null, choiceId: answered?.choiceId ?? null,
    dues: [before.dues, after.dues], treasury: after.treasury - before.treasury, shownTreasury: Number(choice.treasury), closed: (await page.locator(CARD).count()) === 0 };
  const ok = opened && Array.isArray(shown.loaded) && shown.loaded[0] === 960 && shown.loaded[1] === 540 && shown.why.length >= 2 && shown.answers.every(answer => !answer.primary)
    && shown.answers.every(answer => (answer.line ?? '') !== '') && answered?.status === 'answered' && answered.choiceId === choice.choice && rows.drawn.closed
    && rows.drawn.treasury === (Number.isNaN(rows.drawn.shownTreasury) ? 0 : rows.drawn.shownTreasury);
  rows.drawn.ok = ok;
  console.log(`${ok ? 'ok ' : 'BAD'} drawn ${offer.entryId}: art ${shown.art} ${JSON.stringify(shown.loaded)} why ${JSON.stringify(shown.why)} → ${choice.choice} ${answered?.status} treasury ${rows.drawn.treasury} (shown ${choice.treasury})`);
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
// 3. A hold: its card says what holding costs; held, the occurrence keeps the cost (ER-19).
{
  const holdBase = scene(flags.states, 'registry-offer-hold');
  const held = holdBase.registry.occurrences.find(o => o.status === 'offered' && o.source === 'v4');
  const { context, page } = await open(holdBase);
  const opened = await waitCard(page, 'hold');
  const shown = opened ? await card(page) : null;
  const hold = shown?.answers.find(answer => answer.hold === 'true' && answer.enabled === 'true') ?? null;
  const size = opened ? await shoot(page, CARD, `card-hold-${shown.entry}`, 40) : 0;
  if (hold !== null) { await page.locator(`${CARD} .registry-card-option[data-choice="${hold.choice}"]`).first().click(); await page.waitForTimeout(800); }
  const after = (await proof(page)).occurrences.find(o => o.id === shown?.occurrence) ?? null;
  rows.hold = { opened, entry: shown?.entry ?? null, offer: held?.id ?? null, shownOffer: shown?.occurrence ?? null, choice: hold?.choice ?? null, cost: hold?.cost ?? null, line: hold?.line ?? null,
    status: after?.status ?? null, kept: after?.hold ?? null, closed: (await page.locator(CARD).count()) === 0, bytes: size };
  rows.hold.ok = opened && hold !== null && (hold.cost ?? '').startsWith('보류') && after?.status === 'answered' && after.choiceId === hold.choice && after.hold !== null && rows.hold.closed;
  console.log(`${rows.hold.ok ? 'ok ' : 'BAD'} hold: ${JSON.stringify(rows.hold)}`);
  await context.close();
}
// 5. The small view and the tablet.
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
// 6. Lord mode only: a campaign town shows no registry chip, no registry card.
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
const ok = rows.drawn.ok && rows.chip.ok && rows.hold.ok && rows['1024x768'].ok && rows.tablet.ok && rows.campaign.ok;
writeFileSync(join(out, 'captures.json'), JSON.stringify({ url, ok, bytes, offer: { id: offer.id, entryId: offer.entryId, receipt: offer.receipt }, rows }, null, 1) + '\n');
console.log(JSON.stringify({ ok, bytes }));
if (!ok) process.exitCode = 1;
