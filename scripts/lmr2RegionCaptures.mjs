// LM-R2 (region): the lord screen's region map in the browser, on the DGX, from the lord2 states (scripts/lmr2States.ts,
// ~/fls-lmr2-states) — lord-components-region's 캡처 관문 (docs/ops/install-plan-20261003/SPECS/lord-components-region.md):
//  - the lord screen's menu: the person, house and estate items and the region item, each item's icon (lord.nav.<id>);
//    an item with no screen built is disabled with its reason;
//  - the map picture loaded on demand (not requested before the region screen opens) at 1600 × 1000;
//  - one capture of each site picture (manor, market, mill; the abbey is held: no engine estate is a religious house);
//  - a direct, a delegated and a neighbour flag chosen (inherited: the home, the inherited estate given to its steward, the
//    first neighbour; attention-overloaded: the inherited estate taken direct), each chosen estate's line under the map;
//  - the arms only on a flag's empty base (a separate layer): every arms layer sits inside its flag's base, and the old
//    lord's house (no arms in the engine, offer-countered) keeps its base empty;
//  - the world visible behind the panel (the town canvas to its left);
//  - the map's zoom apart from the town's (the town camera's zoom unchanged by the map's zoom steps);
//  - labels ≥ 12 px at the fitted scale; touch targets ≥ 44 px (48 on the tablet); 1024 × 768, the tablet, DPR 2;
//  - a map picture that fails: the plain map with the estates on it, one request, no reload.
//   scripts/remote/run.sh render-LMR2-region-<sha7> -- bash scripts/lmr2RegionCaptures.sh
//   (PLAYWRIGHT_MODULE=… node_modules/.bin/tsx scripts/lmr2RegionCaptures.mjs <out> --url <url> --states <dir>)
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 확인(scripts/lmr2RegionCaptures.mjs)", { remote: "scripts/remote/run.sh render-LMR2-region-<sha7> -- bash scripts/lmr2RegionCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4300/';
const scene = name => JSON.parse(readFileSync(join(flags.states, `${name}.json`), 'utf8'));
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const houseTile = state => { const house = state.buildings.find(b => b.kind === 'house') ?? state.buildings[0]; return [house.tx, house.ty]; };
const PANEL = '.slot-panel.lord-screen';
const MAP = 'lord-components-region/map_region_1600x1000.png';
mkdirSync(out, { recursive: true });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let bytes = 0;
const shots = {};
const shoot = async (page, selector, name, quality = 45) => {
  const path = join(out, `${name}.jpg`);
  if (selector === null) await page.screenshot({ path, type: 'jpeg', quality });
  else await page.locator(selector).first().screenshot({ path, type: 'jpeg', quality });
  const size = statSync(path).size; bytes += size; shots[name] = size; return size;
};
const open = (state, options = {}) => openScene(browser, { state, tile: houseTile(state), baseUrl: url, run: false, initScript: INIT, width: 1280, height: 800,
  query: '&story-delay=600000', loadTimeout: 90_000, zoom: 1.1, ...options });
const mapRequests = page => page.evaluate(map => performance.getEntriesByType('resource').filter(entry => entry.name.includes(map)).length, MAP);
const townZoom = page => page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().camera.zoom);
/** Dock → ledger → lord tab → the way in; then the region item. */
async function openRegion(page) {
  for (const selector of ["[data-dock='ledger']", "[data-ledger-tab='lord']", '[data-lord-open]']) { await page.locator(selector).first().click(); await page.waitForTimeout(400); }
  const before = await mapRequests(page);
  await page.locator("[data-lord-nav='region']").first().click();
  const art = await page.locator(".lord-region-map[data-region-map='art']").first().waitFor({ timeout: 20_000 }).then(() => true, () => false);
  await page.locator(".lord-region-site[data-region-art='art']").first().waitFor({ timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(600);
  return { mapRequestsBefore: before, art };
}
/** What the screen shows: the menu, the panel's box, the map, each estate's marker, the chosen line, the smallest text. */
const read = page => page.evaluate(async ({ panel, map }) => {
  const root = document.querySelector(panel);
  const box = element => { const rect = element.getBoundingClientRect(); return { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width), height: Math.round(rect.height) }; };
  const canvas = root.querySelector('.lord-region-canvas');
  const background = canvas === null ? null : getComputedStyle(canvas).backgroundImage.match(/url\("?([^")]+)"?\)/)?.[1] ?? null;
  const loaded = background === null ? null : await new Promise(done => { const image = new Image(); image.onload = () => done([image.naturalWidth, image.naturalHeight]); image.onerror = () => done('error'); image.src = background; });
  const inside = (inner, outer) => inner.left >= outer.left - 0.5 && inner.top >= outer.top - 0.5 && inner.left + inner.width <= outer.left + outer.width + 0.5 && inner.top + inner.height <= outer.top + outer.height + 0.5;
  const markers = [...root.querySelectorAll('.lord-region-site')].map(button => {
    const flag = button.querySelector('.lord-region-flag-art'); const arms = button.querySelector('.lord-region-arms'); const site = button.querySelector('.lord-region-site-art');
    const label = button.querySelector('.lord-region-label');
    const urlOf = element => element === null ? null : getComputedStyle(element).backgroundImage.match(/url\("?([^")]+)"?\)/)?.[1]?.split('/').pop() ?? null;
    return { estate: button.getAttribute('data-region-estate'), flag: button.getAttribute('data-region-flag'), site: button.getAttribute('data-region-site'), chosen: button.getAttribute('aria-pressed'),
      siteArt: urlOf(site), flagArt: urlOf(flag), arms: arms === null ? null : arms.getAttribute('data-region-arms'), armsDrawn: arms?.querySelector('img') !== null && arms !== null,
      armsOnFlag: arms === null || flag === null ? null : inside(arms.getBoundingClientRect(), flag.getBoundingClientRect()),
      box: box(button), label: label?.textContent ?? null, labelPx: label === null ? null : parseFloat(getComputedStyle(label).fontSize) };
  });
  const texts = [...root.querySelectorAll('*')].filter(el => el.checkVisibility?.() !== false && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim() !== ''));
  const targets = [...root.querySelectorAll('.lord-region button, .lord-screen-nav-item')].filter(el => el.getBoundingClientRect().width > 0).map(el => { const rect = el.getBoundingClientRect(); return Math.round(Math.min(rect.width, rect.height)); });
  const nav = [...root.querySelectorAll('.lord-screen-nav-item')].map(item => ({ id: item.getAttribute('data-lord-nav'), disabled: item.disabled, icon: item.querySelector('.lord-screen-nav-icon') !== null,
    iconUrl: item.querySelector('.lord-screen-nav-icon') === null ? null : getComputedStyle(item.querySelector('.lord-screen-nav-icon')).backgroundImage.split('/').pop()?.replace(/["')]/g, '') ?? null,
    reason: item.querySelector('.lord-screen-nav-reason')?.textContent ?? null, current: item.getAttribute('aria-current') }));
  const panelBox = box(root);
  const world = document.querySelector('canvas');
  return { panel: panelBox, view: [innerWidth, innerHeight], inside: panelBox.left >= 0 && panelBox.top >= 0 && panelBox.left + panelBox.width <= innerWidth && panelBox.top + panelBox.height <= innerHeight,
    worldLeftOfPanel: world === null ? 0 : Math.max(0, Math.min(world.getBoundingClientRect().right, panelBox.left) - Math.max(0, world.getBoundingClientRect().left)),
    map: root.querySelector('.lord-region-map')?.getAttribute('data-region-map') ?? null, canvas: canvas === null ? null : box(canvas), background: background?.split('/').pop() ?? null, loaded,
    zoom: root.querySelector('.lord-region')?.getAttribute('data-region-zoom') ?? null, markers, nav,
    chosen: root.querySelector('.lord-region-chosen')?.getAttribute('data-region-chosen') ?? null,
    rows: [...root.querySelectorAll('.lord-region-row')].map(row => [row.getAttribute('data-region-row'), row.querySelector('dd')?.textContent ?? '']),
    note: root.querySelector('.lord-region-note')?.textContent ?? null,
    smallestText: Math.min(...texts.map(el => parseFloat(getComputedStyle(el).fontSize))), smallestTarget: Math.min(...targets),
    primaries: root.querySelectorAll('.lord-region .ui-btn--primary').length, titles: root.querySelectorAll('[title]').length };
}, { panel: PANEL, map: MAP });
const choose = async (page, estate) => { await page.locator(`.lord-region-site[data-region-estate='${estate}']`).first().click(); await page.waitForTimeout(400); return read(page); };
const rows = {};
const NO_SCREEN = ['character', 'dynasty', 'council', 'petitions', 'military'];

// 1. inherited, 1280 × 800: the menu, the map on demand, the world behind, the three flags chosen, the arms, the zoom, each site.
{
  const { context, page } = await open(scene('inherited'));
  const opened = await openRegion(page);
  const first = await read(page);
  await shoot(page, null, 'region-inherited-1280x800', 50);
  await shoot(page, '.lord-screen-nav', 'menu', 50);
  const chosen = {};
  for (const [flag, estate] of [['direct', 'estate-home'], ['delegated', 'estate-neighbour-3'], ['neighbour', 'estate-neighbour-1']]) {
    const shown = await choose(page, estate);
    chosen[flag] = { estate, chosen: shown.chosen, flag: shown.markers.find(marker => marker.estate === estate)?.flag ?? null, rows: shown.rows };
    await shoot(page, '.lord-region', `chosen-${flag}`, 45);
  }
  const zoomBefore = await townZoom(page);
  await page.locator("[data-region-zoom-step='full']").first().click(); await page.waitForTimeout(700);
  const full = await read(page);
  const zoomAfter = await townZoom(page);
  await shoot(page, '.lord-region-map', 'zoom-full', 45);
  const sites = {};
  for (const site of ['manor', 'market', 'mill']) {
    const marker = page.locator(`.lord-region-site[data-region-site='${site}']`).first();
    await marker.scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
    await shoot(page, `.lord-region-site[data-region-site='${site}']`, `site-${site}`, 60);
    sites[site] = full.markers.filter(entry => entry.site === site).map(entry => ({ estate: entry.estate, siteArt: entry.siteArt, flag: entry.flag, flagArt: entry.flagArt, arms: entry.arms, armsOnFlag: entry.armsOnFlag }));
  }
  await page.locator("[data-region-zoom-step='half']").first().click(); await page.waitForTimeout(500);
  const half = await read(page);
  await page.locator("[data-region-zoom-step='fit']").first().click(); await page.waitForTimeout(500);
  const fit = await read(page);
  rows.inherited = { opened, first: { panel: first.panel, worldLeftOfPanel: first.worldLeftOfPanel, map: first.map, background: first.background, loaded: first.loaded, nav: first.nav,
    markers: first.markers, smallestText: first.smallestText, smallestTarget: first.smallestTarget, primaries: first.primaries, titles: first.titles },
    mapRequestsAfter: await mapRequests(page), chosen, zoom: { town: [zoomBefore, zoomAfter], canvas: { fit: fit.canvas?.width, half: half.canvas?.width, full: full.canvas?.width } },
    sites, armsAll: full.markers.map(marker => [marker.estate, marker.arms, marker.armsOnFlag, marker.armsDrawn]) };
  const nav = Object.fromEntries(first.nav.map(item => [item.id, item]));
  rows.inherited.ok = opened.art && opened.mapRequestsBefore === 0 && rows.inherited.mapRequestsAfter >= 1 && Array.isArray(first.loaded) && first.loaded[0] === 1600 && first.loaded[1] === 1000
    && first.worldLeftOfPanel >= 264 && first.inside !== false
    && nav.region?.disabled === false && nav.region?.current === 'page' && NO_SCREEN.every(id => nav[id]?.disabled === true && (nav[id]?.reason ?? '') !== '')
    && first.nav.every(item => item.id === 'ledger' || (item.icon && item.iconUrl === `nav_${item.id}_40x40.png`))
    && chosen.direct.flag === 'direct' && chosen.delegated.flag === 'delegated' && chosen.neighbour.flag === 'neighbour'
    && Object.values(chosen).every(entry => entry.chosen === entry.estate) && chosen.delegated.rows.some(([key]) => key === 'steward')
    && zoomBefore === zoomAfter && fit.canvas.width < half.canvas.width && half.canvas.width === 800 && full.canvas.width === 1600
    && ['manor', 'market', 'mill'].every(site => sites[site].length > 0 && sites[site].every(entry => entry.siteArt === `map_${site}_96x96.png`))
    && full.markers.every(marker => marker.arms === null || (marker.armsOnFlag === true && marker.flagArt !== null))
    && first.markers.every(marker => marker.labelPx >= 12) && first.smallestText >= 12 && first.smallestTarget >= 44 && first.primaries === 0 && first.titles === 0;
  console.log(`${rows.inherited.ok ? 'ok ' : 'BAD'} inherited: ${JSON.stringify({ opened, world: first.worldLeftOfPanel, loaded: first.loaded, chosen: Object.fromEntries(Object.entries(chosen).map(([k, v]) => [k, v.flag])), zoom: rows.inherited.zoom, text: first.smallestText, target: first.smallestTarget })}`);
  await context.close();
}
// 2. attention-overloaded: the inherited estate taken direct (an off-map estate with the direct flag).
{
  const { context, page } = await open(scene('attention-overloaded'));
  const opened = await openRegion(page);
  const shown = await choose(page, 'estate-neighbour-3');
  await shoot(page, '.lord-region', 'chosen-direct-offmap', 45);
  const marker = shown.markers.find(entry => entry.estate === 'estate-neighbour-3');
  rows.overloaded = { opened, marker, rows: shown.rows, ok: opened.art && marker?.flag === 'direct' && marker.flagArt === 'flag_direct_64x96.png' && shown.chosen === 'estate-neighbour-3' };
  console.log(`${rows.overloaded.ok ? 'ok ' : 'BAD'} overloaded: ${JSON.stringify({ flag: marker?.flag, art: marker?.flagArt })}`);
  await context.close();
}
// 3. offer-countered: the old lord's estate a neighbour's, its house without arms — its flag's base stays empty.
{
  const { context, page } = await open(scene('offer-countered'));
  const opened = await openRegion(page);
  await page.locator("[data-region-zoom-step='full']").first().click(); await page.waitForTimeout(700);
  const shown = await read(page);
  await page.locator(".lord-region-site[data-region-estate='estate-neighbour-3']").first().scrollIntoViewIfNeeded();
  await shoot(page, ".lord-region-site[data-region-estate='estate-neighbour-3']", 'flag-empty-base', 60);
  await shoot(page, ".lord-region-site[data-region-estate='estate-neighbour-1']", 'flag-neighbour-arms', 60);
  const old = shown.markers.find(entry => entry.estate === 'estate-neighbour-3');
  rows.emptyBase = { opened, markers: shown.markers.map(entry => [entry.estate, entry.flag, entry.flagArt, entry.arms]),
    ok: opened.art && old?.flag === 'neighbour' && old.flagArt === 'flag_neighbor_64x96.png' && old.arms === null
      && shown.markers.filter(entry => entry.estate !== 'estate-neighbour-3').every(entry => entry.arms !== null && entry.armsOnFlag === true) };
  console.log(`${rows.emptyBase.ok ? 'ok ' : 'BAD'} empty base: ${JSON.stringify(rows.emptyBase.markers)}`);
  await context.close();
}
// 4. neighbour-suit: a neighbour's estate keeps the neighbour's flag over the pieces the lord won of it.
{
  const { context, page } = await open(scene('neighbour-suit'));
  const opened = await openRegion(page);
  const shown = await choose(page, 'estate-neighbour-1');
  await shoot(page, '.lord-region-chosen', 'neighbour-suit-line', 50);
  rows.neighbourSuit = { opened, rows: shown.rows, ok: opened.art && shown.markers.find(entry => entry.estate === 'estate-neighbour-1')?.flag === 'neighbour' && shown.rows.some(([key]) => key === 'lordPieces') };
  console.log(`${rows.neighbourSuit.ok ? 'ok ' : 'BAD'} neighbour-suit: ${JSON.stringify(shown.rows)}`);
  await context.close();
}
// 5. The small view, the tablet (touch), DPR 2.
for (const [name, options, minTarget] of [['1024x768', { width: 1024, height: 768 }, 44], ['tablet', { width: 1180, height: 820, hasTouch: true }, 48], ['dpr2', { dpr: 2 }, 44]]) {
  const { context, page } = await open(scene('inherited'), options);
  const opened = await openRegion(page);
  const shown = await read(page);
  await shoot(page, name === 'dpr2' ? '.lord-region-map' : null, `region-${name}`, name === 'dpr2' ? 40 : 45);
  const overlaps = shown.markers.flatMap((a, i) => shown.markers.slice(i + 1).filter(b => a.box.left < b.box.left + b.box.width && b.box.left < a.box.left + a.box.width && a.box.top < b.box.top + b.box.height && b.box.top < a.box.top + a.box.height).map(b => [a.estate, b.estate]));
  rows[name] = { opened, panel: shown.panel, inside: shown.inside, world: shown.worldLeftOfPanel, smallestText: shown.smallestText, smallestTarget: shown.smallestTarget, overlaps,
    ok: opened.art && shown.inside && shown.worldLeftOfPanel >= 264 && shown.smallestText >= 12 && shown.smallestTarget >= minTarget && overlaps.length === 0 };
  console.log(`${rows[name].ok ? 'ok ' : 'BAD'} ${name}: ${JSON.stringify(rows[name])}`);
  await context.close();
}
// 6. The map picture fails: the plain map, the estates still on it and choosable, one request, no reload.
{
  const { context, page } = await open(scene('inherited'));
  let requests = 0;
  await page.route(`**/${MAP}`, route => { requests += 1; return route.fulfill({ status: 404, body: '' }); });
  for (const selector of ["[data-dock='ledger']", "[data-ledger-tab='lord']", '[data-lord-open]', "[data-lord-nav='region']"]) { await page.locator(selector).first().click(); await page.waitForTimeout(400); }
  await page.locator('.lord-region-note').first().waitFor({ timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(3_000);
  const shown = await choose(page, 'estate-neighbour-3');
  await shoot(page, '.lord-region', 'map-missing', 40);
  rows.missing = { requests, map: shown.map, note: shown.note, markers: shown.markers.length, chosen: shown.chosen,
    ok: shown.map === 'plain' && shown.note !== null && shown.markers.length === 4 && shown.chosen === 'estate-neighbour-3' && requests <= 1 };
  console.log(`${rows.missing.ok ? 'ok ' : 'BAD'} missing map: ${JSON.stringify(rows.missing)}`);
  await context.close();
}
await browser.close();
const ok = Object.values(rows).every(row => row.ok) && bytes <= 1_000_000;
writeFileSync(join(out, 'captures.json'), JSON.stringify({ url, ok, bytes, shots, held: { map_abbey: 'no engine estate is a religious house (EstateKind manor | market_town | mill_estate | fishery); LM-E10' }, rows }, null, 1) + '\n');
console.log(JSON.stringify({ ok, bytes }));
if (!ok) process.exitCode = 1;
