// ECON-UI gates (engine FIX-7 handed over): the town's ale, the barley lock, the wool levy's in-kind line.
//   e1 the ledger drawer's stock tab with 도시의 에일 (INSTALL-3b's replay at the first ale sale, m11-ale-sold);
//   e2 a store's card with its ale note (the same town);
//   e3 the season card at the next close with the season's ale (the replay's m9-brewing run at 5x);
//   e4 a hamlet's barn (v26 four-farms): barley disabled with the engine's reason;
//   e5 the wool levy card (UI-6's chapter 2 run, wool_payment): the in-kind answer's split — no fleece in the stores;
//   e6 the same card with fleece for half the share in a storehouse (C5 CL-9: stored fleece first, the rest in coin).
// Element JPEGs and captures.json (the lines read from the page).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/econUiCaptures.ts <out-dir> --url <game> --ale <install3States dir> --war <ui6States dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/econUiCaptures.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/econUiCaptures.ts …", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { decodeSave } from "../src/save/saveCodec";
import { CLOTH_BALANCE } from "../src/content/clothConfig";
import { woolInKindPerSeason, woolLevyAmount } from "../src/engine/war";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Locator = { first: () => Locator; count: () => Promise<number>; waitFor: (options?: object) => Promise<void>; click: (options?: object) => Promise<void>;
  screenshot: (options: object) => Promise<unknown>; evaluate: <T>(f: (node: Element) => T) => Promise<T> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; evaluate: <T, A>(f: (arg: A) => T, arg?: A) => Promise<T>; locator: (selector: string) => Locator;
  getByRole: (role: string, options: object) => Locator; mouse: { click: (x: number, y: number) => Promise<void>; move: (x: number, y: number) => Promise<void> };
  keyboard: { press: (key: string) => Promise<void> }; on: (event: string, handler: (error: unknown) => void) => void };
type Proof = { tileClientPoint: (tile: object) => { clientX: number; clientY: number } };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const aleDir = flag("ale")!; const warDir = flag("war")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const json = (dir: string, name: string) => JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8")) as GameState;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const result: Record<string, unknown> = {};
const errors: string[] = [];
const files: string[] = [];

async function scene(state: GameState, tile: readonly number[], options: { run?: boolean; delay?: number } = {}) {
  const { context, page } = await openScene(browser, { state, tile, baseUrl: url, width: 1280, height: 800, zoom: 1.2, run: options.run ?? false, initScript: TUTORIAL_OFF,
    query: `&story-delay=${options.delay ?? 600000}&weather=none` }) as { context: { close: () => Promise<void> }; page: Page };
  page.on("pageerror", error => errors.push(String(error).slice(0, 200)));
  for (const selector of [".season-ledger-resume", ".story-modal-later", ".chronicle-page .chronicle-keep"]) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(300); }
  await page.waitForTimeout(800);
  return { page, close: () => context.close() };
}
async function shot(locator: Locator, file: string) { await locator.first().screenshot({ path: join(out!, file), type: "jpeg", quality: 70 }); files.push(file); }
async function openBuilding(page: Page, building: { tx: number; ty: number }, selector: string) {
  for (const [dx, dy, lift] of [[0.5, 0.5, 8], [0.5, 0.5, 28], [1, 1, 8], [1, 1, 36], [0.3, 0.3, 8]] as const) {
    const at = await page.evaluate(tile => (window as unknown as { __FEUDAL_PHASE10_PROOF__: Proof }).__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), { tx: building.tx + dx, ty: building.ty + dy });
    await page.mouse.click(at.clientX, at.clientY - lift); await page.waitForTimeout(700);
    if (await page.locator(selector).count() > 0) return;
    await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  }
  throw new Error(`no ${selector}`);
}
const text = (page: Page, selector: string) => page.evaluate(query => [...document.querySelectorAll(query)].map(node => node.textContent?.trim() ?? ""), selector);
async function step(name: string, run: () => Promise<Record<string, unknown>>) {
  try { result[name] = await run(); console.log(name, "ok"); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); console.log(name, "FAILED", String(error).slice(0, 200)); }
}

await step("e1-ledger-ale", async () => {
  const state = json(aleDir, "m11-ale-sold"); const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings[0]!;
  const { page, close } = await scene(state, [keep.tx, keep.ty]);
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(700);
  await page.evaluate(() => { document.querySelector(".ledger-town-ale")?.scrollIntoView({ block: "end" }); }); await page.waitForTimeout(300);
  await shot(page.locator(".ledger-drawer"), "e1-ledger-ale.jpg");
  const lines = await text(page, ".ledger-town-ale p");
  await close();
  return { tick: state.tick, lines };
});
await step("e2-store-ale", async () => {
  const state = json(aleDir, "m11-ale-sold"); const store = state.buildings.find(building => building.kind === "granary") ?? state.buildings.find(building => building.kind === "storehouse")!;
  const { page, close } = await scene(state, [store.tx + 1, store.ty + 1]);
  await openBuilding(page, store, ".store-inspector");
  await shot(page.locator(".diagnostic-card, .store-inspector"), "e2-store-ale.jpg");
  const note = await text(page, ".store-ale-note");
  await close();
  return { store: store.id, note };
});
await step("e3-season-ale", async () => {
  const state = json(aleDir, "m9-brewing"); const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings[0]!;
  const { page, close } = await scene(state, [keep.tx, keep.ty], { run: true });
  await page.getByRole("button", { name: "5배속", exact: true }).click().catch(() => undefined);
  await page.locator(".season-ledger-card").first().waitFor({ timeout: 90_000 }); await page.waitForTimeout(600);
  await shot(page.locator(".season-ledger-card"), "e3-season-ale.jpg");
  const lines = await text(page, ".season-ledger-ale, .season-ledger-drink");
  await close();
  return { lines };
});
await step("e4-barn-locked", async () => {
  const state = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v26/four-farms.save.json"))).envelope.state as GameState;
  const barn = state.buildings.find(building => building.kind === "farmstead")!;
  const { page, close } = await scene(state, [barn.tx + 1, barn.ty + 1]);
  await openBuilding(page, barn, ".inspector-crop");
  await page.evaluate(() => { document.querySelector(".inspector-crop")?.scrollIntoView({ block: "center" }); }); await page.waitForTimeout(300);
  await shot(page.locator(".inspector-crop"), "e4-barn-locked.jpg");
  const facts = await page.locator(".inspector-crop").first().evaluate(node => ({ locked: node.querySelector(".inspector-crop-locked")?.textContent ?? null,
    disabled: [...node.querySelectorAll("button")].some(button => button.hasAttribute("disabled") || button.getAttribute("aria-disabled") === "true") }));
  await close();
  return { era: state.era, ...facts };
});
/** The wool levy card, as a player opens it (the card itself, or its chip). */
async function woolCard(state: GameState, file: string) {
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings[0]!;
  const { page, close } = await scene(state, [keep.tx, keep.ty], { delay: 600 });
  await page.waitForTimeout(2_000);
  // As a player opens it: the chip, then the event card's [결정하기].
  if (await page.locator(".petition-card").count() === 0 && await page.locator(".event-chip").count() > 0) {
    await page.locator(".event-chip").first().click({ timeout: 5_000 }); await page.waitForTimeout(600);
    await page.getByRole("button", { name: "결정하기" }).first().click({ timeout: 5_000 }); await page.waitForTimeout(600);
  }
  await page.locator(".petition-card[data-def='wool_payment']").first().waitFor({ timeout: 15_000 });
  await shot(page.locator(".petition-card"), file);
  const lines = await text(page, ".petition-card [data-response], .petition-card .petition-option, .petition-card li");
  await close();
  return [...new Set(lines.filter(line => line.includes("현물") || line.includes("양털")))];
}
let woolLoaded: GameState | null = null;
const woolTownOf = () => (woolLoaded ??= json(warDir, "wool_payment"));
await step("e5-wool-no-fleece", async () => ({ lines: await woolCard(woolTownOf(), "e5-wool-no-fleece.jpg") }));
await step("e6-wool-stored-fleece", async () => {
  // C5 (CL-9): the levy takes the town's stored fleece. Capture setup (not play): fleece for half a season's share put
  // in the first storehouse — a town whose pastoral farm had filled it.
  const woolTown = woolTownOf();
  const share = woolInKindPerSeason(woolLevyAmount(woolTown));
  const fleece = Math.floor(share / CLOTH_BALANCE.fleeceValue / 2);
  const store = woolTown.buildings.find(building => building.kind === "storehouse")!;
  const stocked = { ...woolTown, buildings: woolTown.buildings.map(building => building.id === store.id ? { ...building, inventory: { ...building.inventory, fleece } } : building) } as GameState;
  return { fleece, store: store.id, lines: await woolCard(stocked, "e6-wool-stored-fleece.jpg") };
});
await browser.close();
const bytes = files.reduce((total, file) => total + statSync(join(out!, file)).size, 0);
writeFileSync(join(out!, "captures.json"), JSON.stringify({ steps: result, files, jpegBytes: bytes, errors }, null, 1) + "\n");
console.log(JSON.stringify({ steps: result, errors }).slice(0, 2000));
process.exitCode = errors.length === 0 ? 0 : 1;
