// Zone brush evidence (C1b), real mouse input only (no state edits from the script).
//   play: gate 1 run on a seed 2 natural snapshot: paint plots along a curved road, preview a house inside and
//         outside, paint arable outside the wall and place a wheat farm, try arable inside the wall, paint pasture
//         and orchard. Eight JPEG captures + a step log with timings.
//   perf: gate 3 on the 24-lot town at 1x speed: paint for ~20 s (strokes of ~2 s, 60 moves/s) while collecting every
//         frame's frameWorkMs from the proof port, plus long tasks (> 50 ms) seen by the page.
//   PLAYWRIGHT_MODULE=/abs/playwright-core/index.mjs node scripts/zoneBrushEvidence.mjs play <outDir> --snapshot <state.json> [--url http://127.0.0.1:4200/]
//   PLAYWRIGHT_MODULE=... node scripts/zoneBrushEvidence.mjs perf <out.json> [--url ...]
//   board: gate 2 + 4 in the browser (software raster): the C25 board without and with zones at zoom 0.6/1.0/1.35 x
//         DPR 1/2, each drawn on two fresh pages, and the zoned board also rebuilt from tiles in reverse order.
//   PLAYWRIGHT_MODULE=... node scripts/zoneBrushEvidence.mjs board <out.json> [--url ...]
//   freshness: chunk cache after zone edits (software raster): paint plots, then a stroke that grows the same zone, then
//         compare the live frame with the frame after every chunk raster is dropped and redrawn.
//   PLAYWRIGHT_MODULE=... node scripts/zoneBrushEvidence.mjs freshness <out.json> [--url ...]
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadChromium, openScene, sceneStates } from './renderCommitProbe.mjs';

const [mode, target] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const url = flags.url ?? 'http://127.0.0.1:4200/';

const client = (page, tx, ty) => page.evaluate(([tx, ty]) => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint({ tx, ty }), [tx, ty]);
const zones = page => page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().zones);
const buildings = page => page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.snapshot().buildings.length + window.__FEUDAL_PHASE10_PROOF__.snapshot().constructionSites.length);
async function drag(page, points) {
  let p = await client(page, ...points[0]); await page.mouse.move(p.clientX, p.clientY); await page.mouse.down();
  for (const q of points.slice(1)) { p = await client(page, ...q); await page.mouse.move(p.clientX, p.clientY, { steps: 4 }); }
  return async () => page.mouse.up();
}
/** Middle-button drags until the tile is well inside the view (the player's own camera move). */
async function panTo(page, tx, ty) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const p = await client(page, tx, ty);
    if (p.clientX > 300 && p.clientX < 980 && p.clientY > 220 && p.clientY < 460) return;
    const dx = Math.max(-480, Math.min(480, p.clientX - 640)); const dy = Math.max(-260, Math.min(260, p.clientY - 380));
    await page.mouse.move(640, 380); await page.mouse.down({ button: 'middle' });
    await page.mouse.move(640 - dx, 380 - dy, { steps: 8 }); await page.mouse.up({ button: 'middle' });
    await page.waitForTimeout(150);
  }
}
async function hover(page, tx, ty) { const p = await client(page, tx, ty); await page.mouse.move(p.clientX, p.clientY); await page.waitForTimeout(300); }
async function openZoneTool(page, kind) {
  await page.getByRole('button', { name: '구역', exact: true }).click();
  await page.locator(`[data-zone-tool="${kind}"]`).click();
}
async function openBuildTool(page, category, label) {
  await page.getByRole('button', { name: category, exact: true }).click();
  await page.getByRole('button', { name: label, exact: true }).first().click();
}
const predictionText = page => page.evaluate(() => [...document.querySelectorAll('.prediction-panel, [class*="prediction"]')].map(node => node.textContent?.trim()).filter(Boolean).join(' | '));

async function play(outDir) {
  await mkdir(outDir, { recursive: true });
  const snapshot = JSON.parse(await readFile(flags.snapshot, 'utf8'));
  const plan = JSON.parse(await readFile(join(outDir, 'plan.json'), 'utf8'));
  const chromium = await loadChromium();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const { page } = await openScene(browser, { state: snapshot, tile: plan.camera, baseUrl: url, dpr: 1, zoom: 1.2, run: false });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const started = Date.now(); const log = [];
  const step = async (name, action) => { const t0 = Date.now(); const note = await action(); log.push({ step: name, ms: Date.now() - t0, atS: Math.round((Date.now() - started) / 1000), ...(note ?? {}) }); console.log(JSON.stringify(log.at(-1))); };
  const shot = async name => { await page.waitForTimeout(350); const jpeg = await page.screenshot({ type: 'jpeg', quality: 78 }); await writeFile(join(outDir, `${name}.jpg`), jpeg); return jpeg.length; };

  await step('1 plots: brush along the curved road (captured mid-stroke)', async () => {
    await openZoneTool(page, 'burgage');
    await panTo(page, ...plan.camera);
    const release = await drag(page, plan.plotStroke);
    const bytes = await shot('01-plot-brush-preview');
    await release();
    return { capture: '01-plot-brush-preview.jpg', bytes, prediction: await predictionText(page) };
  });
  const offCanvas = async () => { await page.mouse.move(640, 790); await page.waitForTimeout(150); };
  await step('2 plots appear', async () => {
    await panTo(page, plan.plotStroke[Math.floor(plan.plotStroke.length / 2)][0], plan.plotStroke[Math.floor(plan.plotStroke.length / 2)][1]);
    await offCanvas();
    const bytes = await shot('02-plots-painted');
    return { capture: '02-plots-painted.jpg', bytes, zones: await zones(page) };
  });
  await step('3 house inside a plot: preview', async () => {
    await page.keyboard.press('Escape');
    await openBuildTool(page, '주택', '오두막');
    await panTo(page, ...plan.houseInside);
    await hover(page, ...plan.houseInside);
    const bytes = await shot('03-house-inside-plot');
    return { capture: '03-house-inside-plot.jpg', bytes, prediction: await predictionText(page) };
  });
  await step('3b house inside a plot: place', async () => {
    const before = await buildings(page);
    const p = await client(page, ...plan.houseInside); await page.mouse.click(p.clientX, p.clientY);
    await page.waitForTimeout(300);
    return { placed: (await buildings(page)) - before };
  });
  await step('4 house outside the plots: preview is refused', async () => {
    await panTo(page, ...plan.houseOutside);
    await hover(page, ...plan.houseOutside);
    const bytes = await shot('04-house-outside-refused');
    const before = await buildings(page);
    const p = await client(page, ...plan.houseOutside); await page.mouse.click(p.clientX, p.clientY);
    await page.waitForTimeout(300);
    return { capture: '04-house-outside-refused.jpg', bytes, prediction: await predictionText(page), placed: (await buildings(page)) - before };
  });
  await step('5 arable outside the wall', async () => {
    await page.keyboard.press('Escape');
    await openZoneTool(page, 'arable');
    await panTo(page, ...plan.arableOutside[0]);
    const release = await drag(page, plan.arableOutside); await release();
    await offCanvas();
    const bytes = await shot('05-arable-outside-wall');
    return { capture: '05-arable-outside-wall.jpg', bytes, zones: await zones(page) };
  });
  await step('6 wheat farm inside the arable zone', async () => {
    await page.keyboard.press('Escape');
    await openBuildTool(page, '생산', '밀밭');
    await panTo(page, ...plan.farmInside);
    await hover(page, ...plan.farmInside);
    const bytes = await shot('06-wheat-farm-in-arable');
    const before = await buildings(page);
    const p = await client(page, ...plan.farmInside); await page.mouse.click(p.clientX, p.clientY);
    await page.waitForTimeout(300);
    return { capture: '06-wheat-farm-in-arable.jpg', bytes, prediction: await predictionText(page), placed: (await buildings(page)) - before };
  });
  await step('7 arable inside the wall is refused (captured mid-stroke)', async () => {
    await page.keyboard.press('Escape');
    await openZoneTool(page, 'arable');
    const before = await zones(page);
    await panTo(page, ...plan.arableInside[0]);
    const release = await drag(page, plan.arableInside);
    const bytes = await shot('07-arable-inside-wall-refused');
    const prediction = await predictionText(page);
    await release();
    await page.waitForTimeout(300);
    return { capture: '07-arable-inside-wall-refused.jpg', bytes, prediction, zonesBefore: before.list.length, zonesAfter: (await zones(page)).list.length };
  });
  await step('8 pasture and orchard fills', async () => {
    await openZoneTool(page, 'pasture');
    await panTo(page, ...plan.pasture[0]);
    let release = await drag(page, plan.pasture); await release();
    await openZoneTool(page, 'orchard');
    await panTo(page, ...plan.orchard[0]);
    release = await drag(page, plan.orchard); await release();
    await panTo(page, (plan.pasture[0][0] + plan.orchard[0][0]) / 2, (plan.pasture[0][1] + plan.orchard[0][1]) / 2);
    await page.keyboard.press('Escape');
    await offCanvas();
    const bytes = await shot('08-pasture-orchard');
    return { capture: '08-pasture-orchard.jpg', bytes, zones: await zones(page) };
  });
  await browser.close();
  const result = { url, snapshot: flags.snapshot, tick: snapshot.tick, wall: snapshot.palisade === null ? null : { completed: snapshot.palisade.segments.filter(s => s.completed).length, segments: snapshot.palisade.segments.length },
    totalSeconds: Math.round((Date.now() - started) / 1000), log, errors };
  await writeFile(join(outDir, 'play-log.json'), `${JSON.stringify(result, null, 2)}\n`);
}

async function perf(out) {
  const chromium = await loadChromium(); const states = await sceneStates();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const { page } = await openScene(browser, { state: states.lots24, tile: [45, 37], baseUrl: url, dpr: 1, zoom: 1, run: true });
  await page.evaluate(() => {
    window.__zoneLongTasks = [];
    new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__zoneLongTasks.push(entry.duration); }).observe({ entryTypes: ['longtask'] });
  });
  // --idle 1: same pointer path with the tool armed but no button held (the no-paint baseline).
  const idle = flags.idle === '1';
  await openZoneTool(page, 'burgage');
  const frames = []; let seen = (await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().work.frameCount));
  const collect = async () => {
    const work = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().work);
    const fresh = Math.min(work.frameCount - seen, work.frameWorkMs.length);
    frames.push(...work.frameWorkMs.slice(work.frameWorkMs.length - fresh));
    seen = work.frameCount;
  };
  const viewport = page.viewportSize();
  let strokes = 0; const perStroke = [];
  const strokeCount = Number(flags.strokes ?? 10);
  for (let stroke = 0; stroke < strokeCount; stroke += 1) {
    // Strokes sweep across open ground around the town; each ~2 s at 60 moves/s.
    const y0 = 120 + stroke * 55;
    await page.mouse.move(80, y0); if (!idle) await page.mouse.down();
    for (let step = 0; step < 120; step += 1) {
      await page.mouse.move(80 + step * ((viewport.width - 160) / 120), y0 + Math.sin(step / 8) * 30);
      await page.waitForTimeout(16);
      if (step % 40 === 39) await collect();
    }
    if (!idle) await page.mouse.up(); strokes += 1;
    const before = frames.length;
    await page.waitForTimeout(200); await collect();
    const scene = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().boundary?.scene ?? null);
    perStroke.push({ stroke, maxFrameAfterRelease: Math.max(0, ...frames.slice(before)), sceneBuildMs: scene?.lastBuildMs ?? null, sceneBuilds: scene?.builds ?? null });
  }
  await collect();
  const longTasks = await page.evaluate(() => window.__zoneLongTasks);
  const zonesAfter = await zones(page);
  await browser.close();
  const sorted = [...frames].sort((a, b) => a - b);
  const pick = q => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] ?? null;
  const result = { url, city: 'lots24', dpr: 1, speed: '1x', painting: !idle, strokes, frames: frames.length,
    frameWork: { median: pick(0.5), p95: pick(0.95), max: sorted.at(-1) ?? null }, longTasks: { count: longTasks.length, max: Math.max(0, ...longTasks) },
    zones: zonesAfter.list.length, parcels: zonesAfter.parcels, perStroke };
  console.log(JSON.stringify(result));
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify(result, null, 2)}\n`);
}

async function board(out) {
  const chromium = await loadChromium(); const states = await sceneStates();
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  const png = page => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => done(document.querySelector('canvas').toDataURL('image/png'))))));
  const sha = data => createHash('sha256').update(Buffer.from(data.split(',')[1], 'base64')).digest('hex');
  const open = async (state, zoom, dpr) => {
    const opened = await openScene(browser, { state, tile: [44, 38], baseUrl: url, dpr, zoom, run: false, query: '&render-boundary-v2=1' });
    await opened.page.waitForFunction(() => { const d = window.__FEUDAL_PHASE10_PROOF__.diagnosis(); return d.boundary?.assets.every(a => a.status === 'ready') && d.zones.assets.every(a => a.status !== 'loading'); }, null, { timeout: 60_000 });
    await opened.page.waitForTimeout(1_000);
    return opened;
  };
  const rows = [];
  for (const [name, state] of [['c25', states.seed2], ['c25-zoned', states.c25zoned]]) for (const zoom of [0.6, 1, 1.35]) for (const dpr of [1, 2]) {
    const first = await open(state, zoom, dpr);
    const forward = sha(await png(first.page));
    let reversed = null;
    if (name === 'c25-zoned') {
      await first.page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.resetBoundary(true)); await first.page.waitForTimeout(500);
      reversed = sha(await png(first.page));
    }
    await first.context.close();
    const second = await open(state, zoom, dpr);
    const again = sha(await png(second.page));
    await second.context.close();
    rows.push({ board: name, view: `z${zoom.toFixed(2)}-dpr${dpr}`, sha256: forward, secondPage: again, ...(reversed === null ? {} : { reversedInput: reversed }),
      identical: forward === again && (reversed === null || reversed === forward) });
    console.log(JSON.stringify(rows.at(-1)));
  }
  await browser.close();
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify({ url, raster: 'software (--disable-gpu)', rows }, null, 2)}\n`);
}

async function freshness(out) {
  const chromium = await loadChromium(); const states = await sceneStates();
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu'] });
  const rows = [];
  for (const dpr of [1, 2]) {
    const { context, page } = await openScene(browser, { state: states.seed2, tile: [40, 44], baseUrl: url, dpr, zoom: 1, run: false, query: '&render-boundary-v2=1' });
    await page.waitForFunction(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().boundary?.assets.every(a => a.status === 'ready'), null, { timeout: 60_000 });
    const png = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => done(document.querySelector('canvas').toDataURL('image/png'))))));
    const sha = data => createHash('sha256').update(Buffer.from(data.split(',')[1], 'base64')).digest('hex');
    await openZoneTool(page, 'burgage');
    const road = [[36, 39], [37, 40], [38, 41], [39, 42], [39, 43], [40, 44], [41, 45], [42, 46]].map(([x, y]) => [x - 1.3, y + 1.3]);
    let release = await drag(page, road); await release();
    await page.waitForTimeout(400);
    release = await drag(page, [[42.5, 49], [44, 49]]); await release();
    await page.keyboard.press('Escape'); await page.mouse.move(640, 790);
    await page.waitForTimeout(800);
    const rasters = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().boundary?.chunks ?? null);
    const liveData = await png(); const live = sha(liveData);
    await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.resetBoundary(false)); await page.waitForTimeout(800);
    const freshData = await png(); const fresh = sha(freshData);
    if (flags.dump !== undefined && live !== fresh) {
      await writeFile(`${flags.dump}-dpr${dpr}-live.png`, Buffer.from(liveData.split(',')[1], 'base64'));
      await writeFile(`${flags.dump}-dpr${dpr}-fresh.png`, Buffer.from(freshData.split(',')[1], 'base64'));
    }
    const zones = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().zones.list);
    rows.push({ dpr, live, afterDroppingEveryRaster: fresh, identical: live === fresh, zones, chunkStatsBeforeReset: rasters });
    console.log(JSON.stringify({ dpr, identical: live === fresh, zones }));
    await context.close();
  }
  await browser.close();
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify({ url, raster: 'software (--disable-gpu)', rows }, null, 2)}\n`);
}

if (mode === 'play') await play(target);
else if (mode === 'freshness') await freshness(target);
else if (mode === 'board') await board(target);
else if (mode === 'perf') await perf(target);
else throw new Error('Usage: zoneBrushEvidence.mjs play <outDir> --snapshot <state.json> | perf <out.json> | board <out.json>');
