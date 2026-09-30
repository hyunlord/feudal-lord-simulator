// INSTALL-23 ③ village life captures (src/render/villageLife.ts): one town in summer and in winter at zoom 1.0, the
// summer town at 0.6, and a close-up of the yards (zoom 2, clipped), JPEG 1280 x 800. Beside them captures.json: per
// shot the village life in the view by kind and its animal count (the model's list for the renderer's visible range,
// which reaches a few tiles past the screen edge; and the part of it that zoom draws),
// and the blit benchmark behind the raster cache in villageLifeDraw.ts (software raster: Chrome with --disable-gpu).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/villageLifeCaptures.ts <out-dir> --url <game> --states <dir> [--town chapter2-end]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/villageLifeCaptures.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/villageLifeCaptures.ts …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { computeVisibleTileRange } from "../src/render/renderVisibility";
import { villageLife, villageLifeAnimalCount } from "../src/render/villageLife";
import { villageLifeDrawnAt } from "../src/render/villageLifeDraw";
import { WAVE23_IMAGES } from "../src/render/wave23ArtManifest.generated";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>;
  evaluate: <T, A>(f: (arg: A) => T | Promise<T>, arg: A) => Promise<T>; on: (event: string, handler: (error: unknown) => void) => void };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!; const town = flag("town") ?? "chapter2-end";
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const WIDTH = 1280, HEIGHT = 800;
const base = JSON.parse(readFileSync(join(statesDir, `${town}.json`), "utf8")) as GameState;
/** The same town in a season (calendar seasons: 1 summer, 3 winter), 500 ticks into it. */
const inSeason = (season: number): GameState => ({ ...base, tick: Math.floor(base.tick / 4_000) * 4_000 + season * 1_000 + 500 });
const houses = base.buildings.filter(building => building.kind === "house");
const middle: [number, number] = [Math.round(houses.reduce((sum, house) => sum + house.tx, 0) / houses.length), Math.round(houses.reduce((sum, house) => sum + house.ty, 0) / houses.length)];

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--disable-gpu"] });
const result: Record<string, unknown> = { town, middle };
const errors: string[] = [];

function model(state: GameState, tile: readonly [number, number], zoom: number) {
  const camera = { zoom, panX: WIDTH / 2 - (tile[0] - tile[1]) * 32 * zoom, panY: HEIGHT / 2 - (tile[0] + tile[1]) * 16 * zoom };
  const items = villageLife(state, { range: computeVisibleTileRange({ camera, viewport: { width: WIDTH, height: HEIGHT }, world: state }) });
  const kinds: Record<string, number> = {};
  for (const item of items) kinds[item.kind] = (kinds[item.kind] ?? 0) + 1;
  const drawn = items.filter(item => villageLifeDrawnAt(item, zoom));
  const drawnKinds: Record<string, number> = {};
  for (const item of drawn) drawnKinds[item.kind] = (drawnKinds[item.kind] ?? 0) + 1;
  return { items: items.length, animals: villageLifeAnimalCount(items), kinds, drawnAtThisZoom: { items: drawn.length, animals: villageLifeAnimalCount(drawn), kinds: drawnKinds },
    scales: Object.fromEntries(items.map(item => [item.kind, Number(item.scale.toFixed(4))])) };
}

async function shot(name: string, state: GameState, tile: readonly [number, number], zoom: number, clip?: object) {
  try {
    const { context, page } = await openScene(browser, { state, tile, baseUrl: url, width: WIDTH, height: HEIGHT, zoom, run: false,
      initScript: TUTORIAL_OFF, query: "&story-delay=600000" });
    (page as Page).on("pageerror", error => errors.push(`${name}: ${String(error).slice(0, 200)}`));
    // The village life art loads on its first draw; give it and the house art time.
    await (page as Page).waitForTimeout(3_000);
    await (page as Page).screenshot({ path: join(out!, `${name}.jpg`), type: "jpeg", quality: 70, ...(clip === undefined ? {} : { clip }) });
    result[name] = { zoom, tile, season: Math.floor((state.tick % 4_000) / 1_000), ...model(state, tile, zoom) };
    await context.close();
  } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); }
}

const summer = inSeason(1); const winter = inSeason(3);
await shot("life-summer-z1.0", summer, middle, 1);
await shot("life-winter-z1.0", winter, middle, 1);
await shot("life-summer-z0.6", summer, middle, 0.6);
// The close-up: zoom 2, the middle 640 x 400 (320 x 200 world px) around the ground item with the most others inside it.
const full = { minTx: 0, minTy: 0, maxTx: summer.width - 1, maxTy: summer.height - 1 };
const ground = villageLife(summer, { range: full }).filter(item => item.motion !== "flight" && item.motion !== "perch");
const around = (item: (typeof ground)[number]) => ground.filter(other => Math.abs((other.x - other.y) - (item.x - item.y)) * 32 < 160
  && Math.abs((other.x + other.y) - (item.x + item.y)) * 16 < 100).length;
const focus = [...ground].sort((a, b) => around(b) - around(a) || a.id.localeCompare(b.id))[0];
await shot("life-closeup-z2.0", summer, focus === undefined ? middle : [focus.x, focus.y], 2, { x: 320, y: 200, width: 640, height: 400 });

// The raster cache's measurement: 2 000 blits of the cat (72 px drawn 11 px wide) from the picture and from its raster
// at 3 x, flushed with getImageData, software raster.
try {
  const { context, page } = await openScene(browser, { state: summer, tile: middle, baseUrl: url, width: 640, height: 400, zoom: 1, run: false, initScript: TUTORIAL_OFF,
    query: "&story-delay=600000" });
  // A string, not a function: tsx's name helper (__name) does not exist in the page.
  result.blitBenchmark = await (page as unknown as { evaluate: (source: string) => Promise<unknown> }).evaluate(`(async () => {
    const image = new Image(); image.src = ${JSON.stringify(`${url}${WAVE23_IMAGES.cat_idle_a.url}`)}; await image.decode();
    const drawn = 72 * ${WAVE23_IMAGES.cat_idle_a.displayScale} * 1.6;
    const raster = document.createElement("canvas"); raster.width = Math.ceil(drawn * 3); raster.height = raster.width;
    const rasterContext = raster.getContext("2d"); rasterContext.imageSmoothingQuality = "high"; rasterContext.drawImage(image, 0, 0, raster.width, raster.height);
    const target = document.createElement("canvas"); target.width = 1280; target.height = 800;
    const ctx = target.getContext("2d"); ctx.imageSmoothingEnabled = true;
    const run = (source, sw) => {
      ctx.clearRect(0, 0, 1280, 800); ctx.getImageData(0, 0, 1, 1);
      const start = performance.now();
      for (let index = 0; index < 2000; index += 1) ctx.drawImage(source, 0, 0, sw, sw, (index * 37) % 1260, (index * 53) % 780, drawn, drawn);
      ctx.getImageData(0, 0, 1, 1);
      return performance.now() - start;
    };
    const picture = [], rasterMs = [];
    for (let round = 0; round < 7; round += 1) { picture.push(run(image, 72)); rasterMs.push(run(raster, raster.width)); }
    const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
    return { blits: 2000, drawnPx: Number(drawn.toFixed(1)), pictureMs: Number(median(picture).toFixed(2)), rasterMs: Number(median(rasterMs).toFixed(2)) };
  })()`);
  await context.close();
} catch (error) { errors.push(`benchmark: ${String(error).slice(0, 300)}`); }

await browser.close();
result.errors = errors;
writeFileSync(join(out!, "captures.json"), JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify({ shots: Object.keys(result).length, errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
