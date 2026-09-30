// INSTALL-30 pair-house evidence: the 1340 town before (the trunk, --base) and after (this build, --url).
// The 1340 town (UI-6's seed 2 chapter 2 run, the state nearest 1340 from ~/fls-ui6-states, INSTALL-26's) has no pair
// lot: the bot never merges houses. So the player's own command, `merge_houses` (gameReducer), is applied to every
// enabled neighbour merge there, repeatedly, and that one merged town is drawn by both builds:
//   p1 before / p2 after at zoom 1.0 over the pairs; p3 the same town in its next winter (snow on the Wave 30 roofs);
//   p4 the pairs abandoned (abandonedTick set on each pair: its own boarded layer).
// Paused. JPEGs of the middle of the view and captures.json (the merges, each pair's painting, what the page drew).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/install30PairCaptures.ts <out-dir> --url <this> --base <trunk> --states <ui6States dir> [--after-only]
// --after-only: p2-p4 again (this build changed, the trunk did not); p1 and its record are kept from the earlier run.
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/install30PairCaptures.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/install30PairCaptures.ts …", entry: import.meta.url });
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { BALANCE } from "../src/content/balanceConfig";
import { isWinterTick } from "../src/content/houseFoodConfig";
import { houseMergeOptions } from "../src/engine/houseMerge";
import type { GameState } from "../src/engine/engine.types";
import { houseBuiltLevel } from "../src/population/houseCondition";
import { houseBodyAssignments } from "../src/render/houseVariantChoice";
import { gameReducer } from "../src/state/gameStore";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>; mouse: { move: (x: number, y: number) => Promise<void> };
  locator: (selector: string) => { count: () => Promise<number>; first: () => { click: () => Promise<void> } }; on: (event: string, handler: (error: unknown) => void) => void };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const base = flag("base")!; const statesDir = flag("states")!; const afterOnly = process.argv.includes("--after-only");
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const YEAR = BALANCE.TICKS_PER_YEAR;
const TARGET = (1340 - 1300) * YEAR;
const candidates = readdirSync(statesDir).filter(file => file.endsWith(".json") && !file.startsWith("moments"))
  .map(file => ({ file, state: JSON.parse(readFileSync(join(statesDir, file), "utf8")) as GameState }))
  .filter(entry => typeof entry.state.tick === "number" && Array.isArray(entry.state.buildings));
const town = candidates.sort((a, b) => Math.abs(a.state.tick - TARGET) - Math.abs(b.state.tick - TARGET))[0]!;
// Every enabled merge, one at a time (a merge changes its neighbours' options), in the buildings' order.
let state = town.state;
const merges: { readonly source: string; readonly target: string }[] = [];
for (let merged = true; merged;) {
  merged = false;
  for (const building of state.buildings) {
    if (building.kind !== "house" || building.houseLot !== undefined) continue;
    const option = houseMergeOptions(state, building.id).find(entry => entry.enabled);
    if (option === undefined) continue;
    state = gameReducer(state, { type: "merge_houses", sourceBuildingId: building.id, targetBuildingId: option.targetBuildingId });
    merges.push({ source: building.id, target: option.targetBuildingId }); merged = true; break;
  }
}
const pairs = state.buildings.filter(building => building.kind === "house" && building.houseLot !== undefined);
if (pairs.length === 0) throw new Error("no merge possible in the 1340 town");
const assignments = houseBodyAssignments(state);
const painted = pairs.map(building => ({ id: building.id, tx: building.tx, ty: building.ty, lot: building.houseLot,
  level: houseBuiltLevel(state.houses.find(house => house.buildingId === building.id)!), painting: assignments.get(building.id)?.key ?? "approved" }));
const middle = [pairs.reduce((sum, pair) => sum + pair.tx, 0) / pairs.length + 0.5, pairs.reduce((sum, pair) => sum + pair.ty, 0) / pairs.length + 0.5];
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors: string[] = [];
const files: string[] = [];
const views: Record<string, unknown> = {};
// The middle of the 1280 x 800 view (the pairs), without the HUD's edges.
const CLIP = { x: 190, y: 150, width: 900, height: 540 };

async function view(name: string, game: string, scene: GameState, zoom: number) {
  const { context, page } = await openScene(browser, { state: scene, tile: middle, baseUrl: game, width: 1280, height: 800, zoom, run: false, initScript: TUTORIAL_OFF,
    query: "&story-delay=600000" }) as { context: { close: () => Promise<void> }; page: Page };
  page.on("pageerror", error => errors.push(`${name}: ${String(error).slice(0, 200)}`));
  for (const selector of [".season-ledger-resume", ".story-modal-later", ".chronicle-page .chronicle-keep"]) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(300); }
  await page.mouse.move(200, 40); await page.waitForTimeout(2_500);
  const file = `${name}.jpg`;
  await page.screenshot({ path: join(out!, file), type: "jpeg", quality: 60, clip: CLIP }); files.push(file);
  views[name] = { game: game === url ? "this" : "base", tile: middle, zoom, tick: scene.tick };
  await context.close();
}
const step = async (name: string, run: () => Promise<void>) => { try { await run(); console.log(name, "ok"); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); console.log(name, "FAILED"); } };

await step("town", async () => {
  if (!afterOnly) await view("p1-pairs-z1.0-before", base, state, 1);
  await view("p2-pairs-z1.0-after", url, state, 1);
});
await step("winter", async () => {
  // The next winter's middle, as INSTALL-26's s1.
  let winter = state.tick;
  while (!isWinterTick(winter)) winter += 50;
  winter += 500;
  await view("p3-pairs-winter-z1.0", url, { ...state, tick: winter }, 1);
});
await step("boarded", async () => {
  const ids = new Set(pairs.map(pair => pair.id));
  await view("p4-pairs-boarded-z1.0", url, { ...state, houses: state.houses.map(house => ids.has(house.buildingId) ? { ...house, abandonedTick: state.tick - 1 } : house) }, 1);
});
await browser.close();
// Kept from the earlier run (--after-only): the trunk's p1 and its view record.
const earlier = afterOnly ? JSON.parse(readFileSync(join(out!, "captures.json"), "utf8")) as { views: Record<string, unknown>; run?: string } : null;
if (earlier !== null) { files.unshift("p1-pairs-z1.0-before.jpg"); views["p1-pairs-z1.0-before"] = earlier.views["p1-pairs-z1.0-before"]; }
const bytes = files.reduce((total, file) => total + statSync(join(out!, file)).size, 0);
writeFileSync(join(out!, "captures.json"), JSON.stringify({ state: town.file, tick: state.tick, year: 1300 + Math.floor(state.tick / YEAR), merges, pairs: painted, middle, clip: CLIP,
  views, files, jpegBytes: bytes, errors }, null, 1) + "\n");
console.log(JSON.stringify({ state: town.file, tick: state.tick, pairs: painted, files: files.length, bytes, errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
