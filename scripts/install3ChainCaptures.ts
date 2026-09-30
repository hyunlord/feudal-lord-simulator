// INSTALL-3 gate ①: the ale chain as a player sees it, world first then UI, on the human path's replayed states
// (scripts/install3States.ts: the barn to barley and a malt kiln by command, then the world left to run):
//   01 the barn: its strips still wheat → its card after choosing barley in the page (the crop select, the game command
//      through the store, "from the next sowing");
//   02 the kiln's site beside the barn (world) → the kiln's placement chip (UI: 재료 보리 · 만듦 엿기름);
//   03 the barley sown and growing (world) → the barn's card (보리);
//   04 the barley ripe (world);
//   05 the harvest in the barn: barley sacks (world) → the barn's stock (UI);
//   06 the kiln working: flue smoke, malt sacks (world) → the kiln's stock, barley and malt (UI);
//   07 a house brewing: ale barrels at its door (world) → the ledger drawer's barley and malt (UI);
//   08 the alehouse with its ale stake (world) → a house served by ale (UI: 에일을 마십니다);
//   09 ale sold at the alehouse (world, the first sale's tick) → the season card's ale line (UI: 지금 영지에 보리·엿기름·에일).
// Gate ② (zoom 0.6: barley strips told from wheat) is scripts/install3WorldCaptures.ts's field-* shots (one strip's field each).
// World shots are 640 x 400 crops at zoom 1.3 around the subject; UI shots are the element. JPEG, and captures.json.
// INSTALL-3b ②: INSTALL-3's world shots showed forest and rock — the pointer parked at (4, 4) before each shot sat in
// the 20 px edge-pan band (gameCanvasRuntimeInput EDGE_PAN_MARGIN_PX) and dragged the camera up-left. The pointer now
// rests on the HUD's date bar (off the canvas, outside the band), buildings are centred on their footprint's middle,
// and every world shot checks its subject: the subject's tile, read after the shot, must lie inside the crop (the
// check and the point go to captures.json; a subject outside fails the step).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/install3ChainCaptures.ts <out-dir> --url <game> --states <install3States dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/install3ChainCaptures.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/install3ChainCaptures.ts …", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { arableLayouts } from "../src/zones/arableFields";
import { BUILDING_CONFIG_BY_KIND } from "../src/content/buildingConfig";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Locator = { first: () => Locator; count: () => Promise<number>; waitFor: (options?: object) => Promise<void>; click: (options?: object) => Promise<void>;
  screenshot: (options: object) => Promise<unknown> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; evaluate: <T, A>(f: (arg: A) => T, arg?: A) => Promise<T>; locator: (selector: string) => Locator;
  getByRole: (role: string, options: object) => Locator; screenshot: (options: object) => Promise<unknown>;
  mouse: { click: (x: number, y: number) => Promise<void>; move: (x: number, y: number) => Promise<void> }; keyboard: { press: (key: string) => Promise<void> };
  on: (event: string, handler: (error: unknown) => void) => void };
type Proof = { tileClientPoint: (tile: object) => { clientX: number; clientY: number } };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
// INSTALL-3b: zoom 1.3, just under the wall segments' own tags (wallSiteLabels WALL_SEGMENT_LABEL_MIN_ZOOM 1.35): at 1.4
// every wall segment on screen tagged itself over the chain's subjects.
const WIDTH = 1600, HEIGHT = 1000, ZOOM = 1.3;
const CROP = { x: WIDTH / 2 - 320, y: HEIGHT / 2 - 220, width: 640, height: 400 };
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const moments = JSON.parse(readFileSync(join(statesDir, "moments.json"), "utf8")) as Record<string, Record<string, unknown>>;
const load = (name: string) => JSON.parse(readFileSync(join(statesDir, `${name}.json`), "utf8")) as GameState;
const result: Record<string, unknown> = {};
const errors: string[] = [];
const files: string[] = [];
/** The middle of the building's footprint (a 2 x 2 kiln's middle is its origin + 1, not + 0.5). */
const tileOf = (state: GameState, id: string): [number, number] => { const building = state.buildings.find(candidate => candidate.id === id)!;
  const size = BUILDING_CONFIG_BY_KIND[building.kind]; return [building.tx + size.width / 2, building.ty + size.height / 2]; };
/** A point on the HUD's date bar: off the canvas (no hover card) and 20 px or more from every edge (no edge pan). */
const POINTER_REST = { x: 200, y: 40 };

async function scene(state: GameState, tile: readonly number[], run = false) {
  const { context, page } = await openScene(browser, { state, tile, baseUrl: url, width: WIDTH, height: HEIGHT, zoom: ZOOM, run, initScript: TUTORIAL_OFF,
    query: "&story-delay=600000&weather=none" }) as { context: { close: () => Promise<void> }; page: Page };
  page.on("pageerror", error => errors.push(String(error).slice(0, 200)));
  for (const selector of [".story-modal-later", ".chronicle-page .chronicle-keep"]) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(300); }
  await page.waitForTimeout(1_200);
  return { page, close: () => context.close() };
}
const framing: Record<string, { subject: readonly number[]; clientX: number; clientY: number; inCrop: boolean }> = {};
/** The world shot of `subject` (a tile), then the check that the subject is inside the crop. */
async function world(page: Page, file: string, subject: readonly number[]) {
  await page.mouse.move(POINTER_REST.x, POINTER_REST.y); await page.waitForTimeout(250);
  await page.screenshot({ path: join(out!, file), type: "jpeg", quality: 62, clip: CROP }); files.push(file);
  const at = await page.evaluate(spot => (window as unknown as { __FEUDAL_PHASE10_PROOF__: Proof }).__FEUDAL_PHASE10_PROOF__.tileClientPoint(spot), { tx: subject[0]!, ty: subject[1]! });
  const inCrop = at.clientX >= CROP.x && at.clientX <= CROP.x + CROP.width && at.clientY >= CROP.y && at.clientY <= CROP.y + CROP.height;
  framing[file] = { subject, clientX: Math.round(at.clientX), clientY: Math.round(at.clientY), inCrop };
  if (!inCrop) throw new Error(`${file}: the subject ${subject.join(",")} is at ${Math.round(at.clientX)},${Math.round(at.clientY)}, outside the crop`);
}
async function ui(locator: Locator, file: string) { await locator.first().waitFor({ timeout: 10_000 }); await locator.first().screenshot({ path: join(out!, file), type: "jpeg", quality: 62 }); files.push(file); }
/** Clicks the building at `tile`; a walker or cart passing over it can take the click, so a few nearby points are tried. */
async function selectAt(page: Page, tile: readonly number[]) {
  for (const [dx, dy] of [[0, 0], [0.25, -0.25], [-0.25, 0.25], [0.3, 0.3]] as const) {
    const at = await page.evaluate(spot => (window as unknown as { __FEUDAL_PHASE10_PROOF__: Proof }).__FEUDAL_PHASE10_PROOF__.tileClientPoint(spot), { tx: tile[0]! + dx, ty: tile[1]! + dy });
    await page.mouse.click(at.clientX, at.clientY); await page.waitForTimeout(700);
    if (await page.locator(".diagnostic-card").count() > 0) return;
    await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  }
}
const card = (page: Page) => page.locator(".diagnostic-card");
/** Scrolls the card's own body so `selector` shows (an element shot shows what is in view). */
const reveal = (page: Page, selector: string) => page.evaluate(query => { document.querySelector(query)?.scrollIntoView({ block: "center" }); }, selector).then(() => page.waitForTimeout(250));
async function step(name: string, run: () => Promise<Record<string, unknown> | void>) {
  try { const about = await run(); result[name] = { ...(about ?? {}) }; console.log(name, "ok"); }
  catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); console.log(name, "FAILED", String(error).slice(0, 200)); }
}
const barnId = moments["m0-before"]!.barn as string;
/** The middle of the fields whose strips carry barley (zone membership cells: index = ty × width + tx). */
function barleyFields(state: GameState, crop: "barley" | "wheat" = "barley"): [number, number] {
  // The cells of the strips sown with `crop` (not fallow) in the field with the most of them (the layout gives each strip's cells).
  const sown = new Map((state.arableFields ?? []).flatMap(field => field.strips).filter(strip => strip.crop === crop && strip.stage !== "fallow" && strip.stage !== "ploughed")
    .map(strip => [strip.id, strip] as const));
  const byZone = new Map<string, { tx: number; ty: number }[]>();
  for (const layout of arableLayouts(state)) for (const strip of layout.strips) if (sown.has(strip.id)) {
    const cells = byZone.get(strip.zoneId) ?? []; cells.push(...strip.cells); byZone.set(strip.zoneId, cells);
  }
  const cells = [...byZone.values()].sort((a, b) => b.length - a.length)[0];
  if (cells === undefined || cells.length === 0) return tileOf(state, barnId);
  // The field's front (largest tx + ty, drawn last): the strips there are not behind the houses at zoom 0.6's blocks.
  const front = Math.max(...cells.map(cell => cell.tx + cell.ty));
  const near = cells.filter(cell => cell.tx + cell.ty >= front - 3);
  return [near.reduce((sum, cell) => sum + cell.tx, 0) / near.length + 0.5, near.reduce((sum, cell) => sum + cell.ty, 0) / near.length + 0.5];
}

await step("01-barn-to-barley", async () => {
  const state = load("m0-before"); const tile = tileOf(state, barnId);
  const { page, close } = await scene(state, tile);
  await world(page, "g01a-world-barn-wheat.jpg", tile);
  await selectAt(page, tile);
  await page.locator(".inspector-crop-select .ui-select-trigger").click(); await page.waitForTimeout(300);
  await page.locator('.inspector-crop-select [role="option"]:nth-child(2)').click(); await page.waitForTimeout(700);
  await ui(card(page), "g01b-ui-barn-barley-chosen.jpg");
  await close();
  return { tick: state.tick, barn: barnId };
});
await step("02-kiln-site", async () => {
  const state = load("m2-kiln-site"); const at = moments["m2-kiln-site"]!.kilnAt as [number, number];
  const { page, close } = await scene(state, [at[0] + 1, at[1] + 1]);
  await world(page, "g02a-world-kiln-site.jpg", [at[0] + 1, at[1] + 1]);
  await close();
  // The kiln armed from the build menu shows its placement chip (the same moment before the command).
  const before = load("m0-before");
  const second = await scene(before, [at[0] + 1, at[1] + 1]);
  await second.page.locator("[data-dock='build']").first().click(); await second.page.waitForTimeout(500);
  await second.page.locator("[data-category='trade']").first().click(); await second.page.waitForTimeout(400);
  await second.page.locator('.build-tool[aria-label="엿기름 가마"]').first().click(); await second.page.waitForTimeout(500);
  const spot = await second.page.evaluate(tile => (window as unknown as { __FEUDAL_PHASE10_PROOF__: Proof }).__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), { tx: at[0], ty: at[1] });
  await second.page.mouse.move(spot.clientX, spot.clientY); await second.page.waitForTimeout(700);
  await ui(second.page.locator(".placement-chip"), "g02b-ui-kiln-chip.jpg");
  await second.close();
  return { tick: state.tick, kilnAt: at };
});
await step("03-barley-growing", async () => {
  const state = load("m4-barley-growing"); const tile = tileOf(state, barnId);
  const strips = barleyFields(state); const fields = await scene(state, strips);
  await world(fields.page, "g03a-world-barley-growing.jpg", strips);
  await fields.close();
  const { page, close } = await scene(state, tile);
  await selectAt(page, tile);
  await ui(card(page), "g03b-ui-barn-barley.jpg");
  await close();
  return { tick: state.tick };
});
await step("04-barley-ripe", async () => {
  const state = load("m5-barley-ripe"); const strips = barleyFields(state); const { page, close } = await scene(state, strips);
  await world(page, "g04a-world-barley-ripe.jpg", strips);
  await close();
  return { tick: state.tick };
});
await step("05-harvest", async () => {
  const state = load("m7-barley-in-barn"); const tile = tileOf(state, barnId);
  const { page, close } = await scene(state, tile);
  await world(page, "g05a-world-barn-barley-sacks.jpg", tile);
  await selectAt(page, tile);
  await reveal(page, ".inspector-stock");
  await ui(card(page), "g05b-ui-barn-stock.jpg");
  await close();
  return { tick: state.tick, barley: moments["m7-barley-in-barn"]!.barley };
});
await step("06-malt", async () => {
  const state = load("m8-malt"); const kiln = moments["m8-malt"]!.kiln as string; const tile = tileOf(state, kiln);
  // The flue smokes while the kiln works (manned, barley in hand or a batch under way): read from the state, paused is fine.
  const { page, close } = await scene(state, tile);
  await world(page, "g06a-world-kiln-working.jpg", tile);
  await selectAt(page, tile);
  await reveal(page, ".inspector-stock");
  await ui(card(page), "g06b-ui-kiln-stock.jpg");
  await close();
  return { tick: state.tick, kiln };
});
await step("07-brewing", async () => {
  const state = load("m9-brewing"); const house = moments["m9-brewing"]!.house as string; const tile = tileOf(state, house);
  const { page, close } = await scene(state, tile);
  await world(page, "g07a-world-house-brewing.jpg", tile);
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(700);
  await ui(page.locator(".ledger-drawer"), "g07b-ui-ledger.jpg");
  await close();
  return { tick: state.tick, house };
});
await step("08-alehouse", async () => {
  // The first alehouse whose click opens its own house card (a palisade site on a nearby tile can take the click).
  const state = load("m10-alehouse");
  const ids = [moments["m10-alehouse"]!.alehouse as string, ...state.houses.map(house => house.buildingId)];
  const { alehouses } = await import("../src/engine/ale");
  // The stake shows on a single-lot level 2 alehouse holding ale (INSTALL-3 world rule): those first.
  const stake = (id: string) => { const house = state.houses.find(entry => entry.buildingId === id); const building = state.buildings.find(entry => entry.id === id);
    return house?.level === 2 && building?.houseLot === undefined ? 0 : 1; };
  const candidates = [...new Set(ids)].filter(id => alehouses(state).includes(id)).sort((a, b) => stake(a) - stake(b));
  for (const house of candidates.slice(0, 8)) {
    const tile = tileOf(state, house);
    const { page, close } = await scene(state, tile);
    await selectAt(page, tile);
    // A house card's heading reads "주택 · 생활 등급 N"; a site's reads "건설 현장".
    const kind = await page.evaluate(() => document.querySelector(".diagnostic-card")?.textContent?.slice(0, 80) ?? "", undefined);
    if (!kind.includes("생활 등급")) { await close(); continue; }
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    await world(page, "g08a-world-alehouse-stake.jpg", tile);
    await selectAt(page, tile);
    await ui(card(page), "g08b-ui-house-served.jpg");
    await close();
    return { tick: state.tick, alehouse: house, card: kind };
  }
  throw new Error("no alehouse card opened");
});
await step("09-sold", async () => {
  const state = load("m11-ale-sold"); const house = (moments["m11-ale-sold"]!.alehouses as string[])[0]!; const tile = tileOf(state, house);
  const { page, close } = await scene(state, tile);
  await world(page, "g09a-world-ale-sold.jpg", tile);
  await close();
  // The season's close after the first sale: the season card's ale line (m9-brewing run at 5x to the close).
  const brewing = load("m9-brewing");
  const second = await scene(brewing, tile, true);
  await second.page.getByRole("button", { name: "5배속", exact: true }).click().catch(() => undefined);
  await second.page.locator(".season-ledger-card").first().waitFor({ timeout: 60_000 });
  await ui(second.page.locator(".season-ledger-card"), "g09b-ui-season-ale.jpg");
  await second.close();
  return { tick: state.tick, alehouse: house };
});
await browser.close();
const bytes = files.reduce((total, file) => total + statSync(join(out!, file)).size, 0);
writeFileSync(join(out!, "captures.json"), JSON.stringify({ order: "world → UI per step", steps: result, framing, files, jpegBytes: bytes, errors }, null, 1) + "\n");
console.log(JSON.stringify({ steps: Object.keys(result).length, files: files.length, bytes, errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
