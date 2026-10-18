// VIS-1 (user 2026-10-11, the first play: "10배속으로 돌려도 티가 안 난다"): the lord's slice in the browser as a player sees
// it — a new lord-mode game (seed 1, the riverside town) at 10x for twenty years (1300–1320), the auto-pause on. The lord
// bot only answers for him: its own moves go into the served tick loop before each tick (as scripts/lordSliceRun.ts does
// in Node); its answers to the cards that come to the lord (ASKED_KINDS) wait for the card — when a card stops the game the
// harness presses the bot's choice on it (its `data-choose`), so the answer's receipt shows and is photographed, then
// closed (user 2026-10-11: "답 카드가 화면에 한 번 뜬 뒤 답하게"). An answer whose card never shows is applied after
// ASKED_GRACE ticks (logged), so the game goes on as the bot plays it. The screen, the stops and the season turns are the
// game's own. Every season: a screenshot, the
// page's visible text and the state (gzipped, for scripts/visibleChangeFacts.ts); every stop: a screenshot of what
// stopped the game, then its card put off / its notice resumed and 10x again; all along: every chip, toast, card and
// notice the page added, with its tick and words.
//   scripts/remote/run.sh render-VIS-run-<sha7> --heavy --detach -- bash scripts/visibleChangeRun.sh [out]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
import { railReport } from "./visibleChangeRail.mjs";
refuseHeavyOnMac("브라우저 실행(scripts/visibleChangeRun.mjs)", { remote: "scripts/remote/run.sh render-VIS-run-<sha7> --heavy --detach -- bash scripts/visibleChangeRun.sh", entry: import.meta.url });
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { loadChromium, openScene } from './renderCommitProbe.mjs';
import { newGameState } from '../src/state/newGame.ts';
import { LORD_SLICE_SCENARIO_ID } from '../src/content/lordSliceConfig.ts';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const years = Number(flags.years ?? 20);
const seed = Number(flags.seed ?? 1);
// LS1-11 / LS1-10 (the user 2026-10-17): `--leave audit,estate_petition,will` — the first matter of each kind named is
// left: its card put off (나중에) and never answered, nor applied by the bot, so its deadline runs out and the screen's
// warning, last-season stop and lapse chip show. The kinds not named are answered as the bot plays them.
const leaveKinds = (flags.leave ?? '').split(',').filter(kind => kind !== '');
// The speed the slice runs at (10, as the player's fastest; 1 or 3 for the season band's pace at the slower seals — the
// user 2026-10-18: is the band too often at 1× and 3×?). The run comes back to it after every stop.
const speed = Number(flags.speed ?? 10);
const TICKS_PER_YEAR = 4000;
const SEASON = TICKS_PER_YEAR / 4;
for (const dir of ['seasons', 'stops', 'states']) mkdirSync(join(out, dir), { recursive: true });

const start = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID, seed });
// The camera on the town's middle (its houses' mean tile), as a player would look at it.
const homes = start.buildings.filter(b => b.kind === 'house');
const middle = [Math.round(homes.reduce((sum, b) => sum + b.tx, 0) / homes.length), Math.round(homes.reduce((sum, b) => sum + b.ty, 0) / homes.length)];
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) {}`;
// The bot before each tick (the loop is the game's own otherwise). A stop is read off the calendar: no tick for 1.5 s.
const LOOP = { pattern: '**/src/state/fixedTickLoop.ts*', from: 'nextState = advanceTick(nextState);',
  to: 'nextState = advanceTick(globalThis.__FLS_BOT__ ? globalThis.__FLS_BOT__(nextState) : nextState);' };
/** What puts off a card, closes a receipt or a page, or resumes after a stop — in that order (never an answer). */
const CLEAR = ['.answer-receipt-close', '.slice-begin', '.slice-continue', '.season-ledger-resume', '.results-card-continue', '.chronicle-keep', '.story-modal-later', '.auto-pause-resume'];
/** What the page adds that tells the player something happened (kept with its tick and words). */
/** Ticks an asked answer waits for its card before the bot applies it itself (a card the screen never opened). */
const ASKED_GRACE = 600;
const TOLD = '.event-chip, .event-card, .completion-toast, .story-modal, .auto-pause-notice, .season-ledger-card, .season-notice, .results-card, .chronicle-page, .slice-page, [class*="toast"], [class*="notice"], [role="status"], [role="alert"]';

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const { page } = await openScene(browser, { state: start, tile: middle, baseUrl: url, width: 1280, height: 800, rewrite: [LOOP], run: false, initScript: INIT, loadTimeout: 90_000 });
await page.evaluate(async ({ told, grace, leave }) => {
  const { lordBotCommands, ASKED_KINDS } = await import('/src/engine/lordBot.ts');
  const { gameReducer } = await import('/src/state/gameStore.ts');
  const { AGENCY_WEEK_TICKS } = await import('/src/content/townAgencyConfig.ts');
  window.__FLS_BOT_LOG__ = [];
  // An asked answer waits for its card: first seen (by the matter, not the whole command — the will's choice follows the
  // treasury), applied only after `grace` ticks without it. A counter-offer has no card (it is answered on the 혼인 page):
  // the bot answers it at once, as before.
  const waiting = new Map();
  const matterKey = (kind, command) => `${kind}:${command.type}:${command.occurrenceId ?? command.petitionId ?? command.auditId ?? command.requestId ?? command.negotiationId ?? ''}`;
  const CARDLESS = new Set(['counter']);
  window.__FLS_LEFT__ = new Set(); window.__FLS_LEFT_LOG__ = [];
  const leftKinds = new Set();
  window.__FLS_BOT__ = state => {
    let next = state;
    for (const { kind, command } of lordBotCommands(next)) {
      if (ASKED_KINDS.has(kind) && !CARDLESS.has(kind)) {
        const key = matterKey(kind, command);
        if (leave.includes(kind) && !leftKinds.has(kind) && !window.__FLS_LEFT__.has(key)) { leftKinds.add(kind); window.__FLS_LEFT__.add(key); window.__FLS_LEFT_LOG__.push({ tick: next.tick, kind, key }); }
        if (window.__FLS_LEFT__.has(key)) continue;
        if (!waiting.has(key)) waiting.set(key, next.tick);
        if (next.tick - waiting.get(key) < grace) continue;
        waiting.delete(key);
        const after = gameReducer(next, command);
        if (after !== next) { next = after; window.__FLS_BOT_LOG__.push({ tick: next.tick, kind, type: command.type, without: 'card' }); }
        continue;
      }
      const after = gameReducer(next, command);
      if (after === next) continue;
      next = after; window.__FLS_BOT_LOG__.push({ tick: next.tick, kind, type: command.type });
    }
    return next;
  };
  /** The bot's answers to the asked cards now (its weekly moves read at this week's tick), as the cards' choice ids. */
  window.__FLS_ASKED_NOW__ = () => {
    const state = window.__FEUDAL_PHASE10_PROOF__.state();
    const weekly = { ...state, tick: state.tick - ((state.tick - 1) % AGENCY_WEEK_TICKS + AGENCY_WEEK_TICKS) % AGENCY_WEEK_TICKS };
    return [...lordBotCommands(state), ...lordBotCommands(weekly)].filter(entry => ASKED_KINDS.has(entry.kind) && !CARDLESS.has(entry.kind) && !window.__FLS_LEFT__.has(matterKey(entry.kind, entry.command))).map(({ kind, command }) => ({ kind, type: command.type,
      key: matterKey(kind, command), choice: command.choiceId ?? command.choice ?? command.response ?? (command.grant === true ? 'grant' : command.grant === false ? 'refuse' : 'grant') }));
  };
  window.__FLS_ANSWERED__ = key => waiting.delete(key);
  window.__FLS_TOLD__ = [];
  const tick = () => window.__FEUDAL_PHASE10_PROOF__?.state()?.tick ?? null;
  // LS1-6: a chip's id (`data-chip-id`, its beat's) with it, and a chip's leaving (`gone`), so a chip shown again is told
  // apart from a new one (the distinct chips a year; the times the same chip came back, and why).
  const record = element => {
    const text = (element.innerText ?? element.textContent ?? '').replace(/\s+/g, ' ').trim();
    const id = element.getAttribute('data-chip-id');
    // The season band's own box and what on screen it overlaps as it comes (the band's pace at the slower seals).
    const band = element.matches('.season-band-layer') ? element.getBoundingClientRect() : null;
    const overlaps = band === null ? undefined : [...document.querySelectorAll('.event-chip, .event-card, .story-modal, .auto-pause-notice, .completion-toast, .season-notice, .status-pill')]
      .filter(other => other !== element && !element.contains(other) && other.offsetParent !== null).filter(other => { const r = other.getBoundingClientRect();
        return r.left < band.right && r.right > band.left && r.top < band.bottom && r.bottom > band.top; }).map(other => String(other.className).split(' ')[0]);
    if (text !== '') window.__FLS_TOLD__.push({ tick: tick(), at: Math.round(performance.now()), cls: String(element.className).slice(0, 80), text: text.slice(0, 400), ...(id === null ? {} : { id }),
      ...(band === null ? {} : { box: [Math.round(band.left), Math.round(band.top), Math.round(band.right), Math.round(band.bottom)], overlaps }) });
  };
  const gone = element => window.__FLS_TOLD__.push({ tick: tick(), at: Math.round(performance.now()), cls: String(element.className).slice(0, 80), text: '', id: element.getAttribute('data-chip-id'), gone: true });
  // LS1-13: a kind's chip lit (a decision come into it) and its words changed in place (the count) are told too.
  const fresh = element => window.__FLS_TOLD__.push({ tick: tick(), at: Math.round(performance.now()), cls: String(element.className).slice(0, 80),
    text: (element.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 400), id: element.getAttribute('data-chip-id'), fresh: true });
  const changed = element => window.__FLS_TOLD__.push({ tick: tick(), at: Math.round(performance.now()), cls: String(element.className).slice(0, 80),
    text: (element.innerText ?? '').replace(/\s+/g, ' ').trim().slice(0, 400), id: element.getAttribute('data-chip-id'), changed: true });
  new MutationObserver(changes => {
    for (const change of changes) {
      if (change.type === 'attributes') { if (change.target instanceof HTMLElement && change.target.matches('.event-chip') && change.target.getAttribute('data-fresh') === 'true') fresh(change.target); continue; }
      if (change.type === 'characterData') { const chip = change.target.parentElement?.closest(".event-chip[data-chip-id^='held:']"); if (chip instanceof HTMLElement) changed(chip); continue; }
      for (const node of change.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches(told)) record(node);
        for (const inner of node.querySelectorAll(told)) record(inner);
      }
      for (const node of change.removedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches('.event-chip, .season-band-layer')) gone(node);
        for (const inner of node.querySelectorAll('.event-chip')) gone(inner);
      }
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['data-fresh'] });
}, { told: TOLD, grace: ASKED_GRACE, leave: leaveKinds });

const read = () => page.evaluate(() => ({ tick: window.__FEUDAL_PHASE10_PROOF__.state().tick }));
const tenfold = async () => {
  if (speed === 10) await page.keyboard.press('Digit0');
  else await page.locator('.speed-seals .speed-seal').nth(speed === 1 ? 1 : 2).click({ timeout: 5_000 }).catch(() => undefined);
  await page.waitForTimeout(300);
};
const shoot = async (path) => page.screenshot({ path, type: 'jpeg', quality: 55 }).catch(() => undefined);
const label = tick => { const year = 1300 + Math.floor(tick / TICKS_PER_YEAR); const season = Math.floor((tick % TICKS_PER_YEAR) / SEASON); return `${year}-s${season}`; };
const visibleText = () => page.evaluate(() => document.body.innerText.replace(/[ \t]+/g, ' ').slice(0, 20_000));
const dumpState = async name => {
  const json = await page.evaluate(() => JSON.stringify(window.__FEUDAL_PHASE10_PROOF__.state()));
  writeFileSync(join(out, 'states', `${name}.json.gz`), gzipSync(json));
};

/** The open decision card's choices, the bot's answer among them pressed, its receipt waited for, shot and closed. */
async function answerCard(name) {
  const choices = await page.evaluate(() => [...document.querySelectorAll('.story-modal.decision-card [data-choose]')]
    .filter(button => button.offsetParent !== null && !button.disabled).map(button => button.getAttribute('data-choose')));
  if (choices.length === 0) return null;
  // A left matter's card (its subject among the left keys, the famine by its kind): put off, never answered.
  const left = await page.evaluate(() => {
    const card = document.querySelector('.story-modal.decision-card');
    const subject = card?.getAttribute('data-subject') ?? ''; const family = card?.getAttribute('data-decision-card') ?? '';
    return [...window.__FLS_LEFT__].find(key => (subject !== '' && key.endsWith(`:${subject}`)) || (family === 'famine' && key.startsWith('famine:'))) ?? null;
  });
  if (left !== null) return { card: await page.evaluate(() => document.querySelector('.story-modal.decision-card h2')?.innerText ?? null), kind: 'left', choice: null, left, receipt: false };
  const asked = await page.evaluate(() => window.__FLS_ASKED_NOW__());
  const pick = asked.find(entry => choices.includes(entry.choice));
  if (pick === undefined) return { choice: null, choices, asked: asked.map(entry => `${entry.kind}:${entry.choice}`), receipt: false };
  const card = await page.evaluate(() => document.querySelector('.story-modal.decision-card h2')?.innerText ?? null);
  await page.locator(`.story-modal.decision-card [data-choose='${pick.choice}']`).first().click({ timeout: 5_000 }).catch(() => undefined);
  await page.evaluate(key => window.__FLS_ANSWERED__(key), pick.key);
  const receipt = await page.locator('.answer-receipt').first().waitFor({ timeout: 10_000 }).then(() => true).catch(() => false);
  if (receipt) {
    await page.waitForTimeout(400);
    await shoot(join(out, 'stops', `${name}-receipt.jpg`));
    const lines = await page.evaluate(() => [...document.querySelectorAll('.answer-receipt-row')].map(row => row.innerText.replace(/\s+/g, ' ')));
    await page.locator('.answer-receipt-close').first().click({ timeout: 5_000 }).catch(() => undefined);
    await page.waitForTimeout(400);
    return { card, kind: pick.kind, choice: pick.choice, receipt: true, lines };
  }
  return { card, kind: pick.kind, choice: pick.choice, receipt: false };
}

const end = years * TICKS_PER_YEAR;
const log = { seed, years, speed, startedAt: new Date().toISOString(), seasons: [], stops: [], answers: [], yearsWall: [] };
let lastSeason = -1; let pausedSince = null; let lastTick = -1; let stops = 0; let wallYear = Date.now(); let lastYear = 0;
await dumpState('1300-s0-start'); await shoot(join(out, 'seasons', '1300-s0-start.jpg'));
await tenfold();
for (;;) {
  const { tick } = await read();
  const stalled = tick === lastTick; lastTick = tick;
  if (tick >= end) break;
  const season = Math.floor(tick / SEASON);
  if (season !== lastSeason) {
    lastSeason = season;
    const name = label(tick);
    await shoot(join(out, 'seasons', `${name}.jpg`));
    writeFileSync(join(out, 'seasons', `${name}.txt`), await visibleText());
    await dumpState(name);
    log.seasons.push({ name, tick, at: new Date().toISOString() });
    const year = Math.floor(tick / TICKS_PER_YEAR);
    if (year !== lastYear) { log.yearsWall.push({ year: 1300 + lastYear, seconds: Math.round((Date.now() - wallYear) / 1000) }); lastYear = year; wallYear = Date.now(); }
    console.log(`${new Date().toISOString()} ${name} tick ${tick}`);
  }
  if (stalled) {
    pausedSince ??= Date.now();
    if (Date.now() - pausedSince > 1_500) {
      stops += 1;
      const name = `${String(stops).padStart(3, '0')}-${label(tick)}-t${tick}`;
      const open = await page.evaluate(() => [...document.querySelectorAll('.story-modal h2, .auto-pause-notice, .season-ledger-card h2, .results-card h2, .chronicle-page h2, .slice-page h2')].map(el => el.innerText.replace(/\s+/g, ' ').slice(0, 300)));
      await shoot(join(out, 'stops', `${name}.jpg`));
      const cleared = [];
      // A card that comes to the lord: the bot's choice pressed on it, its receipt photographed and closed.
      const answered = await answerCard(name);
      if (answered !== null) { cleared.push(`answer:${answered.choice}`); log.answers.push({ name, tick, ...answered }); }
      for (let round = 0; round < 4; round += 1) {
        let clicked = false;
        for (const selector of CLEAR) {
          const target = page.locator(selector).first();
          if (await target.count() && await target.isVisible().catch(() => false)) { await target.click({ timeout: 5_000 }).catch(() => undefined); cleared.push(selector); clicked = true; await page.waitForTimeout(400); break; }
        }
        if (!clicked) break;
      }
      await tenfold();
      await page.waitForTimeout(700);
      if ((await read()).tick === tick) { await page.keyboard.press('Escape'); cleared.push('Escape'); await page.waitForTimeout(300); await tenfold(); await page.waitForTimeout(700); }
      const resumed = (await read()).tick !== tick;
      log.stops.push({ name, tick, open, cleared, resumed });
      if (!resumed) console.log(`${new Date().toISOString()} stop ${name}: still stopped after ${cleared.join(' ')}`);
      if (log.stops.filter(stop => !stop.resumed).length >= 5) { console.log('five stops that would not resume: giving up'); break; }
      pausedSince = null; lastTick = -1;
    }
  } else pausedSince = null;
  await page.waitForTimeout(250);
}
const told = await page.evaluate(() => window.__FLS_TOLD__);
const bot = await page.evaluate(() => window.__FLS_BOT_LOG__);
await dumpState('1320-s0-end'); await shoot(join(out, 'seasons', '1320-s0-end.jpg'));
log.finishedAt = new Date().toISOString();
log.left = await page.evaluate(() => window.__FLS_LEFT_LOG__);
writeFileSync(join(out, 'run.json'), JSON.stringify(log, null, 1));
writeFileSync(join(out, 'told.json'), JSON.stringify(told));
// The rail's flickers told apart from its pushes and its chips seen again (scripts/visibleChangeRail.mjs).
const rail = railReport(told);
writeFileSync(join(out, 'rail.json'), JSON.stringify(rail, null, 1));
writeFileSync(join(out, 'bot.json'), JSON.stringify(bot));
console.log(JSON.stringify({ seasons: log.seasons.length, stops: log.stops.length, told: told.length, botCommands: bot.length,
  railFlickers: rail.flickers, resultsPushedByPlain: rail.resultsPushedByPlain, seenAgainAfterAYear: rail.seenAgainAfterAYear,
  townRequestsSeenAgain: rail.townRequestsSeenAgain, left: log.left?.length ?? 0 }));
await browser.close();
