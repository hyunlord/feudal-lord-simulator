// LM-R1 hud captures (the playtest's six blockers in real states, lord mode's pins, the sandbox's drawer unchanged), on
// the DGX. The chapter-1 town is the v24 palisade-construction save (walls going up, chapter 1); its variants change one
// thing each (a hamlet short of timber with its stores full, a barn of bound wheat and a hungry house, a burnt house).
// The chapter-2 town is the ui6 `raid` state (1337's war, as scripts/nat4PauseHolds.mjs opens chapter 2); lord mode is
// the lord's slice at its start; the sandbox a new sandbox.
//  01 pin-rail          the town goal's card on the rail: its next action and button (chapter 1, after the tutorial)
//  02 pin-drawer        the goal log: the chapter and the town goal side by side, the next action, the finished goals folded
//  03 timber-stuck      a hamlet short of timber with every store full: the rail says so and its button is the full store;
//                       the stuck chip names the store's fullness (받을 곳 가득 · 창고 200/200)
//  04 sawmill-card      the sawmill's map card: its pile and the 창고 보기 jump; 05 after the jump (the store's card)
//  06 food-breakdown    the food cell pressed: total, milling, carrying (782 bound wheat), access, hungry households
//  07 season-first      the first season card (it opened by itself) asking how the next ones come; 08 the stacked notice
//  09 burnt-house       a burnt house's card: 다시 짓는 중 / 필요한 조건 / 지금 할 일 and 다시 짓기
//  10 chapter2-drawer   chapter 2's flow beside its town goal
//  11 lord-pins-1280, 12 lord-pins-tablet   lord mode: 명령 opens the command pins (no layer switch)
//  13 sandbox-drawer    the sandbox's build drawer as before (no pins)
// JPEG (small) and captures.json (the texts each capture shows, and what a press opened).
//   scripts/remote/run.sh render-LMR1-hud-<sha7> -- bash scripts/lmr1HudCaptures.sh
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/lmr1HudCaptures.ts)", { remote: "scripts/remote/run.sh render-LMR1-hud-<sha7> -- bash scripts/lmr1HudCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LORD_SLICE_SCENARIO_ID, SANDBOX_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";
import { newGameState } from "../src/state/newGame";
import { TUTORIAL_COPY } from "../src/ui/tutorial/tutorialCopy.ko";
import { TUTORIAL_STEP_IDS } from "../src/ui/tutorial/tutorialModel";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Box = { x: number; y: number; width: number; height: number };
type Locator = { count: () => Promise<number>; first: () => Locator; click: (options?: object) => Promise<void>; textContent: () => Promise<string | null>;
  boundingBox: () => Promise<Box | null>; isVisible: () => Promise<boolean> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<Buffer>; locator: (selector: string) => Locator;
  mouse: { move: (x: number, y: number) => Promise<void>; click: (x: number, y: number) => Promise<void> }; keyboard: { press: (key: string) => Promise<void> };
  evaluate: <T>(f: (arg: never) => T, arg?: unknown) => Promise<T>; waitForSelector: (selector: string, options?: object) => Promise<unknown>;
  on: (event: string, handler: (error: unknown) => void) => void };
type Proof = { __FEUDAL_PHASE10_PROOF__: { tileClientPoint: (t: { tx: number; ty: number }) => { clientX: number; clientY: number } } };

const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const states6 = flag("states6")!;
mkdirSync(out!, { recursive: true });

// The tutorial finished (its thirteen steps in the log, as a player who did it), off; later seasons a notice.
const finishedLog = TUTORIAL_STEP_IDS.map(id => ({ id, title: (TUTORIAL_COPY.cards as Record<string, { title: string }>)[{ well_done: "wellDone", arable_limits: "arableLimits",
  food_chain: "foodChain", zone_unlock: "zoneUnlock", burgage_done: "burgageDone", wrap_up: "wrapUp" }[id as string] ?? id]?.title ?? id, already: false }));
const init = (seasons: "unset" | "notice") => `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', ${JSON.stringify(JSON.stringify({ enabled: false, acks: [], pulsed: [], log: finishedLog }))});`
  + (seasons === "notice" ? ` localStorage.setItem('feudal.seasonLedgerAuto', '0');` : "") + ` } catch (error) { void error; }`;

const town = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v24/palisade-construction.save.json"))).envelope.state as GameState;
const sawmill = town.buildings.find(building => building.kind === "sawmill")!;
const barn = town.buildings.find(building => building.kind === "farmstead")!;
const house = town.houses.find(entry => entry.residents > 0)!;
const houseBuilding = town.buildings.find(building => building.id === house.buildingId)!;
const hamletStuck: GameState = { ...town, era: "hamlet", palisade: null, constructionSites: town.constructionSites.filter(site => site.kind !== "palisade_segment"),
  buildings: town.buildings.map(building => building.kind === "storehouse" ? { ...building, inventory: { logs: 200 }, reserved: {} }
    : building.id === sawmill.id ? { ...building, inventory: { ...building.inventory, timber: 6 } } : building) };
const hungry: GameState = { ...town,
  buildings: town.buildings.map(building => building.id === barn.id ? { ...building, inventory: { ...building.inventory, wheat: 782 }, stuckSinceTick: { wheat: town.tick - 400 } } : building),
  houses: town.houses.map(entry => entry.buildingId === house.buildingId ? { ...entry, breadStock: 0, starvationGraceUntilTick: 0, emptyFoodTicks: 100_000 } : entry) };
const burnt: GameState = { ...town, houses: town.houses.map(entry => entry.buildingId === house.buildingId ? { ...entry, burntTick: town.tick - 10, burntByEventId: "fire-lmr1" } : entry) };
const lord = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID })!;
const sandbox = newGameState({ scenarioId: SANDBOX_SCENARIO_ID })!;
const seatOf = (state: GameState) => { const seat = state.buildings.find(building => building.kind === "manor_house" || building.kind === "keep") ?? state.buildings[0]!; return [seat.tx, seat.ty]; };

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors: string[] = [];
const views: Record<string, unknown> = {};
/** What each map click opened (the building cards' headings), for a capture that did not find its card. */
const picked: string[] = [];
const step = async (name: string, run: () => Promise<void>) => { try { await run(); console.log(name, "ok"); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); console.log(name, "FAILED"); } };
const shot = (page: Page, name: string, clip?: Box) => page.screenshot({ path: join(out!, `${name}.jpg`), type: "jpeg", quality: 50, ...(clip === undefined ? {} : { clip }) });
const text = async (page: Page, selector: string) => (await page.locator(selector).count()) > 0 ? (await page.locator(selector).first().textContent())?.trim() ?? null : null;
const point = async (page: Page, tx: number, ty: number) => { const p = await page.evaluate((t: never) => (window as unknown as Proof).__FEUDAL_PHASE10_PROOF__.tileClientPoint(t), { tx, ty }); return { x: p.clientX, y: p.clientY }; };

/** Click around the building's tile until its map card shows `until` (a neighbour's sprite can take a click); a wrong
 * card is closed by its own button (Esc on an empty screen would open the pause menu). */
async function selectBuilding(page: Page, building: { readonly tx: number; readonly ty: number }, until: string): Promise<boolean> {
  const at = await point(page, building.tx, building.ty);
  for (const [dx, dy] of [[0, 0], [0, -8], [0, -16], [0, 6], [-10, -4], [10, -4], [0, -24]] as const) {
    await page.mouse.click(at.x + dx, at.y + dy); await page.waitForTimeout(900);
    picked.push(`${building.tx},${building.ty} +${dx},${dy}: ${await text(page, ".diagnostic-card h2") ?? "-"}`);
    if (await page.locator(until).count() > 0) return true;
    if (await page.locator(".diagnostic-card .inspector-close").count() > 0) { await page.locator(".diagnostic-card .inspector-close").first().click(); await page.waitForTimeout(300); }
  }
  return false;
}

async function open(name: string, scene: GameState, tile: readonly number[], options: { readonly run?: boolean; readonly seasons?: "unset" | "notice"; readonly width?: number; readonly height?: number; readonly touch?: boolean } = {}) {
  const { context, page } = await openScene(browser, { state: scene, tile, baseUrl: url, width: options.width ?? 1280, height: options.height ?? 800, zoom: 1,
    run: options.run ?? false, hasTouch: options.touch ?? false, initScript: init(options.seasons ?? "notice"), query: "&story-delay=600000&weather=none", loadTimeout: 90_000 }) as { context: { close: () => Promise<void> }; page: Page };
  page.on("pageerror", error => errors.push(`${name}: ${String(error).slice(0, 200)}`));
  for (const selector of [".season-ledger-resume", ".story-modal-later", ".chronicle-page .chronicle-keep"]) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(300); }
  // The pointer rests over the status pill (a window edge would pan the camera).
  await page.mouse.move(80, 105); await page.waitForTimeout(1_500);
  return { context, page };
}

await step("01-02 pin", async () => {
  const { context, page } = await open("pin", town, [houseBuilding.tx, houseBuilding.ty]);
  views["01-pin-rail"] = { title: await text(page, '[data-goal-card="settlement"] .goal-card-title'), next: await text(page, '[data-goal-card="settlement"] .goal-card-why'),
    cta: await text(page, '[data-tutorial-cta="settlement"]') };
  await shot(page, "01-pin-rail", { x: 0, y: 0, width: 560, height: 220 });
  await page.locator(".goal-drawer-toggle").first().click(); await page.waitForTimeout(700);
  views["02-pin-drawer"] = { chapter: await text(page, ".goal-pin-chapter"), town: await text(page, ".goal-pin-town"), next: await text(page, ".goal-pin-next"),
    doneFolded: await page.evaluate(() => (document.querySelector(".goal-drawer-done") as HTMLDetailsElement | null)?.open === false) };
  const slot = await page.locator(".goal-slot").first().boundingBox();
  await shot(page, "02-pin-drawer", slot === null ? undefined : { x: Math.max(0, slot.x - 8), y: Math.max(0, slot.y - 8), width: Math.min(1280 - slot.x + 8, slot.width + 16), height: Math.min(800 - slot.y + 8, slot.height + 16) });
  await context.close();
});

await step("03-05 stuck", async () => {
  const { context, page } = await open("stuck", hamletStuck, [sawmill.tx, sawmill.ty]);
  views["03-timber-stuck"] = { next: await text(page, '[data-goal-card="settlement"] .goal-card-why'), cta: await text(page, '[data-tutorial-cta="settlement"]'),
    chip: await text(page, ".stuck-goods-chip") };
  await shot(page, "03-timber-stuck", { x: 0, y: 0, width: 1280, height: 230 });
  if (!await selectBuilding(page, sawmill, ".diagnostic-card .inspector-stuck-store")) throw new Error("the sawmill's card did not open");
  const card = async () => page.locator(".diagnostic-card").first().boundingBox();
  views["04-sawmill-card"] = { heading: await text(page, ".diagnostic-card h2"), pile: await text(page, ".inspector-stuck-store"), jump: await text(page, ".inspector-stuck-store-jump") };
  const before = await card();
  await shot(page, "04-sawmill-card", before === null ? undefined : { x: Math.max(0, before.x - 8), y: Math.max(0, before.y - 8), width: Math.min(1280 - Math.max(0, before.x - 8), before.width + 16), height: Math.min(800 - Math.max(0, before.y - 8), before.height + 16) });
  await page.locator(".inspector-stuck-store-jump").first().click(); await page.waitForTimeout(1_200);
  views["05-store-after-jump"] = { heading: await text(page, ".diagnostic-card h2"), body: (await text(page, ".diagnostic-card .inspector-body"))?.slice(0, 160) ?? null };
  await shot(page, "05-store-after-jump");
  await context.close();
});

await step("06 food", async () => {
  const { context, page } = await open("food", hungry, [barn.tx, barn.ty]);
  await page.locator(".status-pill-cell[data-food-days]").first().click(); await page.waitForTimeout(600);
  views["06-food-breakdown"] = { cell: await text(page, ".status-pill-cell[data-food-days]"), rows: await text(page, ".food-breakdown-rows"), go: await text(page, ".food-breakdown-go") };
  const panel = await page.locator(".food-breakdown").first().boundingBox();
  await shot(page, "06-food-breakdown", { x: 0, y: 0, width: Math.min(1280, Math.ceil((panel?.x ?? 0) + (panel?.width ?? 520)) + 16), height: Math.min(800, Math.ceil((panel?.y ?? 0) + (panel?.height ?? 360)) + 16) });
  await context.close();
});

await step("07-08 seasons", async () => {
  const { context, page } = await open("seasons", town, [houseBuilding.tx, houseBuilding.ty], { run: true, seasons: "unset" });
  await page.keyboard.press("Digit3");
  await page.waitForSelector(".season-ledger-card", { timeout: 150_000 }); await page.waitForTimeout(900);
  views["07-season-first"] = { ask: await text(page, ".season-ledger-first"), pressed: await text(page, ".season-ledger-first [aria-pressed='true']") };
  const card = await page.locator(".season-ledger-card").first().boundingBox();
  await shot(page, "07-season-first", card === null ? undefined : { x: Math.max(0, card.x - 8), y: Math.max(0, card.y - 8), width: card.width + 16, height: Math.min(800 - Math.max(0, card.y - 8), card.height + 16) });
  await page.locator(".season-ledger-resume").first().click(); await page.waitForTimeout(400);
  await page.keyboard.press("Digit3");
  await page.waitForSelector(".season-notice", { timeout: 150_000 }); await page.waitForTimeout(600);
  views["08-season-notice"] = { notice: await text(page, ".season-notice"), cardOpen: await page.locator(".season-ledger-card").count() > 0 };
  await shot(page, "08-season-notice", { x: 640, y: 0, width: 640, height: 260 });
  await page.locator(".season-notice").first().click(); await page.waitForTimeout(700);
  views["08-season-notice"] = { ...views["08-season-notice"] as object, openedCard: await page.locator(".season-ledger-card").count() > 0, noticeAfter: await page.locator(".season-notice").count() };
  await context.close();
});

await step("09 burnt", async () => {
  const { context, page } = await open("burnt", burnt, [houseBuilding.tx, houseBuilding.ty]);
  if (!await selectBuilding(page, houseBuilding, ".diagnostic-card .inspector-burnt")) throw new Error("the burnt house's card did not open");
  views["09-burnt-house"] = { section: await text(page, ".inspector-burnt"), button: await text(page, ".inspector-burnt-rebuild") };
  const card = await page.locator(".diagnostic-card").first().boundingBox();
  await shot(page, "09-burnt-house", card === null ? undefined : { x: Math.max(0, card.x - 8), y: Math.max(0, card.y - 8), width: Math.min(1280 - Math.max(0, card.x - 8), card.width + 16), height: Math.min(800 - Math.max(0, card.y - 8), card.height + 16) });
  await page.locator(".inspector-burnt-rebuild").first().click(); await page.waitForTimeout(900);
  views["09-burnt-house"] = { ...views["09-burnt-house"] as object, afterRebuild: await text(page, "[data-burnt-status]") };
  await context.close();
});

await step("10 chapter 2", async () => {
  const raid = JSON.parse(readFileSync(join(states6, "raid.json"), "utf8")) as GameState;
  const { context, page } = await open("chapter2", raid, seatOf(raid));
  await page.locator(".goal-drawer-toggle").first().click(); await page.waitForTimeout(700);
  views["10-chapter2-drawer"] = { chapter: await text(page, ".goal-pin-chapter"), town: await text(page, ".goal-pin-town"), next: await text(page, ".goal-pin-next") };
  const slot = await page.locator(".goal-slot").first().boundingBox();
  await shot(page, "10-chapter2-drawer", slot === null ? undefined : { x: Math.max(0, slot.x - 8), y: Math.max(0, slot.y - 8), width: Math.min(1280 - slot.x + 8, slot.width + 16), height: Math.min(800 - slot.y + 8, slot.height + 16) });
  await context.close();
});

for (const [name, width, height, touch] of [["11-lord-pins-1280", 1280, 800, false], ["12-lord-pins-tablet", 1180, 820, true]] as const) {
  await step(name, async () => {
    const { context, page } = await open(name, lord, seatOf(lord), { run: true, width, height, touch });
    const layers = await page.locator(".layer-switch").first().isVisible();
    await page.locator("[data-dock='build']").first().click(); await page.waitForTimeout(600);
    views[name] = { dock: await text(page, "[data-dock='build']"), layerSwitchVisible: layers, pins: await text(page, ".command-pins"), drawer: await page.locator(".court-console.build-drawer").count() };
    await shot(page, name);
    await context.close();
  });
}

await step("13 sandbox drawer", async () => {
  const { context, page } = await open("sandbox", sandbox, seatOf(sandbox), { run: true });
  await page.locator("[data-dock='build']").first().click(); await page.waitForTimeout(600);
  views["13-sandbox-drawer"] = { dock: await text(page, "[data-dock='build']"), drawerOpen: await page.locator(".court-console.build-drawer[data-open='true']").count(),
    pins: await page.locator(".command-pins").count(), layerSwitchVisible: await page.locator(".layer-switch").first().isVisible() };
  await shot(page, "13-sandbox-drawer");
  await context.close();
});

await browser.close();
writeFileSync(join(out!, "captures.json"), `${JSON.stringify({ url, views, picked, errors }, null, 2)}\n`);
console.log(errors.length === 0 ? "captures ok" : `errors:\n${errors.join("\n")}`);
process.exit(errors.length === 0 ? 0 : 1);
