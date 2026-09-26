// UI-3 evidence (gates 1, 2, 4, 5, 6), JPEG, and one JSON of what each capture showed.
//   PLAYWRIGHT_MODULE=... node scripts/ui3Captures.mjs <out-dir> --url <url> --pressure <state.json>
//  1 season ledger cards at the start of the first autumn, winter and spring (5x, time stops, 계속 resumes), and none
//    once the card is turned off;  5 the lean-season goal card when the first winter warning stands;
//  2 the season strip opened, its pin beside the calendar;  4 a naive-reserve bot town (scripts/ui3PressureState.ts):
//    a leaving house (sign + cause icon), an abandoned house (boarded), the inspector's first line;
//  6 title -> mode -> game, save, reload -> title with 이어하기, the mode backdrop, continue.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag('url') ?? 'http://127.0.0.1:4281/';
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { url, seasons: [], lean: null, strip: null, pressure: null, title: null };
const shot = (page, file, clip) => page.screenshot({ path: join(out, file), type: 'jpeg', quality: 78, ...(clip ? { clip } : {}) });
const proofTick = page => page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().tick);

// Gates 1, 5, 2: a new game at 5x through a year.
{
  const { context, page } = await openScene(browser, { state: null, tile: [45, 41], baseUrl: url, width: 1280, height: 800, run: false, initScript: TUTORIAL_OFF });
  await page.getByRole('button', { name: '5배속', exact: true }).click();
  for (let n = 1; n <= 4; n += 1) {
    await page.waitForSelector('.season-ledger-card', { timeout: 90_000 });
    await page.waitForTimeout(300);
    const card = await page.evaluate(() => ({ season: document.querySelector('.season-ledger-card')?.getAttribute('data-season'),
      text: document.querySelector('.season-ledger-card')?.innerText.replace(/\n+/g, ' | ') }));
    const tick = await proofTick(page); await page.waitForTimeout(700);
    const stopped = tick === await proofTick(page);
    if (n >= 2) await shot(page, `season-card-${n}.jpg`, { x: 430, y: 230, width: 420, height: 350 });
    await page.locator('.season-ledger-resume').click(); await page.waitForTimeout(300);
    const resumed = await page.evaluate(() => document.querySelector('.speed-seal[aria-pressed="true"]')?.getAttribute('aria-label'));
    result.seasons.push({ n, tick, ...card, timeStopped: stopped, resumedTo: resumed });
    if (n === 2) {
      const lean = await page.evaluate(() => ({ card: [...document.querySelectorAll('.goal-chip-rail .goal-card')].map(card => card.innerText.replace(/\n+/g, ' | ')),
        steward: document.querySelector('.steward-line')?.textContent ?? null }));
      result.lean = lean;
      await shot(page, 'lean-season.jpg', { x: 0, y: 0, width: 640, height: 200 });
      await shot(page, 'lean-season-steward.jpg', { x: 880, y: 560, width: 400, height: 240 });
    }
  }
  // Card off: the next season closes without one.
  await page.locator('.season-ledger-card').waitFor({ state: 'detached' });
  await page.keyboard.press('Escape'); await page.locator('.pause-menu .season-ledger-auto-setting').click(); await page.keyboard.press('Escape');
  await page.getByRole('button', { name: '5배속', exact: true }).click();
  const before = await proofTick(page);
  await page.waitForFunction(from => window.__FEUDAL_PHASE10_PROOF__.state().tick > from + 1100, before, { timeout: 90_000 });
  result.seasonsOff = { fromTick: before, toTick: await proofTick(page), cardShown: await page.locator('.season-ledger-card').count() > 0 };
  await page.getByRole('button', { name: '일시 정지', exact: true }).click();
  await page.locator('.status-pill-date').click(); await page.waitForTimeout(300);
  result.strip = await page.evaluate(() => ({ date: document.querySelector('.status-pill-date-text')?.textContent, pin: document.querySelector('.season-strip-pin')?.getAttribute('data-fraction'),
    marks: [...document.querySelectorAll('.season-strip-mark')].map(mark => mark.getAttribute('data-mark')), list: [...document.querySelectorAll('.season-strip-list li')].map(li => li.textContent) }));
  await shot(page, 'season-strip.jpg', { x: 0, y: 0, width: 420, height: 300 });
  await context.close();
}

// Gate 4: the naive-reserve bot town under pressure.
{
  const state = JSON.parse(readFileSync(flag('pressure'), 'utf8'));
  const leaving = state.houses.find(house => house.leavingSinceTick !== undefined && house.abandonedTick === undefined);
  const abandoned = state.houses.find(house => house.abandonedTick !== undefined);
  const at = id => state.buildings.find(building => building.id === id);
  const home = at(leaving.buildingId), empty = at(abandoned.buildingId);
  const { context, page } = await openScene(browser, { state, tile: [home.tx, home.ty], baseUrl: url, width: 1280, height: 800, zoom: 1.4, run: false, initScript: TUTORIAL_OFF });
  await page.waitForTimeout(1500);
  await shot(page, 'pressure-leaving.jpg', { x: 440, y: 250, width: 400, height: 300 });
  const point = await page.evaluate(t => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(t), { tx: home.tx, ty: home.ty });
  await page.mouse.click(point.clientX, point.clientY - 10); await page.waitForTimeout(600);
  const inspector = await page.evaluate(() => document.querySelector('.inspector-pressure')?.textContent ?? null);
  await shot(page, 'pressure-inspector.jpg', { x: 960, y: 60, width: 320, height: 420 });
  await context.close();
  const second = await openScene(browser, { state, tile: [empty.tx, empty.ty], baseUrl: url, width: 1280, height: 800, zoom: 1.4, run: false, initScript: TUTORIAL_OFF });
  await second.page.waitForTimeout(1500);
  await shot(second.page, 'pressure-abandoned.jpg', { x: 440, y: 250, width: 400, height: 300 });
  await second.context.close();
  result.pressure = { tick: state.tick, leaving: leaving.buildingId, abandoned: abandoned.buildingId, inspector };
}

// Gate 6: title -> mode -> game, save, reload -> 이어하기, the mode backdrop, continue.
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(`${url}?phase10-proof=1`);
  await page.waitForSelector('.title-screen'); await page.waitForTimeout(1200);
  await shot(page, 'title.jpg');
  await page.locator('.welcome-parchment [data-scenario]').first().click(); await page.waitForTimeout(200);
  const loading = await page.locator('.chapter-loading').count();
  await shot(page, 'chapter-loading.jpg');
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: '1배속', exact: true }).click(); await page.waitForTimeout(2500);
  await page.getByRole('button', { name: '일시 정지', exact: true }).click();
  const savedTick = await proofTick(page);
  await page.locator('.settings-disclosure > summary').click();
  await page.locator('.save-controls .save-control-button').first().click(); await page.waitForTimeout(1200);
  await page.reload(); await page.waitForSelector('.title-screen'); await page.waitForTimeout(1200);
  const offersContinue = await page.locator('.welcome-save').count() > 0;
  await shot(page, 'title-continue.jpg');
  await page.getByRole('button', { name: '새 게임', exact: true }).click(); await page.waitForTimeout(400);
  const modeScreen = await page.locator('.title-screen').getAttribute('data-screen');
  await shot(page, 'mode-select.jpg');
  await page.getByRole('button', { name: '취소', exact: true }).click(); await page.waitForTimeout(200);
  await page.getByRole('button', { name: '이어하기', exact: true }).click(); await page.waitForTimeout(1500);
  const continuedTick = await proofTick(page);
  await shot(page, 'continued.jpg');
  result.title = { chapterLoadingShown: loading > 0, savedTick, offersContinue, modeScreen, continuedTick, continued: continuedTick >= savedTick && savedTick > 0 };
  await context.close();
}
await browser.close();
writeFileSync(join(out, 'ui3-captures.json'), JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify(result, null, 1));
