// INSTALL-7 evidence (gates 2-5), trunk (--base) vs this build (--url):
//  - winter: lots24 (its calendar winter) at zoom 1.0 and 0.6, and the same town a season later (spring): roof snow and
//    frost, gone in spring; the new-game map in winter / autumn / summer (frost, leaves, dry grass).
//  - signals: scripts/install7Scenes.ts `signals` paused (S6 empty stall, S9 latch, S12 bundles, boarded house), and
//    the same scene after 4 s at 5x (S2 road cut, once it has held a distribution cycle).
//  - lod: the C3 seed 2 city (INSTALL-5c market-day scene) at zoom 1.35 and 0.6, running: cart loads, piles, props;
//    below 0.8 the loads are not drawn.
//  - chain (this build only): the same city at 5x, sampled every 250 ms; each link is captured the first sample it is
//    true in the state: sheaves (a tended strip harvested), a sack cart (a carter carrying wheat), the mill working
//    (oven smoke), bread at the mill, a bread basket (a distributor out), roof smoke (a house whose bread rose).
//   PLAYWRIGHT_MODULE=... node scripts/install7Captures.mjs <outDir> --url <this> --base <trunk> [--only chain|views]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadChromium, openScene, sceneStates } from './renderCommitProbe.mjs';

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const load = async path => JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));
const CLIP = { x: 240, y: 150, width: 800, height: 500 };
const CART_LOAD_ZOOM = 0.8;
const states = await sceneStates();
const city = await load('docs/verification/install5c/scene/marketday-children.json.gz');
const signals = await load('docs/verification/install7/scene/signals.json.gz');
const views = [
  { name: 'winter-z1', state: { ...states.lots24, walkers: [] }, tile: [45, 37], zoom: 1, run: false },
  { name: 'winter-z06', state: { ...states.lots24, walkers: [] }, tile: [45, 37], zoom: 0.6, run: false },
  { name: 'spring-z1', state: { ...states.lots24, walkers: [], tick: states.lots24.tick + 1_000 }, tile: [45, 37], zoom: 1, run: false },
  { name: 'newgame-winter', state: await load('docs/verification/install7/scene/newgame-winter.json.gz'), tile: [42, 44], zoom: 1, run: false },
  { name: 'newgame-autumn', state: await load('docs/verification/install7/scene/newgame-autumn.json.gz'), tile: [42, 44], zoom: 1, run: false },
  { name: 'newgame-summer', state: await load('docs/verification/install7/scene/newgame-summer.json.gz'), tile: [42, 44], zoom: 1, run: false },
  { name: 'signals', state: signals, tile: [43, 42], zoom: 1.35, run: false },
  { name: 'signals-roadcut', state: signals, tile: [41, 45], zoom: 1.35, run: '5', waitMs: 4_000 },
  { name: 'lod-z135', state: city, tile: [48, 35], zoom: 1.35, run: true, waitMs: 4_000 },
  { name: 'lod-z06', state: city, tile: [48, 35], zoom: 0.6, run: true, waitMs: 4_000 },
];
await mkdir(outDir, { recursive: true });
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = [];
const open = (state, tile, zoom, run, baseUrl) => openScene(browser, { state, tile, baseUrl, dpr: 1, zoom, run: run !== false });
if (flags.only !== 'chain') for (const view of views) {
  for (const [label, url] of [['before', flags.base], ['after', flags.url]]) {
    if (url === undefined) continue;
    const { context, page } = await open(view.state, view.tile, view.zoom, view.run, url);
    if (view.run === '5') await page.getByRole('button', { name: '5배속', exact: true }).click().catch(() => undefined);
    await page.waitForTimeout(view.waitMs ?? 2_500); await page.mouse.move(640, 790); await page.waitForTimeout(300);
    const file = `${view.name}-${label}.jpg`;
    await writeFile(join(outDir, file), await page.screenshot({ type: 'jpeg', quality: 74, clip: CLIP }));
    rows.push({ file, tick: await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().tick), build: url });
    await context.close();
  }
}
if (flags.only !== 'views') {
  // The whole town in one view at 0.8 (the lowest zoom that still draws the cart loads): every link is on screen.
  const { context, page } = await open(city, [45, 34], CART_LOAD_ZOOM, true, flags.url);
  await page.getByRole('button', { name: '5배속', exact: true }).click().catch(() => undefined);
  const links = ['sheaves', 'sack-cart', 'mill-working', 'mill-bread', 'bread-basket', 'roof-smoke'];
  const found = {};
  let previousBread = null;
  for (let sample = 0; sample < 480 && Object.keys(found).length < links.length; sample += 1) {
    await page.waitForTimeout(250);
    const hit = await page.evaluate(async previous => {
      const farm = await import('/src/render/farmsteadArt.ts');
      const s = window.__FEUDAL_PHASE10_PROOF__.state();
      const work = farm.farmsteadFieldWork(s);
      const bread = Object.fromEntries(s.houses.map(house => [house.buildingId, house.breadStock]));
      const out = { tick: s.tick, bread, links: {} };
      for (const [id, entry] of work) if (entry.harvested !== null) { out.links.sheaves = { tile: entry.harvested[0], note: `farmstead ${id}: strip harvested (${entry.harvested.length} cells)` }; break; }
      const sack = s.walkers.find(w => w.kind === 'carter' && w.cargo?.resource === 'wheat');
      if (sack) out.links['sack-cart'] = { tile: sack.position, note: `carter ${sack.id} carrying ${sack.cargo.amount} wheat` };
      const mill = s.buildings.find(b => b.kind === 'mill' && b.workers > 0 && ((b.inventory.wheat ?? 0) > 0 || b.productionProgress > 0) && !b.operationPaused && !b.upkeepUnpaid);
      if (mill) out.links['mill-working'] = { tile: { tx: mill.tx, ty: mill.ty }, note: `mill ${mill.id}: ${mill.inventory.wheat ?? 0} wheat, baking ${mill.productionProgress.toFixed(2)}` };
      const baked = s.buildings.find(b => b.kind === 'mill' && (b.inventory.bread ?? 0) > 0);
      if (baked) out.links['mill-bread'] = { tile: { tx: baked.tx, ty: baked.ty }, note: `mill ${baked.id}: ${baked.inventory.bread} bread waiting` };
      const round = s.walkers.find(w => w.kind === 'distributor');
      if (round) out.links['bread-basket'] = { tile: round.position, note: `distributor ${round.id} on its round` };
      if (previous !== null) {
        const fed = s.houses.find(house => house.residents > 0 && house.breadStock > (previous[house.buildingId] ?? Infinity));
        if (fed) { const b = s.buildings.find(x => x.id === fed.buildingId); if (b) out.links['roof-smoke'] = { tile: { tx: b.tx, ty: b.ty }, note: `house ${b.id}: bread ${previous[b.id]} -> ${fed.breadStock}` }; }
      }
      return out;
    }, previousBread);
    previousBread = hit.bread;
    const fresh = links.filter(link => found[link] === undefined && hit.links[link] !== undefined);
    if (fresh.length === 0) continue;
    // Pause on this very sample (the pause seal: Space would press a focused card button), crop each link, run on.
    await page.getByRole('button', { name: '일시 정지', exact: true }).click().catch(() => undefined);
    await page.mouse.move(1270, 460); await page.waitForTimeout(250); // off the map: no hover card over the shot
    for (const link of fresh) {
      const at = await page.evaluate(tile => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), hit.links[link].tile);
      const clip = { x: Math.round(Math.max(0, Math.min(1280 - 480, at.clientX - 240))), y: Math.round(Math.max(0, Math.min(800 - 340, at.clientY - 200))), width: 480, height: 340 };
      const file = `chain-${links.indexOf(link) + 1}-${link}.jpg`;
      await writeFile(join(outDir, file), await page.screenshot({ type: 'jpeg', quality: 80, clip }));
      // Where the link is in the shot (scripts/install7Annotate.py rings it).
      found[link] = { file, tick: hit.tick, note: hit.links[link].note, mark: { x: Math.round(at.clientX - clip.x), y: Math.round(at.clientY - clip.y) } };
    }
    await page.getByRole('button', { name: '5배속', exact: true }).click().catch(() => undefined);
  }
  rows.push({ chain: found, missing: links.filter(link => found[link] === undefined) });
  await context.close();
}
await browser.close();
await writeFile(join(outDir, 'captures.json'), JSON.stringify(rows, null, 1) + '\n');
console.log(JSON.stringify(rows.at(-1)));
