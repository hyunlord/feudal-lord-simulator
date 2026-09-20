import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const task = flags.task ?? 'A';
const sourceRoot = resolve(flags['source-root'] ?? '.');
const variant = flags.variant ?? 'before';
const dpr = Number(flags.dpr ?? 1);
const condition = flags.condition ?? 'paused';
if (!['A', 'C', 'E'].includes(task) || !['before', 'after'].includes(variant) || ![1, 2].includes(dpr) || !['paused', 'running', 'drag'].includes(condition)) throw new Error('Invalid benchmark flags');
const statePath = flags.state ?? 'tests/fixtures/phase16-city.json.gz';
const bytes = await readFile(statePath);
const source = statePath.endsWith('.gz') ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8');
const state = JSON.parse(source);
const stateSha256 = createHash('sha256').update(source).digest('hex');
const output = resolve(flags.output ?? 'output/phase16');
await mkdir(output, { recursive: true });
const playwright = flags.playwright ?? process.env.PLAYWRIGHT_MODULE ?? 'playwright-core';
const { chromium } = await import(playwright.startsWith('/') ? pathToFileURL(playwright).href : playwright);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const zoom = Number(flags.zoom ?? 1);
const camera = { zoom, panX: 800, panY: 500 - 1440 * zoom };
const rounds = [];
const cameraChecks = [];
const errors = [];
try {
  for (let round = 0; round < (flags['capture-only'] === 'true' ? 1 : 4); round++) {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1100 }, deviceScaleFactor: dpr });
    page.on('pageerror', error => errors.push(error.message));
    await page.routeWebSocket('**', socket => socket.close());
    await page.route('**/src/state/gameStore.ts*', async route => {
      const response = await route.fetch();
      const text = await response.text();
      if (!text.includes('useState(DEFAULT_GAME_STATE)')) throw new Error('State injection anchor changed');
      await route.fulfill({ response, body: text.replace('useState(DEFAULT_GAME_STATE)', `useState(${source})`) });
    });
    await page.route('**/src/render/canvasRuntime.ts*', async route => {
      const response = await route.fetch();
      const text = await response.text();
      if (!text.includes('function cameraForStartingHouse(canvas, state) {')) throw new Error('Camera injection anchor changed');
      await route.fulfill({ response, body: text.replace('function cameraForStartingHouse(canvas, state) {', `function cameraForStartingHouse(canvas, state) { return ${JSON.stringify(camera)};`) });
    });
    await page.goto((flags.url ?? 'http://127.0.0.1:3226/') + '?phase10-proof=1');
    if (await page.locator('.welcome-dismiss-layer').count()) await page.locator('.welcome-dismiss-layer').click();
    await page.keyboard.press('Escape');
    if (await page.locator('.settlement-progress[open]').count()) await page.locator('.settlement-progress summary').click();
    await page.mouse.move(800, 950);
    if (condition !== 'paused') await page.getByRole('button', { name: '1배속', exact: true }).click();
    await page.waitForTimeout(1500);
    const actualCamera = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.diagnosis().camera);
    if (actualCamera.zoom !== camera.zoom) throw new Error('Camera zoom mismatch');
    const beforeTick = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.snapshot().tick);
    if (condition === 'paused' && beforeTick !== state.tick) throw new Error('Paused state advanced unexpectedly');
    const beforePoint = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint({tx:45,ty:45}));
    if (Math.abs(beforePoint.clientX - 800) > .01 || Math.abs(beforePoint.clientY - 500) > .01) throw new Error('Actual initial camera anchor mismatch');
    if (flags['capture-only'] === 'true') {
      await page.screenshot({ path: `${output}/${task}-${variant}-dpr${dpr}-zoom${camera.zoom}.jpg`, type: 'jpeg', quality: 85 });
      await page.close();
      break;
    }
    const frames = await page.evaluate(async ({ drag }) => {
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('Canvas missing');
      if (drag) canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 1, buttons: 4, clientX: 700, clientY: 450 }));
      return new Promise((resolveFrames, rejectFrames) => {
        const samples = [];
        let last;
        let start;
        function frame(now) {
          start ??= now;
          if (last !== undefined) samples.push(now - last);
          last = now;
          if (drag) {
            const delta = 200 - Math.abs((((now - start) * .2 + 200) % 800) - 400);
            canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, button: 1, buttons: 4, clientX: 700 + delta, clientY: 450 }));
            const point = window.__FEUDAL_PHASE10_PROOF__.tileClientPoint({tx:45,ty:45});
            if (Math.abs(delta) > 5 && (Math.abs(point.clientX - (800 + delta)) > 1.01 || Math.abs(point.clientY - 500) > .01)) {
              rejectFrames(new Error('Actual camera diverged from 200 CSS px/s drag trajectory')); return;
            }
          }
          if (samples.length === 40) {
            if (drag) window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 1, clientX: 700, clientY: 450 }));
            resolveFrames(samples);
          } else requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
    }, { drag: condition === 'drag' });
    const afterTick = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.snapshot().tick);
    if (condition === 'paused' && afterTick !== beforeTick) throw new Error('Paused state advanced while sampling');
    const afterPoint = await page.evaluate(() => window.__FEUDAL_PHASE10_PROOF__.tileClientPoint({tx:45,ty:45}));
    cameraChecks.push({before:beforePoint,after:afterPoint,beforeTick,afterTick});
    if (Math.abs(afterPoint.clientY - beforePoint.clientY) > .01) throw new Error('Camera clamped vertically during horizontal drag');
    if (condition === 'drag' && Math.abs(afterPoint.clientX - beforePoint.clientX) < 1) throw new Error('Drag did not move the real game camera');
    rounds.push(frames);
    if (round === 0) await page.screenshot({ path: `${output}/${task}-${variant}-dpr${dpr}-${condition}.jpg`, type: 'jpeg', quality: 85 });
    await page.close();
  }
  if (flags['capture-only'] === 'true') { await browser.close(); process.exit(0); }
  const samples = rounds.slice(1).flat().sort((a, b) => a - b);
  const result = { task, variant, dpr, condition, browser: browser.version(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: sourceRoot }).trim(), sourceDiffSha256: createHash('sha256').update(execFileSync('git', ['diff', 'HEAD'], {cwd:sourceRoot})).digest('hex'), stateSha256, population: state.houses.reduce((n, h) => n + h.residents, 0), camera, viewport: { width: 1600, height: 1100 }, dragPixelsPerSecond: condition === 'drag' ? 200 : 0, warmupRoundDiscarded: true, cameraChecks, median: samples[Math.floor(samples.length / 2)], p95: samples[Math.floor(samples.length * .95)], rounds, errors };
  await writeFile(`${output}/${task}-${variant}-dpr${dpr}-${condition}.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, rounds: undefined }));
  if (errors.length) process.exitCode = 1;
} finally { await browser.close(); }
