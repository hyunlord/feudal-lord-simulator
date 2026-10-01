// LAND-UI works evidence (Wave 34): the fords on road crossings, the fen's drainage works by stage and the drain tool's
// chip, captured in the game from the states of scripts/landWorksStates.ts (paused, tutorial off). Starts its own vite
// dev server (no watch) on --port; writes small JPEGs and result.json (Wave 34 pictures fetched, chip text) to <out>.
//   PLAYWRIGHT_MODULE=... npx tsx scripts/landWorksCaptures.ts <out> --states <dir> --port <port>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/landWorksCaptures.ts)", { remote: "scripts/remote/run.sh render-LANDUI-works-<sha7> -- node_modules/.bin/tsx scripts/landWorksCaptures.ts …", entry: import.meta.url });
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = {
  waitForTimeout: (ms: number) => Promise<void>;
  screenshot: (options: object) => Promise<unknown>;
  keyboard: { press: (key: string) => Promise<void> };
  mouse: { move: (x: number, y: number) => Promise<void>; click: (x: number, y: number) => Promise<void> };
  locator: (selector: string) => { first: () => { click: () => Promise<void>; innerText: () => Promise<string> }; count: () => Promise<number>; innerText: () => Promise<string> };
  evaluate: <T>(fn: () => T) => Promise<T>;
};
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const statesDir = flag("states")!; const port = Number(flag("port") ?? 4390);
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const W = 1280, H = 800;
const result: Record<string, unknown> = {};
const errors: string[] = [];

const vite = spawn("node_modules/.bin/vite", ["--config", "scripts/remote/viteNoWatch.config.ts", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { stdio: "ignore" });
const url = `http://127.0.0.1:${port}/`;
for (let tries = 0; tries < 90; tries += 1) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  await new Promise(done => setTimeout(done, 1_000));
}
const state = (name: string) => JSON.parse(readFileSync(join(statesDir, `${name}.json`), "utf8"));
const tiles = JSON.parse(readFileSync(join(statesDir, "tiles.json"), "utf8")) as Record<string, [number, number]>;
/** The Wave 34 pictures loaded in the page (the art cache, through the dev server's module). */
const wave34 = (page: Page) => page.evaluate(async () => {
  const paths = ["/src/render/wave34Art.ts", "/src/render/wave34WorksManifest.generated.ts"];
  const art = await import(/* @vite-ignore */ paths[0]!) as { worksArt: (key: string) => unknown };
  const manifest = await import(/* @vite-ignore */ paths[1]!) as { WAVE34_WORKS: Record<string, unknown> };
  return Object.keys(manifest.WAVE34_WORKS).filter(key => art.worksArt(key) !== null);
});
/** The land works the page's own modules see at a tile's chunk (the token in the chunk key, the road fords). */
const works = (page: Page, tile: readonly [number, number]) => (page as unknown as { evaluate: <T, A>(fn: (arg: A) => T, arg: A) => Promise<T> }).evaluate(async ([tx, ty]) => {
  const paths = ["/src/render/landWorksIndex.ts", "/src/render/landWorksModel.ts"];
  const index = await import(/* @vite-ignore */ paths[0]!) as { landWorksChunkToken: (state: unknown, plan: { cx: number; cy: number }) => string };
  const model = await import(/* @vite-ignore */ paths[1]!) as { fordGroups: (state: unknown) => { road: boolean; cells: number[] }[] };
  const state = (window as unknown as { __FEUDAL_PHASE10_PROOF__: { state: () => { river?: { fords: number[] } } } }).__FEUDAL_PHASE10_PROOF__.state();
  return { token: index.landWorksChunkToken(state, { cx: Math.floor(tx / 8), cy: Math.floor(ty / 8) }), fords: state.river?.fords.length ?? null,
    roadFords: model.fordGroups(state).filter(group => group.road).map(group => group.cells) };
}, tile);
/** The canvas pixel of a tile, with the scene's camera centred on `centre` at `zoom`. */
const pixel = (tile: readonly [number, number], centre: readonly [number, number], zoom: number) =>
  ({ x: W / 2 + ((tile[0] - tile[1]) - (centre[0] - centre[1])) * 32 * zoom, y: H / 2 + ((tile[0] + tile[1]) - (centre[0] + centre[1])) * 16 * zoom });
const shot = (page: Page, name: string) => page.screenshot({ path: join(out!, `${name}.jpg`), type: "jpeg", quality: 62, clip: { x: 160, y: 100, width: 960, height: 600 } });

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const [name, zoom] of [["coast-ford-summer", 1.6], ["coast-ford-winter", 1.6], ["downs-ford1-summer", 1.6], ["fen-works-a-summer", 1.1],
    ["fen-works-a-winter", 1.1], ["fen-works-b-summer", 1.1]] as const) {
    try {
      const { context, page: opened } = await openScene(browser, { state: state(name), tile: tiles[name]!, baseUrl: url, width: W, height: H, zoom, run: false,
        initScript: TUTORIAL_OFF, query: "&story-delay=600000" });
      const page = opened as Page;
      await page.waitForTimeout(6_000);
      await shot(page, name);
      result[name] = { wave34: await wave34(page), works: await works(page, tiles[name]!) };
      await context.close();
    } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); }
  }
  // The drain tool: its card in the paths drawer, the chip over a mere, then over the grass beside it (a refusal).
  try {
    const name = "fen-tool-summer", centre = tiles[name]!, zoom = 1.3;
    const { context, page: opened } = await openScene(browser, { state: state(name), tile: centre, baseUrl: url, width: W, height: H, zoom, run: false,
      initScript: TUTORIAL_OFF, query: "&story-delay=600000" });
    const page = opened as Page;
    await page.keyboard.press("b");
    await page.waitForTimeout(500);
    await page.locator('[data-category="trade"]').first().click();
    await page.waitForTimeout(500);
    result.drainCards = await page.locator("[data-drain-tool]").count();
    await page.locator("[data-drain-tool]").first().click();
    await page.waitForTimeout(500);
    const mere = pixel(centre, centre, zoom);
    await page.mouse.move(mere.x, mere.y);
    await page.waitForTimeout(800);
    result.chipMere = await page.locator(".prediction-panel").first().innerText();
    await shot(page, "fen-tool-chip-mere");
    const grass = pixel(tiles["fen-tool-grass"]!, centre, zoom);
    await page.mouse.move(grass.x, grass.y);
    await page.waitForTimeout(800);
    result.chipRefusal = await page.locator(".prediction-panel").first().innerText();
    await page.mouse.click(grass.x, grass.y);
    await page.waitForTimeout(300);
    await shot(page, "fen-tool-chip-refusal");
    await context.close();
  } catch (error) { errors.push(`fen-tool: ${String(error).slice(0, 300)}`); }
} finally {
  await browser.close();
  vite.kill();
}
writeFileSync(join(out!, "result.json"), `${JSON.stringify({ ...result, errors }, null, 2)}\n`);
console.log(JSON.stringify({ errors }));
process.exit(errors.length === 0 ? 0 : 1);
