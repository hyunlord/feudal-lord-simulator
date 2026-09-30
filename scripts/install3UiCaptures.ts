// INSTALL-3 UI captures (JPEG element shots of the replayed states of scripts/install3States.ts: the C4 human path's two
// commands through the reducer, then the world left to run; moments m0…m11 and their ticks in its moments.json):
//  u01 the barn card's crop select on wheat (m0-before), u02 the same barn after choosing barley in the select (the
//      click in the page: the game command goes through the store; its wheat still in the ground says it changes at sowing);
//  u04 the ledger drawer with barley and malt (m8-malt); u05 the barn's stock with barley (m7-barley-in-barn); u06 the malt
//      kiln's stock with barley and malt (m8-malt); u07 a granary's storage inspector with malt, when one holds it;
//  u08 the malt kiln's placement chip (m0-before, the kiln armed from the build menu);
//  u09 a house's progress line unserved by ale (m0-before), with its development conditions open; u10 one served (m11-ale-sold);
//  u11 the season card's ale cause (m1-barn-barley runs to the season's close), u12 its ale chain line (m9-brewing runs to
//      its close), each at 1280×800, and u11t / u12t at the tablet size of the skin audit (1180×820, touch): the card's
//      계속 must be in view with no scrolling and at least 44 px (48 by touch);
//  not in the set (unit-tested instead, captures.json notDone): the bot's crop label, and a granary with malt.
// Beside the shots captures.json (the state, tick and what each shows).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/install3UiCaptures.ts <out-dir> --url <game> --states <install3States dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/install3UiCaptures.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/install3UiCaptures.ts …", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { buildingCauseSnapshot } from "../src/ui/houseProgressModel";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Locator = { first: () => Locator; count: () => Promise<number>; waitFor: (options?: object) => Promise<void>; click: (options?: object) => Promise<void>;
  screenshot: (options: object) => Promise<unknown>; evaluate: <T>(f: (node: Element) => T) => Promise<T>; textContent: () => Promise<string | null> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; evaluate: <T, A>(f: (arg: A) => T, arg?: A) => Promise<T>;
  locator: (selector: string) => Locator; getByRole: (role: string, options: object) => Locator;
  mouse: { click: (x: number, y: number) => Promise<void>; move: (x: number, y: number) => Promise<void> };
  keyboard: { press: (key: string) => Promise<void> }; on: (event: string, handler: (error: unknown) => void) => void };
type Context = { close: () => Promise<void> };
type Proof = { tileClientPoint: (tile: object) => { clientX: number; clientY: number } };

const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true }) as { close: () => Promise<void> };
const moments = JSON.parse(readFileSync(join(statesDir, "moments.json"), "utf8")) as Record<string, Record<string, unknown>>;
const result: Record<string, unknown> = {};
const errors: string[] = [];
const QUALITY = 60;
const load = (dir: string, name: string) => JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8")) as GameState;
async function step(name: string, run: () => Promise<void>) {
  try { await run(); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); console.log(`${name}: FAILED ${String(error).slice(0, 200)}`); }
}
type Rewrite = { pattern: string; from: string; to: string };
type Viewport = { width: number; height: number; touch?: boolean };
async function scene(state: GameState, tile: readonly number[], options: { run?: boolean; zoom?: number; rewrite?: Rewrite[]; viewport?: Viewport } = {}) {
  const viewport = options.viewport ?? { width: 1600, height: 1100 };
  const { context, page } = await openScene(browser, { state, tile, baseUrl: url, width: viewport.width, height: viewport.height, zoom: options.zoom ?? 1.6, run: options.run ?? false,
    hasTouch: viewport.touch === true, initScript: TUTORIAL_OFF, query: "&story-delay=600000", rewrite: options.rewrite ?? [] }) as { context: Context; page: Page };
  page.on("pageerror", error => errors.push(`${String(error).slice(0, 200)}`));
  for (const selector of [".story-modal-later", ".chronicle-page .chronicle-keep"]) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(300); }
  return { page, close: () => context.close() };
}
const point = (page: Page, tile: readonly number[]) => page.evaluate(at => (window as unknown as { __FEUDAL_PHASE10_PROOF__: Proof }).__FEUDAL_PHASE10_PROOF__.tileClientPoint(at), { tx: tile[0], ty: tile[1] });
async function select(page: Page, tile: readonly number[]) {
  const at = await point(page, tile);
  await page.mouse.click(at.clientX, at.clientY); await page.waitForTimeout(700);
  await page.locator(".diagnostic-card").first().waitFor({ timeout: 10_000 });
}
const shot = (locator: Locator, file: string) => locator.first().screenshot({ path: join(out!, file), type: "jpeg", quality: QUALITY });
/** Scrolls the card's body so `selector` shows (the card scrolls inside itself; an element shot shows what is in view). */
const reveal = (page: Page, selector: string) => page.evaluate(query => { document.querySelector(query)?.scrollIntoView({ block: "center" }); }, selector).then(() => page.waitForTimeout(200));
const text = (page: Page, selector: string) => page.evaluate(query => [...document.querySelectorAll(query)].map(node => node.textContent?.trim() ?? ""), selector);
const glyphs = (page: Page, selector: string) => page.evaluate(query => [...document.querySelectorAll(`${query} [data-icon]`)].map(node => node.getAttribute("data-icon")), selector);
const card = (page: Page) => page.locator(".diagnostic-card");
const tileOf = (state: GameState, id: string) => { const building = state.buildings.find(candidate => candidate.id === id)!; return [building.tx, building.ty]; };
/** A house holding toward a rise the ale rule governs, served or not (the engine's reading through houseProgressModel). */
const houseWith = (state: GameState, served: boolean) => [...buildingCauseSnapshot(state).values()]
  .find(model => "currentLevel" in model && model.status === "ready" && model.ale !== undefined && model.ale.served === served)?.buildingId ?? null;

// u01, u02: the barn's crop select on wheat, then barley chosen in the page.
await step("barn", async () => {
  const about = moments["m0-before"]!; const state = load(statesDir, "m0-before"); const tile = tileOf(state, about.barn as string);
  const { page, close } = await scene(state, tile);
  await select(page, tile);
  await reveal(page, ".inspector-crop");
  await shot(card(page), "u01-barn-crop-wheat.jpg");
  const before = await text(page, ".inspector-crop p");
  await page.locator(".inspector-crop-select .ui-select-trigger").click(); await page.waitForTimeout(300);
  await page.locator('.inspector-crop-select [role="option"]:nth-child(2)').click(); await page.waitForTimeout(700);
  await reveal(page, ".inspector-crop-pending, .inspector-crop-sowing");
  await shot(card(page), "u02-barn-crop-barley.jpg");
  result.barn = { state: "m0-before", tick: about.tick, barn: about.barn, before, after: await text(page, ".inspector-crop p"),
    trigger: await page.locator(".inspector-crop-select .ui-select-trigger").first().evaluate(node => node.getAttribute("aria-label")),
    crop: await page.locator(".inspector-crop").first().evaluate(node => node.getAttribute("data-farmstead-crop")) };
  await close();
});

// u04: the ledger drawer with barley and malt; u06: the kiln's stock; u07: a granary with malt, if any.
await step("malt", async () => {
  const about = moments["m8-malt"]!; const state = load(statesDir, "m8-malt"); const tile = tileOf(state, about.kiln as string);
  const { page, close } = await scene(state, tile);
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(600);
  await shot(page.locator(".ledger-drawer"), "u04-ledger-drawer.jpg");
  const rows = await page.evaluate(() => [...document.querySelectorAll(".ledger-matrix tbody tr")].map(row => ({ resource: row.getAttribute("data-resource"),
    icon: row.querySelector("th [data-icon]")?.getAttribute("data-icon") ?? null, text: row.textContent?.trim() ?? "" })), undefined);
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(400);
  await select(page, tile);
  await reveal(page, ".inspector-stock");
  await shot(card(page), "u06-kiln-stock.jpg");
  result.malt = { state: "m8-malt", tick: about.tick, ledgerRows: rows, kilnStock: await text(page, ".inspector-stock-item"), kilnIcons: await glyphs(page, ".inspector-stock") };
  const granary = state.buildings.find(building => building.kind === "granary" && ((building.inventory.malt ?? 0) > 0 || (building.inventory.barley ?? 0) > 0));
  result.granaryWithChain = granary?.id ?? null;
  if (granary !== undefined) {
    await page.keyboard.press("Escape"); await page.waitForTimeout(300);
    await select(page, [granary.tx, granary.ty]);
    await reveal(page, ".store-stock");
    await shot(card(page), "u07-granary-store.jpg");
    result.granary = { id: granary.id, rows: await text(page, ".store-stock tr"), icons: await glyphs(page, ".store-inspector") };
  }
  await close();
});

// u05: the barn's stock with barley.
await step("barley", async () => {
  const about = moments["m7-barley-in-barn"]!; const state = load(statesDir, "m7-barley-in-barn"); const tile = tileOf(state, about.barn as string);
  const { page, close } = await scene(state, tile);
  await select(page, tile);
  await reveal(page, ".inspector-stock");
  await shot(card(page), "u05-barn-stock.jpg");
  result.barley = { state: "m7-barley-in-barn", tick: about.tick, stock: await text(page, ".inspector-stock-item"), icons: await glyphs(page, ".inspector-stock") };
  await close();
});

// u08: the kiln's placement chip.
await step("chip", async () => {
  const about = moments["m2-kiln-site"]!; const tile = about.kilnAt as number[];
  const { page, close } = await scene(load(statesDir, "m0-before"), tile);
  await page.locator("[data-dock='build']").first().click(); await page.waitForTimeout(500);
  await page.locator("[data-category='trade']").first().click(); await page.waitForTimeout(400);
  const tool = page.locator('.build-tool[aria-label="엿기름 가마"]');
  const menu = await tool.first().evaluate(node => ({ text: node.textContent?.trim() ?? "", art: node.querySelector(".build-tool-art img")?.getAttribute("src") ?? node.querySelector(".build-tool-art [data-icon]")?.getAttribute("data-icon") ?? "glyph" }));
  await tool.first().click(); await page.waitForTimeout(500);
  const at = await point(page, tile);
  await page.mouse.move(at.clientX, at.clientY); await page.waitForTimeout(900);
  await page.locator(".placement-chip").first().waitFor({ timeout: 10_000 });
  await shot(page.locator(".placement-chip"), "u08-kiln-chip.jpg");
  result.chip = { state: "m0-before", tick: about.tick, tile, menu, lines: await text(page, ".placement-chip p"), icons: await glyphs(page, ".placement-chip") };
  await close();
});

// u09, u10: a house's progress line, unserved then served.
for (const [name, moment, served, file] of [["unserved", "m0-before", false, "u09-house-unserved.jpg"], ["served", "m11-ale-sold", true, "u10-house-served.jpg"]] as const) {
  await step(name, async () => {
    const about = moments[moment]!; const state = load(statesDir, moment);
    const id = houseWith(state, served)!; const tile = tileOf(state, id);
    const { page, close } = await scene(state, tile);
    await select(page, tile);
    if (await page.locator(".inspector-development summary").count() > 0) { await page.locator(".inspector-development summary").first().click(); await page.waitForTimeout(300); }
    await reveal(page, "[data-ale-condition]");
    await shot(card(page), file);
    result[name] = { state: moment, tick: about.tick, house: id, summary: await text(page, ".inspector-cause-summary"), ale: await text(page, ".inspector-ale-line"),
      condition: await text(page, "[data-ale-condition]") };
    await close();
  });
}

// u11, u12 (and u11t, u12t at the tablet size): the season card (the state runs to the season's close; the card opens
// itself). 계속 must be fully in the card and the viewport without scrolling, and at least 44 px tall (48 by touch).
const SIZES = { desktop: { width: 1280, height: 800 }, tablet: { width: 1180, height: 820, touch: true } } as const;
for (const [name, moment, file, speed] of [["seasonCause", "m1-barn-barley", "u11-season-cause", "1배속"], ["seasonDrink", "m9-brewing", "u12-season-drink", "5배속"]] as const) {
  for (const [size, viewport] of Object.entries(SIZES)) await step(`${name}-${size}`, async () => {
    const about = moments[moment]!; const state = load(statesDir, moment);
    const home = state.buildings.find(building => building.kind === "granary") ?? state.buildings[0]!;
    const { page, close } = await scene(state, [home.tx, home.ty], { run: true, zoom: 1.1, viewport });
    if (speed !== "1배속") await page.getByRole("button", { name: speed, exact: true }).click();
    await page.locator(".season-ledger-card").first().waitFor({ timeout: 60_000 }); await page.waitForTimeout(800);
    await shot(page.locator(".season-ledger-card"), `${file}${size === "tablet" ? "t" : ""}.jpg`);
    const resume = await page.evaluate(() => {
      const button = document.querySelector(".season-ledger-resume")!.getBoundingClientRect();
      const body = document.querySelector(".season-ledger-body")!.getBoundingClientRect();
      const content = document.querySelector(".season-ledger-content")!;
      return { height: Math.round(button.height), top: Math.round(button.top), bottom: Math.round(button.bottom), bodyBottom: Math.round(body.bottom),
        inCard: button.top >= body.top && button.bottom <= body.bottom, inViewport: button.bottom <= window.innerHeight,
        coarse: window.matchMedia("(pointer: coarse)").matches, contentScrolls: content.scrollHeight > content.clientHeight };
    }, undefined);
    result[`${name}-${size}`] = { state: moment, tick: about.tick, viewport, title: await text(page, ".season-ledger-card h2"), events: await text(page, ".season-ledger-events li"),
      drink: await text(page, ".season-ledger-drink"), icons: await glyphs(page, ".season-ledger-drink"), resume,
      resumeOk: resume.inCard && resume.inViewport && resume.height >= (resume.coarse ? 48 : 44) };
    await close();
  });
}

await browser.close();
const files = ["u01-barn-crop-wheat.jpg", "u02-barn-crop-barley.jpg", "u04-ledger-drawer.jpg", "u05-barn-stock.jpg", "u06-kiln-stock.jpg",
  "u07-granary-store.jpg", "u08-kiln-chip.jpg", "u09-house-unserved.jpg", "u10-house-served.jpg", "u11-season-cause.jpg", "u11-season-causet.jpg",
  "u12-season-drink.jpg", "u12-season-drinkt.jpg"];
const notDone = {
  u07: result.granaryWithChain === null ? "no granary holds barley or malt in these states (the kiln keeps its malt; the households fetch it): the storage inspector's icons are unit-tested (tests/aleScreens.test.ts, the granary with malt)" : null,
  u13: "no replayed state where the bot's next action is set_farmstead_crop (the palisade town's bot does not reach the ale chain in 12,000 ticks; seed 1's natural growth to 200,000 ticks never named it): the label is unit-tested (tests/aleScreens.test.ts, 다음: 헛간 작물을 보리로)",
};
const sizes = Object.fromEntries(files.flatMap(file => existsSync(join(out!, file)) ? [[file, statSync(join(out!, file)).size]] : []));
writeFileSync(join(out!, "captures.json"), `${JSON.stringify({ url, states: "scripts/install3States.ts (replayed states, moments m0…m11)", moments, ...result, notDone, sizes,
  totalBytes: Object.values(sizes).reduce<number>((sum, size) => sum + size, 0), errors }, null, 2)}\n`);
console.log(JSON.stringify({ sizes, errors }, null, 2));
