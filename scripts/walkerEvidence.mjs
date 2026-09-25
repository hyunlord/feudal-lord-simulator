// V2 walker composer captures (gates 3 and 4). Runs against a Vite dev server of this checkout (--url) and, for the
// before shots, of the trunk before V2 (--base). Paused, walkers shown.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/walkerEvidence.mjs <outDir> --base <url> [--url ...]
// Scenes (docs/verification/v2-walkers/scene/, from scripts/walkerLookEvidence.ts): the C3 seed 2 city run without
// input to its first summer (tick 349,000) and winter (tick 351,000) sample.
//  - streets: the market / mill quarter (48,36) at zoom 2, before (legacy actors) and after (composed looks), summer
//    and winter; the looks on screen are written next to the shots.
//  - cells: composed looks read back from the composer (window proof port walkerComposite): the 32 cells (4 body
//    templates x 4 directions x 2 gait frames) with a held prop, and the winter cloak on / off.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4281/';
const ROOT = resolve(new URL('..', import.meta.url).pathname);
const load = async path => JSON.parse(gunzipSync(await readFile(join(ROOT, path))).toString('utf8'));
const CLIP = { x: 240, y: 100, width: 800, height: 600 };

const ready = page => page.waitForFunction(() => {
  const d = window.__FEUDAL_PHASE10_PROOF__.diagnosis();
  const walkerImages = d.walkers?.images ?? [];
  return (d.boundary === undefined || d.boundary === null || d.boundary.assets.every(a => a.status === 'ready'))
    && walkerImages.every(image => image.status !== 'loading');
}, null, { timeout: 60_000 }).then(() => page.waitForTimeout(2_500));

await mkdir(outDir, { recursive: true });
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const rows = [];
for (const season of ['summer', 'winter']) {
  const state = await load(`docs/verification/v2-walkers/scene/seed2-${season}.json.gz`);
  for (const [label, base] of [...(flags.base ? [['before', flags.base]] : []), ['after', url]]) {
    const { context, page } = await openScene(browser, { state, tile: [48, 35], baseUrl: base, dpr: 1, zoom: 2, run: false });
    await ready(page); await page.mouse.move(640, 790); await page.waitForTimeout(400);
    const file = `street-${season}-z2.00-${label}.jpg`;
    await writeFile(join(outDir, file), await page.screenshot({ type: 'jpeg', quality: 78, clip: CLIP }));
    const looks = label === 'after' ? await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.walkerLooks()) : null;
    const stats = label === 'after' ? await page.evaluate(() => { const { keys, images, ...rest } = window.__FEUDAL_PHASE10_PROOF__.diagnosis().walkers; return { ...rest, keys }; }) : null;
    rows.push({ file, season, tick: state.tick, tile: [48, 35], zoom: 2, build: base, looks, composer: stats });
    await context.close();
  }
}

// Composed cells, read back from the composer of this build.
const { context, page } = await openScene(browser, { state: await load('docs/verification/v2-walkers/scene/seed2-summer.json.gz'), tile: [48, 35], baseUrl: url, dpr: 1, zoom: 2, run: false });
await ready(page);
const sheets = [
  ['wk_labor_m_01', 'tool_hammer', 'civilian man template'], ['wk_servant_f_01', 'jug', 'civilian woman template'],
  ['wk_merchant_m_01', 'loaf', 'merchant template'], ['wk_priest_m_01', 'loaf', 'cleric template'],
  ['wk_textile_f_02', 'bundle_wool', 'civilian woman template'], ['wk_artisan_m_02', 'tool_axe', 'civilian man template'],
  ['wk_poor_m_01', 'bundle_cloth', 'civilian man template'], ['legacy_carter', 'loaf', 'legacy carter'],
];
const cloaks = [['wk_labor_m_01', 'male'], ['wk_servant_f_01', 'female'], ['wk_gentry_f_01', 'female'], ['legacy_carter', 'male'], ['legacy_builder', 'male']];
const urls = await page.evaluate(async ({ sheets, cloaks }) => {
  const proof = window.__FEUDAL_PHASE10_PROOF__;
  const read = async (...args) => { for (let i = 0; i < 100; i += 1) { const value = proof.walkerComposite(...args); if (value !== null) return value; await new Promise(r => setTimeout(r, 50)); } return null; };
  const props = []; for (const [sheet, prop] of sheets) props.push(await read(sheet, prop, null));
  const winter = []; for (const [sheet, cloak] of cloaks) winter.push([await read(sheet, null, null), await read(sheet, null, cloak)]);
  return { props, winter };
}, { sheets, cloaks });
// Enlarged contact sheets: 3x nearest, cells laid out as composed (NE SE SW NW x frame 0 / 1).
const sheetImage = await page.evaluate(async ({ props, winter, labels, cloakLabels }) => {
  const loadImage = src => new Promise(resolve => { const image = new Image(); image.onload = () => resolve(image); image.src = src; });
  const draw = async (entries, columns, rowLabels) => {
    const images = await Promise.all(entries.map(loadImage));
    const w = images[0].width, h = images[0].height, S = 3, gap = 8, labelH = 18;
    const canvas = document.createElement('canvas');
    canvas.width = columns * (w * S + gap); canvas.height = Math.ceil(images.length / columns) * (h * S + gap + labelH);
    const context = canvas.getContext('2d'); context.fillStyle = '#d8d4c6'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = false; context.font = '13px sans-serif'; context.fillStyle = '#222';
    images.forEach((image, index) => {
      const x = (index % columns) * (w * S + gap), y = Math.floor(index / columns) * (h * S + gap + labelH);
      context.fillText(rowLabels[index] ?? '', x + 4, y + 13);
      context.drawImage(image, x, y + labelH, w * S, h * S);
    });
    return canvas.toDataURL('image/jpeg', 0.85);
  };
  return { props: await draw(props, 2, labels), winter: await draw(winter.flat(), 2, cloakLabels) };
}, { ...urls, labels: sheets.map(([sheet, prop, template]) => `${sheet} + ${prop} (${template})`),
  cloakLabels: cloaks.flatMap(([sheet]) => [`${sheet} summer`, `${sheet} winter cloak`]) });
for (const [name, data] of Object.entries(sheetImage)) {
  const file = `cells-${name}.jpg`;
  await writeFile(join(outDir, file), Buffer.from(data.split(',')[1], 'base64'));
  rows.push({ file, source: name === 'props' ? sheets : cloaks, build: url });
}
await context.close();
await browser.close();
await writeFile(join(outDir, 'captures.json'), `${JSON.stringify({ walkers: 'shown', paused: true, rows }, null, 2)}\n`);
