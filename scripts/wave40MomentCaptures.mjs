// EVENT-ART (wave40) the lord's moments in the browser, on the DGX (spec docs/ops/install-plan-20261003/SPECS/wave40.md
// "캡처 관문"), from scripts/wave40MomentStates.ts's lord-mode states (each the tick after the engine wrote the moment's record):
//  - each of the fourteen moments: its chip comes by itself (the story's delay) with its Wave 40 picture, exactly one chip for
//    the record; its card shows the picture loaded at 960 × 540, the ledger's sentence and the moment's title;
//  - closed, the game run on and the chronicle opened on the record (its Wave 40 picture there) and closed: the chip does
//    not come back (one notification per history record id);
//  - one moment at the tablet (1180 × 820, touch) and at DPR 2;
//  - lord mode only: the campaign's ui5 merchant town has no moment chip.
//   scripts/remote/run.sh render-EVENTART-wave40-<sha7> -- bash scripts/wave40MomentCaptures.sh
//   (node_modules/.bin/tsx scripts/wave40MomentCaptures.mjs <out> --url <url> --states <dir> --states5 <dir>)
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 확인(scripts/wave40MomentCaptures.mjs)", { remote: "scripts/remote/run.sh render-EVENTART-wave40-<sha7> -- bash scripts/wave40MomentCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const scene = (dir, name) => JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
const moments = JSON.parse(readFileSync(join(flags.states, 'moments.json'), 'utf8'));
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
// The fourteen, with the file each must show (src/ui/wave40ArtManifest.generated.ts).
const FILES = {
  marriage_negotiation: '01_marriage_negotiation.jpg', marriage_sealing: '02_marriage_sealing.jpg', bride_arrival: '03_bride_arrival.jpg',
  first_child: '04_first_child.jpg', brother_in_law_born: '05_brother_in_law_born.jpg', old_lord_sickbed: '06_old_lord_sickbed.jpg',
  attempted_will_change: '07_attempted_will_change.jpg', inheritance_fealty: '08_inheritance_fealty.jpg', lawsuit_filed: '09_lawsuit_filed.jpg',
  documentary_evidence: '10_documentary_evidence.jpg', possession_refused: '11_possession_refused.jpg', possession_taken: '12_possession_taken.jpg',
  child_lord_guardian: '13_child_lord_guardian.jpg', end_of_wardship: '14_end_of_wardship.jpg',
};
const CHRONICLE_SHOTS = new Set(['child_lord_guardian', 'lawsuit_filed']);
const seatTile = state => { const seat = state.buildings.find(b => b.kind === 'manor_house') ?? state.buildings.find(b => b.kind === 'keep') ?? state.buildings[0]; return [seat.tx, seat.ty]; };
const QUALITY = 40;
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const open = (state, options = {}) => openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: false, initScript: INIT, width: 1280, height: 800,
  query: '&story-delay=500', loadTimeout: 90_000, zoom: 1.1, ...options });
/** The moment chips on screen: each one's picture file (from its art's background) and its label. */
const chips = page => page.evaluate(() => [...document.querySelectorAll('.event-chip[data-story="lord_moment"]')].map(chip => {
  const art = chip.querySelector('.event-chip-art');
  return { file: (art === null ? '' : getComputedStyle(art).backgroundImage).match(/wave40\/([^")]+)/)?.[1] ?? null, label: chip.getAttribute('aria-label') };
}));
/** A story modal that opened by itself (a petition, a home petition) put off, as a player would. */
const putOff = async page => { const later = page.locator('.story-modal-later >> visible=true'); if (await later.count() > 0) await later.first().click(); };
const waitChip = async (page, file) => {
  for (let waited = 0; waited < 30_000; waited += 500) {
    if ((await chips(page)).some(chip => chip.file === file)) return true;
    await putOff(page); await page.waitForTimeout(500);
  }
  return false;
};
/** The open card: its picture's url loaded to its natural size, its title and line, its box. */
const card = page => page.evaluate(async () => {
  const root = document.querySelector('.event-card[data-story="lord_moment"]');
  if (root === null) return null;
  const art = root.querySelector('.event-card-art');
  const src = art === null ? null : getComputedStyle(art).backgroundImage.match(/url\("?([^")]+)"?\)/)?.[1] ?? null;
  const loaded = src === null ? null : await new Promise(done => { const image = new Image(); image.onload = () => done([image.naturalWidth, image.naturalHeight]); image.onerror = () => done('error'); image.src = src; });
  const box = root.getBoundingClientRect(); const artBox = art?.getBoundingClientRect();
  return { title: root.querySelector('h2')?.textContent ?? null, line: root.querySelector('.event-card-line')?.textContent ?? null, src, loaded,
    art: artBox === undefined ? null : [Math.round(artBox.width), Math.round(artBox.height)],
    box: { left: Math.round(box.left), top: Math.round(box.top), right: Math.round(box.right), bottom: Math.round(box.bottom), inside: box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight },
    smallestText: Math.min(...[...root.querySelectorAll('*')].filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== '')).map(el => parseFloat(getComputedStyle(el).fontSize))) };
});
const shoot = async (locator, name) => { const path = join(out, `${name}.jpg`); await locator.screenshot({ path, type: 'jpeg', quality: QUALITY }); return statSync(path).size; };
/** The chronicle opened from the ledger dock: the record's card (scrolled to) and its picture, then closed. */
const chronicle = async (page, record, name) => {
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(500);
  await page.locator('.ledger-tab--chronicle').first().click();
  await page.locator('.chronicle-screen').first().waitFor({ state: 'visible', timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(900);
  let found = null;
  for (let tries = 0; tries < 40 && found === null; tries += 1) {
    found = await page.evaluate(id => {
      const cardEl = document.querySelector(`.chronicle-card[data-record="${id}"]`);
      if (cardEl === null) { const list = document.querySelector('.chronicle-list'); if (list !== null) list.scrollTop += list.clientHeight * 0.8; return null; }
      cardEl.scrollIntoView({ block: 'center' });
      const art = cardEl.querySelector('.chronicle-card-art');
      return { kind: [...(art?.classList ?? [])].find(name => name.startsWith('chronicle-card-art--')) ?? null,
        file: (art === null ? '' : getComputedStyle(art).backgroundImage).match(/wave40\/([^")]+)/)?.[1] ?? null };
    }, record);
    if (found === null) await page.waitForTimeout(150);
  }
  let bytes = 0;
  if (found !== null && name !== null) { await page.waitForTimeout(400); bytes = await shoot(page.locator(`.chronicle-card[data-record="${record}"]`).first(), name); }
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  if (await page.locator('.chronicle-screen').count() > 0) await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  return { ...(found ?? { kind: null, file: null }), bytes };
};

const rows = {}; let bytes = 0;
// 1. Each moment: the chip by itself, its card, closed; the game on, the chronicle opened and closed; the chip not back.
for (const [name, file] of Object.entries(FILES)) {
  const about = moments[`moment_${name}`];
  if (about === undefined) { rows[name] = { missing: true }; console.log(`BAD ${name}: no state`); continue; }
  const { context, page } = await open(scene(flags.states, name));
  const row = { record: about.record, template: about.template, year: about.year, seed: about.seed ?? null };
  row.chipShown = await waitChip(page, file);
  row.chips = await chips(page);
  row.sameChip = row.chips.filter(chip => chip.file === file).length;
  if (row.chipShown) {
    await page.locator('.event-chip[data-story="lord_moment"]').filter({ has: page.locator(`.event-chip-art[style*="${file}"]`) }).first().click();
    await page.locator('.event-card[data-story="lord_moment"]').first().waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(500);
    row.card = await card(page);
    row.bytes = row.card === null ? 0 : await shoot(page.locator('.event-card').first(), name); bytes += row.bytes;
    // Closed (the card's last action), then the game run on a little.
    await page.locator('.event-card .event-card-actions .ui-btn').last().click(); await page.waitForTimeout(400);
    await page.getByRole('button', { name: '1배속', exact: true }).click().catch(() => {});
    await page.waitForTimeout(4_000);
    row.afterRun = (await chips(page)).filter(chip => chip.file === file).length;
    await page.getByRole('button', { name: '일시 정지', exact: true }).click().catch(() => {});
    row.chronicle = await chronicle(page, about.record, CHRONICLE_SHOTS.has(name) ? `${name}-chronicle` : null);
    bytes += row.chronicle.bytes;
    await page.waitForTimeout(1_500);
    row.afterChronicle = (await chips(page)).filter(chip => chip.file === file).length;
  }
  row.ok = row.chipShown && row.sameChip === 1 && row.card !== null && row.card.src?.endsWith(file) === true && Array.isArray(row.card.loaded)
    && row.card.loaded[0] === 960 && row.card.loaded[1] === 540 && row.card.box.inside && row.afterRun === 0 && row.afterChronicle === 0
    && row.chronicle.kind === 'chronicle-card-art--wave40' && row.chronicle.file === file;
  rows[name] = row;
  console.log(`${row.ok ? 'ok ' : 'BAD'} ${name}: ${row.template} ${row.record} chip ${row.chipShown}×${row.sameChip} card ${row.card?.title} ${JSON.stringify(row.card?.loaded)} ${JSON.stringify(row.card?.art)} · after run ${row.afterRun} · chronicle ${row.chronicle?.kind} ${row.chronicle?.file} · after ${row.afterChronicle}`);
  await context.close();
}
// 2. One moment at the tablet and at DPR 2.
for (const [name, options] of [['lawsuit_filed-tablet', { width: 1180, height: 820, hasTouch: true }], ['lawsuit_filed-dpr2', { dpr: 2 }]]) {
  const { context, page } = await open(scene(flags.states, 'lawsuit_filed'), options);
  const shown = await waitChip(page, FILES.lawsuit_filed);
  if (shown) await page.locator('.event-chip[data-story="lord_moment"]').filter({ has: page.locator(`.event-chip-art[style*="${FILES.lawsuit_filed}"]`) }).first().click();
  await page.waitForTimeout(700);
  const shownCard = await card(page);
  const size = shownCard === null ? 0 : await shoot(page.locator('.event-card').first(), name); bytes += size;
  rows[name] = { shown, card: shownCard, bytes: size, ok: shown && shownCard?.box.inside === true && Array.isArray(shownCard?.loaded) && shownCard.smallestText >= 12 };
  console.log(`${rows[name].ok ? 'ok ' : 'BAD'} ${name}: ${JSON.stringify(shownCard?.box)} art ${JSON.stringify(shownCard?.art)} smallest ${shownCard?.smallestText}`);
  await context.close();
}
// 3. Lord mode only: a campaign town shows no moment chip.
{
  const state = scene(flags.states5, 'merchant-town');
  const { context, page } = await openScene(browser, { state, tile: seatTile(state), baseUrl: url, run: true, initScript: INIT, width: 1280, height: 800, query: '&story-delay=500', loadTimeout: 90_000 });
  await page.waitForTimeout(4_000);
  rows.campaign = { momentChips: (await chips(page)).length, ok: (await chips(page)).length === 0 };
  console.log(`${rows.campaign.ok ? 'ok ' : 'BAD'} campaign: ${JSON.stringify(rows.campaign)}`);
  await context.close();
}
await browser.close();
const ok = Object.values(rows).every(row => row.ok === true);
writeFileSync(join(out, 'captures.json'), JSON.stringify({ url, ok, bytes, rows }, null, 1) + '\n');
console.log(JSON.stringify({ ok, bytes }));
if (!ok) process.exitCode = 1;
