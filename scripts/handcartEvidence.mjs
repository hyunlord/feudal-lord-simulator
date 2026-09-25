// TOUCH-1 item 0: are there handcarts without a carter in the V2 winter capture? Runs against a Vite dev server of
// this checkout, paused, walkers shown:
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/handcartEvidence.mjs <outDir> [--url http://127.0.0.1:4291/]
// Scene: docs/verification/v2-walkers/scene/seed2-winter.json.gz at tile (48,35), zoom 2, DPR 2 (the V2 street shot).
//  - full.jpg: the whole 1280x800 view. Drawn on it: the V2 capture clip (390,200 500x375 CSS px, yellow), and each
//    carter's foot point (green inside the clip, red outside) with its handcart direction.
//  - carters.jpg: every carter cut out around its own foot point (220x210 device px), so cart and carter are seen whole.
//  - carters.json: per carter id, foot point, direction, sheet, cloak, inside / outside the V2 clip.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4291/';
const ROOT = new URL('..', import.meta.url).pathname;
const CLIP = { x: 390, y: 200, width: 500, height: 375 };
const state = JSON.parse(gunzipSync(await readFile(join(ROOT, 'docs/verification/v2-walkers/scene/seed2-winter.json.gz'))).toString('utf8'));

await mkdir(outDir, { recursive: true });
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const { context, page } = await openScene(browser, { state, tile: [48, 35], baseUrl: url, dpr: 2, zoom: 2, run: false });
await page.waitForFunction(() => (window.__FEUDAL_PHASE10_PROOF__.diagnosis().walkers?.images ?? []).every(image => image.status !== 'loading'), null, { timeout: 60_000 });
await page.waitForTimeout(2500); await page.mouse.move(640, 790); await page.waitForTimeout(400);
const shot = (await page.screenshot({ type: 'png' })).toString('base64');
const carters = await page.evaluate(() => {
  const proof = window.__FEUDAL_PHASE10_PROOF__;
  const looks = new Map(proof.walkerLooks().map(look => [look.id, look]));
  return proof.state().walkers.filter(walker => walker.kind === 'carter').map(walker => {
    // Foot point: the walker's tile centre (fractional position) plus the walker foot offset of walkerVisualAnchor.
    const point = proof.tileClientPoint({ tx: walker.position.tx, ty: walker.position.ty });
    const look = looks.get(walker.id);
    return { id: walker.id, tx: walker.position.tx, ty: walker.position.ty, x: point.clientX, y: point.clientY, sheet: look.sheetId, cloak: look.cloak, prop: look.prop };
  });
});
for (const carter of carters) carter.insideV2Clip = carter.x >= CLIP.x && carter.x < CLIP.x + CLIP.width && carter.y >= CLIP.y && carter.y < CLIP.y + CLIP.height;
const images = await page.evaluate(async ({ shot, carters, CLIP }) => {
  const image = await new Promise(resolve => { const i = new Image(); i.onload = () => resolve(i); i.src = `data:image/png;base64,${shot}`; });
  const S = image.width / 1280;
  const full = document.createElement('canvas'); full.width = image.width; full.height = image.height;
  const f = full.getContext('2d'); f.drawImage(image, 0, 0);
  f.lineWidth = 4; f.strokeStyle = '#f2d23c'; f.strokeRect(CLIP.x * S, CLIP.y * S, CLIP.width * S, CLIP.height * S);
  f.font = `${12 * S}px sans-serif`;
  carters.forEach((carter, index) => {
    f.strokeStyle = f.fillStyle = carter.insideV2Clip ? '#2fdc4a' : '#ff3b30';
    f.beginPath(); f.arc(carter.x * S, carter.y * S, 7 * S, 0, Math.PI * 2); f.stroke(); f.fillText(String(index + 1), carter.x * S + 9 * S, carter.y * S);
  });
  const W = 220, H = 210, columns = 5;
  const gallery = document.createElement('canvas'); gallery.width = columns * W; gallery.height = Math.ceil(carters.length / columns) * H;
  const g = gallery.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, gallery.width, gallery.height); g.font = '12px sans-serif';
  carters.forEach((carter, index) => {
    const x = (index % columns) * W, y = Math.floor(index / columns) * H;
    g.drawImage(image, carter.x * S - W / 2, carter.y * S - 150, W, H, x, y, W, H);
    g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(x, y, W, 16); g.fillStyle = carter.insideV2Clip ? '#2fdc4a' : '#ff8a80';
    g.fillText(`${index + 1} ${carter.sheet} ${carter.cloak ?? '-'}`, x + 3, y + 12);
  });
  return { full: full.toDataURL('image/jpeg', 0.8), gallery: gallery.toDataURL('image/jpeg', 0.85) };
}, { shot, carters, CLIP });
await writeFile(join(outDir, 'handcart-full.jpg'), Buffer.from(images.full.split(',')[1], 'base64'));
await writeFile(join(outDir, 'handcart-carters.jpg'), Buffer.from(images.gallery.split(',')[1], 'base64'));
await writeFile(join(outDir, 'handcart-carters.json'), `${JSON.stringify({ url, scene: 'seed2-winter', clip: CLIP, carters }, null, 2)}\n`);
await context.close(); await browser.close();
console.log(JSON.stringify(carters.map((c, i) => [i + 1, c.sheet, c.cloak, c.insideV2Clip, Math.round(c.x), Math.round(c.y)])));
