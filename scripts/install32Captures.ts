// INSTALL-32 gate: the Wave 32 granaries on the map.
//   a-before / a-after  the 1340 town (UI-6's seed 2 chapter 2 run, the state nearest 1340, from ~/fls-ui6-states) at
//                       zoom 1.0, centred on its six granaries: the trunk (--base, every granary barn.png) and this build;
//   b-states            one granary in the bare opening town (fixtures/saves/v33/new-game: its founding granary, painting b) at zoom
//                       2.0, its stock driven full (180 / 200) -> half (80) -> empty (10), then full in winter (snow),
//                       paused (boarded) and one hand short (weathered): six crops of the paused game in one strip.
// JPEGs and captures.json (the states, each granary's painting and stock, what each view drew).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/install32Captures.ts <out-dir> --url <this> --base <trunk> --states <ui6States dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/install32Captures.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/install32Captures.ts …", entry: import.meta.url });
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BALANCE } from "../src/content/balanceConfig";
import type { Building } from "../src/content/buildingConfig";
import type { GameState } from "../src/engine/engine.types";
import { stateCalendar } from "../src/engine/scenarioState";
import { granaryFill, granaryStockRatio, granaryVariantAssignments } from "../src/render/granaryVariantChoice";
import { decodeSave } from "../src/save/saveCodec";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<Buffer>; mouse: { move: (x: number, y: number) => Promise<void> };
  locator: (selector: string) => { count: () => Promise<number>; first: () => { click: () => Promise<void> } }; on: (event: string, handler: (error: unknown) => void) => void;
  setContent: (html: string) => Promise<void> };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const base = flag("base")!; const statesDir = flag("states")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const YEAR = BALANCE.TICKS_PER_YEAR;
const TARGET = (1340 - 1300) * YEAR;
const candidates = readdirSync(statesDir).filter(file => file.endsWith(".json") && !file.startsWith("moments"))
  .map(file => ({ file, state: JSON.parse(readFileSync(join(statesDir, file), "utf8")) as GameState }))
  .filter(entry => typeof entry.state.tick === "number" && Array.isArray(entry.state.buildings));
const town = candidates.sort((a, b) => Math.abs(a.state.tick - TARGET) - Math.abs(b.state.tick - TARGET))[0]!;
const granaries = town.state.buildings.filter(building => building.kind === "granary");
const middle = [granaries.reduce((sum, g) => sum + g.tx + 0.5, 0) / granaries.length, granaries.reduce((sum, g) => sum + g.ty + 0.5, 0) / granaries.length];
const describe = (state: GameState) => {
  const chosen = granaryVariantAssignments(state);
  return state.buildings.filter(building => building.kind === "granary").map(building => ({ id: building.id, tx: building.tx, ty: building.ty,
    painting: chosen.get(building.id)?.variant, stock: Math.round(granaryStockRatio(building) * 1000) / 1000, fill: granaryFill(granaryStockRatio(building)),
    workers: building.workers, paused: building.operationPaused === true }));
};

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors: string[] = [];
const files: string[] = [];
const views: Record<string, unknown> = {};

async function open(name: string, game: string, scene: GameState, tile: readonly number[], zoom: number) {
  const { context, page } = await openScene(browser, { state: scene, tile, baseUrl: game, width: 1280, height: 800, zoom, run: false, initScript: TUTORIAL_OFF,
    query: "&story-delay=600000" }) as { context: { close: () => Promise<void> }; page: Page };
  page.on("pageerror", error => errors.push(`${name}: ${String(error).slice(0, 200)}`));
  for (const selector of [".season-ledger-resume", ".story-modal-later", ".chronicle-page .chronicle-keep"]) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(300); }
  await page.mouse.move(200, 40); await page.waitForTimeout(2_500);
  views[name] = { game: game === url ? "this" : "base", tile, zoom, tick: scene.tick, year: 1300 + Math.floor(scene.tick / YEAR), granaries: describe(scene) };
  return { context, page };
}
const step = async (name: string, run: () => Promise<void>) => { try { await run(); console.log(name, "ok"); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); console.log(name, "FAILED"); } };

await step("town", async () => {
  for (const [name, game] of [["a-1340-z1.0-before", base], ["a-1340-z1.0-after", url]] as const) {
    const { context, page } = await open(name, game, town.state, middle, 1);
    await page.screenshot({ path: join(out!, `${name}.jpg`), type: "jpeg", quality: 60 }); files.push(`${name}.jpg`);
    await context.close();
  }
});

await step("states", async () => {
  const bare = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v33/new-game.save.json"))).envelope.state as GameState;
  const founding = bare.buildings.find(building => building.kind === "granary")!;
  let winter = bare.tick;
  while (stateCalendar({ ...bare, tick: winter }).season !== 3) winter += 50;
  winter += 500;
  const scene = (label: string, fields: Partial<Building>, tick = bare.tick) => ({ label,
    state: { ...bare, tick, buildings: bare.buildings.map(building => building.id === founding.id ? { ...building, ...fields } as Building : building) } as GameState });
  const scenes = [
    scene("full 180/200", { inventory: { bread: 100, wheat: 80 } }),
    scene("half 80/200", { inventory: { bread: 40, wheat: 40 } }),
    scene("empty 10/200", { inventory: { bread: 10 } }),
    scene("winter, full: snow", { inventory: { bread: 100, wheat: 80 } }, winter),
    scene("paused: boarded", { inventory: { bread: 100, wheat: 80 }, operationPaused: true, workers: 0 }),
    scene("1 of 2 hands: weathered", { inventory: { bread: 40, wheat: 40 }, workers: 1 }),
  ];
  const zoom = 2;
  const crops: { label: string; data: string }[] = [];
  for (const [index, entry] of scenes.entries()) {
    const { context, page } = await open(`b-${index + 1}`, url, entry.state, [founding.tx + 0.5, founding.ty + 0.5], zoom);
    const shot = await page.screenshot({ type: "png", clip: { x: 640 - 150, y: 400 - 230, width: 300, height: 300 } });
    crops.push({ label: entry.label, data: shot.toString("base64") });
    await context.close();
  }
  type Sheet = { newPage: () => Promise<Page>; close: () => Promise<void> };
  const context = await (browser as unknown as { newContext: (options: object) => Promise<Sheet> }).newContext({ viewport: { width: 6 * 300, height: 330 } });
  const page = await context.newPage();
  await page.setContent(`<body style="margin:0;display:flex;background:#222;font:14px sans-serif;color:#eee">${crops.map(crop =>
    `<figure style="margin:0;width:300px"><img src="data:image/png;base64,${crop.data}" width="300" height="300" style="display:block"><figcaption style="height:30px;line-height:30px;text-align:center">${crop.label}</figcaption></figure>`).join("")}</body>`);
  await page.screenshot({ path: join(out!, "b-granary-states.jpg"), type: "jpeg", quality: 72, fullPage: true }); files.push("b-granary-states.jpg");
  await context.close();
});
await browser.close();
const bytes = files.reduce((total, file) => total + statSync(join(out!, file)).size, 0);
writeFileSync(join(out!, "captures.json"), JSON.stringify({ state: town.file, tick: town.state.tick, year: 1300 + Math.floor(town.state.tick / YEAR), middle, views, files, jpegBytes: bytes, errors }, null, 1) + "\n");
console.log(JSON.stringify({ state: town.file, tick: town.state.tick, files: files.length, bytes, errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
