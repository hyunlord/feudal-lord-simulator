// INSTALL-23 weather captures: one scene (a seed 2 chapter-2 state, the lake shore and the town) in each of the four
// weathers at zoom 1.0 and 0.6, and the wet season's height (the storm sheet) besides its morning — 10 JPEGs, 1280 x
// 800, with the DOM HUD on top (the weather is on the world canvas only), and at zoom 1.0 a 480 x 300 crop of the
// shore at quality 70 each (the rain and dust are faint streaks under the cap that a low JPEG quality smooths away). The weather shown is the proof hook's (`&weather=<kind>&weather-tick=<t>`, src/render/weatherProof.ts), so
// all four are the same scene; the game state is not changed. Beside them weather.json: per weather the layers
// (element, blend, alpha, moving), the alpha stacked on one pixel, and the draw cost in the page (headless Chromium,
// software raster: `--disable-gpu`; the platform is in weather.json).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/weatherCaptures.ts <out-dir> --url <game> --state <state.json> [--tile 44,38]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/weatherCaptures.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/weatherCaptures.ts …", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { WeatherKind } from "../src/content/eventConfig";
import type { GameState } from "../src/engine/engine.types";
import { stackedPermille, weatherLayers } from "../src/render/weatherLayers";
import { fogAnchors } from "../src/render/weatherPlacement";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>;
  evaluate: <T, A>(f: (arg: A) => T | Promise<T>, arg: A) => Promise<T>; on: (event: string, handler: (error: unknown) => void) => void;
  keyboard: { press: (key: string) => Promise<void> };
  locator: (selector: string) => { first: () => { click: () => Promise<void>; textContent: () => Promise<string | null>; getAttribute: (name: string) => Promise<string | null> }; count: () => Promise<number> } };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statePath = flag("state")!;
const tile = (flag("tile") ?? "44,38").split(",").map(Number) as [number, number];
mkdirSync(out!, { recursive: true });
const state = JSON.parse(readFileSync(statePath, "utf8")) as GameState;
/** The moment of the season shown: past the fade-in, a wet season's morning (drizzle, fog along the water, puddles);
 * `wet-storm` is the height of a wet season (WET_STORM_FROM-TO: the storm sheet instead of the drizzle). */
const WEATHERS: readonly { readonly name: string; readonly weather: WeatherKind; readonly tick: number }[] = [
  { name: "wet", weather: "wet", tick: 200 }, { name: "wet-storm", weather: "wet", tick: 575 },
  { name: "dry", weather: "dry", tick: 200 }, { name: "cold", weather: "cold", tick: 200 }, { name: "normal", weather: "normal", tick: 200 }];
const CROP = { x: 20, y: 300, width: 480, height: 300 } as const;
const ZOOMS = [1, 0.6] as const;
const SEASON_TICK = 200;
// tsx names the functions it compiles with an `__name` helper; the page evaluation below runs that code, so the page gets the helper.
const TUTORIAL_OFF = `window.__name = (target) => target; try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--disable-gpu"] });
const errors: string[] = [];
const result: Record<string, unknown> = {};
// The map fields the weather reads (the draw-cost run in the page gets these, not the whole state).
const mapState = { tick: state.tick, seed: state.seed, scenarioId: state.scenarioId, events: state.events, historicalEras: state.historicalEras,
  tiles: state.tiles, width: state.width, height: state.height };
const started = performance.now();
const anchors = fogAnchors(state.seed, state.tiles, state.width, state.height);
const fogAnchorsMs = performance.now() - started;

for (const { name, weather, tick } of WEATHERS) {
  const layers = weatherLayers({ weather, seasonTick: tick, enabled: true, rain: true });
  const shots: Record<string, unknown> = {};
  for (const zoom of ZOOMS) {
    const { context, page } = await openScene(browser, { state, tile, baseUrl: url, width: 1280, height: 800, zoom, run: false,
      initScript: TUTORIAL_OFF, query: `&story-delay=600000&weather=${weather}&weather-tick=${tick}` });
    (page as Page).on("pageerror", error => errors.push(`${name} ${zoom}: ${String(error).slice(0, 200)}`));
    await (page as Page).waitForTimeout(2_500);
    const file = `weather-${name}-z${zoom.toFixed(1)}.jpg`;
    await (page as Page).screenshot({ path: join(out!, file), type: "jpeg", quality: 42 });
    const crop = zoom === 1 ? `weather-${name}-crop.jpg` : null;
    if (crop !== null) await (page as Page).screenshot({ path: join(out!, crop), type: "jpeg", quality: 70, clip: CROP });
    // The draw cost of the two weather passes on an offscreen 1280 x 800 canvas at this camera (the page's own weather
    // modules and caches): the first call (images decoded, rain cells and patterns built) and the median of 60 more.
    const cost = await (page as Page).evaluate(async ({ map, zoom: z, tile: t }) => {
      const overlay = await import("/src/render/weatherOverlay.ts" as string) as typeof import("../src/render/weatherOverlay");
      const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 800;
      const paint = canvas.getContext("2d")!;
      const panX = 640 - (t[0] - t[1]) * 32 * z, panY = 400 - (t[0] + t[1]) * 16 * z;
      const visible = map.tiles.filter(cell => { const sx = (cell.tx - cell.ty) * 32 * z + panX, sy = (cell.tx + cell.ty) * 16 * z + panY; return sx > -96 && sx < 1376 && sy > -96 && sy < 896; });
      const frame = (nowMs: number) => {
        paint.setTransform(z, 0, 0, z, panX, panY);
        overlay.drawWeatherGround(paint, map as never, visible, z, nowMs);
        overlay.drawWeatherSky(paint, map as never, { width: 1280, height: 800 }, z, nowMs);
        paint.getImageData(0, 0, 1, 1);
      };
      const clock = (nowMs: number) => { const begin = performance.now(); frame(nowMs); return performance.now() - begin; };
      const firstMs = clock(0);
      const times = Array.from({ length: 60 }, (_, index) => clock(16.7 * (index + 1))).sort((a, b) => a - b);
      // For scale: one full-view alpha fill of a solid colour, the cost unit the DGX notes name.
      const fills = Array.from({ length: 30 }, () => { const begin = performance.now(); paint.setTransform(1, 0, 0, 1, 0, 0); paint.globalAlpha = 0.2;
        paint.fillStyle = "gray"; paint.fillRect(0, 0, 1280, 800); paint.getImageData(0, 0, 1, 1); return performance.now() - begin; }).sort((a, b) => a - b);
      return { firstMs: Math.round(firstMs * 100) / 100, medianMs: Math.round(times[30]! * 100) / 100, p95Ms: Math.round(times[57]! * 100) / 100,
        fullViewFillMedianMs: Math.round(fills[15]! * 100) / 100, visibleTiles: visible.length };
    }, { map: mapState, zoom, tile });
    shots[`z${zoom.toFixed(1)}`] = { file, bytes: statSync(join(out!, file)).size, ...(crop !== null ? { crop, cropBytes: statSync(join(out!, crop)).size } : {}), cost };
    await context.close();
  }
  result[name] = {
    seasonTick: tick,
    layers: layers.map(layer => ({ element: layer.id, art: layer.assets, blend: layer.blend, alpha: layer.alphaPermille / 1000, moving: layer.moving,
      space: layer.space, pass: layer.pass, zone: layer.zone, placement: layer.placement })),
    stackedAlpha: stackedPermille(layers) / 1000,
    shots,
  };
}
// The settings switch: in a wet scene, the pause menu's weather switch turns every layer off (the world canvas then
// matches the same scene with no weather, apart from the clock-driven water and smoke), and on again.
const canvasMean = (page: Page) => page.evaluate(() => {
  const source = document.querySelector("canvas")!; const copy = document.createElement("canvas"); copy.width = 320; copy.height = 200;
  const paint = copy.getContext("2d")!; paint.drawImage(source, 0, 0, 320, 200);
  return Array.from(paint.getImageData(0, 0, 320, 200).data);
}, null);
const meanDiff = (a: readonly number[], b: readonly number[]) => Math.round(a.reduce((total, value, index) => index % 4 === 3 ? total : total + Math.abs(value - (b[index] ?? 0)), 0) / (a.length * 0.75) * 100) / 100;
const switchCheck = await (async () => {
  const open = async (weather: string) => (await openScene(browser, { state, tile, baseUrl: url, width: 1280, height: 800, zoom: 1, run: false,
    initScript: TUTORIAL_OFF, query: `&story-delay=600000&weather=${weather}&weather-tick=${SEASON_TICK}` }));
  const none = await open("none"); await (none.page as Page).waitForTimeout(2_000);
  const plain = await canvasMean(none.page as Page); await none.context.close();
  const wet = await open("wet"); const page = wet.page as Page; await page.waitForTimeout(2_000);
  const withWeather = await canvasMean(page);
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  const toggle = page.locator(".pause-menu [data-preference='weatherFx']").first();
  const before = { label: await toggle.textContent(), pressed: await toggle.getAttribute("aria-pressed") };
  await toggle.click(); await page.waitForTimeout(200);
  const after = { label: await toggle.textContent(), pressed: await toggle.getAttribute("aria-pressed") };
  await page.keyboard.press("Escape"); await page.waitForTimeout(800);
  const switchedOff = await canvasMean(page);
  const stored = await page.evaluate(() => localStorage.getItem("feudal.presentation.weatherFx"), null);
  await wet.context.close();
  return { before, after, stored, meanAbsDiff: { wetOnVsNone: meanDiff(withWeather, plain), wetOffVsNone: meanDiff(switchedOff, plain), wetOnVsOff: meanDiff(withWeather, switchedOff) } };
})();
// The cache notes' measurements (src/render/weatherArt.ts): a tint as a repeat pattern against its flat mean colour,
// the rain fill, and building a rain sheet's four cells with their patterns (what the cell cache saves per frame).
const fillCost = await (async () => {
  type Browser = { newContext: (options: object) => Promise<{ addInitScript: (script: string) => Promise<void>; newPage: () => Promise<unknown>; close: () => Promise<void> }> };
  const context = await (browser as unknown as Browser).newContext({ viewport: { width: 1280, height: 800 } });
  await context.addInitScript(TUTORIAL_OFF);
  const page = await context.newPage() as unknown as Page & { goto: (url: string) => Promise<unknown> };
  await page.goto(`${url}assets/wave23/weather/overcast_tint.png`);
  const measured = await page.evaluate(async base => {
    const load = (src: string) => new Promise<HTMLImageElement>(done => { const image = new Image(); image.onload = () => done(image); image.src = src; });
    const tint = await load(`${base}assets/wave23/weather/overcast_tint.png`); const sheet = await load(`${base}assets/wave23/weather/drizzle_sheet.png`);
    const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 800; const paint = canvas.getContext("2d")!;
    paint.fillStyle = "green"; paint.fillRect(0, 0, 1280, 800);
    const median = (run: () => void) => { const times: number[] = []; for (let index = 0; index < 40; index += 1) { const begin = performance.now(); run(); paint.getImageData(0, 0, 1, 1); times.push(performance.now() - begin); }
      times.sort((a, b) => a - b); return Math.round(times[20]! * 100) / 100; };
    const buildCells = () => Array.from({ length: 4 }, (_, frame) => { const cell = document.createElement("canvas"); cell.width = 256; cell.height = 256;
      cell.getContext("2d")!.drawImage(sheet, frame * 256, 0, 256, 256, 0, 0, 256, 256); return paint.createPattern(cell, "repeat")!; });
    const cells = buildCells();
    const fill = (style: CanvasPattern | string, blend: GlobalCompositeOperation, alpha: number) => () => {
      paint.save(); paint.globalAlpha = alpha; paint.globalCompositeOperation = blend; paint.fillStyle = style; paint.fillRect(0, 0, 1280, 800); paint.restore(); };
    return { tintPatternMultiplyMs: median(fill(paint.createPattern(tint, "repeat")!, "multiply", 0.06)), tintFlatMultiplyMs: median(fill("gray", "multiply", 0.06)),
      rainPatternFillMs: median(fill(cells[0]!, "source-over", 0.2)), rainCellsAndPatternsBuildMs: median(() => { buildCells(); }) };
  }, url);
  await context.close();
  return measured;
})();
await browser.close();
const total = WEATHERS.flatMap(({ name }) => [...ZOOMS.map(zoom => `weather-${name}-z${zoom.toFixed(1)}.jpg`), `weather-${name}-crop.jpg`])
  .map(file => statSync(join(out!, file)).size).reduce((a, b) => a + b, 0);
const body = { scene: { state: statePath.split("/").pop(), tick: state.tick, seed: state.seed, tile, viewport: [1280, 800], proofQuery: "&weather=<kind>&weather-tick=<tick>" },
  cap: 0.38, cost: { fogAnchorsMs: Math.round(fogAnchorsMs * 100) / 100, fogAnchors: anchors.length, fillCost, browser: `headless Chrome --disable-gpu (software raster), ${process.platform}` },
  weathers: result, settingSwitch: switchCheck, jpegBytes: total, errors };
writeFileSync(join(out!, "weather.json"), JSON.stringify(body, null, 1) + "\n");
console.log(JSON.stringify({ jpegBytes: total, errors: errors.length }));
process.exitCode = errors.length === 0 ? 0 : 1;
