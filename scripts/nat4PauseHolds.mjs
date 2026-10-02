// NAT-4 story (QA-025, QA-032, QA-030) in the browser, on the DGX:
//  - pause: a chapter-2 town (ui6 `raid`) and a chapter-5 town (ui10 `royal_tax`, the QA's chapter), paused, the story's
//    modals held back (story-delay); every surface the HUD opens while paused (the goal cards'
//    buttons, the goal drawer, the pause menu and its book, the chronicle, the dock's drawers and the steward, the pill's
//    population / ledger / season strip, the settings) is opened and closed; the proof port's tick and the pressed speed
//    seal are read before, while open (1.2 s) and after (1.2 s). A surface keeps the pause when the tick never moves.
//  - chapter page: the ui5 `chapter-end` town opens its page on its own (5 s on, after the scene's own Esc); the end is
//    marked seen; the town is saved
//    (설정 → 지금 저장) and that slot loaded: no page again in 8 s.
//  - food days: the ui5 `merchant-town` runs at 1× for 2.5 s, Space pauses it; the pill's `data-food-days` must be the
//    paused state's own `foodDays`.
//   scripts/remote/run.sh render-NAT4-story-<sha7> -- bash scripts/nat4PauseHolds.sh
//   (PLAYWRIGHT_MODULE=… node_modules/.bin/tsx scripts/nat4PauseHolds.mjs <out> --url <url> --states5 <dir> --states6 <dir> --states10 <dir>)
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 확인(scripts/nat4PauseHolds.mjs)", { remote: "scripts/remote/run.sh render-NAT4-story-<sha7> -- bash scripts/nat4PauseHolds.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';
import { foodDays } from '../src/ui/hud/statusPillModel.ts';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const scene = (dir, name) => JSON.parse(readFileSync(join(flags[dir], `${name}.json`), 'utf8'));
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const tileOf = state => { const house = state.buildings.find(building => building.kind === 'house') ?? state.buildings[0]; return [house.tx, house.ty]; };
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const read = page => page.evaluate(() => ({
  tick: window.__FEUDAL_PHASE10_PROOF__.state().tick,
  seal: document.querySelector('.speed-seal[aria-pressed="true"]')?.getAttribute('aria-label') ?? null,
}));
const visible = async (page, selector) => (await page.locator(selector).count()) > 0 && await page.locator(selector).first().isVisible();
const press = (selector, options = {}) => async page => { await page.locator(selector).first().click(options); };
const key = name => async page => { await page.keyboard.press(name); };
const steps = (...list) => async page => { for (const step of list) { await step(page); await page.waitForTimeout(250); } };
const unfoldChapter = async page => {
  const fold = page.locator('[data-goal-card="chapter"] .goal-card-fold');
  if (await page.locator('[data-goal-card="chapter"][data-folded="true"]').count()) await fold.click();
};

// 1. Every surface while paused.
const SURFACES = [
  // A goal card shows only where its town has it (chapter 2 on: the chapter's card first; chapter 1: the settlement's).
  { id: 'goal-card.chapter (목표 보기)', needs: '[data-goal-card="chapter"]', open: steps(unfoldChapter, press('[data-tutorial-cta="chapter"]')), shown: '.chapter-preview', close: press('.chapter-preview-continue'), shot: true },
  { id: 'goal-card.settlement', needs: '[data-tutorial-cta="settlement"]', open: press('[data-tutorial-cta="settlement"]'), shown: '.goal-slot', close: key('Escape') },
  // The rail (and its toggle) leaves the screen while the drawer is open: Esc closes it.
  { id: 'goal drawer toggle', open: press('.goal-drawer-toggle'), shown: '.goal-slot', close: key('Escape') },
  { id: 'pause menu (Esc, then Esc)', open: key('Escape'), shown: '.pause-menu', close: key('Escape') },
  { id: 'pause menu (Esc, then 계속)', open: key('Escape'), shown: '.pause-menu', close: press('.pause-menu-resume') },
  { id: 'pause menu → chronicle book', open: steps(key('Escape'), press('.pause-menu .pause-menu-book')), shown: '.legacy-book', close: steps(key('Escape'), key('Escape')) },
  { id: 'chronicle (C)', open: key('c'), shown: '.chronicle-screen', close: key('c') },
  { id: 'dock.ledger', open: press('[data-dock="ledger"]'), shown: '[data-slot="ledger"]', close: press('[data-dock="ledger"]') },
  { id: 'dock.build', open: press('[data-dock="build"]'), shown: '.build-menu-category', close: press('[data-dock="build"]') },
  { id: 'dock.steward', open: press('[data-dock="steward"]'), shown: '[data-dock="steward"][aria-expanded="true"]', close: press('[data-dock="steward"]') },
  { id: 'pill.population', open: press('.status-pill .status-pill-cell >> nth=1'), shown: '[data-slot="population"]', close: key('Escape') },
  { id: 'pill.food → ledger', open: press('.status-pill-cell[data-food-days]'), shown: '[data-slot="ledger"]', close: key('Escape') },
  { id: 'pill.season strip', open: press('[data-testid="hud-calendar"]'), shown: '[data-testid="hud-calendar"][aria-expanded="true"]', close: press('[data-testid="hud-calendar"]') },
  { id: 'settings', open: press('.settings-disclosure > summary'), shown: '.settings-disclosure[open]', close: press('.settings-disclosure > summary') },
];
const pauseRows = [];
for (const [dir, name] of [['states6', 'decline'], ['states6', 'raid'], ['states10', 'royal_tax']]) {
  const state = scene(dir, name);
  const { context, page } = await openScene(browser, { state, tile: tileOf(state), baseUrl: url, run: false, initScript: INIT, width: 1280, height: 800,
    query: '&story-delay=600000', loadTimeout: 90_000 });
  for (const surface of SURFACES) {
    if (surface.needs !== undefined && !(await visible(page, surface.needs))) { pauseRows.push({ scene: name, surface: surface.id, absent: true }); console.log(`absent ${name}: ${surface.id}`); continue; }
    const before = await read(page);
    let opened = false; let error = null;
    try {
      await surface.open(page); await page.waitForTimeout(1_200);
      opened = await visible(page, surface.shown);
      if (surface.shot) await page.screenshot({ path: join(out, `goal-view-paused-${name}.jpg`), type: 'jpeg', quality: 55 });
    } catch (caught) { error = String(caught).split('\n')[0]; }
    const during = await read(page);
    try { await surface.close(page); } catch (caught) { error ??= String(caught).split('\n')[0]; }
    await page.waitForTimeout(1_200);
    const after = await read(page);
    const held = before.tick === during.tick && during.tick === after.tick && after.seal === before.seal;
    pauseRows.push({ scene: name, surface: surface.id, opened, held, before, during, after, error });
    // A surface left open would block the next one: Esc until no modal or drawer stays.
    for (let guard = 0; guard < 3 && (await visible(page, '[role="dialog"], .slot-panel')); guard += 1) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    console.log(`${held ? 'held' : 'RAN '} ${opened ? 'opened' : 'NOT OPENED'} ${name}: ${surface.id} ${before.tick} → ${during.tick} → ${after.tick} (${after.seal})${error ? ` ${error}` : ''}`);
  }
  await context.close();
}

// 2. The chapter page after a save and a load.
const chapter = {};
{
  const state = scene('states5', 'chapter-end');
  const { context, page } = await openScene(browser, { state, tile: tileOf(state), baseUrl: url, run: false, initScript: INIT, width: 1280, height: 800, query: '&story-delay=5000', loadTimeout: 90_000 });
  const PAGE = 'section.chronicle-page:not(.legacy-book):not(.legacy-ending)';
  chapter.before = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().politics?.chapterEnds.map(end => [end.chapter, end.tick, end.seenTick ?? null]) ?? []);
  chapter.pageOpened = await page.locator(PAGE).first().waitFor({ state: 'visible', timeout: 30_000 }).then(() => true, () => false);
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(out, 'chapter-page-first.jpg'), type: 'jpeg', quality: 55 });
  chapter.seenTicks = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().politics?.chapterEnds.map(end => [end.chapter, end.tick, end.seenTick ?? null]) ?? []);
  if (chapter.pageOpened) { await page.keyboard.press('Escape'); await page.waitForTimeout(600); }
  await page.locator('.settings-disclosure > summary').click();
  await page.getByRole('button', { name: '지금 저장' }).click(); await page.waitForTimeout(2_000);
  const slot = page.locator('.save-slot-button').first();
  chapter.slot = (await slot.innerText()).replace(/\s+/g, ' ');
  await slot.click(); await page.waitForTimeout(8_000);
  chapter.reopenedAfterLoad = await visible(page, PAGE);
  chapter.afterLoad = await page.evaluate(() => ({ tick: window.__FEUDAL_PHASE10_PROOF__.state().tick,
    ends: window.__FEUDAL_PHASE10_PROOF__.state().politics?.chapterEnds.map(end => [end.chapter, end.tick, end.seenTick ?? null]) ?? [] }));
  await page.screenshot({ path: join(out, 'chapter-after-load.jpg'), type: 'jpeg', quality: 55 });
  console.log(`chapter page: before ${JSON.stringify(chapter.before)}, opened ${chapter.pageOpened}, seen ${JSON.stringify(chapter.seenTicks)}, after load reopened ${chapter.reopenedAfterLoad}`);
  await context.close();
}

// 3. The paused pill's food days.
const food = {};
{
  const state = scene('states5', 'merchant-town');
  const { context, page } = await openScene(browser, { state, tile: tileOf(state), baseUrl: url, run: true, initScript: INIT, width: 1280, height: 800, loadTimeout: 90_000 });
  await page.waitForTimeout(2_500);
  await page.getByRole('button', { name: '일시 정지', exact: true }).click(); await page.waitForTimeout(1_000);
  const paused = await page.evaluate(() => JSON.stringify(window.__FEUDAL_PHASE10_PROOF__.state()));
  const parsed = JSON.parse(paused);
  food.tick = parsed.tick; food.bucketStart = Math.floor(parsed.tick / 60) * 60;
  food.state = foodDays(parsed);
  food.pill = Number(await page.locator('.status-pill-cell[data-food-days]').getAttribute('data-food-days'));
  food.match = food.pill === food.state;
  console.log(`food days: tick ${food.tick} (bucket ${food.bucketStart}) pill ${food.pill} state ${food.state} ${food.match ? 'match' : 'MISMATCH'}`);
  await context.close();
}

await browser.close();
const shown = pauseRows.filter(row => row.absent !== true);
// Every surface opened in at least one town, and wherever it opened the tick stood.
const result = { url, pause: pauseRows, allHeld: shown.every(row => row.held),
  allOpened: SURFACES.every(surface => shown.some(row => row.surface === surface.id && row.opened)) && shown.every(row => row.opened), chapter, food };
writeFileSync(join(out, 'pause-holds.json'), JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify({ allHeld: result.allHeld, allOpened: result.allOpened, chapterReopened: chapter.reopenedAfterLoad, foodMatch: food.match }));
if (!result.allHeld || !result.allOpened || !chapter.pageOpened || chapter.reopenedAfterLoad || !food.match) process.exitCode = 1;
