// INSTALL-3 UI captures (JPEG element shots, the states of scripts/install3UiStates.ts and scripts/install3BotState.ts;
// every one a replayed state: the C4 human path's two commands through the reducer, or the guardrail bot's own run):
//  u01 the barn card's crop select on wheat (barn-wheat), u02 the same barn after choosing barley in the select (the
//      click in the page: the game command goes through the store; its wheat still in the ground says it changes at sowing);
//  u04 the ledger drawer with barley and malt (malt-held); u05 the barn's stock with barley (barley-held); u06 the malt
//      kiln's stock with barley and malt (malt-held); u07 a granary's storage inspector with malt, when one holds it;
//  u08 the malt kiln's placement chip (barn-wheat, the kiln armed from the build menu);
//  u09 a house's progress line unserved by ale (barn-wheat), with its development conditions open; u10 one served (served);
//  u11 the season card's ale cause (barn-barley runs to the season's close), u12 its ale chain line (season-before runs
//      to its close);
//  u13 the bot's next action (bot-crop: the settings' autoplay line). The bot commits its action 240 ms after it names
//      it; this shot alone serves the page with the commit delay raised so the line can be read (no rule changes).
// Beside the shots captures.json (the state, tick and what each shows).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/install3UiCaptures.ts <out-dir> --url <game> --states <dir> [--bot <dir>]
import { mkdirSync, readFileSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
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
const url = flag("url")!; const statesDir = flag("states")!; const botDir = flag("bot");
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
async function scene(state: GameState, tile: readonly number[], options: { run?: boolean; zoom?: number; rewrite?: Rewrite[] } = {}) {
  const { context, page } = await openScene(browser, { state, tile, baseUrl: url, width: 1600, height: 1100, zoom: options.zoom ?? 1.6, run: options.run ?? false,
    initScript: TUTORIAL_OFF, query: "&story-delay=600000", rewrite: options.rewrite ?? [] }) as { context: Context; page: Page };
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

// u01, u02: the barn's crop select on wheat, then barley chosen in the page.
await step("barn", async () => {
  const about = moments["barn-wheat"]!; const tile = about.barnTile as number[];
  const { page, close } = await scene(load(statesDir, "barn-wheat"), tile);
  await select(page, tile);
  await reveal(page, ".inspector-crop");
  await shot(card(page), "u01-barn-crop-wheat.jpg");
  const before = await text(page, ".inspector-crop p");
  await page.locator(".inspector-crop-select .ui-select-trigger").click(); await page.waitForTimeout(300);
  await page.locator('.inspector-crop-select [role="option"]:nth-child(2)').click(); await page.waitForTimeout(700);
  await reveal(page, ".inspector-crop-pending, .inspector-crop-sowing");
  await shot(card(page), "u02-barn-crop-barley.jpg");
  result.barn = { state: "barn-wheat", tick: about.tick, barn: about.barn, before, after: await text(page, ".inspector-crop p"),
    trigger: await page.locator(".inspector-crop-select .ui-select-trigger").first().evaluate(node => node.getAttribute("aria-label")),
    crop: await page.locator(".inspector-crop").first().evaluate(node => node.getAttribute("data-farmstead-crop")) };
  await close();
});

// u04: the ledger drawer with barley and malt; u06: the kiln's stock; u07: a granary with malt, if any.
await step("malt", async () => {
  const about = moments["malt-held"]!; const tile = about.kilnTile as number[];
  const state = load(statesDir, "malt-held");
  const { page, close } = await scene(state, tile);
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(600);
  await shot(page.locator(".ledger-drawer"), "u04-ledger-drawer.jpg");
  const rows = await page.evaluate(() => [...document.querySelectorAll(".ledger-matrix tbody tr")].map(row => ({ resource: row.getAttribute("data-resource"),
    icon: row.querySelector("th [data-icon]")?.getAttribute("data-icon") ?? null, text: row.textContent?.trim() ?? "" })), undefined);
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(400);
  await select(page, tile);
  await reveal(page, ".inspector-stock");
  await shot(card(page), "u06-kiln-stock.jpg");
  result.malt = { state: "malt-held", tick: about.tick, ledgerRows: rows, kilnStock: await text(page, ".inspector-stock-item"), kilnIcons: await glyphs(page, ".inspector-stock") };
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
  const about = moments["barley-held"]!; const tile = about.barnTile as number[];
  const { page, close } = await scene(load(statesDir, "barley-held"), tile);
  await select(page, tile);
  await reveal(page, ".inspector-stock");
  await shot(card(page), "u05-barn-stock.jpg");
  result.barley = { state: "barley-held", tick: about.tick, stock: await text(page, ".inspector-stock-item"), icons: await glyphs(page, ".inspector-stock") };
  await close();
});

// u08: the kiln's placement chip.
await step("chip", async () => {
  const about = moments["barn-wheat"]!; const tile = about.kilnSpot as number[];
  const { page, close } = await scene(load(statesDir, "barn-wheat"), tile);
  await page.locator("[data-dock='build']").first().click(); await page.waitForTimeout(500);
  await page.locator("[data-category='trade']").first().click(); await page.waitForTimeout(400);
  const tool = page.locator('.build-tool[aria-label="엿기름 가마"]');
  const menu = await tool.first().evaluate(node => ({ text: node.textContent?.trim() ?? "", art: node.querySelector(".build-tool-art img")?.getAttribute("src") ?? node.querySelector(".build-tool-art [data-icon]")?.getAttribute("data-icon") ?? "glyph" }));
  await tool.first().click(); await page.waitForTimeout(500);
  const at = await point(page, tile);
  await page.mouse.move(at.clientX, at.clientY); await page.waitForTimeout(900);
  await page.locator(".placement-chip").first().waitFor({ timeout: 10_000 });
  await shot(page.locator(".placement-chip"), "u08-kiln-chip.jpg");
  result.chip = { state: "barn-wheat", tick: about.tick, tile, menu, lines: await text(page, ".placement-chip p"), icons: await glyphs(page, ".placement-chip") };
  await close();
});

// u09, u10: a house's progress line, unserved then served.
for (const [name, moment, houseKey, file] of [["unserved", "barn-wheat", "unservedHouse", "u09-house-unserved.jpg"], ["served", "served", "house", "u10-house-served.jpg"]] as const) {
  await step(name, async () => {
    const about = moments[moment]!; const state = load(statesDir, moment);
    const home = state.buildings.find(building => building.id === about[houseKey])!;
    const { page, close } = await scene(state, [home.tx, home.ty]);
    await select(page, [home.tx, home.ty]);
    if (await page.locator(".inspector-development summary").count() > 0) { await page.locator(".inspector-development summary").first().click(); await page.waitForTimeout(300); }
    await reveal(page, "[data-ale-condition]");
    await shot(card(page), file);
    result[name] = { state: moment, tick: about.tick, house: home.id, summary: await text(page, ".inspector-cause-summary"), ale: await text(page, ".inspector-ale-line"),
      condition: await text(page, "[data-ale-condition]") };
    await close();
  });
}

// u11, u12: the season card (the state runs at 1x to the season's close; the card opens itself).
for (const [name, moment, file] of [["seasonCause", "barn-barley", "u11-season-cause.jpg"], ["seasonDrink", "season-before", "u12-season-drink.jpg"]] as const) {
  await step(name, async () => {
    const about = moments[moment]!; const state = load(statesDir, moment);
    const home = state.buildings.find(building => building.kind === "granary") ?? state.buildings[0]!;
    const { page, close } = await scene(state, [home.tx, home.ty], { run: true, zoom: 1.1 });
    await page.locator(".season-ledger-card").first().waitFor({ timeout: 30_000 }); await page.waitForTimeout(800);
    await shot(page.locator(".season-ledger-card"), file);
    result[name] = { state: moment, tick: about.tick, title: await text(page, ".season-ledger-card h2"), events: await text(page, ".season-ledger-events li"),
      drink: await text(page, ".season-ledger-drink"), icons: await glyphs(page, ".season-ledger-drink") };
    await close();
  });
}

// u13: the bot's next action (the commit delay raised for this page alone).
if (botDir !== undefined && existsSync(join(botDir, "bot-crop.json"))) await step("bot", async () => {
  const about = JSON.parse(readFileSync(join(botDir, "bot-crop.moment.json"), "utf8")) as Record<string, unknown>;
  const state = load(botDir, "bot-crop");
  const { page, close } = await scene(state, about.barnTile as number[], { zoom: 1.2,
    rewrite: [{ pattern: "**/src/ui/autoplayPresentation.ts*", from: "export const AUTOPLAY_COMMIT_DELAY_MS = 240;", to: "export const AUTOPLAY_COMMIT_DELAY_MS = 600000;" }] });
  await page.locator(".settings-disclosure summary").first().click(); await page.waitForTimeout(300);
  await page.locator(".autoplay-toggle").first().click(); await page.waitForTimeout(900);
  await shot(page.locator(".autoplay-control"), "u13-bot-label.jpg");
  result.bot = { state: "bot-crop", ...about, hint: await text(page, ".autoplay-hint") };
  await close();
});

await browser.close();
const files = ["u01-barn-crop-wheat.jpg", "u02-barn-crop-barley.jpg", "u04-ledger-drawer.jpg", "u05-barn-stock.jpg", "u06-kiln-stock.jpg",
  "u07-granary-store.jpg", "u08-kiln-chip.jpg", "u09-house-unserved.jpg", "u10-house-served.jpg", "u11-season-cause.jpg", "u12-season-drink.jpg", "u13-bot-label.jpg"];
const sizes = Object.fromEntries(files.flatMap(file => existsSync(join(out!, file)) ? [[file, statSync(join(out!, file)).size]] : []));
writeFileSync(join(out!, "captures.json"), `${JSON.stringify({ url, states: "scripts/install3UiStates.ts, scripts/install3BotState.ts (replayed states)", moments, ...result, sizes,
  totalBytes: Object.values(sizes).reduce<number>((sum, size) => sum + size, 0), errors }, null, 2)}\n`);
console.log(JSON.stringify({ sizes, errors }, null, 2));
