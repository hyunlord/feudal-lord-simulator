// LM-R1 (petitions) the lord's cards in the browser, on the DGX (spec docs/ops/install-plan-20261003/SPECS/wave44.md
// "캡처 관문"), from scripts/lmr1PetitionStates.ts's lord-mode states:
//  - each home petition kind: its card opens by itself (the story's delay), the Wave 44 picture loaded (or none for the
//    pannage and the chancel — no other picture), both answers through answer_estate_petition (the card answered
//    once per answer, each from the scene's own state: status, decidedBy lord, the treasury by the card's number);
//  - boundary_dispute also at the tablet (1180 × 820, touch) and at DPR 2;
//  - the town's request card from its chip (a proclamation waiting) and its answer's command;
//  - the guardian case: a minor lord's court line on the card;
//  - lord mode only: the campaign's ui5 merchant town has no lord chip.
//   scripts/remote/run.sh render-LMR1-petitions-<sha7> -- bash scripts/lmr1PetitionCaptures.sh
//   (PLAYWRIGHT_MODULE=… node_modules/.bin/tsx scripts/lmr1PetitionCaptures.mjs <out> --url <url> --states <dir> --states5 <dir>)
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 확인(scripts/lmr1PetitionCaptures.mjs)", { remote: "scripts/remote/run.sh render-LMR1-petitions-<sha7> -- bash scripts/lmr1PetitionCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { closeAnswerReceipt } from './answerReceiptPress.mjs';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const scene = (dir, name) => JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const KINDS = ['boundary_dispute', 'mill_suit', 'heriot', 'merchet', 'ale_fines', 'road_bridge', 'stall_dispute', 'wardship', 'common_pasture', 'newcomer', 'pannage', 'chancel_repair'];
const ART = { boundary_dispute: true, mill_suit: true, heriot: true, merchet: true, ale_fines: true, road_bridge: true, stall_dispute: true, wardship: true,
  common_pasture: true, newcomer: true, pannage: false, chancel_repair: false };
const seatTile = state => { const seat = state.buildings.find(b => b.kind === 'manor_house') ?? state.buildings.find(b => b.kind === 'house') ?? state.buildings[0]; return [seat.tx, seat.ty]; };
const QUALITY = 42;
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const proof = page => page.evaluate(() => {
  const state = window.__FEUDAL_PHASE10_PROOF__.state();
  const cash = (state.ledger?.accounts ?? []).find(account => account.id === 'cash');
  return { tick: state.tick, treasury: state.treasuryCoin, cash: cash?.balance ?? null, rules: state.stewardship?.rules ?? null,
    petitions: (state.stewardship?.petitions ?? []).map(p => ({ id: p.id, kind: p.kind, status: p.status, decidedBy: p.decidedBy ?? null, precedent: p.precedent ?? null })),
    era: state.era, requests: (state.agency?.requests ?? []).map(r => r.kind) };
});
/** The card's text and picture as shown: the picture's url loaded to its natural size (or none). */
const card = page => page.evaluate(async () => {
  const root = document.querySelector('.lord-card');
  if (root === null) return null;
  const art = root.querySelector('.lord-card-art, .story-modal-art');
  const background = art === null ? null : getComputedStyle(art).backgroundImage;
  const src = background === null ? null : background.match(/url\("?([^")]+)"?\)/)?.[1] ?? null;
  const loaded = src === null ? null : await new Promise(done => { const image = new Image(); image.onload = () => done([image.naturalWidth, image.naturalHeight]); image.onerror = () => done('error'); image.src = src; });
  const box = root.getBoundingClientRect();
  return { title: root.querySelector('h2')?.textContent ?? null, court: root.querySelector('.lord-card-court, .decision-card-court')?.textContent ?? null,
    demand: root.querySelector('.decision-card-situation, h2 + p')?.textContent ?? null, art: art?.getAttribute('data-art') ?? null, src, loaded,
    // DEC-CARD: a card in the heavy layout has answer blocks (data-choice grant / refuse) in place of the option buttons.
    answers: [...root.querySelectorAll('.petition-option, .decision-card-choice')].map(button => ({ grant: button.getAttribute('data-grant') ?? (button.getAttribute('data-choice') === null ? null : String(button.getAttribute('data-choice') === 'grant')), text: button.textContent,
      treasury: button.querySelector('.lord-card-forecast')?.getAttribute('data-treasury') ?? null, relations: button.querySelector('.lord-card-forecast')?.getAttribute('data-relations') ?? null,
      height: Math.round(button.getBoundingClientRect().height) })),
    precedent: root.querySelector('.lord-card-precedent')?.textContent ?? null, recurring: root.querySelector('.lord-card-recurring')?.getAttribute('aria-pressed') ?? null,
    box: { left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom), inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight },
    smallestText: Math.min(...[...root.querySelectorAll('*')].filter(el => el.childNodes.length > 0 && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== '')).map(el => parseFloat(getComputedStyle(el).fontSize))) };
});
const shoot = async (page, name) => { const path = join(out, `${name}.jpg`); await page.locator('.lord-card').first().screenshot({ path, type: 'jpeg', quality: QUALITY }); return statSync(path).size; };
const open = (state, options = {}) => openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: false, initScript: INIT, width: 1280, height: 800,
  query: '&story-delay=3000', loadTimeout: 90_000, zoom: 1.1, ...options });
/** The card, a political petition that opened first put off (it opens before a home petition, as for a player). */
const waitCard = async (page, selector) => {
  for (let waited = 0; waited < 30_000; waited += 500) {
    if (await page.locator(`${selector} >> visible=true`).count() > 0) return true;
    const political = page.locator('.petition-card:not(.lord-card) .story-modal-later >> visible=true');
    if (await political.count() > 0) await political.first().click();
    await page.waitForTimeout(500);
  }
  return false;
};
const fromChip = async (page, story, selector) => {
  const chip = page.locator(`.event-chip[data-story="${story}"]`).first();
  if (!(await chip.waitFor({ state: 'visible', timeout: 30_000 }).then(() => true, () => false))) return false;
  await chip.click(); await page.locator('.event-card .event-card-decide').first().click();
  return waitCard(page, selector);
};

const rows = {}; let bytes = 0;
// 1. Each home petition kind: the card by itself, both answers.
for (const kind of KINDS) {
  const state = scene(flags.states, `home-${kind}`);
  const petition = state.stewardship.petitions.find(p => p.status === 'open' && p.kind === kind);
  const row = { petition: petition.id, answers: {} };
  for (const grant of [true, false]) {
    const { context, page } = await open(state);
    row.opened = await waitCard(page, `.lord-card[data-home-petition="${kind}"]`);
    if (grant) { row.card = await card(page); row.bytes = await shoot(page, `home-${kind}`); bytes += row.bytes; }
    const before = await proof(page);
    await page.locator(`.lord-card .petition-option[data-grant="${grant}"], .lord-card [data-choose="${grant ? 'grant' : 'refuse'}"]`).first().click(); await page.waitForTimeout(600);
    // RECEIPTS: the answered card turns over to its receipt; [확인] closes it.
    const receipt = await closeAnswerReceipt(page);
    const after = await proof(page);
    const answered = after.petitions.find(p => p.id === petition.id);
    const shown = row.card?.answers.find(answer => answer.grant === String(grant));
    row.answers[grant ? 'grant' : 'refuse'] = { status: answered?.status ?? null, decidedBy: answered?.decidedBy ?? null, treasury: after.treasury - before.treasury,
      shownTreasury: shown === undefined ? null : Number(shown.treasury), receipt, closed: (await page.locator('.lord-card').count()) === 0 };
    await context.close();
  }
  row.pictureOk = ART[kind] ? row.card?.art !== null && Array.isArray(row.card?.loaded) && row.card.loaded[0] === 960 : row.card?.art === null && row.card?.src === null;
  row.answersOk = ['grant', 'refuse'].every(key => row.answers[key].status === (key === 'grant' ? 'granted' : 'refused') && row.answers[key].decidedBy === 'lord'
    && row.answers[key].treasury === row.answers[key].shownTreasury && row.answers[key].receipt && row.answers[key].closed);
  rows[`home-${kind}`] = row;
  console.log(`${row.opened && row.pictureOk && row.answersOk ? 'ok ' : 'BAD'} home-${kind}: art ${row.card?.art} ${JSON.stringify(row.card?.loaded)} · ${JSON.stringify(row.answers)}`);
}
// 2. The boundary at the tablet and at DPR 2.
for (const [name, options] of [['home-boundary_dispute-tablet', { width: 1180, height: 820, hasTouch: true }], ['home-boundary_dispute-dpr2', { dpr: 2 }]]) {
  const { context, page } = await open(scene(flags.states, 'home-boundary_dispute'), options);
  const opened = await waitCard(page, '.lord-card[data-home-petition="boundary_dispute"]');
  const shown = await card(page);
  const size = await shoot(page, name); bytes += size;
  rows[name] = { opened, card: shown, bytes: size };
  console.log(`${opened && shown?.box.inside ? 'ok ' : 'BAD'} ${name}: ${JSON.stringify(shown?.box)} answers ${JSON.stringify(shown?.answers.map(answer => answer.height))} smallest ${shown?.smallestText}`);
  await context.close();
}
// 3. (DEC-CARD-2: the steward's precedent card is gone — DEC-TRACE DTR-1; his season is the season card's "청지기가 처리한 일".)
// 4. The town's request.
{
  const state = scene(flags.states, 'request');
  const { context, page } = await open(state);
  const opened = await fromChip(page, 'lord_request', '.lord-card[data-lord-request]');
  const shown = await card(page);
  const size = opened ? await shoot(page, 'request') : 0; bytes += size;
  const before = await proof(page);
  // DEC-CARD: the request's grant is the heavy card's [data-choose]; RECEIPTS: its receipt closed with [확인].
  if (opened) { await page.locator('.lord-card .petition-option[data-grant="true"], .lord-card [data-choose="grant"]').first().click(); await page.waitForTimeout(800); }
  const receipt = opened && await closeAnswerReceipt(page);
  const after = await proof(page);
  rows.request = { opened, card: shown, bytes: size, receipt, before: { era: before.era, requests: before.requests }, after: { era: after.era, requests: after.requests } };
  console.log(`${opened && receipt ? 'ok ' : 'BAD'} request: ${shown?.title} era ${before.era} → ${after.era}, receipt ${receipt}`);
  await context.close();
}
// 5. The guardian case.
{
  const { context, page } = await open(scene(flags.states, 'guardian'));
  const opened = await waitCard(page, '.lord-card[data-home-petition]');
  const shown = await card(page);
  const size = opened ? await shoot(page, 'guardian') : 0; bytes += size;
  rows.guardian = { opened, court: shown?.court ?? null, bytes: size };
  console.log(`${opened && /후견/.test(shown?.court ?? '') ? 'ok ' : 'BAD'} guardian: ${shown?.court}`);
  await context.close();
}
// 6. Lord mode only: a campaign town shows no lord chip, no lord card.
{
  const state = scene(flags.states5, 'merchant-town');
  const { context, page } = await openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: true, initScript: INIT, width: 1280, height: 800, query: '&story-delay=500', loadTimeout: 90_000 });
  await page.waitForTimeout(4_000);
  rows.campaign = { lordChips: await page.locator('.event-chip[data-story="home_petition"], .event-chip[data-story="home_precedent"], .event-chip[data-story="lord_request"]').count(),
    lordCards: await page.locator('.lord-card').count() };
  console.log(`${rows.campaign.lordChips + rows.campaign.lordCards === 0 ? 'ok ' : 'BAD'} campaign: ${JSON.stringify(rows.campaign)}`);
  await context.close();
}
await browser.close();
const ok = KINDS.every(kind => rows[`home-${kind}`].opened && rows[`home-${kind}`].pictureOk && rows[`home-${kind}`].answersOk)
  && rows.request.opened && rows.guardian.opened && rows.campaign.lordChips + rows.campaign.lordCards === 0;
writeFileSync(join(out, 'captures.json'), JSON.stringify({ url, ok, bytes, rows }, null, 1) + '\n');
console.log(JSON.stringify({ ok, bytes }));
if (!ok) process.exitCode = 1;
