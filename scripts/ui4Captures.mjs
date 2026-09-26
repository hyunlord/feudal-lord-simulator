// UI-4 evidence (gates 1-4), JPEG, and one JSON of what each capture showed.
//   PLAYWRIGHT_MODULE=... node scripts/ui4Captures.mjs <out-dir> --url <url> --states <dir from scripts/ui4ChapterStates.ts>
//  1 world before UI, for the first fire, the wet summer (dearth rehearsal), the Great Famine, the first petition and
//    the end of chapter 1: each state opened paused with the world-first delay lengthened (`story-delay=5000`, the
//    same order as the game's 1.5 s) — a "before" shot (the world: roof fire and smoke, blighted fields and rain, the
//    crowd at the chapel; no card) and an "after" shot (the chip, the decision modal, the petition card, the
//    chronicle page). The game's own delay is measured on a second load of each state: the time from the first frame
//    to the chip or modal.
//  2 the famine modal's four answers, then an answer: the modal closes, the state under it comes back, the answer is
//    the engine's; 3 the chronicle page, then 제2장으로 (the chapter 2 preview); 4 S12, the family at the door of a
//    leaving house and the family walking out of a house just left.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag('url') ?? 'http://127.0.0.1:4282/';
const statesDir = flag('states');
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
// Timeline: when the first chip or story modal shows, from the first time the proof API answers (the first frame).
const TIMELINE = `window.__UI4_TIMELINE__ = { first: null, ui: null }; const tick = () => { const t = performance.now();
  if (window.__UI4_TIMELINE__.first === null && window.__FEUDAL_PHASE10_PROOF__ !== undefined) window.__UI4_TIMELINE__.first = t;
  if (window.__UI4_TIMELINE__.ui === null && document.querySelector('.event-chip, .famine-decision, .petition-card, .chronicle-page') !== null) window.__UI4_TIMELINE__.ui = t;
  requestAnimationFrame(tick); }; requestAnimationFrame(tick);`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { url, errors: [], moments: {} };
const shot = (page, file, clip) => page.screenshot({ path: join(out, file), type: 'jpeg', quality: 74, ...(clip ? { clip } : {}) });
const load = name => JSON.parse(readFileSync(join(statesDir, `${name}.json`), 'utf8'));
const ui = page => page.evaluate(() => ({ chips: [...document.querySelectorAll('.event-chip')].map(chip => chip.textContent),
  modal: document.querySelector('.famine-decision') ? 'decision' : document.querySelector('.petition-card') ? 'petition' : document.querySelector('.chronicle-page') ? 'chronicle' : null }));
const focusOf = (state, focus) => {
  const building = id => state.buildings.find(b => b.id === id);
  if (focus === 'fire') { const b = building(state.events?.burning?.[0]?.buildingId) ?? state.buildings.find(x => state.houses.find(h => h.buildingId === x.id && h.burntTick !== undefined)); if (b) return [b.tx, b.ty]; }
  if (focus === 'field') { const z = (state.zones ?? []).find(zone => zone.kind === 'arable'); const c = z?.membership[Math.floor(z.membership.length / 2)]; if (c !== undefined) return [c % state.width, Math.floor(c / state.width)]; }
  if (focus === 'chapel') { const b = state.buildings.find(x => x.kind === 'keep' || x.kind === 'church' || x.kind === 'chapel'); if (b) return [b.tx, b.ty + 1]; }
  if (focus === 'leaving') { const h = state.houses.find(x => x.leavingSinceTick !== undefined && x.abandonedTick === undefined); const b = h && building(h.buildingId); if (b) return [b.tx, b.ty + 1]; }
  if (focus === 'left') { const h = state.houses.find(x => x.abandonedTick !== undefined && state.tick - x.abandonedTick < 20); const b = h && building(h.buildingId); if (b) return [b.tx, b.ty + 1]; }
  const b = state.buildings[0]; return [b.tx, b.ty];
};
async function scene(name, focus, query) {
  const state = load(name);
  const opened = await openScene(browser, { state, tile: focusOf(state, focus), baseUrl: url, width: 1280, height: 800, zoom: 1.3, run: false, initScript: `${TUTORIAL_OFF};${TIMELINE}`, query });
  opened.page.on('pageerror', error => result.errors.push(`${name}: ${String(error)}`));
  return opened;
}

// [key, state, camera focus, the UI that follows the world]
const MOMENTS = [
  ['fire', 'fire-ignited', 'fire', '.event-chip'],
  ['wet_summer', 'dearth-wet-summer', 'field', '.event-chip'],
  ['famine', 'famine-arrival', 'field', '.famine-decision'],
  ['petition', 'petition-open', 'chapel', '.petition-card'],
  ['chapter_end', 'chapter-end', 'field', '.chronicle-page'],
];
for (const [key, name, focus, expected] of MOMENTS) {
  // World first (lengthened delay): before and after.
  const { context, page } = await scene(name, focus, '&story-delay=5000');
  await page.waitForTimeout(900);
  const before = await ui(page);
  await shot(page, `${key}-1-world.jpg`);
  await page.waitForSelector(expected, { timeout: 12_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
  const after = await ui(page);
  await shot(page, `${key}-2-ui.jpg`);
  const moment = { state: name, before, after, worldFirst: before.chips.length === 0 && before.modal === null && (after.chips.length > 0 || after.modal !== null) };
  if (key === 'fire' && after.chips.length > 0) {
    await page.locator('.event-chip').first().click(); await page.waitForTimeout(300);
    await page.locator('.event-card-actions button', { hasText: '조언' }).click().catch(() => undefined); await page.waitForTimeout(200);
    moment.card = await page.evaluate(() => document.querySelector('.event-card')?.innerText.replace(/\n+/g, ' | ') ?? null);
    await shot(page, 'fire-3-card.jpg', { x: 900, y: 100, width: 380, height: 560 });
  }
  if (key === 'famine' && after.modal === 'decision') {
    moment.options = await page.evaluate(() => [...document.querySelectorAll('.famine-option')].map(button => button.innerText.replace(/\n+/g, ' | ')));
    const modeBefore = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().events.records.find(r => r.defId === 'great_famine')?.response ?? null);
    await page.locator('.famine-option[data-choice="relief"]').click(); await page.waitForTimeout(600);
    moment.afterChoice = await page.evaluate(() => ({ modal: document.querySelector('.famine-decision') !== null, response: window.__FEUDAL_PHASE10_PROOF__.state().events.records.find(r => r.defId === 'great_famine')?.response ?? null,
      dockVisible: document.querySelector('.action-dock')?.hasAttribute('hidden') === false, paused: document.querySelector('.speed-seal[aria-pressed="true"]')?.getAttribute('aria-label') }));
    moment.responseBefore = modeBefore;
    await shot(page, 'famine-3-after-choice.jpg');
  }
  if (key === 'petition' && after.modal === 'petition') {
    await page.locator('.petition-option[data-response="accept"]').click(); await page.waitForTimeout(600);
    moment.afterAnswer = await page.evaluate(() => ({ modal: document.querySelector('.petition-card') !== null, rights: window.__FEUDAL_PHASE10_PROOF__.state().politics.rights.length,
      chips: [...document.querySelectorAll('.event-chip')].map(chip => chip.textContent) }));
  }
  if (key === 'chapter_end' && after.modal === 'chronicle') {
    moment.page = await page.evaluate(() => ({ entries: document.querySelectorAll('.chronicle-entry').length, decisions: document.querySelectorAll('.chronicle-decisions li').length,
      text: document.querySelector('.chronicle-body')?.innerText.slice(0, 1200) }));
    await shot(page, 'chapter_end-3-chronicle.jpg');
    await page.locator('.chronicle-next').click(); await page.waitForTimeout(500);
    moment.preview = await page.locator('.chapter-preview').count() > 0;
    await shot(page, 'chapter_end-4-chapter2-preview.jpg');
  }
  await context.close();
  // The game's own delay: a second load at the default, the first frame to the card.
  const timed = await scene(name, focus, '');
  await timed.page.waitForFunction(() => window.__UI4_TIMELINE__.ui !== null, null, { timeout: 12_000 }).catch(() => undefined);
  moment.defaultDelayMs = await timed.page.evaluate(() => window.__UI4_TIMELINE__.ui === null || window.__UI4_TIMELINE__.first === null ? null : Math.round(window.__UI4_TIMELINE__.ui - window.__UI4_TIMELINE__.first));
  await timed.context.close();
  result.moments[key] = moment;
}

// S12: the leaving family at the door; the family walking out of a house just left.
for (const [key, name, focus] of [['leaving', 'household-leaving', 'leaving'], ['left', 'household-left', 'left']]) {
  const { context, page } = await scene(name, focus, '&story-delay=60000');
  await page.waitForTimeout(key === 'left' ? 3500 : 1200);
  await shot(page, `s12-${key}.jpg`, { x: 340, y: 180, width: 600, height: 440 });
  result.moments[`s12_${key}`] = { state: name };
  await context.close();
}
await browser.close();
writeFileSync(join(out, 'ui4-captures.json'), JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify(result, null, 1));
