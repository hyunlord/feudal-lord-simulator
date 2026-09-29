// CLOTH-UI gate captures (C5's human path, scripts/clothStates.ts): world first, then the screens.
//   w0 the commands (the pasture strokes and the five sites), w1 the five buildings standing (one frame over the chain),
//   w2 the shorn fleece at the pastoral farm, w3 a spinning house's skeins at its door (w3b one whose back cells take
//   the Wave 27 weaver's yard), w4 the weaver's house with its raw
//   cloth, w5 the fulling mill by the water, w6 the tenter yard with dyed cloth hung, w7 finished cloth on the tenters,
//   w8 the first sale (the merchants buy at the tenters) — each close (zoom 1.4, paused, no hover, the story held back);
//   u1 the ledger drawer's stock tab with 도시의 직물 (a season after the sale), u2 a store's card with the cloth goods'
//   icons, u3 the season card at the next close with its cloth row (the first-sale state run at 5x).
// JPEGs and captures.json (what each frame holds and the lines read from the page).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/clothCaptures.ts <out-dir> --url <game> --states <clothStates dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { townCloth } from "../src/engine/cloth";
import { backyardDecals } from "../src/render/backyardDecals";
import { spinningPile } from "../src/render/clothWorldArt";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Locator = { first: () => Locator; count: () => Promise<number>; waitFor: (options?: object) => Promise<void>; click: (options?: object) => Promise<void>;
  screenshot: (options: object) => Promise<unknown> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; evaluate: <T, A>(f: (arg: A) => T, arg?: A) => Promise<T>; locator: (selector: string) => Locator;
  screenshot: (options: object) => Promise<unknown>; getByRole: (role: string, options: object) => Locator;
  mouse: { click: (x: number, y: number) => Promise<void> }; keyboard: { press: (key: string) => Promise<void> }; on: (event: string, handler: (error: unknown) => void) => void };
type Proof = { tileClientPoint: (tile: object) => { clientX: number; clientY: number } };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const load = (name: string) => JSON.parse(readFileSync(join(statesDir, `${name}.json`), "utf8")) as GameState;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const result: Record<string, unknown> = {};
const errors: string[] = [];

async function scene(state: GameState, tile: readonly number[], zoom: number, options: { run?: boolean } = {}) {
  const { context, page } = await openScene(browser, { state, tile, baseUrl: url, width: 1280, height: 800, zoom, run: options.run ?? false, initScript: TUTORIAL_OFF,
    query: "&story-delay=600000&weather=none" }) as { context: { close: () => Promise<void> }; page: Page };
  page.on("pageerror", error => errors.push(String(error).slice(0, 200)));
  for (const selector of [".season-ledger-resume", ".story-modal-later", ".chronicle-page .chronicle-keep"]) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(300); }
  await page.waitForTimeout(1_000);
  return { page, close: () => context.close() };
}
async function step(name: string, run: () => Promise<unknown>) {
  try { result[name] = await run(); console.log(name, "ok"); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); console.log(name, "FAILED", String(error).slice(0, 200)); }
}
const text = (page: Page, selector: string) => page.evaluate(query => [...document.querySelectorAll(query)].map(node => node.textContent?.trim() ?? ""), selector);
const KINDS = ["pastoral_farm", "weaver_house", "fulling_mill", "dyehouse", "tenter_yard"] as const;
const centre = (building: { tx: number; ty: number; kind: string }) => [building.tx + 1, building.ty + 1] as const;
const of = (state: GameState, kind: string) => state.buildings.find(building => building.kind === kind);
const sites = (state: GameState) => (state.constructionSites ?? []).flatMap(site => "tx" in site && (KINDS as readonly string[]).includes(site.kind) ? [{ tx: site.tx, ty: site.ty }] : []);
/** What the frame holds (the chain's goods in town, the building's own stock). */
const facts = (state: GameState, building?: { id: string; inventory: Readonly<Record<string, number | undefined>> }) => ({
  tick: state.tick, goods: townCloth(state).goods, sheep: townCloth(state).sheep, spinning: townCloth(state).spinningHouses,
  ...(building === undefined ? {} : { at: building.id, holds: Object.fromEntries(Object.entries(building.inventory).filter(([, amount]) => (amount ?? 0) > 0)) }) });

// World first: each stage close, then one frame over the whole chain.
const WORLD: readonly (readonly [file: string, state: string, focus: (state: GameState) => { tx: number; ty: number; id?: string; inventory?: Record<string, number | undefined> } | undefined, zoom: number])[] = [
  ["w0-commands", "c0-commands", state => sites(state)[0], 1.0],
  ["w2-fleece", "c2-fleece", state => of(state, "pastoral_farm"), 1.4],
  ["w3-spinning", "c3-yarn", state => { const house = state.houses.find(entry => spinningPile(entry) !== null); return house === undefined ? undefined : state.buildings.find(building => building.id === house.buildingId); }, 2.0],
  ["w3b-spinning-yard", "c3-yarn", state => { const yard = backyardDecals(state).find(decal => String(decal.key).startsWith("yard_weaver")); return yard === undefined ? undefined : state.buildings.find(building => building.id === yard.buildingId); }, 2.0],
  ["w4-woven", "c4-woven", state => of(state, "weaver_house"), 1.6],
  ["w5-fulled", "c5-fulled", state => of(state, "fulling_mill"), 1.4],
  ["w6-dyed", "c6-dyed", state => of(state, "tenter_yard"), 1.4],
  ["w7-finished", "c7-finished", state => of(state, "tenter_yard"), 1.4],
  ["w8-first-sale", "c8-first-sale", state => of(state, "tenter_yard"), 1.2],
];
for (const [file, name, focus, zoom] of WORLD) {
  await step(file, async () => {
    const state = load(name);
    const building = focus(state);
    if (building === undefined) throw new Error(`nothing to look at in ${name}`);
    const { page, close } = await scene(state, centre({ ...building, kind: "" }), zoom);
    await page.screenshot({ path: join(out!, `${file}.jpg`), type: "jpeg", quality: 66 });
    await close();
    return facts(state, building.inventory === undefined ? undefined : building as { id: string; inventory: Record<string, number | undefined> });
  });
}
await step("w1-chain", async () => {
  const state = load("c1-built");
  const built = KINDS.map(kind => of(state, kind)!).filter(Boolean);
  const tile = [built.reduce((sum, building) => sum + building.tx, 0) / built.length, built.reduce((sum, building) => sum + building.ty, 0) / built.length];
  const { page, close } = await scene(state, tile, 0.8);
  await page.screenshot({ path: join(out!, "w1-chain.jpg"), type: "jpeg", quality: 66 });
  await close();
  return { tick: state.tick, buildings: built.map(building => ({ kind: building.kind, tile: [building.tx, building.ty] })) };
});

// Then the screens.
await step("u1-ledger-cloth", async () => {
  const state = load("c9-season-after"); const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings[0]!;
  const { page, close } = await scene(state, [keep.tx, keep.ty], 1.1);
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(700);
  await page.evaluate(() => { document.querySelector(".ledger-town-cloth")?.scrollIntoView({ block: "end" }); }, undefined); await page.waitForTimeout(300);
  await page.locator(".ledger-drawer").first().screenshot({ path: join(out!, "u1-ledger-cloth.jpg"), type: "jpeg", quality: 70 });
  const lines = { cloth: await text(page, ".ledger-town-cloth p"), ale: await text(page, ".ledger-town-ale h3") };
  await close();
  return lines;
});
await step("u2-store-cloth", async () => {
  const state = load("c3-yarn");
  const store = state.buildings.filter(building => building.kind === "storehouse").find(building => KINDS.length > 0 && ["fleece", "yarn", "raw_cloth"].some(good => (building.inventory[good as "fleece"] ?? 0) > 0))
    ?? state.buildings.find(building => building.kind === "storehouse")!;
  const { page, close } = await scene(state, [store.tx + 1, store.ty + 1], 1.2);
  for (const [dx, dy, lift] of [[0.5, 0.5, 8], [0.5, 0.5, 28], [1, 1, 8], [1, 1, 36], [0.3, 0.3, 8]] as const) {
    const at = await page.evaluate(tile => (window as unknown as { __FEUDAL_PHASE10_PROOF__: Proof }).__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), { tx: store.tx + dx, ty: store.ty + dy });
    await page.mouse.click(at.clientX, at.clientY - lift); await page.waitForTimeout(700);
    if (await page.locator(".store-inspector").count() > 0) break;
    await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  }
  await page.locator(".diagnostic-card, .store-inspector").first().screenshot({ path: join(out!, "u2-store-cloth.jpg"), type: "jpeg", quality: 70 });
  const icons = await page.evaluate(() => [...document.querySelectorAll(".store-inspector [data-icon^='chain.']")].map(node => node.getAttribute("data-icon")), undefined);
  await close();
  return { store: store.id, holds: Object.fromEntries(Object.entries(store.inventory).filter(([, amount]) => (amount ?? 0) > 0)), icons };
});
await step("u3-season-cloth", async () => {
  const state = load("c8-first-sale"); const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings[0]!;
  const { page, close } = await scene(state, [keep.tx, keep.ty], 1.1, { run: true });
  await page.getByRole("button", { name: "5배속", exact: true }).click().catch(() => undefined);
  await page.locator(".season-ledger-card").first().waitFor({ timeout: 300_000 }); // a season at 5x (slower on the DGX) await page.waitForTimeout(600);
  await page.locator(".season-ledger-card").first().screenshot({ path: join(out!, "u3-season-cloth.jpg"), type: "jpeg", quality: 70 });
  const lines = { cloth: await text(page, ".season-ledger-cloth, .season-ledger-cloth-money"), ale: await text(page, ".season-ledger-drink, .season-ledger-ale"),
    clothIcons: await page.evaluate(() => [...document.querySelectorAll(".season-ledger-cloth [data-icon^='chain.']")].map(node => node.getAttribute("data-icon")), undefined),
    aleIcons: await page.evaluate(() => [...document.querySelectorAll(".season-ledger-drink [data-icon^='chain.']")].map(node => node.getAttribute("data-icon")), undefined) };
  await close();
  return lines;
});

await browser.close();
writeFileSync(join(out!, "captures.json"), JSON.stringify({ ...result, errors }, null, 2));
console.log(JSON.stringify({ errors }, null, 2));
process.exit(errors.length === 0 ? 0 : 1);
