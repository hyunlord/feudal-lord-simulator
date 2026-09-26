// F0-V captures: before (--base, the trunk) / after (--url, this build), 600 x 450 CSS px around each view's centre.
//  - blockers (gate 2): scripts/visibilityScenes.ts, three sites with no builders / no material in store / a road cut,
//    paused: each plaque carries its blocker icon and line; at zoom 0.6 same-cause neighbours share one icon.
//  - smoke (gate 4): the C3 seed 2 city on a market day (INSTALL-5c evidence scene), running 1x for 3 s: roof smoke
//    over lived-in houses with bread, the mill ovens, carts with their payload.
//  - signs (gate 5): the C25 zoned board (empty plot stakes) and the fixed12 fixture (cold houses, road cuts); at most
//    three emphasis rings.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/visibilityCaptures.mjs <outDir> --base <url> [--url ...]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadChromium, openScene, sceneStates } from './renderCommitProbe.mjs';

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4241/';
const load = async path => JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));
const CLIP = { x: 340, y: 175, width: 600, height: 450 };
const states = await sceneStates();
const views = [
  { name: 'blockers', state: await load('docs/verification/f0v-visible-construction/scene/blockers.json.gz'), tile: [46, 42], zoom: 1.35, run: false, walkers: false, source: 'new game + three sites: no builders (well), no material in store (barn), road cut (storehouse); paused' },
  { name: 'blockers-far', state: await load('docs/verification/f0v-visible-construction/scene/blockers.json.gz'), tile: [46, 42], zoom: 0.6, run: false, walkers: false, source: 'the same scene at zoom 0.6: bars and blocker icons only; the two no-builder sites share one icon with a count' },
  { name: 'smoke-town', state: await load('docs/verification/install5c/scene/marketday-children.json.gz'), tile: [48, 35], zoom: 1, run: true, walkers: true, source: 'C3 seed 2 city, market day, 1x for 3 s: roof smoke, mill ovens, cart payloads' },
  { name: 'signs-zoned', state: states.c25zoned, tile: [38, 44], zoom: 1, run: false, walkers: false, source: 'C25 zoned board (burgage zones): its two empty plots (36,41 and 41,47) carry stakes and emphasis rings' },
  { name: 'signs-cold', state: states.fixed12, tile: [45, 41], zoom: 1, run: false, walkers: false, source: 'fixed12 fixture: four lived-in houses with no bread, no smoke, emphasis rings (at most three)' },
  { name: 'signs-road', state: states.fixed12, tile: [43, 56], zoom: 1, run: false, walkers: false, source: 'fixed12 fixture: two buildings off the road (43,55 and 42,59), footprints toward the nearest road' },
];
await mkdir(outDir, { recursive: true });
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = [];
for (const view of views) {
  for (const [label, base] of [['before', flags.base], ['after', url]]) {
    const { context, page } = await openScene(browser, { state: view.walkers ? view.state : { ...view.state, walkers: [] }, tile: view.tile, baseUrl: base, dpr: 1, zoom: view.zoom, run: view.run });
    await page.waitForTimeout(view.run ? 3_000 : 2_500); await page.mouse.move(640, 790); await page.waitForTimeout(300);
    const file = `${view.name}-${label}.jpg`;
    await writeFile(join(outDir, file), await page.screenshot({ type: 'jpeg', quality: 72, clip: CLIP }));
    rows.push({ file, source: view.source, tile: view.tile, zoom: view.zoom, build: base });
    await context.close();
  }
}
await browser.close();
await writeFile(join(outDir, 'captures.json'), JSON.stringify(rows, null, 1) + '\n');
console.log(rows.map(row => row.file).join(' '));
