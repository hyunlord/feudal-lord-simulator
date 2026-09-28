// INSTALL-26~29 gates: the same town before (the trunk, --base) and after (this build, --url).
//   a1–a4 the 1340 town (UI-6's seed 2 chapter 2 run: the state nearest 1340, from ~/fls-ui6-states) at zoom 1.0 and 0.6,
//         before and after — the houses' variants (repetition), the backyards, the countryside, the water;
//   b1 the backyards up close (zoom 1.4, this build) and b2 the countryside outside the wall (zoom 1.0);
//   w1–w6 the water in six frames 150 ms apart while the game is paused (it moves as scenery), zoom 1.4, this build;
//   s1 the same town in winter (the state's tick moved to the next winter: snow on the Wave 26 roofs, winter yards).
// Full-view JPEGs and captures.json (the state, the tile of each view and what the page drew).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/install26Captures.ts <out-dir> --url <this> --base <trunk> --states <ui6States dir>
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BALANCE } from "../src/content/balanceConfig";
import { isWinterTick } from "../src/content/houseFoodConfig";
import type { GameState } from "../src/engine/engine.types";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>; mouse: { move: (x: number, y: number) => Promise<void> };
  locator: (selector: string) => { count: () => Promise<number>; first: () => { click: () => Promise<void> } }; on: (event: string, handler: (error: unknown) => void) => void };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const base = flag("base")!; const statesDir = flag("states")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const YEAR = BALANCE.TICKS_PER_YEAR;
const TARGET = (1340 - 1300) * YEAR;
// The state nearest 1340 among UI-6's saved moments.
const candidates = readdirSync(statesDir).filter(file => file.endsWith(".json") && !file.startsWith("moments"))
  .map(file => ({ file, state: JSON.parse(readFileSync(join(statesDir, file), "utf8")) as GameState }))
  .filter(entry => typeof entry.state.tick === "number" && Array.isArray(entry.state.buildings));
const town = candidates.sort((a, b) => Math.abs(a.state.tick - TARGET) - Math.abs(b.state.tick - TARGET))[0]!;
const state = town.state;
const houses = state.buildings.filter(building => building.kind === "house");
const middle = [houses.reduce((sum, house) => sum + house.tx, 0) / houses.length, houses.reduce((sum, house) => sum + house.ty, 0) / houses.length];
const water = state.tiles.filter(tile => tile.terrain === "water");
// A water tile near the shore closest to the town (ripples, foam, reeds in one view).
const shore = water.filter(tile => state.tiles.some(other => other.terrain !== "water" && Math.abs(other.tx - tile.tx) + Math.abs(other.ty - tile.ty) === 1))
  .sort((a, b) => Math.hypot(a.tx - middle[0]!, a.ty - middle[1]!) - Math.hypot(b.tx - middle[0]!, b.ty - middle[1]!))[0];
// Open country outside the settled area: the grass tile farthest from the town within 22 tiles.
const country = state.tiles.filter(tile => tile.terrain === "grass" && !tile.hasRoad && Math.hypot(tile.tx - middle[0]!, tile.ty - middle[1]!) < 22)
  .sort((a, b) => Math.hypot(b.tx - middle[0]!, b.ty - middle[1]!) - Math.hypot(a.tx - middle[0]!, a.ty - middle[1]!))[0];
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors: string[] = [];
const files: string[] = [];
const views: Record<string, unknown> = {};

async function view(name: string, game: string, scene: GameState, tile: readonly number[], zoom: number, frames = 1) {
  const { context, page } = await openScene(browser, { state: scene, tile, baseUrl: game, width: 1280, height: 800, zoom, run: false, initScript: TUTORIAL_OFF,
    query: "&story-delay=600000" }) as { context: { close: () => Promise<void> }; page: Page };
  page.on("pageerror", error => errors.push(`${name}: ${String(error).slice(0, 200)}`));
  for (const selector of [".season-ledger-resume", ".story-modal-later", ".chronicle-page .chronicle-keep"]) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(300); }
  await page.mouse.move(200, 40); await page.waitForTimeout(2_500);
  for (let frame = 0; frame < frames; frame += 1) {
    const file = frames === 1 ? `${name}.jpg` : `${name}-${frame + 1}.jpg`;
    await page.screenshot({ path: join(out!, file), type: "jpeg", quality: 64 }); files.push(file);
    if (frame < frames - 1) await page.waitForTimeout(150);
  }
  views[name] = { game: game === url ? "this" : "base", tile, zoom, tick: scene.tick };
  await context.close();
}
const step = async (name: string, run: () => Promise<void>) => { try { await run(); console.log(name, "ok"); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); console.log(name, "FAILED"); } };

for (const [zoom, tag] of [[1, "z1.0"], [0.6, "z0.6"]] as const) {
  await step(`town-${tag}`, async () => {
    await view(`a-${tag}-before`, base, state, middle, zoom);
    await view(`a-${tag}-after`, url, state, middle, zoom);
  });
}
await step("backyards", () => view("b1-backyards-z1.4", url, state, middle, 1.4));
await step("countryside", async () => { if (country === undefined) throw new Error("no open country near the town"); await view("b2-countryside-z1.0", url, state, [country.tx, country.ty], 1); });
await step("water", async () => { if (shore === undefined) throw new Error("no shore"); await view("w-water-z1.4-paused", url, state, [shore.tx, shore.ty], 1.4, 6); });
await step("winter", async () => {
  // The next winter's middle (the season model reads the tick): the Wave 26 roofs' snow and the winter yards.
  let winter = state.tick;
  while (!isWinterTick(winter)) winter += 50;
  winter += 500; // into the winter, past its first days
  await view("s1-winter-z1.0", url, { ...state, tick: winter }, middle, 1);
});
await browser.close();
const bytes = files.reduce((total, file) => total + statSync(join(out!, file)).size, 0);
writeFileSync(join(out!, "captures.json"), JSON.stringify({ state: town.file, tick: state.tick, year: 1300 + Math.floor(state.tick / YEAR), middle, shore, country, views, files, jpegBytes: bytes, errors }, null, 1) + "\n");
console.log(JSON.stringify({ state: town.file, tick: state.tick, files: files.length, bytes, errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
