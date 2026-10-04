// UI-AUDIT-1 stuck goods: the HUD chip in two cached towns (UI-10's ~/fls-ui10-states), paused at 1280 x 800.
//   a-empty-manor-press  the 1404 town as cached: two barns over 900 wheat with the harvest waiting behind them (BOT-4's
//                        case, found by the model unstaged); the chip pressed, so the camera is on the worst barn and its
//                        inspector is open. Cropped to the right 880 px (the barn in the middle, the chip and the slot).
//   b-staged-no-road     the chapter-4 end town with one barn's wheat set to 800 and its four road-access tiles cut:
//                        the chip row only (길 없음, 외 1곳 for the fleece yard).
// JPEGs and captures.json (each scene's model rows, the chip's text and name, what the press opened).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/uiAuditStuckCaptures.ts <out-dir> --url <this> --states <ui10States dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/uiAuditStuckCaptures.ts)", { remote: "scripts/remote/run.sh render-UIAUDIT-stuck -- node_modules/.bin/tsx scripts/uiAuditStuckCaptures.ts …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { buildingRoadAccessTiles } from "../src/engine/routing";
import { stuckRows } from "../src/ui/hud/stuckStockView";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Locator = { count: () => Promise<number>; first: () => Locator; click: () => Promise<void>; textContent: () => Promise<string | null>;
  getAttribute: (name: string) => Promise<string | null>; boundingBox: () => Promise<{ x: number; y: number; width: number; height: number } | null> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<Buffer>; mouse: { move: (x: number, y: number) => Promise<void> };
  locator: (selector: string) => Locator; on: (event: string, handler: (error: unknown) => void) => void };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const load = (file: string) => JSON.parse(readFileSync(join(statesDir, file), "utf8")) as GameState;
// LM-R1: the chip reads the engine's stuck stock (FIX-11 `stuckStock`), not the UI-AUDIT-1 screen-side guess.
const rowsOf = (state: GameState) => stuckRows(state);

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors: string[] = [];
const views: Record<string, unknown> = {};
const step = async (name: string, run: () => Promise<void>) => { try { await run(); console.log(name, "ok"); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); console.log(name, "FAILED"); } };

async function open(name: string, scene: GameState, tile: readonly number[]) {
  const { context, page } = await openScene(browser, { state: scene, tile, baseUrl: url, width: 1280, height: 800, zoom: 1, run: false, initScript: TUTORIAL_OFF,
    query: "&story-delay=600000" }) as { context: { close: () => Promise<void> }; page: Page };
  page.on("pageerror", error => errors.push(`${name}: ${String(error).slice(0, 200)}`));
  for (const selector of [".season-ledger-resume", ".story-modal-later", ".chronicle-page .chronicle-keep"]) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(300); }
  await page.mouse.move(200, 40); await page.waitForTimeout(2_500);
  return { context, page };
}
const chip = async (page: Page) => {
  const found = page.locator(".stuck-goods-chip").first();
  if (await page.locator(".stuck-goods-chip").count() === 0) return null;
  return { text: await found.textContent(), label: await found.getAttribute("aria-label"), reason: await found.getAttribute("data-stuck-reason"),
    building: await found.getAttribute("data-stuck-building"), box: await found.boundingBox() };
};

await step("a-empty-manor-press", async () => {
  const state = load("empty-manor.json");
  const rows = rowsOf(state);
  const { context, page } = await open("a", state, [32, 32]);
  const before = await chip(page);
  await page.locator(".stuck-goods-chip").first().click();
  await page.waitForTimeout(2_000);
  const inspector = page.locator(".inspector-slot");
  views["a-empty-manor-press"] = { tick: state.tick, rows, chip: before, pressed: { inspectorOpen: await inspector.count() > 0,
    inspectorHeading: await inspector.count() > 0 ? (await page.locator(".inspector-slot h2, .inspector-slot h3").first().textContent()) : null } };
  await page.screenshot({ path: join(out!, "a-empty-manor-press.jpg"), type: "jpeg", quality: 45, clip: { x: 400, y: 0, width: 880, height: 800 } });
  await context.close();
});

await step("b-staged-no-road", async () => {
  const town = load("chapter4-end.json");
  const barnId = "construction-site-000064";
  const barn = town.buildings.find(building => building.id === barnId)!;
  const cut = new Set(buildingRoadAccessTiles(town, barn).map(tile => tile.ty * town.width + tile.tx));
  const state = { ...town, tiles: town.tiles.map((tile, index) => cut.has(index) ? { ...tile, hasRoad: false } : tile),
    buildings: town.buildings.map(building => building.id === barnId ? { ...building, inventory: { ...building.inventory, wheat: 800 }, stockReserved: {} } : building) } as GameState;
  const rows = rowsOf(state);
  const { context, page } = await open("b", state, [barn.tx, barn.ty]);
  const shown = await chip(page);
  views["b-staged-no-road"] = { tick: state.tick, staged: { barnId, wheat: 800, cutRoadTiles: [...cut] }, rows, chip: shown };
  const box = shown?.box ?? { x: 700, y: 60, width: 500, height: 44 };
  const left = Math.max(0, Math.floor(box.x) - 16);
  await page.screenshot({ path: join(out!, "b-staged-no-road.jpg"), type: "jpeg", quality: 60, clip: { x: left, y: 52, width: 1280 - left, height: 72 } });
  await context.close();
});

await browser.close();
writeFileSync(join(out!, "captures.json"), `${JSON.stringify({ url, views, errors }, null, 2)}\n`);
console.log(errors.length === 0 ? "captures ok" : `errors:\n${errors.join("\n")}`);
process.exit(errors.length === 0 ? 0 : 1);
