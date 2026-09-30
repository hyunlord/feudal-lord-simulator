// NAT-2 QA-008: the zoom-out art — frame cost and captures of the biggest town (fixtures/perf-gate/ch4-1380) at the
// wide zooms, 1600 × 1100 DPR 1 (Astra's window), the camera on the town's middle.
//  measure: per-frame draw time (the proof port's render stage probe, the last 240 frames after an 8 s warm-up) at
//    zoom 0.6, 0.5 (the game's widest) and 0.4, paused and at 5x, two page loads each; median / p95 of the frame, of
//    the buildings and nature stages and of every stage over 0.05 ms, and the drawImage calls per frame.
//  capture: JPEGs of the paused town at each `--zooms` value.
//   PLAYWRIGHT_MODULE=... npx tsx scripts/nat2LodProbe.ts <out-dir> --label before|after --url http://127.0.0.1:5395/
//     [--mode measure|capture|both] [--zooms 0.6,1.0] [--size 1600x1100] [--dpr 1]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>;
  evaluate: <T, A = void>(f: (arg: A) => T, arg?: A) => Promise<T>; mouse: { move: (x: number, y: number) => Promise<void> };
  getByRole: (role: string, options: object) => { click: () => Promise<void> }; on: (event: string, handler: (error: unknown) => void) => void };
type Frame = { totalMs: number; stageMs: number[]; calls: number[][] };

const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url") ?? "http://127.0.0.1:5395/"; const label = flag("label") ?? "run"; const mode = flag("mode") ?? "both";
const zooms = (flag("zooms") ?? "0.6,1.0").split(",").map(Number);
// The window (CSS px) and device pixel ratio; the user's report was a retina window of about 1850 × 1010 (NAT-2).
const [width, height] = (flag("size") ?? "1600x1100").split("x").map(Number) as [number, number]; const dpr = Number(flag("dpr") ?? 1);
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const envelope = JSON.parse(gunzipSync(readFileSync("fixtures/perf-gate/ch4-1380.save.json.gz")).toString("utf8"));
const TILE = [44, 32] as const;
// The game clamps the camera to MIN_ZOOM 0.5 (camera.ts); the strategic-map zooms under it (0.4, 0.3) are reached by
// lowering that clamp in the served module (Vite serves it as `.5`) for the probe only (the diagnosis' camera zoom is reported per row).
const MIN_ZOOM_REWRITE = { pattern: "**/src/render/camera.ts*", from: "export const MIN_ZOOM = .5;", to: "export const MIN_ZOOM = .25;" };
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors: string[] = [];

async function scene(zoom: number, speed: 0 | 5): Promise<{ page: Page; close: () => Promise<void> }> {
  const { context, page } = await openScene(browser, { state: envelope, tile: TILE, baseUrl: url, width, height, dpr, zoom, run: false,
    initScript: TUTORIAL_OFF, query: "&story-delay=600000", rewrite: [MIN_ZOOM_REWRITE] });
  (page as Page).on("pageerror", error => errors.push(String(error).slice(0, 200)));
  if (speed === 5) await (page as Page).getByRole("button", { name: "5배속", exact: true }).click();
  await (page as Page).mouse.move(800, 70);
  return { page: page as Page, close: () => context.close() };
}

const quantile = (values: readonly number[], q: number) => { const sorted = [...values].sort((a, b) => a - b); return sorted[Math.floor(sorted.length * q)] ?? NaN; };
const round = (value: number) => Math.round(value * 100) / 100;

async function measure(zoom: number, speed: 0 | 5, load: number) {
  const { page, close } = await scene(zoom, speed);
  await page.waitForTimeout(8_000);
  const snap = await page.evaluate(() => {
    const stages = (window as unknown as { __FEUDAL_PHASE10_PROOF__: { diagnosis: () => { camera: { zoom: number; lod: string }; renderStages: { stages: string[]; methods: string[]; frames: Frame[] } } } })
      .__FEUDAL_PHASE10_PROOF__.diagnosis();
    return { camera: stages.camera, stages: stages.renderStages.stages, methods: stages.renderStages.methods, frames: stages.renderStages.frames };
  });
  // The canvas budget's bytes by owner (the page's own module instance: Vite serves it at this URL).
  const budget = await page.evaluate(async () => (await import(/* @vite-ignore */ "/src/render/canvasBudget.ts" as string)).canvasBudget.stats().byOwner as Record<string, number>);
  await close();
  const stage = (name: string) => snap.stages.indexOf(name);
  const drawImage = snap.methods.indexOf("drawImage");
  const pick = (f: (frame: Frame) => number) => { const values = snap.frames.map(f); return { p50: round(quantile(values, 0.5)), p95: round(quantile(values, 0.95)) }; };
  return {
    zoom, speed, load, cameraZoom: round(snap.camera.zoom), lod: snap.camera.lod, frames: snap.frames.length,
    budgetMB: Object.fromEntries(Object.entries(budget).map(([owner, bytes]) => [owner, round(bytes / 2 ** 20)])),
    frameMs: pick(frame => frame.totalMs),
    buildingsMs: pick(frame => frame.stageMs[stage("buildings")] ?? 0),
    natureMs: pick(frame => frame.stageMs[stage("nature")] ?? 0),
    drawImagePerFrame: pick(frame => frame.calls.reduce((sum, row) => sum + (row[drawImage] ?? 0), 0)),
    // Every stage's median ms and drawImage calls (stages with a median of 0.05 ms or more).
    stages: Object.fromEntries(snap.stages.flatMap((name, index) => {
      const ms = quantile(snap.frames.map(frame => frame.stageMs[index] ?? 0), 0.5);
      return ms >= 0.05 ? [[name, { p50: round(ms), drawImage: quantile(snap.frames.map(frame => frame.calls[index]?.[drawImage] ?? 0), 0.5) }]] : [];
    })),
  };
}

const result: Record<string, unknown> = { label, url, tile: TILE, viewport: "1600x1100@1" };
if (mode !== "capture") {
  const rows = [];
  // `--cells 0.6:5,0.4:0 --loads 1` for a quick look; the report's numbers are the full grid.
  const cells = (flag("cells") ?? "0.6:0,0.6:5,0.5:0,0.5:5,0.4:0,0.4:5").split(",").map(cell => cell.split(":").map(Number) as [number, 0 | 5]);
  const loads = Number(flag("loads") ?? 2);
  for (const [zoom, speed] of cells) for (let load = 1; load <= loads; load++) {
    const row = await measure(zoom, speed, load); rows.push(row);
    console.log(JSON.stringify(row));
  }
  result.measure = rows;
}
if (mode !== "measure") {
  for (const zoom of zooms) {
    const { page, close } = await scene(zoom, 0);
    await page.waitForTimeout(6_000);
    const file = join(out!, `${label}-zoom${zoom.toFixed(2)}${width === 1600 && height === 1100 && dpr === 1 ? "" : `-${width}x${height}@${dpr}`}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 62 });
    console.log(file);
    await close();
  }
}
result.errors = errors;
writeFileSync(join(out!, `${label}-probe.json`), `${JSON.stringify(result, null, 2)}\n`);
await browser.close();
