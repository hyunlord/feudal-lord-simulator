// UI-AUDIT-1 fix group A: before / after captures of the person card (1280×800 and the tablet) and the HUD's top corners
// (status pill, goal chip, speed cluster, crisis icons) with their boxes, this build ($URL) beside the base ($BASE_URL):
//   scripts/remote/run.sh render-UIAUDIT-fixa-<sha7> -- bash scripts/uiauditFixaVerification.sh <base-sha> shots
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/uiauditFixaCaptures.mjs)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- bash scripts/uiauditFixaVerification.sh <base> shots", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const urls = { after: flag('url'), before: flag('base') };
const statesDir = flag('states');
const states9 = flag('states9');
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const load = (name, dir = statesDir) => JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
const houseTile = state => { const house = state.buildings.find(building => building.kind === 'house') ?? state.buildings[0]; return [house.tx, house.ty]; };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const VIEWS = { desk: { width: 1280, height: 800 }, tablet: { width: 1180, height: 820, hasTouch: true, isMobile: false } };
const HUD = ['.status-pill', '.status-pill-cell', '.speed-seal', '.goal-chip-rail', '.goal-chip-rail .goal-card', '.hud-time-cluster', '.crisis-icons', '.slot-panel'];
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const log = { errors: [], shots: [], boxes: [] };

async function boxes(page, label) {
  const found = await page.evaluate(selectors => selectors.map(selector => { const element = [...document.querySelectorAll(selector)].find(e => e.getBoundingClientRect().width > 0);
    if (element === undefined) return { selector, rect: null };
    const r = element.getBoundingClientRect(); const style = getComputedStyle(element);
    return { selector, rect: [r.left, r.top, r.right, r.bottom].map(v => Math.round(v * 10) / 10), border: style.borderWidth, padding: style.padding }; }), HUD);
  log.boxes.push({ label, found });
}
async function shot(page, selector, file) {
  // Arms and marks are composed in the page: the card is shot once its emblem is drawn.
  await page.waitForFunction(() => document.querySelector('.person-card .emblem-image--pending') === null, null, { timeout: 5_000 }).catch(() => undefined);
  const box = await page.locator(selector).first().boundingBox({ timeout: 15_000 });
  if (box === null) throw new Error(`${selector}: no box`);
  const margin = 10;
  const clip = { x: Math.max(0, box.x - margin), y: Math.max(0, box.y - margin), width: box.width + margin * 2, height: box.height + margin * 2 };
  const metrics = await page.locator(selector).first().evaluate(element => { const style = getComputedStyle(element); const r = element.getBoundingClientRect();
    const emblem = element.querySelector('.person-card-emblem'); const e = emblem?.getBoundingClientRect();
    return { frame: element.getAttribute('data-frame'), border: style.borderWidth, padding: style.padding, width: r.width, height: r.height,
      ...(emblem ? { emblem: { rect: [e.left - r.left, e.top - r.top, e.width, e.height], html: emblem.innerHTML.slice(0, 160) } } : {}) }; });
  await page.screenshot({ path: join(out, file), type: 'jpeg', quality: 72, clip });
  log.shots.push({ file, selector, ...metrics });
}
async function corners(page, view, file) {
  const { width } = VIEWS[view];
  await page.screenshot({ path: join(out, `${file}-left.jpg`), type: 'jpeg', quality: 60, clip: { x: 0, y: 0, width: 600, height: 150 } });
  await page.screenshot({ path: join(out, `${file}-right.jpg`), type: 'jpeg', quality: 60, clip: { x: width - 360, y: 0, width: 360, height: 150 } });
  log.shots.push({ file: `${file}-left.jpg / -right.jpg` });
}
async function run(name, fn) { try { await fn(); } catch (error) { log.errors.push(`${name}: ${String(error).slice(0, 300)}`); } }
const scene = (base, name, view, zoom, tutorial = false, dir = statesDir, query = '') => openScene(browser, { state: load(name, dir), tile: houseTile(load(name, dir)), baseUrl: base, ...VIEWS[view], zoom, run: false,
  initScript: tutorial ? '' : TUTORIAL_OFF, query });
const click = async (page, selector, timeout = 10_000) => { await page.locator(`${selector} >> visible=true`).first().click({ timeout }); await pause(600); };

for (const [when, base] of Object.entries(urls)) {
  for (const view of Object.keys(VIEWS)) {
    await run(`${when} ${view} person-card`, async () => {
      const { context, page } = await scene(base, 'merchant-town', view, 1.6);
      await pause(600);
      const town = load('merchant-town');
      const house = await page.evaluate(at => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(at), (([tx, ty]) => ({ tx, ty }))(houseTile(town)));
      await page.mouse.click(house.clientX, house.clientY); await pause(800);
      const withState = page.locator('.diagnostic-card .person-chip:has(.person-state-ornament)');
      await (await withState.count() > 0 ? withState.first() : page.locator('.diagnostic-card .person-chip').first()).click(); await pause(800);
      await shot(page, '.person-card', `person-card-${view}-${when}.jpg`);
      await context.close();
    });
    // The steward (the key ornament, the user's screenshot): from the famine decision's steward chip.
    await run(`${when} ${view} steward card`, async () => {
      const { context, page } = await scene(base, 'famine-arrival', view, 1.1, false, statesDir, '&story-delay=5000');
      // As the geometry audit's story step: the decision may open on its own, else the chips in turn.
      if (!await page.locator('.famine-decision >> visible=true').first().waitFor({ timeout: 10_000 }).then(() => true).catch(() => false)) {
        for (let chip = 0; chip < 8 && await page.locator('.famine-decision >> visible=true').count() === 0; chip += 1) {
          if (await page.locator('.event-chip >> visible=true').count() === 0) break;
          await click(page, '.event-chip');
          if (await page.locator('.event-card-decide >> visible=true').count() > 0) { await click(page, '.event-card-decide'); continue; }
          await page.locator('.event-card-actions > button:last-child >> visible=true').first().click({ timeout: 5_000 }).catch(() => undefined); await pause(500);
        }
      }
      await click(page, '.decision-steward .person-chip');
      await shot(page, '.person-card', `person-card-steward-${view}-${when}.jpg`);
      await context.close();
    });
    // The lord (the house's arms): from the rights register's household, chapter 4.
    if (states9 !== undefined) await run(`${when} ${view} lord card`, async () => {
      const { context, page } = await scene(base, 'chapter4-end', view, 1.1, false, states9, '&story-delay=600000');
      await pause(1000);
      for (const selector of ['.chronicle-page .chronicle-keep', '.story-modal-later', '.season-ledger-resume']) if (await page.locator(`${selector} >> visible=true`).count() > 0) await click(page, selector);
      await click(page, "[data-dock='ledger']"); await click(page, "[data-ledger-tab='rights']"); await click(page, '.ledger-rights-household .person-chip');
      await shot(page, '.person-card', `person-card-lord-${view}-${when}.jpg`);
      await context.close();
    });
    if (process.env.FIXA_CARDS_ONLY === '1') continue;
    await run(`${when} ${view} hud`, async () => {
      const { context, page } = await scene(base, 'merchant-town', view, 1.1, true);
      await pause(1200);
      await boxes(page, `${when} ${view} merchant-town tutorial on`);
      await corners(page, view, `hud-${view}-${when}`);
      await context.close();
    });
    await run(`${when} ${view} hud crisis`, async () => {
      const { context, page } = await scene(base, 'famine-arrival', view, 1.1);
      await pause(1200);
      await boxes(page, `${when} ${view} famine-arrival`);
      await context.close();
    });
  }
}
await browser.close();
writeFileSync(join(out, 'captures.json'), `${JSON.stringify(log, null, 1)}\n`);
console.log(JSON.stringify(log, null, 1));
