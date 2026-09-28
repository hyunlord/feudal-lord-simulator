// INSTALL-23b captures (JPEG) and measurements, beside captures.json:
//  ① the rain: one scene (a seed 2 chapter-2 state, the lake shore) clear, in a wet season (tick 300: drizzle 0.55, the
//     overcast 0.145) and at a storm's height (575: storm 0.7), zoom 1.0 full view (quality 50) and a native-pixel
//     crop (quality 70); the world canvas's mean difference from the clear scene; and the share of the 1280 x 800 view
//     the rain streaks cover as the renderer fills them (each sheet's four cells as cut at their scale, unsmoothed, on
//     a transparent canvas in the page: pixels with any alpha).
//  ② the props: the chapter-2 end town in summer around its busiest yard at zoom 1.0 (the toys not drawn) and 1.4.
//  ③ pause: the same yard at zoom 2, weather off, paused from the start — two frames 1.63 s apart; then at 1x — two
//     frames 1.63 s apart. Changed pixels inside the village's ground animals' and the walkers' boxes and in the whole
//     view, with the difference images (x4).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/install23bCaptures.ts <out-dir> --url <game> --states <ui6States dir>
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { tileToScreen } from "../src/render/iso";
import { villageLife } from "../src/render/villageLife";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Rect = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>; keyboard: { press: (key: string) => Promise<void> };
  evaluate: <T, A>(f: (arg: A) => T | Promise<T>, arg: A) => Promise<T> };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!;
mkdirSync(out!, { recursive: true });
const WIDTH = 1280, HEIGHT = 800;
// tsx names the functions it compiles with an `__name` helper; the page evaluations below run that code, so the page gets the helper.
const TUTORIAL_OFF = `window.__name = (target) => target; try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const load = (name: string) => JSON.parse(readFileSync(join(statesDir, `${name}.json`), "utf8")) as GameState;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--disable-gpu"] });
const result: Record<string, unknown> = {};
const errors: string[] = [];
async function scene(state: GameState, tile: readonly [number, number], zoom: number, query: string, run: boolean) {
  const opened = await openScene(browser, { state, tile, baseUrl: url, width: WIDTH, height: HEIGHT, zoom, run, initScript: TUTORIAL_OFF, query: `&story-delay=600000${query}` });
  return { page: opened.page as Page, close: () => opened.context.close() };
}
/** The world canvas downsampled to 320 x 200 (RGBA). */
const canvasPixels = (page: Page) => page.evaluate(() => {
  const source = document.querySelector("canvas")!; const copy = document.createElement("canvas"); copy.width = 320; copy.height = 200;
  const paint = copy.getContext("2d")!; paint.drawImage(source, 0, 0, 320, 200);
  return Array.from(paint.getImageData(0, 0, 320, 200).data);
}, null);
const meanDiff = (a: readonly number[], b: readonly number[]) => Math.round(a.reduce((total, value, index) => index % 4 === 3 ? total : total + Math.abs(value - (b[index] ?? 0)), 0) / (a.length * 0.75) * 100) / 100;

// ① The rain.
const shore = load("wool_payment");
const WEATHERS = [{ name: "clear", query: "&weather=normal&weather-tick=300" }, { name: "wet", query: "&weather=wet&weather-tick=300" },
  { name: "storm", query: "&weather=wet&weather-tick=575" }] as const;
const CROP: Rect = { x: 20, y: 300, width: 480, height: 300 };
const pixels: Record<string, number[]> = {};
const rain: Record<string, unknown> = {};
for (const { name, query } of WEATHERS) {
  try {
    const { page, close } = await scene(shore, [44, 38], 1, query, false);
    await page.waitForTimeout(2_500);
    await page.screenshot({ path: join(out!, `r-${name}-z1.0.jpg`), type: "jpeg", quality: 50 });
    await page.screenshot({ path: join(out!, `r-${name}-crop.jpg`), type: "jpeg", quality: 70, clip: CROP });
    pixels[name] = await canvasPixels(page);
    if (name === "storm") {
      Object.assign(rain, await page.evaluate(async () => {
        const art = await import("/src/render/weatherArt.ts" as string) as typeof import("../src/render/weatherArt");
        const area: Record<string, number> = {};
        for (const key of ["drizzle_sheet", "storm_rain_sheet"] as const) {
          // The storm scene shows only the storm sheet: ask for the drizzle too and wait for it.
          for (let tries = 0; tries < 50 && art.weatherImage(key) === null; tries += 1) await new Promise(done => setTimeout(done, 100));
          let most = 0;
          for (let frame = 0; frame < 4; frame += 1) {
            const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 800;
            const paint = canvas.getContext("2d")!;
            const pattern = art.weatherPattern(paint, key, frame);
            if (pattern === null) return { error: `${key} not loaded` };
            // As the renderer fills it (weatherOverlay.ts drawFill): the cell cut at its scale, whole-pixel steps, unsmoothed.
            paint.imageSmoothingEnabled = false;
            paint.fillStyle = pattern; paint.fillRect(0, 0, 1280, 800);
            const data = paint.getImageData(0, 0, 1280, 800).data;
            let covered = 0; for (let index = 3; index < data.length; index += 4) if ((data[index] ?? 0) > 0) covered += 1;
            most = Math.max(most, covered / (1280 * 800));
          }
          area[key] = Math.round(most * 10_000) / 10_000;
        }
        return { viewShare: area, bothWhileCrossFading: Math.round(((area.drizzle_sheet ?? 0) + (area.storm_rain_sheet ?? 0)) * 10_000) / 10_000 };
      }, null));
    }
    await close();
  } catch (error) { errors.push(`weather ${name}: ${String(error).slice(0, 300)}`); }
}
result.rain = { ...rain, meanDiffFromClear: { wet: meanDiff(pixels.wet ?? [], pixels.clear ?? []), storm: meanDiff(pixels.storm ?? [], pixels.clear ?? []) } };

// ② The props and ③ pause, around the busiest yard of the chapter-2 end town in summer (as scripts/villageLifeCaptures.ts).
const base = load("chapter2-end");
const summer: GameState = { ...base, tick: Math.floor(base.tick / 4_000) * 4_000 + 1_000 + 500 };
const full = { minTx: 0, minTy: 0, maxTx: summer.width - 1, maxTy: summer.height - 1 };
const ground = villageLife(summer, { range: full }).filter(item => item.motion !== "flight" && item.motion !== "perch");
const around = (item: (typeof ground)[number]) => ground.filter(other => Math.abs((other.x - other.y) - (item.x - item.y)) * 32 < 160
  && Math.abs((other.x + other.y) - (item.x + item.y)) * 16 < 100).length;
const focus = [...ground].sort((a, b) => around(b) - around(a) || a.id.localeCompare(b.id))[0]!;
const tile: [number, number] = [focus.x, focus.y];
const PROPS_CLIP: Rect = { x: 320, y: 200, width: 640, height: 400 };
for (const zoom of [1, 1.4]) {
  try {
    const { page, close } = await scene(summer, tile, zoom, "&weather=none", false);
    await page.waitForTimeout(2_500);
    await page.screenshot({ path: join(out!, `p-props-z${zoom.toFixed(1)}.jpg`), type: "jpeg", quality: 70, clip: PROPS_CLIP });
    await close();
  } catch (error) { errors.push(`props ${zoom}: ${String(error).slice(0, 300)}`); }
}
result.props = { town: "chapter2-end", tile, clip: PROPS_CLIP, kindsNearby: [...new Set(ground.filter(item => around(item) > 0 && Math.abs(item.x - focus.x) < 6 && Math.abs(item.y - focus.y) < 6).map(item => item.kind))].sort() };

// ③ Pause. Screen boxes (view px at zoom 2) of the ground animals and the walkers in view.
const ZOOM = 2;
// Not a whole number of smoke cycles (the Wave 7 sheet: 4 frames x 180 ms = 720 ms; 1.5 s is two cycles and a sliver,
// so both frames showed the same smoke), about nine frames apart.
const GAP_MS = 1_630;
const screenOf = (x: number, y: number) => { const at = tileToScreen(x, y); return { x: WIDTH / 2 + (at.sx - tileToScreen(tile[0], tile[1]).sx) * ZOOM, y: HEIGHT / 2 + (at.sy - tileToScreen(tile[0], tile[1]).sy) * ZOOM }; };
const inView = (box: Rect) => box.x + box.width > 0 && box.y + box.height > 0 && box.x < WIDTH && box.y < HEIGHT;
const animalBoxes = ground.filter(item => item.animals > 0).map(item => { const at = screenOf(item.x, item.y); return { x: at.x - 48, y: at.y - 40, width: 96, height: 56 }; }).filter(inView);
async function frames(run: boolean, name: string) {
  const { page, close } = await scene(summer, tile, ZOOM, "&weather=none", run);
  await page.waitForTimeout(2_000);
  const walkers = await page.evaluate(() => {
    const proof = (window as unknown as { __FEUDAL_PHASE10_PROOF__?: { state?: () => GameState } }).__FEUDAL_PHASE10_PROOF__;
    return proof?.state?.().walkers.map(walker => ({ tx: walker.position.tx, ty: walker.position.ty })) ?? null;
  }, null);
  const walkerBoxes = (walkers ?? summer.walkers.map(walker => walker.position)).map(position => { const at = screenOf(position.tx, position.ty); return { x: at.x - 20, y: at.y - 44, width: 40, height: 50 }; }).filter(inView);
  const measured = await page.evaluate(async ({ boxes, wait }) => {
    const grab = () => { const source = document.querySelector("canvas")!; const copy = document.createElement("canvas"); copy.width = 1280; copy.height = 800;
      copy.getContext("2d")!.drawImage(source, 0, 0, 1280, 800); return copy.getContext("2d")!.getImageData(0, 0, 1280, 800); };
    const first = grab();
    await new Promise(done => setTimeout(done, wait));
    const second = grab();
    const changed = new Uint8Array(1280 * 800);
    const view = document.createElement("canvas"); view.width = 1280; view.height = 800; const paint = view.getContext("2d")!;
    const diff = paint.createImageData(1280, 800);
    let total = 0;
    for (let index = 0; index < changed.length; index += 1) {
      const at = index * 4; const delta = Math.abs(first.data[at]! - second.data[at]!) + Math.abs(first.data[at + 1]! - second.data[at + 1]!) + Math.abs(first.data[at + 2]! - second.data[at + 2]!);
      if (delta > 12) { changed[index] = 1; total += 1; }
      const shown = Math.min(255, delta * 4); diff.data[at] = shown; diff.data[at + 1] = shown; diff.data[at + 2] = shown; diff.data[at + 3] = 255;
    }
    paint.putImageData(diff, 0, 0);
    const inside = (list: readonly { x: number; y: number; width: number; height: number }[]) => {
      const seen = new Uint8Array(changed.length); let count = 0;
      for (const box of list) for (let y = Math.max(0, Math.floor(box.y)); y < Math.min(800, box.y + box.height); y += 1)
        for (let x = Math.max(0, Math.floor(box.x)); x < Math.min(1280, box.x + box.width); x += 1) { const index = y * 1280 + x; if (!seen[index]) { seen[index] = 1; if (changed[index]) count += 1; } }
      return count;
    };
    return { changedInView: total, changedInAnimalBoxes: inside(boxes.animals), changedInWalkerBoxes: inside(boxes.walkers), image: view.toDataURL("image/jpeg", 0.6) };
  }, { boxes: { animals: animalBoxes, walkers: walkerBoxes }, wait: GAP_MS });
  // The walkers themselves: their positions in the game state after the two frames (a box can also catch smoke).
  const after = await page.evaluate(() => {
    const proof = (window as unknown as { __FEUDAL_PHASE10_PROOF__?: { state?: () => GameState } }).__FEUDAL_PHASE10_PROOF__;
    return proof?.state?.().walkers.map(walker => ({ tx: walker.position.tx, ty: walker.position.ty })) ?? null;
  }, null);
  const walkersMoved = walkers === null || after === null ? null : after.filter((position, index) => position.tx !== walkers[index]?.tx || position.ty !== walkers[index]?.ty).length;
  writeFileSync(join(out!, `f-${name}-diff.jpg`), Buffer.from(measured.image.split(",")[1]!, "base64"));
  await page.screenshot({ path: join(out!, `f-${name}.jpg`), type: "jpeg", quality: 55 });
  await close();
  const { image: _image, ...counts } = measured;
  return { ...counts, animalBoxes: animalBoxes.length, walkerBoxes: walkerBoxes.length, walkers: walkers?.length ?? null, walkersMoved };
}
try {
  result.pause = { zoom: ZOOM, tile, weather: "none", paused: await frames(false, "paused"), running: await frames(true, "running") };
} catch (error) { errors.push(`pause: ${String(error).slice(0, 300)}`); }

await browser.close();
const bytes = ["r-clear-z1.0", "r-clear-crop", "r-wet-z1.0", "r-wet-crop", "r-storm-z1.0", "r-storm-crop", "p-props-z1.0", "p-props-z1.4", "f-paused", "f-paused-diff", "f-running", "f-running-diff"]
  .map(name => { try { return statSync(join(out!, `${name}.jpg`)).size; } catch { return 0; } }).reduce((a, b) => a + b, 0);
writeFileSync(join(out!, "captures.json"), JSON.stringify({ ...result, jpegBytes: bytes, errors }, null, 1) + "\n");
console.log(JSON.stringify({ rain: result.rain, pause: result.pause, bytes, errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
