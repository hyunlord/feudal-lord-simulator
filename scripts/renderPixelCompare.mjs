// Captures paused, fixed-camera canvas frames of repository fixtures, or compares two capture folders pixel by pixel.
// Used to show that a render-only change leaves the picture as it was.
//   capture: PLAYWRIGHT_MODULE=... node scripts/renderPixelCompare.mjs capture <outDir> [--url http://127.0.0.1:4194/] [--gpu off] [--query '&x=1']
//   compare: PLAYWRIGHT_MODULE=... node scripts/renderPixelCompare.mjs compare <beforeDir> <afterDir> [--out result.json]
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadChromium, openScene, sceneStates } from './renderCommitProbe.mjs';

const [mode, first, second] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const SHOTS = [
  { name: 'pop176-village', city: 'pop176', tile: [46, 39] },
  { name: 'newgame-village', city: 'newgame', tile: [45, 41] },
  { name: 'lots24-town', city: 'lots24', tile: [45, 37] },
  // Curved-ground scenes (D1a gate 5: with the flag off the picture is unchanged).
  { name: 'fixed12', city: 'fixed12', tile: [42, 56] },
  { name: 'seed2-town', city: 'seed2', tile: [47, 32] },
];

async function capture(outDir) {
  await mkdir(outDir, { recursive: true });
  const chromium = await loadChromium(); const states = await sceneStates();
  // --gpu off captures with software rendering (--disable-gpu) for comparison.
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: flags.gpu === 'off' ? ['--disable-gpu'] : [] });
  for (const dpr of [1, 2]) for (const shot of SHOTS) {
    // The simulation never starts, so every capture draws the fixture's own tick.
    const { context, page } = await openScene(browser, { state: states[shot.city], tile: shot.tile, baseUrl: flags.url ?? 'http://127.0.0.1:4194/', dpr, run: false, query: flags.query ?? '' });
    await page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().assets.every(asset => asset.status !== 'loading' && asset.status !== 'idle'), null, { timeout: 60_000 });
    await page.waitForTimeout(1_000);
    // The canvas bitmap itself (no DOM chrome), after two more frames of the paused state.
    const dataUrl = await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => done(document.querySelector('canvas').toDataURL('image/png'))))));
    await writeFile(join(outDir, `${shot.name}-dpr${dpr}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
    await context.close();
  }
  await browser.close();
}

async function compare(beforeDir, afterDir) {
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const rows = [];
  for (const file of (await readdir(beforeDir)).filter(name => name.endsWith('.png')).sort()) {
    const [a, b] = await Promise.all([readFile(join(beforeDir, file)), readFile(join(afterDir, file))]);
    rows.push({ file, ...await page.evaluate(async ([left, right]) => {
      const load = async src => { const image = new Image(); image.src = src; await image.decode(); return image; };
      const [l, r] = await Promise.all([load(left), load(right)]);
      const pixels = image => { const canvas = new OffscreenCanvas(image.width, image.height); const context = canvas.getContext('2d'); context.drawImage(image, 0, 0); return context.getImageData(0, 0, image.width, image.height).data; };
      const pa = pixels(l), pb = pixels(r); let differing = 0, maxDelta = 0, over8 = 0;
      for (let index = 0; index < pa.length; index += 4) {
        const delta = Math.max(Math.abs(pa[index] - pb[index]), Math.abs(pa[index + 1] - pb[index + 1]), Math.abs(pa[index + 2] - pb[index + 2]));
        if (delta > 0) differing += 1; if (delta > 8) over8 += 1; maxDelta = Math.max(maxDelta, delta);
      }
      const total = pa.length / 4;
      return { width: l.width, height: l.height, sameSize: l.width === r.width && l.height === r.height, differingPixels: differing, differingShare: differing / total, pixelsOverDelta8: over8, maxChannelDelta: maxDelta };
    }, [`data:image/png;base64,${a.toString('base64')}`, `data:image/png;base64,${b.toString('base64')}`]) });
  }
  await browser.close();
  const out = flags.out ? resolve(flags.out) : null;
  if (out) await writeFile(out, `${JSON.stringify({ before: beforeDir, after: afterDir, rows }, null, 2)}\n`);
  for (const row of rows) console.log(JSON.stringify(row));
}

if (mode === 'capture') await capture(resolve(first));
else if (mode === 'compare') await compare(resolve(first), resolve(second));
else throw new Error('Usage: renderPixelCompare.mjs capture <dir> | compare <before> <after>');
