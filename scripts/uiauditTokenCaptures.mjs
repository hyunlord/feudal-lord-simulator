// UI-AUDIT-1 frame tokens: before / after captures of four framed surfaces (event card, goal chip, ledger drawer, person
// card), each cropped to its box plus a margin, this build ($URL) beside the trunk before it ($BASE_URL):
//   scripts/remote/run.sh render-UIAUDIT-tokens-shots -- bash scripts/remote/with-base-build.sh <sha> -- node scripts/uiauditTokenCaptures.mjs <out> --url '$URL' --base '$BASE_URL' --states ~/fls-ui5-states-v22
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/uiauditTokenCaptures.mjs)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node scripts/uiauditTokenCaptures.mjs …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const urls = { after: flag('url'), before: flag('base') };
const statesDir = flag('states');
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const load = name => JSON.parse(readFileSync(join(statesDir, `${name}.json`), 'utf8'));
const houseTile = state => { const house = state.buildings.find(building => building.kind === 'house') ?? state.buildings[0]; return [house.tx, house.ty]; };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const log = { errors: [], shots: [] };

async function shot(page, selector, file) {
  const box = await page.locator(selector).first().boundingBox({ timeout: 15_000 });
  if (box === null) throw new Error(`${selector}: no box`);
  const margin = 12;
  const clip = { x: Math.max(0, box.x - margin), y: Math.max(0, box.y - margin), width: box.width + margin * 2, height: box.height + margin * 2 };
  const metrics = await page.locator(selector).first().evaluate(element => { const style = getComputedStyle(element);
    return { frame: element.getAttribute('data-frame'), border: style.borderWidth, padding: style.padding, width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }; });
  await page.screenshot({ path: join(out, file), type: 'jpeg', quality: 80, clip });
  log.shots.push({ file, selector, ...metrics });
}
async function run(name, fn) { try { await fn(); } catch (error) { log.errors.push(`${name}: ${String(error).slice(0, 300)}`); } }
const scene = (base, name, tile, zoom = 1.4) => openScene(browser, { state: load(name), tile, baseUrl: base, width: 1280, height: 800, zoom, run: false, initScript: TUTORIAL_OFF, query: '' });

for (const [when, base] of Object.entries(urls)) {
  const town = load('merchant-town');
  await run(`${when} goal-chip+ledger`, async () => {
    const { context, page } = await scene(base, 'merchant-town', houseTile(town));
    await pause(800);
    await shot(page, '.goal-chip-rail .goal-card', `goal-chip-${when}.jpg`);
    await page.locator("[data-dock='ledger']").click(); await pause(600);
    await shot(page, '.ledger-drawer', `ledger-drawer-${when}.jpg`);
    await context.close();
  });
  await run(`${when} person-card`, async () => {
    const { context, page } = await scene(base, 'merchant-town', houseTile(town), 1.6);
    await pause(600);
    const house = await page.evaluate(at => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(at), (([tx, ty]) => ({ tx, ty }))(houseTile(town)));
    await page.mouse.click(house.clientX, house.clientY); await pause(800);
    await page.locator('.person-chip:visible').first().click(); await pause(700);
    await shot(page, '.person-card', `person-card-${when}.jpg`);
    await context.close();
  });
  await run(`${when} event-card`, async () => {
    const state = load('famine-arrival');
    const { context, page } = await scene(base, 'famine-arrival', houseTile(state));
    await pause(800);
    await page.locator('.event-chip').first().click({ timeout: 20_000 }); await pause(600);
    await shot(page, '.event-card', `event-card-${when}.jpg`);
    await context.close();
  });
}
await browser.close();
writeFileSync(join(out, 'captures.json'), `${JSON.stringify(log, null, 1)}\n`);
console.log(JSON.stringify(log, null, 1));
