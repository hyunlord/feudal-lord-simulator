// TOUCH-1 gate 1: B9's 13-step input regression (scripts/inputReplayCompare.mjs) played twice in this build, once with
// the mouse and once with touch (Chrome touch emulation, real TouchEvents through CDP Input.dispatchTouchEvent),
// paused, from the default new game. After every step the game state (roads, buildings, sites, zones, zone undo
// stack) and the camera (client point of a fixed tile, zoom) must match.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/touchReplayCompare.mjs <out.json> [--url <url>]
// Touch equivalents of the mouse steps:
//   drag = one-finger drag · click = tap · right click during a road drag = a second finger (drops the stroke) ·
//   left drag without a tool = one-finger drag · middle drag / Space + drag = two-finger drag (with the road tool:
//   gate 3) · wheel steps 1.1, 1.1, 0.9 = one pinch through the same ratios at the same anchor · right click on a
//   site = two-finger tap there · UI buttons = taps on them. Keys stay keys (Esc, Z, ], D held).
// The pinch reaches the wheel's zoom through a product of ratios, so zoom and camera are compared to 1e-6 / 0.01 px
// there; everything else must be identical.
import { writeFile } from 'node:fs/promises';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

// UX-1: the replay compares input handling, so the build under test runs with the tutorial off (its unlocks would lock
// the pasture brush); the baseline ignores the key. The categories were renamed (주택 → 생활, 도로 → 길); both match.
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const CATEGORY_NAME = { '주택': /^(주택|생활)/, '도로': /^(도로|길)$/ };

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4291/';

const mouseDevice = page => ({
  drag: async (a, b) => { await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(60); },
  tap: async p => { await page.mouse.click(p.x, p.y); await page.waitForTimeout(60); },
  press: async locator => { await locator.click(); },
  roadDragCancelled: async (a, b) => {
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 6 });
    await page.mouse.click(b.x, b.y, { button: 'right' }); await page.mouse.up();
  },
  panDrag: async (a, b) => { await page.mouse.move(a.x, a.y); await page.mouse.down({ button: 'middle' }); await page.mouse.move(b.x, b.y, { steps: 5 }); await page.mouse.up({ button: 'middle' }); },
  panDragWithSpace: async (a, b) => { await page.mouse.move(a.x, a.y); await page.keyboard.down('Space'); await mouseDevice(page).drag(a, b); await page.keyboard.up('Space'); },
  zoomSteps: async (anchor) => { await page.mouse.move(anchor.x, anchor.y); for (const deltaY of [-120, -120, 120]) { await page.mouse.wheel(0, deltaY); await page.waitForTimeout(80); } },
  cancelAt: async p => { await page.mouse.click(p.x, p.y, { button: 'right' }); },
  park: async () => { await page.mouse.move(640, 790); },
});

const touchDevice = (page, cdp) => {
  const send = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, id) => ({ x: p.x, y: p.y, id })) });
  const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const oneFinger = async (a, b, steps) => { await send('touchStart', [a]); for (let i = 1; i <= steps; i += 1) await send('touchMove', [lerp(a, b, i / steps)]); await send('touchEnd', []); await page.waitForTimeout(60); };
  const twoFinger = async (a, b, steps, gap = 60) => {
    const pair = p => [{ x: p.x - gap / 2, y: p.y }, { x: p.x + gap / 2, y: p.y }];
    await send('touchStart', pair(a)); for (let i = 1; i <= steps; i += 1) await send('touchMove', pair(lerp(a, b, i / steps))); await send('touchEnd', []); await page.waitForTimeout(60);
  };
  return {
    drag: (a, b) => oneFinger(a, b, 8),
    tap: async p => { await send('touchStart', [p]); await send('touchEnd', []); await page.waitForTimeout(60); },
    press: async locator => { const box = await locator.boundingBox(); await touchDevice(page, cdp).tap({ x: box.x + box.width / 2, y: box.y + box.height / 2 }); },
    roadDragCancelled: async (a, b) => {
      await send('touchStart', [a]); for (let i = 1; i <= 6; i += 1) await send('touchMove', [lerp(a, b, i / 6)]);
      await send('touchStart', [b, { x: b.x + 80, y: b.y }]); await send('touchEnd', []); await page.waitForTimeout(60);
    },
    panDrag: (a, b) => twoFinger(a, b, 5),
    panDragWithSpace: (a, b) => twoFinger(a, b, 8),
    zoomSteps: async anchor => {
      // Distances 100 -> 110 -> 121 -> 108.9: the ratios 1.1, 1.1, 0.9 of the wheel steps, around the same anchor.
      const pair = d => [{ x: anchor.x - d / 2, y: anchor.y }, { x: anchor.x + d / 2, y: anchor.y }];
      await send('touchStart', pair(100)); for (const d of [110, 121, 108.9]) { await send('touchMove', pair(d)); await page.waitForTimeout(80); } await send('touchEnd', []);
    },
    cancelAt: async p => { await send('touchStart', [{ x: p.x - 20, y: p.y }, { x: p.x + 20, y: p.y }]); await send('touchEnd', []); await page.waitForTimeout(60); },
    park: async () => {},
  };
};

const STEPS = [
  ['road tool, drag a road line', async (d, page, at) => { await tool(d, page, '도로', '길'); await d.drag(await at(43, 44), await at(47, 44)); }],
  ['road tool, click one tile twice (place, remove)', async (d, page, at) => { await d.tap(await at(40, 46)); await d.tap(await at(40, 46)); await d.tap(await at(38, 46)); }],
  ['road tool, drag then right click cancels, release', async (d, page, at) => { await d.roadDragCancelled(await at(36, 50), await at(39, 50)); }],
  ['Esc disarms, left drag pans', async (d, page) => { await escape(page); await d.drag({ x: 700, y: 420 }, { x: 610, y: 380 }); }],
  ['middle drag pans', async (d) => { await d.panDrag({ x: 640, y: 400 }, { x: 700, y: 450 }); }],
  ['wheel zoom in and out', async (d) => { await d.zoomSteps({ x: 600, y: 380 }); }],
  ['house tool, place', async (d, page, at) => { await tool(d, page, '주택', '오두막'); await d.tap(await at(48, 38)); }],
  ['right click the new site cancels it', async (d, page, at) => { await escape(page); await d.cancelAt(await at(48, 38)); }],
  ['Space held + drag pans with the road tool', async (d, page) => { await tool(d, page, '도로', '길'); await d.panDragWithSpace({ x: 640, y: 400 }, { x: 600, y: 440 }); await escape(page); }],
  ['zone brush: paint, radius ], paint', async (d, page, at) => {
    await d.press(page.locator('button.build-menu-category', { hasText: '구역' }));
    await d.press(page.locator('[data-zone-tool="pasture"]:visible').first());
    await d.park();
    await d.drag(await at(52, 46), await at(55, 46));
    await page.keyboard.press('BracketRight');
    await d.drag(await at(52, 49), await at(54, 50));
  }],
  ['zone brush: Z undoes the last stroke, Esc disarms', async (d, page) => { await page.keyboard.press('KeyZ'); await escape(page); }],
  ['keyboard pan (D held)', async (d, page) => { await page.mouse.move(640, 400); await page.keyboard.down('KeyD'); await page.waitForTimeout(250); await page.keyboard.up('KeyD'); await page.waitForTimeout(400); }],
  ['map overview press jumps the camera', async (d, page) => {
    // UX-3: the map is the ledger drawer's 지도 tab (opened from the dock); before, a 지도 disclosure in the console.
    const ledger = page.locator("[data-dock='ledger']");
    const drawer = await ledger.count() > 0;
    if (drawer) { await d.press(ledger); await d.press(page.locator('.ledger-tab', { hasText: '지도' })); } else await d.press(page.locator('summary', { hasText: '지도' }).first());
    const box = await page.locator('button.map-overview').boundingBox();
    await d.tap({ x: box.x + box.width * 0.3, y: box.y + box.height * 0.6 });
    await d.press(drawer ? ledger : page.locator('summary', { hasText: '지도' }).first());
    await d.park();
  }],
];

/** Esc one step; on the normal screen UX-3 opens the pause menu (S-31), which this session closes again. */
async function escape(page) {
  await page.keyboard.press('Escape');
  if (await page.locator('.pause-menu').count() > 0) await page.keyboard.press('Escape');
}

async function tool(d, page, category, name) {
  // UX-3: the categories are inside the build drawer the dock opens; picking a tool closes it (길 arms the road itself).
  const dock = page.locator("[data-dock='build']");
  if (await dock.count() > 0 && await dock.isVisible() && await dock.getAttribute('aria-expanded') !== 'true') await d.press(dock);
  await d.press(page.locator('button.build-menu-category[data-category]', { hasText: CATEGORY_NAME[category] ?? category }));
  const button = page.locator(`button[aria-label="${name}"]:visible`);
  if (await button.count() > 0) await d.press(button.first());
  await d.park();
}

async function session(browser, kind) {
  const { context, page } = await openScene(browser, { state: null, tile: [44, 41], baseUrl: url, run: false, hasTouch: kind === 'touch', initScript: TUTORIAL_OFF });
  await page.mouse.move(640, 790);
  const cdp = kind === 'touch' ? await context.newCDPSession(page) : null;
  const device = kind === 'touch' ? touchDevice(page, cdp) : mouseDevice(page);
  const at = async (tx, ty) => page.evaluate(([x, y]) => { const p = window.__FEUDAL_PHASE10_PROOF__.tileClientPoint({ tx: x, ty: y }); return { x: p.clientX, y: p.clientY }; }, [tx, ty]);
  const rows = [];
  for (const [name, step] of STEPS) {
    await step(device, page, at);
    await page.waitForTimeout(150);
    rows.push({ step: name, ...(await page.evaluate(() => {
      const proof = window.__FEUDAL_PHASE10_PROOF__;
      const state = proof.state();
      const roads = state.tiles.filter(tile => tile.hasRoad).map(tile => `${tile.tx},${tile.ty}`).join(' ');
      const probe = proof.tileClientPoint({ tx: 44, ty: 41 });
      return { roads, roadRevision: state.roadRevision, buildings: state.buildings.length,
        sites: state.constructionSites.map(site => `${site.kind}@${site.tx ?? ''},${site.ty ?? ''}`).join(' '),
        zones: (state.zones ?? []).map(zone => `${zone.kind}:${zone.membership.length}`).join(' '), zoneUndo: (state.zoneUndo ?? []).length,
        cameraX: probe.clientX, cameraY: probe.clientY, zoom: proof.diagnosis().camera.zoom, device: proof.inputDevice() };
    })) });
  }
  await context.close();
  return rows;
}

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const mouse = await session(browser, 'mouse');
const touch = await session(browser, 'touch');
const mouseAgain = await session(browser, 'mouse');
await browser.close();
const cameraKeys = ['cameraX', 'cameraY', 'zoom'];
const rows = mouse.map((row, index) => {
  const other = touch[index];
  const game = key => !cameraKeys.includes(key) && key !== 'device';
  const sameGame = Object.keys(row).filter(game).every(key => row[key] === other[key]);
  const dx = Math.abs(row.cameraX - other.cameraX); const dy = Math.abs(row.cameraY - other.cameraY); const dz = Math.abs(row.zoom - other.zoom);
  // Held-key motion (keyboard pan) integrates wall-clock frame time: allow the mouse-vs-mouse spread there.
  const spread = Math.max(Math.abs(row.cameraX - mouseAgain[index].cameraX), Math.abs(row.cameraY - mouseAgain[index].cameraY));
  // B9's rule for the timed step: the camera moves the same way within the mouse-vs-mouse spread or 10% of the move.
  const moved = index === 0 ? 0 : Math.hypot(row.cameraX - mouse[index - 1].cameraX, row.cameraY - mouse[index - 1].cameraY);
  const allowed = row.step.startsWith('keyboard pan') ? Math.max(0.01, spread, 0.1 * moved) : 0.01;
  const sameCamera = dx <= allowed && dy <= allowed && dz <= 1e-6;
  return { step: row.step, identical: sameGame && sameCamera, exactCamera: dx === 0 && dy === 0 && dz === 0, cameraDelta: { dx, dy, dz }, mouseSpread: spread, movedPx: moved,
    mouse: row, touch: other };
});
await writeFile(out, `${JSON.stringify({ url, identical: rows.filter(row => row.identical).length, of: rows.length, rows }, null, 2)}\n`);
for (const row of rows) console.log(row.identical ? 'same' : 'DIFF', row.exactCamera ? '' : `(camera Δ ${row.cameraDelta.dx.toFixed(4)},${row.cameraDelta.dy.toFixed(4)} zoom Δ ${row.cameraDelta.dz})`, row.step, row.identical ? '' : JSON.stringify({ mouse: row.mouse, touch: row.touch }));
