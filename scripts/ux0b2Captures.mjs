// UX-0b2 captures (JPEG and one JSON of what each showed), on the states of scripts/ux0b2States.ts:
//  MARKET-1 — a house's placement chip within and beyond a market's road reach ("시장까지 길 d걸음 / 40"), a market's
//  placement preview (the road tiles in reach and the homes, not a radius) and a selected market (the same, and its
//  card's line);
//  WALL-2 — [목책 넓히기] from the goal log's era console, one side of the wall dragged outward on the map, the preview
//  (cost, area, the fields taken in and when they turn to pasture) with those fields marked, the expansion proclaimed,
//  then the pending line and the marked fields while zones are painted; the console's new buttons on a touch tablet.
//   PLAYWRIGHT_MODULE=... node scripts/ux0b2Captures.mjs <out-dir> --url <url> --states <dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/ux0b2Captures.mjs)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node scripts/ux0b2Captures.mjs …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag('url') ?? 'http://127.0.0.1:4282/';
const statesDir = flag('states');
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { url, errors: [], gates: {} };
const moments = JSON.parse(readFileSync(join(statesDir, 'moments.json'), 'utf8'));
const load = name => JSON.parse(readFileSync(join(statesDir, `${name}.json`), 'utf8'));
const shot = (page, file, clip) => page.screenshot({ path: join(out, file), type: 'jpeg', quality: 72, ...(clip ? { clip } : {}) });
const tilePoint = (page, tile) => page.evaluate(at => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(at), tile);
const ZOOM = 1.4;

async function open(name, stateName, tile, extra = {}) {
  const opened = await openScene(browser, { state: load(stateName), tile, baseUrl: url, width: extra.width ?? 1280, height: extra.height ?? 800, zoom: ZOOM, run: false,
    initScript: TUTORIAL_OFF, hasTouch: extra.hasTouch ?? false, isMobile: extra.isMobile ?? false });
  opened.page.on('pageerror', error => result.errors.push(`${name}: ${String(error)}`));
  opened.page.on('console', message => { if (message.type() === 'error') result.errors.push(`${name} console: ${message.text()}`); });
  return opened;
}
async function pickTool(page, category, label) {
  await page.locator("[data-dock='build']").click(); await page.waitForTimeout(250);
  await page.locator('button.build-menu-category[data-category]', { hasText: category }).click(); await page.waitForTimeout(200);
  await page.locator(`button[aria-label="${label}"]:visible`).first().click(); await page.waitForTimeout(250);
}
async function hover(page, tile) {
  const point = await tilePoint(page, tile);
  await page.mouse.move(point.clientX, point.clientY, { steps: 4 }); await page.waitForTimeout(600);
  return point;
}
const chipFacts = page => page.evaluate(() => { const chip = document.querySelector('.placement-chip'); const market = chip?.querySelector('.placement-chip-market');
  return { title: chip?.querySelector('.placement-chip-title')?.textContent ?? null, market: market?.textContent ?? null, far: market?.getAttribute('data-far') ?? null,
    reach: chip?.querySelector('.placement-chip-reach')?.textContent ?? null, lines: [...(chip?.querySelectorAll('p') ?? [])].map(p => p.textContent) }; });
const around = (point, width = 560, height = 360) => ({ x: Math.max(0, Math.round(point.clientX - width / 2)), y: Math.max(0, Math.round(point.clientY - height / 2)), width, height });

// MARKET-1: the house chip within and beyond the reach, the market's placement preview.
try {
  const { market } = moments;
  const { context, page } = await open('market-place', 'market-town', [40, 45]);
  await pickTool(page, /^생활/, '오두막');
  const nearPoint = await hover(page, market.near.tile);
  const near = await chipFacts(page);
  await shot(page, 'm01-house-chip-near.jpg', around(nearPoint));
  const farPoint = await hover(page, market.far.tile);
  const far = await chipFacts(page);
  await shot(page, 'm02-house-chip-far.jpg', around(farPoint));
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await pickTool(page, /^저장/, '시장');
  await hover(page, market.marketSpot);
  const placing = await chipFacts(page);
  await page.waitForTimeout(400);
  await shot(page, 'm03-market-placement-reach.jpg');
  result.gates.chip = { near: { tile: market.near.tile, expected: market.near.distance, ...near }, far: { tile: market.far.tile, expected: market.far.distance, ...far }, market: placing };
  await context.close();
} catch (error) { result.errors.push(`market placement: ${String(error)}`); }

// MARKET-1: a selected market (its card's line, the road tiles on the map).
try {
  const { market } = moments.market;
  const { context, page } = await open('market-selected', 'market-town', [market.tx, market.ty]);
  const point = await tilePoint(page, { tx: market.tx, ty: market.ty });
  await page.mouse.click(point.clientX, point.clientY - 8); await page.waitForTimeout(700);
  const selected = await page.evaluate(() => ({ line: document.querySelector('[data-market-reach]')?.textContent ?? null, card: document.querySelector('.diagnostic-card h2, .diagnostic-card strong')?.textContent ?? null }));
  await shot(page, 'm04-selected-market-reach.jpg');
  result.gates.selected = { market: market.id, ...selected };
  await context.close();
} catch (error) { result.errors.push(`market selected: ${String(error)}`); }

// WALL-2: widen the wall — the console's entry, a side dragged outward, the preview, the proclamation, the pending line.
try {
  const { drag } = moments.wall;
  const { context, page } = await open('wall', 'walled-town', [drag.middle.x, drag.middle.y + 2]);
  await page.locator('.goal-drawer-toggle').click(); await page.waitForTimeout(400);
  // The era console sits in the settlement panel's "도시 발전 조건" disclosure.
  await page.locator('.goal-slot details summary', { hasText: '도시 발전 조건' }).click(); await page.waitForTimeout(300);
  const consoleBox = page.locator('.era-console');
  await consoleBox.scrollIntoViewIfNeeded();
  const entry = await page.locator('[data-action="begin-expansion"]').count();
  await page.locator('[data-action="begin-expansion"]').click(); await page.waitForTimeout(400);
  const before = await page.evaluate(() => ({ lines: [...document.querySelectorAll('[data-expansion-line]')].map(li => li.textContent), action: document.querySelector('.era-console .era-action')?.textContent ?? null,
    enabled: !(document.querySelector('.era-console .era-action')?.disabled ?? true) }));
  // The side's middle (a tile-edge point sits half a tile above its tile's centre), dragged to the target tile.
  const start = await tilePoint(page, { tx: drag.middle.x, ty: drag.middle.y });
  const target = await tilePoint(page, { tx: drag.target.x, ty: drag.target.y });
  await page.mouse.move(start.clientX, start.clientY - 16 * ZOOM); await page.mouse.down();
  await page.mouse.move(target.clientX, target.clientY, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(600);
  const preview = await page.evaluate(() => ({ lines: [...document.querySelectorAll('[data-expansion-line]')].map(li => ({ id: li.getAttribute('data-expansion-line'), text: li.textContent,
    tone: [...li.classList].find(name => name.startsWith('prediction-line--')) ?? null })), action: document.querySelector('.era-console .era-action')?.textContent ?? null,
    enabled: !(document.querySelector('.era-console .era-action')?.disabled ?? true) }));
  await page.locator('.era-expansion-lines').scrollIntoViewIfNeeded().catch(() => undefined); await page.waitForTimeout(200);
  await shot(page, 'w01-expansion-preview.jpg');
  const panel = await consoleBox.boundingBox();
  if (panel !== null) await shot(page, 'w02-expansion-console.jpg', { x: Math.max(0, panel.x - 8), y: Math.max(0, panel.y - 8), width: panel.width + 16, height: Math.min(800 - Math.max(0, panel.y - 8), panel.height + 16) });
  await page.locator('.era-console .era-action', { hasText: '목책 확장 선포' }).click(); await page.waitForTimeout(600);
  const after = await page.evaluate(() => { const s = window.__FEUDAL_PHASE10_PROOF__.state(); return { pending: document.querySelector('.era-expansion-pending')?.textContent ?? null,
    expansion: s.palisade?.expansion === undefined ? null : { tick: s.palisade.expansion.tick, cells: s.palisade.expansion.arableCells.length }, drafting: document.querySelectorAll('[data-expansion-line]').length,
    alerts: [...document.querySelectorAll('.crisis-icons .crisis-icon')].map(element => element.getAttribute('aria-label')) }; });
  await shot(page, 'w03-after-expansion.jpg');
  // The fields still to turn, marked while zones are painted.
  await page.locator('.goal-drawer-toggle').click().catch(() => undefined); await page.waitForTimeout(200);
  await page.locator("[data-layer='zone']").first().click(); await page.waitForTimeout(300);
  await page.locator("[data-zone-tool='arable']").first().click(); await page.waitForTimeout(500);
  const hoverField = await tilePoint(page, { tx: drag.middle.x, ty: drag.middle.y + 2 });
  await page.mouse.move(hoverField.clientX + 200, hoverField.clientY - 150); await page.waitForTimeout(400);
  await shot(page, 'w04-zone-paint-pasture.jpg');
  result.gates.wall = { moment: moments.wall, entry, before, preview, after };
  await context.close();
} catch (error) { result.errors.push(`wall: ${String(error)}`); }

// The console's buttons on a touch tablet (1180 x 820): the new ones ≥ 48 px, text ≥ 12 px.
try {
  const { drag } = moments.wall;
  const { context, page } = await open('wall-tablet', 'walled-town', [drag.middle.x, drag.middle.y], { width: 1180, height: 820, hasTouch: true, isMobile: true });
  await page.locator('.goal-drawer-toggle').tap(); await page.waitForTimeout(400);
  await page.locator('.goal-slot details summary', { hasText: '도시 발전 조건' }).tap(); await page.waitForTimeout(300);
  await page.locator('[data-action="begin-expansion"]').scrollIntoViewIfNeeded();
  const idle = await page.evaluate(() => { const box = document.querySelector('[data-action="begin-expansion"]')?.getBoundingClientRect(); return box === undefined ? null : { width: Math.round(box.width), height: Math.round(box.height) }; });
  await page.locator('[data-action="begin-expansion"]').tap(); await page.waitForTimeout(400);
  await shot(page, 'w05-tablet-console.jpg');
  result.gates.tablet = { coarse: await page.evaluate(() => matchMedia('(pointer: coarse)').matches), begin: idle,
    ...(await page.evaluate(() => ({ buttons: [...document.querySelectorAll('.era-console button')].map(button => { const box = button.getBoundingClientRect(); return { text: button.textContent, width: Math.round(box.width), height: Math.round(box.height) }; }),
      textUnder12: [...document.querySelectorAll('.era-console *')].filter(element => [...element.childNodes].some(node => node.nodeType === 3 && node.textContent.trim() !== ''))
        .map(element => parseFloat(getComputedStyle(element).fontSize)).filter(size => size < 12).length }))) };
  await context.close();
} catch (error) { result.errors.push(`tablet: ${String(error)}`); }

await browser.close();
writeFileSync(join(out, 'captures.json'), `${JSON.stringify(result, null, 1)}\n`);
console.log(JSON.stringify({ errors: result.errors, chip: result.gates.chip?.near?.market, far: result.gates.chip?.far?.market, reach: result.gates.chip?.market?.reach,
  selected: result.gates.selected?.line, preview: result.gates.wall?.preview?.lines?.map(line => line.text), after: result.gates.wall?.after }));
