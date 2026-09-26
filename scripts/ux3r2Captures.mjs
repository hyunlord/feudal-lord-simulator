// UX-3R2 evidence (UX3R 5·6·8절), JPEG, and one JSON of what each capture showed.
//   PLAYWRIGHT_MODULE=... node scripts/ux3r2Captures.mjs <out-dir> --url <url>
//  zone: the left zone panel with arable armed (the paintable-land overlay: good / fair / barred), burgage armed, a
//    stroke, undo, redo, a right-click erase, and an open polygon with its area label;
//  store: the granary's and the storehouse's storage cards after a little play; ledger: a row lighting its stores on
//    the map, a column head opening the storage inspector in the slot; site: a house site's first line;
//  road click-click: anchor, preview to the pointer, a second click lays the line, Enter ends;
//  tablet (1180 × 820, touch): a tap leaves the ghost 80 px above the finger and the confirm bar; nothing is built until ✓.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag('url') ?? 'http://127.0.0.1:4281/';
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { url, errors: [] };
const shot = (page, file, clip) => page.screenshot({ path: join(out, file), type: 'jpeg', quality: 76, ...(clip ? { clip } : {}) });
const at = (page, tx, ty) => page.evaluate(t => { const p = window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(t); return { x: p.clientX, y: p.clientY }; }, { tx, ty });
const proof = (page, f) => page.evaluate(f);
const zoneCells = page => proof(page, () => (window.__FEUDAL_PHASE10_PROOF__.state().zones ?? []).map(zone => [zone.kind, zone.membership.length]));
const roads = page => proof(page, () => window.__FEUDAL_PHASE10_PROOF__.state().tiles.filter(tile => tile.hasRoad).length);

// Zone panel, overlay, undo / redo / right-click erase, polygon area.
{
  const { context, page } = await openScene(browser, { state: null, tile: [45, 41], baseUrl: url, width: 1280, height: 800, run: false, initScript: TUTORIAL_OFF });
  page.on('pageerror', error => result.errors.push(String(error)));
  await page.locator("[data-layer='zone']").first().click(); await page.waitForTimeout(400);
  await page.locator("[data-zone-tool='arable']").first().click(); await page.waitForTimeout(400);
  await page.mouse.move(400, 450); await page.waitForTimeout(300);
  await shot(page, 'zone-arable-land.jpg');
  const legend = await proof(page, () => document.querySelector('.zone-toolbar .zone-land-legend')?.innerText.replace(/\n+/g, ' | '));
  await page.locator("[data-zone-tool='burgage']").first().click(); await page.waitForTimeout(300);
  await shot(page, 'zone-burgage-land.jpg');
  await page.locator("[data-zone-tool='arable']").first().click(); await page.waitForTimeout(200);
  const a = await at(page, 36, 44), b = await at(page, 40, 46);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300);
  const painted = await zoneCells(page);
  await page.locator("[data-zone-mode='undo']").click(); await page.waitForTimeout(200);
  const undone = await zoneCells(page);
  await page.locator("[data-zone-mode='redo']").click(); await page.waitForTimeout(200);
  const redone = await zoneCells(page);
  const c = await at(page, 38, 45);
  await page.mouse.click(c.x, c.y, { button: 'right' }); await page.waitForTimeout(200);
  const erased = await zoneCells(page);
  await page.keyboard.press('KeyZ'); await page.waitForTimeout(150);
  await page.locator("[data-zone-mode='polygon']").click(); await page.waitForTimeout(150);
  for (const [tx, ty] of [[30, 40], [34, 40], [34, 44]]) { const p = await at(page, tx, ty); await page.mouse.click(p.x, p.y); await page.waitForTimeout(80); }
  const open = await at(page, 30, 45); await page.mouse.move(open.x, open.y); await page.waitForTimeout(300);
  await shot(page, 'zone-polygon-area.jpg');
  result.zone = { legend, painted, undone, redone, erasedByRightClick: erased };
  await context.close();
}

// Storage cards, ledger highlight and store inspector in the slot, a site's first line.
{
  const { context, page } = await openScene(browser, { state: null, tile: [45, 41], baseUrl: url, width: 1280, height: 800, run: true, initScript: TUTORIAL_OFF });
  page.on('pageerror', error => result.errors.push(String(error)));
  // A little play (1x, about a season's first weeks) so the stores have a week of samples and carts have run.
  await page.waitForTimeout(16_000);
  if (await page.locator('.season-ledger-resume').count() > 0) await page.locator('.season-ledger-resume').click();
  await page.getByRole('button', { name: '일시 정지', exact: true }).click(); await page.waitForTimeout(200);
  const cards = {};
  for (const kind of ['granary', 'storehouse']) {
    const p = await page.evaluate(k => { const s = window.__FEUDAL_PHASE10_PROOF__.state(); const b = s.buildings.find(x => x.kind === k); return b ? window.__FEUDAL_PHASE10_PROOF__.tileClientPoint({ tx: b.tx, ty: b.ty }) : null; }, kind);
    if (p === null) continue;
    await page.mouse.click(p.clientX, p.clientY - 10); await page.waitForTimeout(500);
    cards[kind] = await proof(page, () => document.querySelector('.store-inspector')?.innerText.replace(/\n+/g, ' | ') ?? null);
    await shot(page, `store-${kind}.jpg`, { x: 940, y: 50, width: 340, height: 440 });
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  }
  await page.locator("[data-dock='ledger']").click(); await page.waitForTimeout(300);
  const row = page.locator('.ledger-matrix tr[data-resource="logs"] .ledger-row, .ledger-matrix tr[data-resource="timber"] .ledger-row').first();
  if (await row.count() > 0) await row.click();
  await page.waitForTimeout(300);
  await shot(page, 'ledger-row-highlight.jpg');
  const lit = await proof(page, () => [...document.querySelectorAll('.ledger-matrix tr[data-lit="true"]')].map(tr => tr.getAttribute('data-resource')));
  const ledger = await proof(page, () => document.querySelector('.ledger-matrix')?.innerText.replace(/\t/g, ' ').replace(/\n+/g, ' | '));
  const head = page.locator('.ledger-matrix .ledger-store').first();
  let slot = null;
  if (await head.count() > 0) {
    await head.click(); await page.waitForTimeout(400);
    slot = await proof(page, () => document.querySelector('.inspector-slot .store-inspector')?.innerText.replace(/\n+/g, ' | ') ?? null);
    await shot(page, 'ledger-store-inspector.jpg', { x: 860, y: 50, width: 420, height: 520 });
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  }
  // A site's first line: a well placed on open ground and selected soon after (while its materials are on the way).
  await page.locator("[data-dock='build']").click(); await page.waitForTimeout(200);
  await page.locator('button.build-menu-category[data-category]', { hasText: /^(주택|생활)/ }).click();
  await page.locator('button[aria-label="우물"]:visible').first().click(); await page.waitForTimeout(200);
  // A free grass tile beside a road (so the site's stall is its materials, not the road).
  const spot = await proof(page, () => {
    const s = window.__FEUDAL_PHASE10_PROOF__.state(); const tile = (x, y) => s.tiles[y * s.width + x];
    const taken = new Set([...s.buildings.flatMap(b => [`${b.tx},${b.ty}`]), ...s.constructionSites.flatMap(c => c.tx === undefined ? [] : [`${c.tx},${c.ty}`])]);
    for (const road of s.tiles.filter(t => t.hasRoad)) for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
      const x = road.tx + dx, y = road.ty + dy, t = tile(x, y);
      if (t && !t.hasRoad && t.terrain === 'grass' && !taken.has(`${x},${y}`) && x > 38 && x < 52) return { tx: x, ty: y };
    }
    return { tx: 40, ty: 44 };
  });
  const site = await at(page, spot.tx, spot.ty); await page.mouse.click(site.x, site.y); await page.waitForTimeout(200);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.getByRole('button', { name: '1배속', exact: true }).click(); await page.waitForTimeout(250);
  await page.getByRole('button', { name: '일시 정지', exact: true }).click(); await page.waitForTimeout(200);
  await page.mouse.click(site.x, site.y - 6); await page.waitForTimeout(400);
  const siteCard = await proof(page, () => ({ blocker: document.querySelector('.inspector-blocker')?.textContent ?? null, first: document.querySelector('.diagnostic-card .inspector-body p')?.textContent ?? null }));
  await shot(page, 'site-first-line.jpg', { x: 940, y: 50, width: 340, height: 360 });
  result.store = { cards, ledger, lit, slot, site: siteCard };
  await context.close();
}

// Road click-click.
{
  const { context, page } = await openScene(browser, { state: null, tile: [44, 41], baseUrl: url, width: 1280, height: 800, run: false, initScript: TUTORIAL_OFF });
  page.on('pageerror', error => result.errors.push(String(error)));
  await page.locator("[data-dock='build']").click(); await page.waitForTimeout(200);
  await page.locator('button.build-menu-category[data-category]', { hasText: /^(도로|길)$/ }).click(); await page.waitForTimeout(200);
  const road = page.locator('button[aria-label="길"]:visible'); if (await road.count() > 0) await road.first().click();
  const before = await roads(page);
  const a = await at(page, 41, 48), b = await at(page, 45, 48), c = await at(page, 45, 51);
  await page.mouse.click(a.x, a.y); await page.waitForTimeout(100);
  const afterAnchor = await roads(page);
  await page.mouse.move(b.x, b.y, { steps: 4 }); await page.waitForTimeout(300);
  await shot(page, 'road-chain-preview.jpg', { x: b.x - 300, y: b.y - 220, width: 600, height: 400 });
  await page.mouse.click(b.x, b.y); await page.waitForTimeout(150);
  const afterSecond = await roads(page);
  await page.mouse.move(c.x, c.y, { steps: 4 }); await page.waitForTimeout(300);
  await shot(page, 'road-chain-next.jpg', { x: b.x - 300, y: b.y - 220, width: 600, height: 400 });
  await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  await page.mouse.click(c.x, c.y); await page.waitForTimeout(150);
  const afterEnterClick = await roads(page);
  result.road = { before, afterAnchor, afterSecond, afterEnterClick, chainEndedByEnter: afterEnterClick === afterSecond };
  await context.close();
}

// Tablet confirm bar.
{
  const { context, page } = await openScene(browser, { state: null, tile: [45, 41], baseUrl: url, width: 1180, height: 820, run: false, hasTouch: true, initScript: TUTORIAL_OFF });
  page.on('pageerror', error => result.errors.push(String(error)));
  const cdp = await context.newCDPSession(page);
  const tap = async p => { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 0 }] }); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await page.waitForTimeout(400); };
  const press = async locator => { const box = await locator.boundingBox(); await tap({ x: box.x + box.width / 2, y: box.y + box.height / 2 }); };
  await press(page.locator("[data-dock='build']"));
  await press(page.locator('button.build-menu-category[data-category]', { hasText: /^(주택|생활)/ }));
  await press(page.locator('button[aria-label="우물"]:visible').first());
  const target = await at(page, 40, 44);
  const sites = () => proof(page, () => window.__FEUDAL_PHASE10_PROOF__.state().constructionSites.length);
  const before = await sites();
  await tap({ x: target.x, y: target.y + 80 });
  const bar = await page.locator('.placement-confirm-bar').count();
  const afterLift = await sites();
  await shot(page, 'tablet-confirm-bar.jpg');
  await press(page.locator('.placement-confirm-button[data-confirm="ok"]')); await page.waitForTimeout(200);
  const afterConfirm = await sites();
  const siteTile = await proof(page, () => { const s = window.__FEUDAL_PHASE10_PROOF__.state().constructionSites.at(-1); return s ? { tx: s.tx, ty: s.ty } : null; });
  result.tablet = { bar: bar > 0, before, afterLift, afterConfirm, siteTile, target: { tx: 40, ty: 44 }, barAfterConfirm: await page.locator('.placement-confirm-bar').count() > 0,
    toolStays: await proof(page, () => document.querySelector('.build-drawer')?.getAttribute('data-open') !== 'true' && document.querySelector('.action-dock')?.hasAttribute('hidden') === true) };
  await context.close();
}

await browser.close();
writeFileSync(join(out, 'ux3r2-captures.json'), JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify(result, null, 1));
