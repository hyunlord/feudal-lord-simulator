// INSTALL-5c captures: before (--base, the trunk) / after (--url, this build), paused, 600 x 450 CSS px around the view's
// centre. Walls and water: seed fixtures (renderFixtureStates), walkers hidden. Street: the market-day scene written by
// scripts/ageBandWalkerEvidence.ts (the resident walkers shown, centred on its first child).
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/install5cEvidence.mjs <outDir> --base <url> [--url ...]
// Writes <view>-before.jpg / <view>-after.jpg and captures.json (the views, their tiles and sources).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadChromium, openScene, sceneStates } from './renderCommitProbe.mjs';

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4213/';
const load = async path => JSON.parse(gunzipSync(await readFile(path)).toString('utf8'));
const ready = page => page.waitForFunction(() => {
  const d = window.__FEUDAL_PHASE10_PROOF__.diagnosis();
  return d.boundary === undefined || d.boundary === null || d.boundary.assets.every(a => a.status === 'ready');
}, null, { timeout: 60_000 }).then(() => page.waitForTimeout(2_000));
const CLIP = { x: 340, y: 175, width: 600, height: 450 };

const states = await sceneStates();
const seed5 = await load('docs/verification/install5c/scene/seed5.json.gz');
const children = await load('docs/verification/install5c/scene/marketday-children.json.gz');
const child = JSON.parse(await readFile('docs/verification/install5c/age-band-walkers.json', 'utf8')).sceneChild;
const views = [
  // The fixtures' only straight-run stone gates (both NW-SE); the other 8 of 10 stand on a 90 degree bend (no axis),
  // where trunk and this build draw the masonry fallback. The NE-SW fit is shown by gateFitSheet below.
  { name: 'gate-seed2-nwse', state: states.seed2, tile: [53, 26], zoom: 2, source: 'seed 2 final: the straight NW-SE stone gate at (53, 26), gate v3 NW-SE painting' },
  { name: 'gate-seed5-nwse', state: seed5, tile: [40, 1.5], zoom: 2, source: 'seed 5 final: the straight NW-SE stone gate at (40, 0) on the map edge' },
  { name: 'pillar-seed2-south', state: states.seed2, tile: [52, 47.5], zoom: 2, source: 'seed 2 final: 135 degree pillars at (50, 48) left turn b, (51, 47) right turn c, (55, 47) left turn b' },
  { name: 'pillar-seed3-north', state: states.seed3, tile: [9.5, 2.5], zoom: 2, source: 'seed 3 final: 135 degree pillars at (7, 2) and (12, 2), both left turn b' },
  { name: 'water-seed2-lake', state: states.seed2, tile: [44, 38], zoom: 1, source: 'seed 2 final, the C25 board: lake shallow fill d / e beside the deep water' },
  { name: 'street-children', state: children, tile: [child.tx, child.ty], zoom: 3, walkers: true, source: `C3 seed 2 city, market day (tick ${children.tick}): a child beside its adult (${child.id})` },
];
await mkdir(outDir, { recursive: true });
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = [];
for (const view of views) {
  for (const [label, base] of [['before', flags.base], ['after', url]]) {
    const { context, page } = await openScene(browser, { state: view.walkers ? view.state : { ...view.state, walkers: [] }, tile: view.tile, baseUrl: base, dpr: 1, zoom: view.zoom, run: false });
    await ready(page); await page.mouse.move(640, 790); await page.waitForTimeout(500);
    const file = `${view.name}-${label}.jpg`;
    await writeFile(join(outDir, file), await page.screenshot({ type: 'jpeg', quality: 72, clip: CLIP }));
    rows.push({ file, source: view.source, tile: view.tile, zoom: view.zoom, build: base });
    await context.close();
  }
}
// Gate fit sheet: both axes drawn by the build's own drawRegisteredGate (wall-strip path, stone) on a plain canvas at
// zoom 2, with the passage ends (+-GATE_HALF_CLEARANCE tiles along the axis) ticked in red. Trunk draws gate v2
// (panels, NE-SW mirrored), this build gate v3 (one painting per axis).
for (const [label, base] of [['before', flags.base], ['after', url]]) {
  const { context, page } = await openScene(browser, { state: { ...states.seed2, walkers: [] }, tile: [53, 26], baseUrl: base, dpr: 1, zoom: 2, run: false });
  await ready(page);
  const data = await page.evaluate(async () => {
    const { drawRegisteredGate } = await import('/src/render/gateArtRenderer.ts');
    const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 300;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = '#7d8a5a'; ctx.fillRect(0, 0, 640, 300);
    const nodes = [{ point: { x: 10, y: 10 }, neighbors: [{ x: 9, y: 10 }, { x: 11, y: 10 }], kind: 'gate' }, { point: { x: 10, y: 10 }, neighbors: [{ x: 10, y: 9 }, { x: 10, y: 11 }], kind: 'gate' }];
    nodes.forEach((node, index) => {
      const sx = (node.point.x - node.point.y) * 32, sy = (node.point.x + node.point.y) * 16 - 16; // palisadeScreenPath
      const ox = 160 + index * 320, oy = 190;
      ctx.save(); ctx.translate(ox, oy); ctx.scale(2, 2); ctx.translate(-sx, -sy);
      drawRegisteredGate(ctx, node, 'stone', true);
      ctx.restore();
      const slope = index === 0 ? 0.5 : -0.5;
      ctx.fillStyle = '#c0392b';
      for (const side of [-1, 1]) { const x = ox + side * 0.8 * 32 * 2; ctx.fillRect(x - 2, oy + slope * (x - ox) - 2, 4, 4); }
      ctx.fillStyle = '#ffffff'; ctx.font = '14px sans-serif'; ctx.fillText(index === 0 ? 'NW-SE (descending)' : 'NE-SW (ascending)', ox - 70, 290);
    });
    return canvas.toDataURL('image/jpeg', 0.8);
  });
  await writeFile(join(outDir, `gate-fit-${label}.jpg`), Buffer.from(data.split(',')[1], 'base64'));
  rows.push({ file: `gate-fit-${label}.jpg`, source: 'both gate axes drawn by drawRegisteredGate (stone, wall strips) on a plain canvas, zoom 2; red ticks = passage ends (+-0.8 tile along the axis)', build: base });
  await context.close();
}
await browser.close();
await writeFile(join(outDir, 'captures.json'), JSON.stringify(rows, null, 1) + '\n');
