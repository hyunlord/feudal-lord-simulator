// TOUCH-1 gate 2: a gamepad session with a virtual pad (navigator.getGamepads replaced before the page loads; the
// translator polls it every frame like a real pad), paused, from the default new game:
//   1. RB until the hut tool is armed, the left stick drives the map cursor onto tile (48,38), A places a hut.
//   2. B disarms (a tool is armed), B again with the cursor on the new site cancels it (the aimed cancel).
//   3. X three times = pasture brush; cursor to (52,46), A held while the stick moves the cursor to (55,46) = a stroke.
// Afterwards: the site appeared and went, the pasture zone has cells. A capture shows the map cursor.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/gamepadReplay.mjs <outDir> [--url <url>]
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4291/';
const initScript = () => {
  // UX-1: the tutorial off (its unlocks would lock the zone tools that X cycles); the replay tests pad input.
  try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }
  const pad = { id: 'virtual standard pad', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
  Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [pad, null, null, null] });
  window.__setPad = ({ axes = [0, 0, 0, 0], press = [] }) => {
    pad.axes = axes;
    pad.buttons = pad.buttons.map((_, index) => ({ pressed: press.includes(index), touched: press.includes(index), value: press.includes(index) ? 1 : 0 }));
    pad.timestamp += 1;
  };
};
const A = 0, B = 1, X = 2, RB = 5;

await mkdir(outDir, { recursive: true });
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const { context, page } = await openScene(browser, { state: null, tile: [44, 41], baseUrl: url, run: false, initScript });
await page.mouse.move(640, 790);
const set = (pad) => page.evaluate(value => window.__setPad(value), pad);
const tap = async (button) => { await set({ press: [button] }); await page.waitForTimeout(80); await set({}); await page.waitForTimeout(80); };
const cursor = () => page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.gamepadCursor());
const tileClient = (tx, ty) => page.evaluate(([x, y]) => { const p = window.__FEUDAL_PHASE10_PROOF__.tileClientPoint({ tx: x, ty: y }); return { x: p.clientX, y: p.clientY }; }, [tx, ty]);
/** Steer the cursor with the left stick onto a tile (holding `press` buttons), closed loop on the reported cursor. */
const steer = async (tx, ty, press = []) => {
  for (let i = 0; i < 200; i += 1) {
    const at = await cursor(); const goal = await tileClient(tx, ty);
    const dx = goal.x - at.clientX; const dy = goal.y - at.clientY; const d = Math.hypot(dx, dy);
    if (d < 3 && at.tx === tx && at.ty === ty) break;
    const strength = Math.min(1, Math.max(0.3, d / 120));
    await set({ axes: [dx / d * strength, dy / d * strength, 0, 0], press });
    await page.waitForTimeout(20);
  }
  await set({ press }); await page.waitForTimeout(80);
  return cursor();
};
const snapshot = (label) => page.evaluate(label => {
  const proof = window.__FEUDAL_PHASE10_PROOF__; const state = proof.state();
  return { label, cursor: proof.gamepadCursor(), device: proof.inputDevice(),
    sites: state.constructionSites.map(site => `${site.kind}@${site.tx ?? ''},${site.ty ?? ''}`).join(' '),
    zones: (state.zones ?? []).map(zone => `${zone.kind}:${zone.membership.length}`).join(' '),
    hutArmed: document.querySelector('button[aria-label="오두막"][aria-pressed="true"]') !== null,
    pastureArmed: document.querySelector('[data-zone-tool="pasture"][aria-pressed="true"]') !== null,
    hint: document.querySelector('.build-menu-instruction')?.textContent ?? '' };
}, label);
const rows = [];
await tap(0 + 3); // Y: pause toggle (wakes the pad), again to stay paused
await tap(3);
for (let i = 0; i < 40 && !(await snapshot('')).hutArmed; i += 1) await tap(RB);
rows.push(await snapshot('RB until the hut tool is armed'));
await steer(48, 38);
rows.push(await snapshot('cursor on (48,38)'));
await page.screenshot({ path: join(outDir, 'gamepad-cursor-hut.jpg'), type: 'jpeg', quality: 75, clip: { x: 340, y: 150, width: 600, height: 450 } });
await tap(A);
rows.push(await snapshot('A places a hut'));
await tap(B);
rows.push(await snapshot('B disarms'));
await tap(B);
rows.push(await snapshot('B on the site cancels it'));
for (let i = 0; i < 3; i += 1) await tap(X);
rows.push(await snapshot('X x3 = pasture brush'));
await steer(52, 46);
await set({ press: [A] }); await page.waitForTimeout(80);
await steer(55, 46, [A]);
await set({}); await page.waitForTimeout(150);
rows.push(await snapshot('A held + stick (52,46) -> (55,46) paints'));
await page.screenshot({ path: join(outDir, 'gamepad-cursor-zone.jpg'), type: 'jpeg', quality: 75, clip: { x: 340, y: 150, width: 600, height: 450 } });
await context.close(); await browser.close();
const placed = rows.find(row => row.label === 'A places a hut');
const cancelled = rows.find(row => row.label === 'B on the site cancels it');
const painted = rows.at(-1);
const result = { url, pass: placed.sites.includes('house@48,38') && !cancelled.sites.includes('house@48,38') && /pasture:\d+/.test(painted.zones), rows };
await writeFile(join(outDir, 'gamepad-replay.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 1));
