// VIS-1 (user 2026-10-11, the first play: "10배속으로 돌려도 티가 안 난다"): the lord's slice in the browser as a player sees
// it — a new lord-mode game (seed 1, the riverside town) at 10x for twenty years (1300–1320), the auto-pause on. The lord
// bot only answers for him: its commands go into the served tick loop before each tick (as scripts/lordSliceRun.ts does
// in Node), so the screen, the cards, the stops and the season turns are the game's own. Every season: a screenshot, the
// page's visible text and the state (gzipped, for scripts/visibleChangeFacts.ts); every stop: a screenshot of what
// stopped the game, then its card put off / its notice resumed and 10x again; all along: every chip, toast, card and
// notice the page added, with its tick and words.
//   scripts/remote/run.sh render-VIS-run-<sha7> --heavy --detach -- bash scripts/visibleChangeRun.sh [out]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
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
const TOLD = '.event-chip, .event-card, .completion-toast, .story-modal, .auto-pause-notice, .season-ledger-card, .season-notice, .results-card, .chronicle-page, .slice-page, [class*="toast"], [class*="notice"], [role="status"], [role="alert"]';

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const { page } = await openScene(browser, { state: start, tile: middle, baseUrl: url, width: 1280, height: 800, rewrite: [LOOP], run: false, initScript: INIT, loadTimeout: 90_000 });
await page.evaluate(async ({ told }) => {
  const { lordBotCommands } = await import('/src/engine/lordBot.ts');
  const { gameReducer } = await import('/src/state/gameStore.ts');
  window.__FLS_BOT_LOG__ = [];
  window.__FLS_BOT__ = state => {
    let next = state;
    for (const { kind, command } of lordBotCommands(next)) {
      const after = gameReducer(next, command);
      if (after === next) continue;
      next = after; window.__FLS_BOT_LOG__.push({ tick: next.tick, kind, type: command.type });
    }
    return next;
  };
  window.__FLS_TOLD__ = [];
  const tick = () => window.__FEUDAL_PHASE10_PROOF__?.state()?.tick ?? null;
  const record = element => {
    const text = (element.innerText ?? element.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text !== '') window.__FLS_TOLD__.push({ tick: tick(), at: Math.round(performance.now()), cls: String(element.className).slice(0, 80), text: text.slice(0, 400) });
  };
  new MutationObserver(changes => {
    for (const change of changes) for (const node of change.addedNodes) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.matches(told)) record(node);
      for (const inner of node.querySelectorAll(told)) record(inner);
    }
  }).observe(document.body, { childList: true, subtree: true });
}, { told: TOLD });

const read = () => page.evaluate(() => ({ tick: window.__FEUDAL_PHASE10_PROOF__.state().tick }));
const tenfold = async () => { await page.keyboard.press('Digit0'); await page.waitForTimeout(300); };
const shoot = async (path) => page.screenshot({ path, type: 'jpeg', quality: 55 }).catch(() => undefined);
const label = tick => { const year = 1300 + Math.floor(tick / TICKS_PER_YEAR); const season = Math.floor((tick % TICKS_PER_YEAR) / SEASON); return `${year}-s${season}`; };
const visibleText = () => page.evaluate(() => document.body.innerText.replace(/[ \t]+/g, ' ').slice(0, 20_000));
const dumpState = async name => {
  const json = await page.evaluate(() => JSON.stringify(window.__FEUDAL_PHASE10_PROOF__.state()));
  writeFileSync(join(out, 'states', `${name}.json.gz`), gzipSync(json));
};

const end = years * TICKS_PER_YEAR;
const log = { seed, years, startedAt: new Date().toISOString(), seasons: [], stops: [], yearsWall: [] };
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
writeFileSync(join(out, 'run.json'), JSON.stringify(log, null, 1));
writeFileSync(join(out, 'told.json'), JSON.stringify(told));
writeFileSync(join(out, 'bot.json'), JSON.stringify(bot));
console.log(JSON.stringify({ seasons: log.seasons.length, stops: log.stops.length, told: told.length, botCommands: bot.length }));
await browser.close();
