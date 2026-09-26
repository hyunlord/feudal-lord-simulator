// Footprint lineup captures (render fix R0-2): scripts/footprintScene.ts in the browser, paused, zoom 1 (and 1.35 per
// row), with every building's footprint diamond drawn over the screenshot in red (the camera is the one openScene
// sets, so a tile's screen point is known exactly). `--label before|after` names the files.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/footprintCaptures.mjs <outDir> --url <url> --label after
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [outDir] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4251/';
const label = flags.label ?? 'after';
const state = JSON.parse(gunzipSync(await readFile('docs/verification/r0-render-fixes/scene/lineup.json.gz')).toString('utf8'));
const placed = JSON.parse(await readFile('docs/verification/r0-render-fixes/scene/lineup-placed.json', 'utf8'));
const WIDTH = 1440, HEIGHT = 900;
const views = [{ name: 'lineup', tile: [22, 22], zoom: 1 }];
await mkdir(outDir, { recursive: true });
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
for (const view of views) {
  const { context, page } = await openScene(browser, { state, tile: view.tile, baseUrl: url, width: WIDTH, height: HEIGHT, dpr: 1, zoom: view.zoom, run: false });
  await page.waitForTimeout(3_000); await page.mouse.move(WIDTH - 4, HEIGHT - 4); await page.waitForTimeout(300);
  const raw = join(outDir, `${view.name}-${label}.png`);
  await writeFile(raw, await page.screenshot({ type: 'png' }));
  await context.close();
  const camera = { zoom: view.zoom, panX: WIDTH / 2 - (view.tile[0] - view.tile[1]) * 32 * view.zoom, panY: HEIGHT / 2 - (view.tile[0] + view.tile[1]) * 16 * view.zoom };
  execFileSync('python3', ['-c', `
import json, sys
from PIL import Image, ImageDraw
camera = json.loads(sys.argv[2]); placed = json.loads(open(sys.argv[3]).read())
im = Image.open(sys.argv[1]).convert('RGB'); draw = ImageDraw.Draw(im)
def to(tx, ty):
    return ((tx - ty) * 32 * camera['zoom'] + camera['panX'], (tx + ty) * 16 * camera['zoom'] + camera['panY'])
for p in placed:
    tx, ty, w, h = p['tx'] - 0.5, p['ty'] - 0.5, p['width'], p['height']
    poly = [to(tx, ty), to(tx + w, ty), to(tx + w, ty + h), to(tx, ty + h)]
    draw.line(poly + [poly[0]], fill=(220, 30, 30), width=2)
    x, y = to(tx + w / 2, ty + h)
    draw.text((x - 40, y + 30), p['label'], fill=(255, 255, 255))
im.save(sys.argv[4], quality=80)
`, raw, JSON.stringify(camera), 'docs/verification/r0-render-fixes/scene/lineup-placed.json', join(outDir, `${view.name}-${label}.jpg`)]);
  execFileSync('rm', [raw]);
}
await browser.close();
console.log(views.map(view => `${view.name}-${label}.jpg`).join(' '));
