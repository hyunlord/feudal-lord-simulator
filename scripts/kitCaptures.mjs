// INSTALL-11 evidence: scripts/kitScene.ts (six kit sizes x four stages, a stone wall site with a corner per stage),
// trunk (--base: the common four-stage art) vs this build (--url: the family kits), paused.
//  - row views at zoom 1.0 (timber small / medium + stone medium; stone large + church + keep) and the whole lineup
//    at 0.6 (the families must still tell apart at the frame and roof stages);
//  - the church at its frame stage at 1.35 (treadwheel crane, hoisted block, centring arch, mortar, the mason);
//  - the stone wall sites (the tower kit at each corner turn).
//   PLAYWRIGHT_MODULE=... node scripts/kitCaptures.mjs <outDir> --url <this> --base <trunk>
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const state = JSON.parse(gunzipSync(await readFile('docs/verification/install11/scene/kits.json.gz')).toString('utf8'));
const placed = JSON.parse(await readFile('docs/verification/install11/scene/kits-placed.json', 'utf8'));
const at = (kind, stage) => { const p = placed.find(entry => entry.kind === kind && entry.stage === stage); return [p.tx, p.ty]; };
const WIDTH = 1440, HEIGHT = 900;
const views = [
  { name: 'row1-z1', tile: ((t) => [t[0] + 3, t[1] - 3])(at('farmstead', 1)), zoom: 1, clip: { x: 0, y: 110, width: 1180, height: 680 } },
  { name: 'row2-z1', tile: ((t) => [t[0] + 3, t[1] - 3])(at('church', 1)), zoom: 1, clip: { x: 0, y: 110, width: 1180, height: 680 } },
  { name: 'all-z06', tile: at('church', 0), zoom: 0.6 },
  { name: 'church-frame-z135', tile: at('church', 2), zoom: 1.35, walkers: true },
  { name: 'walls-z1', tile: at('stone_wall', 1), zoom: 1 },
];
// Two builders on the church frame so the mason shows (walkers are presentation; the scene has none of its own).
const church = state.constructionSites.find(site => site.kind === 'church' && site.builderTicks / site.requiredBuilderTicks > 0.6 && site.builderTicks / site.requiredBuilderTicks < 0.8);
const builders = [0, 1].map(index => ({ id: `kit-builder-${index}`, kind: 'builder', siteId: church.id, slotIndex: index, homeBuildingId: '',
  position: { tx: church.tx + 2 + index * 0.4, ty: church.ty + 1.6 - index * 0.8 }, path: [{ tx: church.tx + 2, ty: church.ty + 1 }, { tx: church.tx + 2, ty: church.ty + 2 }],
  pathIndex: 0, previousTile: null, cargo: null, spawnedTick: 0 }));
await mkdir(outDir, { recursive: true });
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const view of views) {
  for (const [label, url] of [['before', flags.base], ['after', flags.url]]) {
    const scene = view.walkers ? { ...state, walkers: builders } : state;
    const { context, page } = await openScene(browser, { state: scene, tile: view.tile, baseUrl: url, width: WIDTH, height: HEIGHT, dpr: 1, zoom: view.zoom, run: false });
    await page.waitForTimeout(3_000); await page.mouse.move(WIDTH - 4, HEIGHT / 2); await page.waitForTimeout(300);
    await writeFile(join(outDir, `${view.name}-${label}.jpg`), await page.screenshot({ type: 'jpeg', quality: 74, clip: view.clip ?? { x: 220, y: 110, width: 1000, height: 680 } }));
    await context.close();
  }
}
await browser.close();
console.log(views.map(view => view.name).join(' '));
