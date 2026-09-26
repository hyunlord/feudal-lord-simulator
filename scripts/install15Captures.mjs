// INSTALL-15 evidence (gates 2 and 3), JPEG, and one JSON of what each capture showed.
//   PLAYWRIGHT_MODULE=... node scripts/install15Captures.mjs <out-dir> --url <url> --states <dir from scripts/install15States.ts>
//  2 the same place in four seasons (the C25 zoned board: fields, pasture, orchard, forest edge, road, lake and wall),
//    at zoom 1.0 and 0.6, paused, once every season image has loaded; a close view of the winter ground (drifts at the
//    fence, ice, frost) and of spring (flowers, petals, blossom); the falling leaves and the first snow.
//  3 the season turn at 1x (autumn to winter, then winter to spring): every frame from a second before the turn to two
//    seconds after, downsampled in the page (160 x 100), is compared with the one before it. A cut would put the whole
//    change into one frame; a crossfade spreads it. Recorded per turn: the largest one-frame share of the total change,
//    frames with empty ground (canvas background showing), the chunk cache's fades and deferred rasters, and three
//    shots (just before, mid-fade, after).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadChromium, openScene } from './renderCommitProbe.mjs';

const [out] = process.argv.slice(2);
const flag = name => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag('url') ?? 'http://127.0.0.1:4282/';
const statesDir = flag('states');
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const QUERY = '&story-delay=600000';
const CENTRE = [36, 41];
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const result = { url, errors: [], seasons: {}, closeups: {}, fx: {}, turns: {} };
const load = name => JSON.parse(readFileSync(join(statesDir, `${name}.json`), 'utf8'));
const shot = (page, file, clip) => page.screenshot({ path: join(out, file), type: 'jpeg', quality: 72, ...(clip ? { clip } : {}) });
const seasonArtReady = page => page.waitForFunction(() => {
  const art = window.__FEUDAL_PHASE10_PROOF__?.diagnosis().boundary?.seasonArt ?? [];
  return art.length === 65 && art.every(entry => entry.status === 'ready');
}, null, { timeout: 30_000 }).then(() => true).catch(() => false);
async function scene(name, { zoom = 1, run = false, tile = CENTRE } = {}) {
  const opened = await openScene(browser, { state: load(name), tile, baseUrl: url, width: 1280, height: 800, zoom, run, initScript: TUTORIAL_OFF, query: QUERY });
  opened.page.on('pageerror', error => result.errors.push(`${name}: ${String(error)}`));
  return opened;
}

// 2: four seasons, two zooms.
for (const season of ['spring', 'summer', 'autumn', 'winter']) {
  for (const zoom of [1, 0.6]) {
    const { context, page } = await scene(`season-${season}`, { zoom });
    const ready = await seasonArtReady(page);
    await page.waitForTimeout(600);
    await shot(page, `season-${season}-z${zoom.toFixed(1)}.jpg`);
    result.seasons[`${season}-z${zoom.toFixed(1)}`] = { ready, tick: await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.state().tick) };
    await context.close();
  }
}
// Close views: winter ground (fence drifts, ice, frost) and spring (flowers, petals, blossom).
for (const [key, name, tile] of [['winter-ground', 'season-winter', [40, 44]], ['spring-orchard', 'season-spring', [32, 41]]]) {
  const { context, page } = await scene(name, { zoom: 1.6, tile });
  await seasonArtReady(page); await page.waitForTimeout(600);
  await shot(page, `closeup-${key}.jpg`, { x: 240, y: 150, width: 800, height: 500 });
  result.closeups[key] = { state: name };
  await context.close();
}
// Season effects: the first quarter of autumn (leaves at the forest edge) and of winter (snowfall).
for (const [key, name] of [['leaves', 'fx-leaves'], ['snow', 'fx-snow']]) {
  const { context, page } = await scene(name, { zoom: 1.3 });
  await seasonArtReady(page); await page.waitForTimeout(800);
  await shot(page, `fx-${key}.jpg`);
  result.fx[key] = { state: name };
  await context.close();
}

// 3: the turn at 1x.
// In-page sampler (downsampled 160 x 100 each frame): per frame after the turn, the change from the frame before; the
// frame just before the turn and the latest frame (for the total change); frames with see-through canvas (no ground).
const SAMPLE = `window.__I15__ = { frames: 0, turnAt: null, season: null, steps: [], empty: 0, fades0: null, fades: 0, deferred0: null, deferred: 0, ticks: [] };
  (() => { const small = document.createElement('canvas'); small.width = 160; small.height = 100; const paint = small.getContext('2d', { willReadFrequently: true });
    let previous = null; let before = null;
    const diff = (a, b) => { let sum = 0; for (let i = 0; i < a.length; i += 4) sum += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return sum; };
    const frame = () => { const canvas = document.querySelector('canvas'); const port = window.__FEUDAL_PHASE10_PROOF__; const s = window.__I15__;
      if (canvas && port && window.__I15_ON__) { paint.clearRect(0, 0, 160, 100); paint.drawImage(canvas, 0, 0, 160, 100); const data = paint.getImageData(0, 0, 160, 100).data;
        const tick = port.state().tick; const season = Math.floor(((tick % 4000) * 4) / 4000);
        const chunks = port.diagnosis().boundary?.chunks ?? {};
        if (s.season !== null && season !== s.season && s.turnAt === null) { s.turnAt = s.frames; before = previous; s.fades0 = chunks.fades ?? 0; s.deferred0 = chunks.deferredContent ?? 0; }
        s.season = season; s.frames += 1; s.ticks.push(tick);
        let seeThrough = 0; for (let i = 3; i < data.length; i += 4) if (data[i] < 250) seeThrough += 1;
        if (seeThrough > 160) s.empty += 1;
        if (s.turnAt !== null && previous !== null) s.steps.push(diff(previous, data));
        if (before !== null) s.total = diff(before, data);
        s.fades = chunks.fades ?? 0; s.deferred = chunks.deferredContent ?? 0;
        previous = data; }
      requestAnimationFrame(frame); }; requestAnimationFrame(frame); })();`;
for (const [key, name] of [['autumn-winter', 'turn-autumn-winter'], ['winter-spring', 'turn-winter-spring']]) {
  const opened = await openScene(browser, { state: load(name), tile: CENTRE, baseUrl: url, width: 1280, height: 800, zoom: 1, run: false, initScript: `${TUTORIAL_OFF};${SAMPLE}`, query: QUERY });
  const { context, page } = opened;
  page.on('pageerror', error => result.errors.push(`${name}: ${String(error)}`));
  await seasonArtReady(page); await page.waitForTimeout(400);
  await page.evaluate(() => { window.__I15_ON__ = true; });
  await page.getByRole('button', { name: '1배속', exact: true }).click();
  await page.waitForFunction(() => window.__I15__.turnAt !== null, null, { timeout: 20_000 }).catch(() => undefined);
  await shot(page, `turn-${key}-1-start.jpg`);
  await page.waitForTimeout(500);
  await shot(page, `turn-${key}-2-mid.jpg`);
  await page.waitForTimeout(1_700);
  await shot(page, `turn-${key}-3-after.jpg`);
  const data = await page.evaluate(() => { window.__I15_ON__ = false; const s = window.__I15__; return { ...s, ticks: [s.ticks[0], s.ticks.at(-1)] }; });
  const total = data.total ?? 0; const largest = Math.max(0, ...data.steps);
  result.turns[key] = { frames: data.frames, turnFrame: data.turnAt, ticks: data.ticks, totalChange: total, largestStepShare: total === 0 ? null : Math.round(largest / total * 1000) / 1000,
    largestStepAt: data.steps.indexOf(largest), framesWithEmptyGround: data.empty, fades: data.fades - (data.fades0 ?? data.fades), deferredContent: data.deferred - (data.deferred0 ?? data.deferred),
    noFlicker: data.turnAt !== null && total > 0 && largest / total <= 0.25 && data.empty === 0 };
  await context.close();
}
await browser.close();
writeFileSync(join(out, 'install15-captures.json'), JSON.stringify(result, null, 1) + '\n');
console.log(JSON.stringify(result, null, 1));
