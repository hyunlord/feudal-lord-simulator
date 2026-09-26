// Render stage benchmark: the phase19 formal loop (docs/verification/phase19/paired-work-benchmark.mjs: 240 actual
// draws per window, rounds after the first retained, floor(n/2) median, floor(n*0.95) p95) plus the proof-mode
// render stage probe (src/render/renderStageProbe.ts), canvas call counts, visible tiles/objects, world raster
// cache counters, JS heap, and a devtools.timeline trace that separates the canvas rAF from React/scheduler work
// and compositor Commit.
//
// Usage (Vite dev server of a clean checkout running, e.g. `npx vite --host 127.0.0.1 --port 4194 --strictPort`):
//   PLAYWRIGHT_MODULE=/abs/path/playwright-core/index.mjs node scripts/renderStageBenchmark.mjs \
//     --output docs/verification/b11-render-metrics/baseline [--url http://127.0.0.1:4194/] [--matrix b11]
//   Single cell: --city lots24|pop176|newgame --dpr 1|2 --camera still|drag [--cpu 4] [--width 1280 --height 800]
//   --stages 0 measures the same loop with the stage probe off (probe overhead).
// Cities come from repository fixtures only (clean-clone rule), migrated to the current save schema by
// scripts/renderFixtureStates.ts: new game = DEFAULT_GAME_STATE, pop176 = newest fixtures/saves/vN/population-176,
// lots24 = fixtures/determinism/seed1/final-state.json (24 lots, all L4).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { arch, cpus, platform, release } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadChromium, openScene, sceneStates, traceMainThreadSplit } from './renderCommitProbe.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const flags = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => value.startsWith('--') ? [...pairs, [value.slice(2), all[index + 1]]] : pairs, []));
const TILES = { newgame: [45, 41], pop176: [46, 39], pop176turn: [46, 39], lots24: [45, 37] };
const WINDOW = 240;

export const stats = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return { count: values.length, median: sorted[Math.floor(sorted.length / 2)] ?? null, p95: sorted[Math.floor(sorted.length * 0.95)] ?? null,
    mean: values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length };
};

async function measureCell(chromium, states, cell, options) {
  const { city, dpr, camera, cpu = 1, width = 1280, height = 800 } = cell;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const windows = [];
  try {
    for (let round = 0; round < options.rounds; round++) {
      // `story-delay`: UI-4 story modals stop time (the petition pop176 carries opens ~1.5 s in: 0 ticks, a false
      // 38 % p95). Holding the world-first delay past the window keeps time running, as before UI-4; older builds ignore it.
      const { context, page } = await openScene(browser, { state: states[city], tile: TILES[city], baseUrl: options.url, width, height, dpr,
        query: (options.stages ? '' : '&render-stages=0') + '&story-delay=600000' + options.query });
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const cdp = await context.newCDPSession(page);
      await cdp.send('Performance.enable');
      await cdp.send('HeapProfiler.collectGarbage').catch(() => {});
      const heap = async () => (await cdp.send('Performance.getMetrics')).metrics.find(m => m.name === 'JSHeapUsedSize')?.value / 2 ** 20;
      const heapBefore = await heap();
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
      const measured = await page.evaluate(({ drag, cx, cy, windowSize }) => new Promise((done, fail) => {
        const port = window.__FEUDAL_PHASE10_PROOF__; const canvas = document.querySelector('canvas');
        if (!port || !canvas) { fail(new Error('Proof port/canvas missing')); return; }
        if (drag) canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 1, buttons: 4, clientX: cx - 100, clientY: cy - 50 }));
        const timeout = setTimeout(() => fail(new Error('Measurement exceeded 300 seconds')), 300_000);
        let start, last, before, lastTickCount; const raf = []; const ticks = [];
        const frame = now => {
          try {
            if (start === undefined) { start = now; before = port.diagnosis(); lastTickCount = before.work.tickCount; }
            else raf.push(now - last);
            last = now;
            if (drag) {
              const delta = 200 - Math.abs((((now - start) * 0.2 + 200) % 800) - 400);
              canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, button: 1, buttons: 4, clientX: cx - 100 + delta, clientY: cy - 50 }));
            }
            if (raf.length > 0 && raf.length % 40 === 0) {
              const work = port.diagnosis().work; const count = work.tickCount - lastTickCount;
              if (count > 240 || count < 0) throw new Error(`Tick checkpoint overflow: ${count}`);
              if (count) ticks.push(...work.tickWorkMs.slice(-count)); lastTickCount = work.tickCount;
            }
            if (raf.length === windowSize) {
              const after = port.diagnosis();
              const frameCount = after.work.frameCount - before.work.frameCount;
              if (frameCount !== windowSize) throw new Error(`Expected ${windowSize} draws, got ${frameCount}`);
              if (drag) window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 1, clientX: cx, clientY: cy }));
              const stages = after.renderStages;
              clearTimeout(timeout);
              done({ raf, frameWorkMs: after.work.frameWorkMs.slice(-windowSize), tickWorkMs: ticks, tickCount: after.work.tickCount - before.work.tickCount, wallMs: now - start,
                stageFrames: stages === null ? null : stages.frames.slice(-windowSize), stageNames: stages?.stages ?? null, methods: stages?.methods ?? null,
                stageFrameCount: stages === null ? null : stages.frameCount - (before.renderStages?.frameCount ?? 0),
                rasterBefore: before.rasterCache, rasterAfter: after.rasterCache });
            } else requestAnimationFrame(frame);
          } catch (error) { clearTimeout(timeout); fail(error); }
        };
        requestAnimationFrame(frame);
      }), { drag: camera === 'drag', cx: width / 2, cy: height / 2, windowSize: WINDOW });
      const trace = options.trace && round === options.rounds - 1 ? await traceMainThreadSplit(page, 3_000) : null;
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const heapAfter = await heap();
      windows.push({ round, discarded: round === 0, heapBefore, heapAfter, trace, errors, ...measured });
      await context.close();
      console.log(JSON.stringify({ city, dpr, camera, cpu, round, ticks: measured.tickCount, stageFrames: measured.stageFrameCount }));
    }
  } finally { await browser.close(); }
  return summarise(cell, windows);
}

function summarise(cell, windows) {
  const kept = windows.filter(window => !window.discarded);
  const frames = kept.flatMap(window => window.stageFrames ?? []);
  const stageNames = kept[0]?.stageNames ?? [];
  const methods = kept[0]?.methods ?? [];
  const frameWork = kept.flatMap(window => window.frameWorkMs);
  const stageSum = frames.map(frame => frame.stageMs.reduce((a, b) => a + b, 0));
  const sum = values => values.reduce((a, b) => a + b, 0);
  const stages = Object.fromEntries(stageNames.map((name, index) => [name, stats(frames.map(frame => frame.stageMs[index] ?? 0))]));
  const calls = Object.fromEntries(methods.map((method, index) => [method, stats(frames.map(frame => sum(frame.calls.map(row => row[index] ?? 0))))]));
  const callsByStage = Object.fromEntries(stageNames.map((name, stageIndex) => [name, Object.fromEntries(methods.map((method, methodIndex) =>
    [method, frames.length === 0 ? 0 : sum(frames.map(frame => frame.calls[stageIndex]?.[methodIndex] ?? 0)) / frames.length]))]));
  const last = frames.at(-1);
  const raster = kept.map(window => window.rasterAfter && window.rasterBefore ? { hits: window.rasterAfter.hits - window.rasterBefore.hits, misses: window.rasterAfter.misses - window.rasterBefore.misses, rasterMs: window.rasterAfter.rasterMs - window.rasterBefore.rasterMs } : null).filter(Boolean);
  return {
    ...cell,
    frameWork: stats(frameWork), tickWork: stats(kept.flatMap(window => window.tickWorkMs)), raf: stats(kept.flatMap(window => window.raf)),
    effectiveSpeed: sum(kept.map(window => window.tickCount)) / sum(kept.map(window => window.wallMs / 50)),
    stageCoverage: frames.length === 0 ? null : sum(stageSum) / sum(frameWork),
    stages, calls, callsByStage,
    visibleTiles: last?.visibleTiles ?? null, objects: last?.objects ?? null,
    rasterCachePerWindow: raster,
    heapUsedMB: { before: kept.map(window => window.heapBefore), after: kept.map(window => window.heapAfter) },
    trace: kept.at(-1)?.trace ?? null,
    errors: kept.flatMap(window => window.errors),
  };
}

export const B11_MATRIX = [
  ...['lots24', 'pop176', 'newgame'].flatMap(city => [1, 2].flatMap(dpr => ['still', 'drag'].map(camera => ({ city, dpr, camera, cpu: 1 })))),
  { city: 'lots24', dpr: 1, camera: 'still', cpu: 4 }, { city: 'lots24', dpr: 1, camera: 'drag', cpu: 4 },
];
const cellName = cell => `${cell.city}-${cell.width ?? 1280}x${cell.height ?? 800}-dpr${cell.dpr}-cpu${cell.cpu ?? 1}-${cell.camera}`;

async function main() {
  const output = resolve(flags.output ?? 'docs/verification/b11-render-metrics/baseline');
  await mkdir(output, { recursive: true });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  const dirty = execFileSync('git', ['status', '--porcelain', '--untracked-files=no', '--', 'src'], { cwd: ROOT, encoding: 'utf8' }).trim();
  if (dirty !== '' && flags['allow-dirty'] !== 'true') throw new Error(`Dirty src/ in measured checkout:\n${dirty}`);
  const chromium = await loadChromium();
  const states = await sceneStates();
  // --query appends to the page URL (e.g. `&render-boundary-v2=1`); --label suffixes the output file names.
  const options = { url: flags.url ?? 'http://127.0.0.1:4194/', rounds: Number(flags.rounds ?? 3), stages: flags.stages !== '0', trace: flags.trace !== 'false',
    query: flags.query ?? '', label: flags.label === undefined ? '' : `-${flags.label}` };
  const cells = flags.matrix === 'b11' ? B11_MATRIX
    : [{ city: flags.city ?? 'lots24', dpr: Number(flags.dpr ?? 1), camera: flags.camera ?? 'still', cpu: Number(flags.cpu ?? 1), width: Number(flags.width ?? 1280), height: Number(flags.height ?? 800) }];
  const browserVersion = await (async () => { const browser = await chromium.launch({ channel: 'chrome', headless: true }); const version = browser.version(); await browser.close(); return version; })();
  const results = [];
  for (const cell of cells) {
    const result = await measureCell(chromium, states, cell, options);
    const record = { name: cellName(cell), commit, dirtySource: dirty !== '', url: options.url, stageProbe: options.stages, browser: browserVersion,
      host: { platform: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model }, harnessSha256: createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex'),
      protocol: `${options.rounds} rounds × ${WINDOW} draws, round 0 discarded, 1× game speed`, ...result };
    await writeFile(`${output}/${record.name}${options.stages ? '' : '-nostages'}${options.label}.json`, `${JSON.stringify({ ...record, query: options.query }, null, 2)}\n`);
    results.push(record);
  }
  await writeFile(`${output}/summary${options.label}.md`, renderSummary(results));
}

const f1 = value => value === null || value === undefined ? '—' : value.toFixed(1);
export function renderSummary(results) {
  const lines = ['| 도시 | DPR | CPU | 카메라 | frameWork 중앙/p95 | 단계 합/frameWork | 상위 3단계 (중앙 ms) | rAF 중앙/p95 | tick 중앙/p95 | drawImage·fill·fillRect | 화면 타일·객체 |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of results) {
    const top = Object.entries(r.stages).sort((a, b) => (b[1].mean ?? 0) - (a[1].mean ?? 0)).slice(0, 3).map(([name, s]) => `${name} ${f1(s.median)}`).join(', ');
    const objects = r.objects === null ? '—' : Object.values(r.objects).reduce((a, b) => a + b, 0);
    lines.push(`| ${r.city} | ${r.dpr} | ${r.cpu}× | ${r.camera === 'still' ? '정지' : '드래그'} | ${f1(r.frameWork.median)} / ${f1(r.frameWork.p95)} | ${r.stageCoverage === null ? '—' : `${(r.stageCoverage * 100).toFixed(1)}%`} | ${top} | ${f1(r.raf.median)} / ${f1(r.raf.p95)} | ${f1(r.tickWork.median)} / ${f1(r.tickWork.p95)} | ${f1(r.calls.drawImage?.median)} · ${f1(r.calls.fill?.median)} · ${f1(r.calls.fillRect?.median)} | ${r.visibleTiles ?? '—'} · ${objects} |`);
  }
  return `${lines.join('\n')}\n`;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
