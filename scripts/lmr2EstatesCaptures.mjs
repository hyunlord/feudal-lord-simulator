// LM-R2 (estates) the lord screen's 영지 in the browser, on the DGX — the 캡처 관문 of docs/ops/install-plan-20261003/SPECS/
// wave35-estates.md, wave35-operations.md (not the suit track: the ledger area's) and lord-components-ui.md, from the
// lord2 states (scripts/lmr2States.ts, DGX ~/fls-lmr2-states):
//  - wave35-estates: the home estate, a poor neighbour (the third, before the marriage), a rich neighbour (the first),
//    the mill estate and the delegated estate (the third, inherited): each card's possessor, annual value and pieces
//    against estatesOf / the portfolio of the scene's own state; the card's picture loaded at 480×270; the overlay
//    only on the estate taken into possession (none on the same estate before);
//  - wave35-operations: delegation 0 (the estate taken direct, within the attention) / 1 (given to a steward, and a
//    candidate appointed in its place by the screen's button) / the attention over its limit; a pending audit by visit
//    (the state) and by accounts (the inherited state with its audit set to accounts by the screen's command, played on
//    to the Michaelmas whose audit finds something); the four policies switched in the ledger's lord tab; the subsidy
//    refused over a quarter of the treasury; the subsidy's notice with a subsidy on offer;
//  - lord-components-ui: the merchant / peasant trait icons on the candidates, the deadline / rights / urgent alerts;
//  - the home card at the tablet (1180 × 820, touch) and at DPR 2; the world in view beside the panel.
//   scripts/remote/run.sh render-LMR2-estates-<sha7> -- bash scripts/lmr2EstatesCaptures.sh
//   (PLAYWRIGHT_MODULE=… node_modules/.bin/tsx scripts/lmr2EstatesCaptures.mjs <out> --url <url> --states <dir>)
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 확인(scripts/lmr2EstatesCaptures.mjs)", { remote: "scripts/remote/run.sh render-LMR2-estates-<sha7> -- bash scripts/lmr2EstatesCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';
import { advanceTick } from '../src/engine/tick.ts';
import { pendingAudits } from '../src/engine/stewardship.ts';
import { gameReducer } from '../src/state/gameStore.ts';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const scene = name => JSON.parse(readFileSync(join(flags.states, `${name}.json`), 'utf8'));
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const N1 = 'estate-neighbour-1', N2 = 'estate-neighbour-2', N3 = 'estate-neighbour-3', HOME = 'estate-home';
const QUALITY = 40;
const seatTile = state => { const seat = state.buildings.find(b => b.kind === 'manor_house') ?? state.buildings.find(b => b.kind === 'house') ?? state.buildings[0]; return [seat.tx, seat.ty]; };
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const open = (state, options = {}) => openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: false, initScript: INIT, width: 1280, height: 800,
  query: '&story-delay=600000', loadTimeout: 90_000, zoom: 1.1, ...options });
/** The engine's own view of the scene, read in the page (the same state the screen draws). */
const proof = page => page.evaluate(() => {
  const state = window.__FEUDAL_PHASE10_PROOF__.state();
  const estates = state.estates?.estates ?? null;
  const oversight = state.stewardship?.oversight ?? [];
  return { tick: state.tick, treasury: state.treasuryCoin, policy: state.agency?.policy ?? null, subsidies: state.agency?.subsidies ?? [],
    estates: estates === null ? null : estates.map(e => ({ id: e.id, possessor: e.possessor, title: e.titleHolder, annualValue: e.annualValue, offMap: e.offMap,
      pieces: e.pieces.map(p => ({ id: p.id, possessor: p.possessor, title: p.titleHolder })) })),
    oversight: oversight.map(o => ({ estateId: o.estateId, mode: o.mode, stewardId: o.stewardId, auditMode: o.auditMode })),
    rules: state.stewardship?.rules ?? null, audits: (state.stewardship?.audits ?? []).map(a => ({ id: a.id, mode: a.mode, status: a.status })) };
});
/** The screen as drawn: the chosen card's facts and pieces, its picture and overlay as loaded, the oversight. */
const screen = page => page.evaluate(async () => {
  const loaded = async el => {
    if (el === null) return null;
    const src = getComputedStyle(el).backgroundImage.match(/url\("?([^")]+)"?\)/)?.[1] ?? null;
    if (src === null) return { src: null, size: null };
    const size = await new Promise(done => { const image = new Image(); image.onload = () => done([image.naturalWidth, image.naturalHeight]); image.onerror = () => done('error'); image.src = src; });
    return { src, size };
  };
  const root = document.querySelector('.lord-estates');
  if (root === null) return null;
  const card = root.querySelector('.lord-estates-card');
  const panel = document.querySelector('.slot-panel.lord-screen').getBoundingClientRect();
  const texts = sel => [...root.querySelectorAll(sel)].map(el => el.textContent.trim());
  return {
    estate: root.getAttribute('data-lord-estates'), possessor: card?.getAttribute('data-possessor') ?? null, annualValue: Number(card?.getAttribute('data-annual-value')),
    picture: card?.getAttribute('data-picture') ?? null, overlayFlag: card?.getAttribute('data-overlay') ?? null,
    art: card?.querySelector('.lord-estates-picture')?.getAttribute('data-art') ?? null,
    pictureLoaded: await loaded(card?.querySelector('.lord-estates-picture') ?? null), overlay: await loaded(card?.querySelector('.lord-estates-overlay') ?? null),
    facts: Object.fromEntries([...root.querySelectorAll('.lord-estates-fact')].map(el => [el.getAttribute('data-fact'), el.querySelector('dd').textContent])),
    pieces: [...root.querySelectorAll('.lord-estates-pieces tbody tr')].map(tr => ({ id: tr.getAttribute('data-piece'), possessor: tr.getAttribute('data-possessor') })),
    oversight: root.querySelector('.lord-estates-oversight')?.getAttribute('data-oversight') ?? null,
    office: root.querySelector('.lord-estates-keeper')?.getAttribute('data-office') ?? null,
    officeIcon: await loaded(root.querySelector('.lord-estates-keeper .lord-estates-office')),
    traits: await Promise.all([...root.querySelectorAll('.lord-estates-trait')].map(loaded)),
    dispositions: [...root.querySelectorAll('.lord-estates-disposition')].map(el => ({ disposition: el.getAttribute('data-disposition'), icon: el.querySelector('.lord-estates-trait') !== null })),
    attention: root.querySelector('[data-attention-load]')?.textContent ?? null, overloaded: root.querySelector('.lord-estates-attention')?.getAttribute('data-overloaded') ?? null,
    alerts: await Promise.all([...root.querySelectorAll('.lord-estates-alert')].map(loaded)),
    pending: root.querySelector('.lord-estates-pending')?.getAttribute('data-audit-mode') ?? null, pendingText: texts('.lord-estates-pending .lord-estates-line')[0] ?? null,
    auditArt: await loaded(root.querySelector('.lord-estates-audit-art')),
    summaries: root.querySelectorAll('.lord-estates-summaries tbody tr').length, totals: texts('.lord-estates-total dd'),
    worldVisible: Math.round(panel.left), panelInside: panel.left >= 0 && panel.right <= innerWidth && panel.bottom <= innerHeight,
    smallestText: Math.min(...[...root.querySelectorAll('*')].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== '')).map(el => parseFloat(getComputedStyle(el).fontSize))),
    coarse: matchMedia('(pointer: coarse)').matches,
    smallestButton: Math.min(...[...root.querySelectorAll('.ui-btn')].map(el => Math.round(el.getBoundingClientRect().height))),
  };
});
const intoEstates = async page => {
  await page.locator("[data-dock='ledger']").first().click(); await page.locator("[data-ledger-tab='lord']").first().click();
  await page.locator('[data-lord-open]').first().click(); await page.waitForTimeout(400);
  await page.locator("[data-lord-nav='estates']").first().click(); await page.waitForTimeout(600);
};
const choose = async (page, estateId) => { await page.locator(`[data-estate='${estateId}']`).first().click(); await page.waitForTimeout(500); };
/** The panel as the player sees it, scrolled so `section` (what the shot is about) starts at the top of the screen's scroller. */
const shoot = async (page, name, selector = '.slot-panel.lord-screen', section = null) => {
  const path = join(out, `${name}.jpg`);
  if (section !== null) { await page.locator(section).first().evaluate(el => el.scrollIntoView({ block: 'start' })); await page.waitForTimeout(200); }
  if (selector === null) await page.screenshot({ path, type: 'jpeg', quality: QUALITY }); else await page.locator(selector).first().screenshot({ path, type: 'jpeg', quality: QUALITY });
  return statSync(path).size;
};
/** The card against the engine: possessor, annual value and pieces of the scene's own state (estatesOf: the stored ones). */
const matches = (shown, engine, id) => {
  const estate = engine.estates?.find(e => e.id === id);
  if (estate === undefined) return id !== HOME && engine.estates === null; // the opening portfolio (no stored estates): read from the seed
  return shown.possessor === estate.possessor && (!estate.offMap || shown.annualValue === estate.annualValue) && shown.pieces.length === estate.pieces.length && shown.pieces.every((piece, at) => piece.id === estate.pieces[at].id && piece.possessor === estate.pieces[at].possessor);
};

const rows = {}; let bytes = 0;
const record = (name, row, ok) => { rows[name] = { ...row, ok }; bytes += row.bytes ?? 0; console.log(`${ok ? 'ok ' : 'BAD'} ${name}: ${JSON.stringify({ picture: row.shown?.picture, art: row.shown?.art, size: row.shown?.pictureLoaded?.size, overlay: row.shown?.overlay?.size ?? null, facts: row.shown?.facts, extra: row.extra ?? null })}`); };
const pictureOk = (shown, picture) => shown?.picture === picture && shown?.art === picture && Array.isArray(shown?.pictureLoaded?.size) && shown.pictureLoaded.size[0] === 480 && shown.pictureLoaded.size[1] === 270;

// 1. wave35-estates: home, the rich and the mill neighbours, the poor neighbour before the marriage, the delegated estate after it.
for (const [name, state, id, picture, overlay] of [['estate-home', 'inherited', HOME, 'ordinary', false], ['estate-rich', 'inherited', N1, 'wealthy', false],
  ['estate-mill', 'inherited', N2, 'riverside_mill', false], ['estate-poor', 'offer-countered', N3, 'poor', false], ['estate-delegated', 'inherited', N3, 'poor', true]]) {
  const { context, page } = await open(scene(state));
  await intoEstates(page); if (id !== HOME) await choose(page, id);
  const shown = await screen(page); const engine = await proof(page);
  const size = await shoot(page, name, name === 'estate-home' ? null : '.slot-panel.lord-screen', name === 'estate-delegated' ? '.lord-estates-card' : name === 'estate-home' ? null : '.lord-estates-picker');
  const overlayOk = overlay ? Array.isArray(shown?.overlay?.size) && shown.overlay.size[0] === 480 && shown.overlayFlag === 'true' : shown?.overlay === null && shown?.overlayFlag === 'false';
  const extra = name === 'estate-home' ? { worldVisible: shown.worldVisible, alerts: shown.alerts.map(a => a?.size), smallestText: shown.smallestText, smallestButton: shown.smallestButton }
    : name === 'estate-delegated' ? { oversight: shown.oversight, office: shown.office, officeIcon: shown.officeIcon?.size, dispositions: shown.dispositions, traits: shown.traits.map(t => t?.size) } : null;
  const ok = shown?.estate === id && pictureOk(shown, picture) && overlayOk && matches(shown, engine, id) && shown.smallestText >= 12
    && (name !== 'estate-home' || (shown.worldVisible >= 264 && shown.alerts.some(a => Array.isArray(a?.size))))
    && (name !== 'estate-delegated' || (shown.oversight === 'steward' && shown.office === 'steward' && Array.isArray(shown.officeIcon?.size)
      && shown.dispositions.every(d => d.icon === (d.disposition !== 'greedy')) && shown.traits.every(t => Array.isArray(t?.size))));
  record(name, { state, shown, engine: engine.estates?.find(e => e.id === id) ?? null, bytes: size, extra }, ok);
  await context.close();
}
// 2. The home card at the tablet and at DPR 2.
for (const [name, options] of [['estate-home-tablet', { width: 1180, height: 820, hasTouch: true }], ['estate-home-dpr2', { dpr: 2 }]]) {
  const { context, page } = await open(scene('inherited'), options);
  await intoEstates(page);
  const shown = await screen(page);
  const size = await shoot(page, name);
  record(name, { shown: { picture: shown?.picture, art: shown?.art, pictureLoaded: shown?.pictureLoaded }, bytes: size, extra: { coarse: shown?.coarse, panelInside: shown?.panelInside, smallestButton: shown?.smallestButton, smallestText: shown?.smallestText } },
    pictureOk(shown, 'ordinary') && shown.panelInside && shown.smallestText >= 12 && shown.smallestButton >= (shown.coarse ? 48 : 44));
  await context.close();
}
// 3. Delegation 0 / 1 / over the attention; a candidate appointed; the audit's mode.
{
  const { context, page } = await open(scene('promises'));
  await intoEstates(page); await choose(page, N3);
  const shown = await screen(page); const size = await shoot(page, 'delegation-0', undefined, '.lord-estates-oversight');
  record('delegation-0', { shown, bytes: size, extra: { oversight: shown?.oversight, office: shown?.office, officeIcon: shown?.officeIcon?.size, attention: shown?.attention } },
    shown?.oversight === 'direct' && shown.office === 'receiver' && Array.isArray(shown.officeIcon?.size) && shown.overloaded === 'false');
  await context.close();
}
{
  const { context, page } = await open(scene('inherited'));
  await intoEstates(page); await choose(page, N3);
  const before = await proof(page);
  const candidate = await page.locator('.lord-estates-candidates li').first().getAttribute('data-candidate');
  await page.locator('.lord-estates-candidates li .lord-estates-appoint').first().click(); await page.waitForTimeout(500);
  const appointed = await proof(page);
  await page.locator("[data-audit-mode='accounts']").first().click(); await page.waitForTimeout(400);
  const audited = await proof(page);
  await page.locator("[data-rule='amount']").first().click(); await page.waitForTimeout(400);
  await page.locator("[data-rule-step='more']").first().click(); await page.waitForTimeout(400);
  const ruled = await proof(page);
  const shown = await screen(page); const size = await shoot(page, 'delegation-1', undefined, '.lord-estates-oversight');
  const n3 = state => state.oversight.find(o => o.estateId === N3);
  record('delegation-1', { shown, bytes: size, extra: { before: n3(before), candidate, appointed: n3(appointed), audited: n3(audited), rules: ruled.rules } },
    n3(before).mode === 'steward' && n3(appointed).stewardId === candidate && n3(appointed).mode === 'steward' && n3(audited).auditMode === 'accounts'
    && ruled.rules?.amountAtLeast === 1440 && shown?.oversight === 'steward');
  await context.close();
}
{
  const { context, page } = await open(scene('attention-overloaded'));
  await intoEstates(page); await choose(page, N3);
  const shown = await screen(page); const size = await shoot(page, 'attention-overloaded');
  record('attention-overloaded', { shown, bytes: size, extra: { attention: shown?.attention, alerts: shown?.alerts.map(a => a?.size) } },
    shown?.overloaded === 'true' && shown.oversight === 'direct' && shown.alerts.some(a => Array.isArray(a?.size)));
  await context.close();
}
// 4. pendingAudits by visit (the state) and by accounts (played on from the inherited state, the mode set by the screen's command).
{
  const { context, page } = await open(scene('audit-pending'));
  await intoEstates(page); await choose(page, N3);
  const shown = await screen(page); const size = await shoot(page, 'audit-visit', undefined, '.lord-estates-pending');
  record('audit-visit', { shown, bytes: size, extra: { pending: shown?.pending, text: shown?.pendingText, art: shown?.auditArt?.size } },
    shown?.pending === 'visit' && Array.isArray(shown.auditArt?.size) && shown.auditArt.size[0] === 960 && shown.alerts.some(a => Array.isArray(a?.size)));
  await context.close();
}
{
  let state = gameReducer(scene('inherited'), { type: 'set_audit_mode', estateId: N3, mode: 'accounts' });
  let played = 0;
  while (pendingAudits(state).length === 0 && played < 12_000) { state = advanceTick(state); played += 1; }
  const audit = pendingAudits(state)[0];
  const { context, page } = await open(state);
  await intoEstates(page); await choose(page, N3);
  const shown = await screen(page); const size = await shoot(page, 'audit-accounts', undefined, '.lord-estates-pending');
  record('audit-accounts', { shown, bytes: size, extra: { played, audit: audit === undefined ? null : { id: audit.id, mode: audit.mode, kept: audit.revealedKept, errors: audit.revealedErrors }, text: shown?.pendingText } },
    audit?.mode === 'accounts' && shown?.pending === 'accounts');
  await context.close();
}
// 5. The ledger's lord tab: the four policies switched (each the engine's set_estate_policy), the notice of a subsidy on offer.
{
  const { context, page } = await open(scene('neighbour-suit'));
  await page.locator("[data-dock='ledger']").first().click(); await page.locator("[data-ledger-tab='lord']").first().click(); await page.waitForTimeout(600);
  const switched = [];
  for (const policy of ['growth', 'revenue', 'stability', 'defence']) {
    await page.locator(`.lord-policy-option[data-policy='${policy}']`).first().click(); await page.waitForTimeout(300);
    switched.push({ policy, now: (await proof(page)).policy, art: await page.locator(`.lord-policy-option[data-policy='${policy}']`).first().getAttribute('data-policy-art') });
  }
  const notice = await page.evaluate(async () => {
    const el = document.querySelector('.lord-policy-notice'); if (el === null) return null;
    const src = getComputedStyle(el).backgroundImage.match(/url\("?([^")]+)"?\)/)?.[1];
    return new Promise(done => { const image = new Image(); image.onload = () => done([image.naturalWidth, image.naturalHeight]); image.onerror = () => done('error'); image.src = src; });
  });
  const size = await shoot(page, 'policy-subsidy', '.slot-panel.ledger-drawer');
  record('policy-subsidy', { bytes: size, extra: { switched, notice } }, switched.every(row => row.now === row.policy && row.art === row.policy) && Array.isArray(notice) && notice[0] === 192);
  await context.close();
}
// 6. The subsidy refused over a quarter of the treasury (the engine's subsidyRefusal; the set button shut).
{
  const state = scene('offer-countered');
  const { context, page } = await open(state);
  await page.locator("[data-dock='ledger']").first().click(); await page.locator("[data-ledger-tab='lord']").first().click(); await page.waitForTimeout(600);
  for (let step = 0; step < 4; step += 1) { await page.locator(".lord-policy-step[data-step='more']").first().click(); await page.waitForTimeout(150); }
  const refusal = await page.locator(".lord-policy-refusal[data-refused='true']").first().textContent().catch(() => null);
  const shut = await page.locator('.lord-policy-set').first().isDisabled();
  const before = (await proof(page)).subsidies.length;
  await page.locator('.lord-policy-set').first().click({ force: true }).catch(() => undefined); await page.waitForTimeout(300);
  const after = (await proof(page)).subsidies.length;
  const size = await shoot(page, 'subsidy-refused', '.slot-panel.ledger-drawer');
  record('subsidy-refused', { bytes: size, extra: { treasury: state.treasuryCoin, refusal, shut, before, after } }, refusal !== null && shut && before === after);
  await context.close();
}
await browser.close();
const ok = Object.values(rows).every(row => row.ok);
writeFileSync(join(out, 'captures.json'), JSON.stringify({ url, ok, bytes, rows }, null, 1) + '\n');
console.log(JSON.stringify({ ok, bytes }));
if (!ok) process.exitCode = 1;
