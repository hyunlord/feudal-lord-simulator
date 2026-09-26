// B9 gate 4 (input regression): the same real mouse / keyboard session, driven by Playwright, in the baseline build
// (--base) and this build (--url), paused, from the default new game. Afterwards the game state (roads, buildings,
// sites, zones, zone undo stack) and the camera (client point of a fixed tile) must match exactly.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/inputReplayCompare.mjs <out.json> --base <url> [--url <url>]
import { writeFile } from 'node:fs/promises';
import { loadChromium, openScene } from './renderCommitProbe.mjs';
// Where the mouse rests between steps: over the old bottom console, and on the UX-3 map clear of the 20 px edge-pan
// band (y 790 was inside it once the console left, so the camera slid while the replay waited).
const PARK = { x: 640, y: 740 };

// UX-1: the replay compares input handling, so the build under test runs with the tutorial off (its unlocks would lock
// the pasture brush); the baseline ignores the key. The categories were renamed (주택 → 생활, 도로 → 길); both match.
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const CATEGORY_NAME = { '주택': /^(주택|생활)/, '도로': /^(도로|길)$/ };

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4241/';

const STEPS = [
  ['road tool, drag a road line', async (page, at) => {
    await tool(page, '도로', '길');
    await drag(page, await at(43, 44), await at(47, 44));
  }],
  // UX-3R2 keeps the single click: it toggles the tile (and on open ground anchors a click-click chain there).
  ['road tool, click one tile twice (place, remove)', async (page, at) => { await clickAt(page, await at(40, 46)); await clickAt(page, await at(40, 46)); await clickAt(page, await at(38, 46)); }],
  ['UX-3R2 road click-click: two clicks lay a line, Enter ends the chain', async (page, at) => {
    if (!(await lineTools(page))) { await drag(page, await at(41, 48), await at(44, 48)); return; }
    await clickAt(page, await at(41, 48)); await clickAt(page, await at(44, 48)); await page.keyboard.press('Enter');
  }],
  ['road tool, drag then right click cancels, release', async (page, at) => {
    const a = await at(36, 50); const b = await at(39, 50);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.click(b.x, b.y, { button: 'right' }); await page.mouse.up();
  }],
  ['Esc disarms, left drag pans', async (page) => { await escape(page); await drag(page, { x: 700, y: 420 }, { x: 610, y: 380 }); }],
  ['middle drag pans', async (page) => { await page.mouse.move(640, 400); await page.mouse.down({ button: 'middle' }); await page.mouse.move(700, 450, { steps: 5 }); await page.mouse.up({ button: 'middle' }); }],
  ['wheel zoom in and out', async (page) => { await page.mouse.move(600, 380); await page.mouse.wheel(0, -120); await page.waitForTimeout(80); await page.mouse.wheel(0, -120); await page.waitForTimeout(80); await page.mouse.wheel(0, 120); }],
  ['house tool, place', async (page, at) => {
    await tool(page, '주택', '오두막');
    await clickAt(page, await at(48, 38));
  }],
  ['right click the new site cancels it', async (page, at) => { await escape(page); const p = await at(48, 38); await page.mouse.click(p.x, p.y, { button: 'right' }); }],
  ['Space held + drag pans with the road tool', async (page) => {
    await tool(page, '도로', '길');
    await page.mouse.move(640, 400); await page.keyboard.down('Space'); await drag(page, { x: 640, y: 400 }, { x: 600, y: 440 }); await page.keyboard.up('Space');
    await escape(page);
  }],
  // UX-3: the strokes sit in the upper map (tiles 46-50 x 41-43), clear of the old bottom console and the zone drawer
  // (the earlier tiles 52-55 x 46-50 fell under the drawer once the camera had panned).
  ['zone brush: paint, radius ], paint', async (page, at) => {
    await page.locator('button.build-menu-category', { hasText: '구역' }).click();
    await page.locator('[data-zone-tool="pasture"]:visible').first().click();
    await page.mouse.move(PARK.x, PARK.y);
    await drag(page, await at(47, 41), await at(50, 41));
    await page.keyboard.press('BracketRight');
    await drag(page, await at(46, 43), await at(48, 43));
  }],
  ['zone brush: Z undoes the last stroke, Esc disarms', async (page) => { await page.keyboard.press('KeyZ'); await escape(page); }],
  ['keyboard pan (D held)', async (page) => { await page.mouse.move(640, 400); await page.keyboard.down('KeyD'); await page.waitForTimeout(250); await page.keyboard.up('KeyD'); await page.waitForTimeout(400); }],
  ['map overview press jumps the camera', async (page) => {
    // UX-3: the map is the ledger drawer's 지도 tab (opened from the dock); before, a 지도 disclosure in the console.
    const ledger = page.locator("[data-dock='ledger']");
    const drawer = await ledger.count() > 0;
    if (drawer) { await ledger.click(); await page.locator('.ledger-tab', { hasText: '지도' }).click(); } else await page.locator('summary', { hasText: '지도' }).first().click();
    const box = await page.locator('button.map-overview').boundingBox();
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.6);
    if (drawer) await ledger.click(); else await page.locator('summary', { hasText: '지도' }).first().click();
    await page.mouse.move(PARK.x, PARK.y);
  }],
];

async function tool(page, category, name) {
  // UX-3: the categories are inside the build drawer the dock opens (a tool is picked from the drawer, which then
  // closes; the 길 category arms the road itself). The baseline has no dock and its categories are always on screen.
  const dock = page.locator("[data-dock='build']");
  if (await dock.count() > 0 && await dock.isVisible() && await dock.getAttribute('aria-expanded') !== 'true') await dock.click();
  await page.locator('button.build-menu-category[data-category]', { hasText: CATEGORY_NAME[category] ?? category }).click();
  const button = page.locator(`button[aria-label="${name}"]:visible`);
  if (await button.count() > 0) await button.first().click();
  await page.mouse.move(PARK.x, PARK.y);
}
/** Esc one step; on the normal screen UX-3 opens the pause menu (S-31), which this session closes again. */
async function escape(page) {
  await page.keyboard.press('Escape');
  if (await page.locator('.pause-menu').count() > 0) await page.keyboard.press('Escape');
}
async function drag(page, a, b) { await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(60); }
async function clickAt(page, p) { await page.mouse.click(p.x, p.y); await page.waitForTimeout(60); }
/** UX-3R2: the build has the click-click line tools (the canvas says so); the base lays the same line by a drag. */
async function lineTools(page) { return await page.locator('canvas[data-line-tools="click-click"]').count() > 0; }

async function session(browser, base) {
  const { context, page } = await openScene(browser, { state: null, tile: [44, 41], baseUrl: base, run: false, initScript: TUTORIAL_OFF });
  await page.mouse.move(PARK.x, PARK.y);
  const at = async (tx, ty) => page.evaluate(([x, y]) => { const p = window.__FEUDAL_PHASE10_PROOF__.tileClientPoint({ tx: x, ty: y }); return { x: p.clientX, y: p.clientY }; }, [tx, ty]);
  const rows = [];
  for (const [name, step] of STEPS) {
    await step(page, at);
    await page.waitForTimeout(150);
    rows.push({ step: name, ...(await page.evaluate(() => {
      const state = window.__FEUDAL_PHASE10_PROOF__.state();
      const roads = state.tiles.filter(tile => tile.hasRoad).map(tile => `${tile.tx},${tile.ty}`).join(' ');
      const probe = window.__FEUDAL_PHASE10_PROOF__.tileClientPoint({ tx: 44, ty: 41 });
      return { roads, roadRevision: state.roadRevision, buildings: state.buildings.length,
        sites: state.constructionSites.map(site => `${site.kind}@${site.tx ?? ''},${site.ty ?? ''}`).join(' '),
        zones: (state.zones ?? []).map(zone => `${zone.kind}:${zone.membership.length}`).join(' '), zoneUndo: (state.zoneUndo ?? []).length,
        camera: `${probe.clientX.toFixed(3)},${probe.clientY.toFixed(3)}`, zoom: window.__FEUDAL_PHASE10_PROOF__.diagnosis().camera.zoom };
    })) });
  }
  await context.close();
  return rows;
}

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const before = await session(browser, flags.base);
const after = await session(browser, url);
// Held-key camera motion integrates wall-clock frame times, so two runs of the same build differ there too.
const control = await session(browser, flags.base);
await browser.close();
const timed = row => row.step.startsWith('keyboard pan');
const cameraX = row => Number(row.camera.split(',')[0]);
const rows = before.map((row, index) => {
  const identical = JSON.stringify(row) === JSON.stringify(after[index]);
  if (!timed(row)) return { step: row.step, identical, before: row, after: after[index] };
  // Timed step: everything but the camera must match; the camera moves the same way within the base-vs-base spread.
  const same = JSON.stringify({ ...row, camera: 0 }) === JSON.stringify({ ...after[index], camera: 0 });
  const previous = before[index - 1]; const moved = [before, after, control].map(run => cameraX(run[index - 1]) - cameraX(run[index]));
  const spread = Math.abs(moved[0] - moved[2]);
  return { step: row.step, identical: identical || (same && moved[1] > 0 && Math.abs(moved[0] - moved[1]) <= Math.max(spread, 0.1 * moved[0])),
    movedPx: { base: moved[0], build: moved[1], baseAgain: moved[2] }, before: row, after: after[index], previous: previous?.step };
});
await writeFile(out, `${JSON.stringify({ base: flags.base, url, identical: rows.filter(row => row.identical).length, of: rows.length, rows }, null, 2)}\n`);
for (const row of rows) console.log(row.identical ? 'same' : 'DIFF', row.step, row.identical ? '' : JSON.stringify({ before: row.before, after: row.after }));
