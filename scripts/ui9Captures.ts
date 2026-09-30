// UI-9 gate captures (states from scripts/ui9States.ts, seed 2's bot through chapter 4; JPEG, 1280 × 800):
//  ① the reorganisation in order, world before UI — for each step (chapter 3's end → chapter 4's opening, the wages
//    war, the textile street, the alehouses, the petitions' surge, the earl's warning, the four decisions, the poll
//    tax, the rumour of 1381 quiet and chased, the charter, chapter 4's end) a world shot before the chip or card (the
//    story waits STORY_DELAY_MS) and a UI shot after; the season strip's reorganisation forecast;
//  ② the four decision cards (the "after" shots of their states);
//  ③ the world close up, paused (zoom 1.4): the textile street, the alehouse crowd, the petition crowd at the manor,
//    the collectors hurrying off (chased; nobody hurt), the guildhall; the facts read in node from the same state;
//  ④ the faction tab's influence bars and tug of war, the rights tab (the rights passed to the town, the fee farm, the
//    revolt pressure and its causes, both rumours), the chapter 4 ledger.
// Beside the shots captures.json (what each shows).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/ui9Captures.ts <out-dir> --url <game> --states <dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/ui9Captures.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/ui9Captures.ts …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { isAlehouse } from "../src/engine/ale";
import { guildOf, reorganisationStage, revoltPressure } from "../src/engine/reorganisation";
import { reorgProp } from "../src/render/reorgWorldProps";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Locator = { first: () => Locator; click: (options?: object) => Promise<void>; count: () => Promise<number>; waitFor: (options?: object) => Promise<void>;
  screenshot: (options: object) => Promise<unknown>; evaluate: <T>(f: (node: Element) => T) => Promise<T> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>; evaluate: <T, A = void>(f: (arg: A) => T, arg?: A) => Promise<T>;
  locator: (selector: string) => Locator; getByRole: (role: string, options: object) => Locator; keyboard: { press: (key: string) => Promise<void> };
  mouse: { click: (x: number, y: number) => Promise<void>; move: (x: number, y: number) => Promise<void> }; on: (event: string, handler: (error: unknown) => void) => void };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!;
mkdirSync(out!, { recursive: true });
const STORY_DELAY_MS = 5_000;
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const load = (name: string) => JSON.parse(readFileSync(join(statesDir, `${name}.json`), "utf8")) as GameState;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const result: Record<string, unknown> = {};
const errors: string[] = [];
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function focus(state: GameState): [number, number] {
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings.find(building => building.kind === "house")!;
  return [keep.tx, keep.ty];
}
async function scene(name: string, delay: number, view: { tile?: readonly number[]; zoom?: number } = {}): Promise<{ page: Page; close: () => Promise<void> }> {
  const state = load(name);
  const { context, page } = await openScene(browser, { state, tile: view.tile ?? focus(state), baseUrl: url, width: 1280, height: 800, zoom: view.zoom ?? 1.1, run: false,
    initScript: TUTORIAL_OFF, query: `&story-delay=${delay}` });
  (page as Page).on("pageerror", error => errors.push(`${name}: ${String(error).slice(0, 200)}`));
  return { page: page as Page, close: () => context.close() };
}
const screen = (page: Page) => page.evaluate(() => ({
  modal: document.querySelector(".petition-card, .chronicle-page, .chapter-preview, .famine-card, .story-modal")?.getAttribute("aria-label") ?? null,
  def: document.querySelector(".petition-card")?.getAttribute("data-def") ?? null,
  chips: [...document.querySelectorAll(".event-chip")].map(chip => chip.textContent?.trim() ?? ""),
  goal: document.querySelector(".goal-chip-rail")?.textContent?.trim().slice(0, 120) ?? null,
}));
async function step(name: string, run: () => Promise<void>) {
  try { await run(); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); }
}


// ① + ②: the reorganisation, each step world first (before the story's delay), then the chip or the card.
const STEPS = ["reorg.wage_competition", "reorg.textile_street", "reorg.alehouse_boom", "reorg.petitions_surge", "reorg.overlord_warning", "guild_charter",
  "cloth_or_grain", "tax_collection", "reorg.poll_tax", "rumour-quiet", "rumour-chased", "borough_charter", "chapter4-end"];
for (const [index, name] of STEPS.entries()) {
  await step(name, async () => {
    const { page, close } = await scene(name, STORY_DELAY_MS);
    const prefix = `r${String(index + 1).padStart(2, "0")}-${name.replace("reorg.", "")}`;
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(out!, `${prefix}-1-world.jpg`), type: "jpeg", quality: 66 });
    const world = await screen(page);
    await page.waitForTimeout(STORY_DELAY_MS + 1_200);
    // A chip that waits (no modal) opens its card, as the player would.
    if ((await screen(page)).modal === null && await page.locator(".event-chip").count() > 0) {
      await page.locator(".event-chip").first().click({ timeout: 5_000 }); await page.waitForTimeout(500);
    }
    await page.screenshot({ path: join(out!, `${prefix}-2-ui.jpg`), type: "jpeg", quality: 66 });
    const state = load(name);
    result[name] = { world, ui: await screen(page), stage: reorganisationStage(state), pressure: revoltPressure(state) };
    await close();
  });
}

// Chapter 3's page, then chapter 4's opening screen (its Wave 31 painting, title, line and goals).
await step("r00-chapter4-opening", async () => {
  const { page, close } = await scene("chapter3-end", 0);
  await page.locator(".chronicle-page").waitFor({ timeout: 90_000 });
  await page.screenshot({ path: join(out!, "r00-chapter3-page.jpg"), type: "jpeg", quality: 66 });
  await page.locator(".chronicle-page .chronicle-next").first().click(); await page.waitForTimeout(1_500);
  await page.screenshot({ path: join(out!, "r00-chapter4-opening.jpg"), type: "jpeg", quality: 66 });
  result["r00-chapter4-opening"] = await page.evaluate(() => {
    const screen = document.querySelector<HTMLElement>(".chapter-preview");
    return screen === null ? null : { chapter: screen.dataset.chapter, title: screen.getAttribute("aria-label"), art: screen.style.backgroundImage.includes("chapter4_intro"),
      goals: [...screen.querySelectorAll(".chapter-preview-goals li")].map(item => item.textContent ?? "") };
  });
  await close();
});

// The reorganisation's forecast on the season strip (the petitions' surge: the guild's demand a year ahead).
await step("season-strip", async () => {
  const { page, close } = await scene("reorg.petitions_surge", 600_000);
  await page.waitForTimeout(1_000);
  await page.locator("[data-testid='hud-calendar']").first().click(); await page.waitForTimeout(600);
  await page.screenshot({ path: join(out!, "r00-season-strip.jpg"), type: "jpeg", quality: 66 });
  result["season-strip"] = await page.evaluate(() => [...document.querySelectorAll(".season-strip-list li[data-mark^='reorg']")].map(item => item.textContent?.trim() ?? ""));
  await close();
});

// ③ the world close up (paused, the story held back): what the reorganisation puts in the town before any card.
const of = (state: GameState, kind: string) => state.buildings.filter(building => building.kind === kind);
const keepOf = (state: GameState) => state.buildings.find(building => building.kind === "keep")
  ?? state.buildings.find(building => building.kind === "church")!;
function worldFacts(state: GameState) {
  const r = state.reorganisation;
  return { tick: state.tick, stage: reorganisationStage(state), weavers: of(state, "weaver_house").length, textileStreet: r?.textileStreetTick ?? null,
    alehouseBoom: r?.alehouseBoomTick ?? null, guild: guildOf(state), guildhall: reorgProp(state), rebellion: r?.rebellion ?? null, openPetitions: (state.politics?.petitions ?? []).filter(p => p.response === undefined).map(p => p.defId) };
}
const CLOSE: readonly (readonly [file: string, name: string, at: (state: GameState) => { tx: number; ty: number }])[] = [
  ["w1-textile-street", "reorg.textile_street", state => of(state, "weaver_house")[0] ?? keepOf(state)],
  ["w2-alehouse-crowd", "reorg.alehouse_boom", state => { const house = state.houses.find(entry => isAlehouse(entry)); return state.buildings.find(building => building.id === house?.buildingId) ?? keepOf(state); }],
  ["w3-petition-crowd", "guild_charter", keepOf],
  ["w4-collectors-chased", "rumour-chased", state => { const market = of(state, "market")[0] ?? keepOf(state); const keep = keepOf(state);
    return { tx: Math.round((market.tx + keep.tx) / 2), ty: Math.round((market.ty + keep.ty) / 2) }; }],
  ["w5-rumour-quiet", "rumour-quiet", keepOf],
  ["w6-guildhall", "cloth_or_grain", state => reorgProp(state) ?? of(state, "market")[0] ?? keepOf(state)],
];
for (const [file, name, at] of CLOSE) {
  await step(file, async () => {
    const state = load(name);
    const target = at(state);
    const { page, close } = await scene(name, 600_000, { tile: [target.tx + 1, target.ty + 1], zoom: 1.4 });
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: join(out!, `${file}.jpg`), type: "jpeg", quality: 66 });
    result[file] = { ...worldFacts(state), at: [target.tx, target.ty] };
    await close();
  });
}

// ④ the faction tab (influence, tug of war), a faction's page (the commons: the revolt pressure), the rights tab, the ledger.
async function openChronicleFactions(page: Page) {
  for (const selector of [".chronicle-page .chronicle-keep", ".story-modal-later", ".season-ledger-resume"]) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(400); }
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(600);
  await page.locator(".ledger-tab--chronicle").first().click(); await page.waitForTimeout(1_200);
  await page.evaluate(() => { for (const tab of document.querySelectorAll<HTMLElement>(".chronicle-tab")) if (tab.textContent?.trim() === "세력") tab.click(); });
  await page.waitForTimeout(900);
}
for (const [file, name] of [["f1-factions-warning", "reorg.overlord_warning"], ["f2-factions-chapter-end", "chapter4-end"]] as const) {
  await step(file, async () => {
    const { page, close } = await scene(name, 600_000);
    await openChronicleFactions(page);
    await page.screenshot({ path: join(out!, `${file}.jpg`), type: "jpeg", quality: 66 });
    result[file] = await page.evaluate(() => ({ tug: document.querySelector(".chronicle-factions-tug")?.textContent?.trim() ?? null,
      influence: [...document.querySelectorAll(".chronicle-factions-row")].map(row => [row.getAttribute("data-faction"), row.querySelector(".chronicle-factions-influence-value")?.textContent?.trim() ?? null]) }));
    await close();
  });
}
for (const [file, name] of [["f3-commons-quiet", "rumour-quiet"], ["f4-commons-chased", "rumour-chased"]] as const) {
  await step(file, async () => {
    const { page, close } = await scene(name, 600_000);
    await openChronicleFactions(page);
    await page.locator(".chronicle-factions-row[data-faction='commons']").first().click(); await page.waitForTimeout(900);
    // The revolt pressure stands below the page (scrolled to, as the player scrolls).
    await page.evaluate(() => { document.querySelector(".chronicle-faction-pressure")?.scrollIntoView({ block: "end" }); }); await page.waitForTimeout(400);
    await page.screenshot({ path: join(out!, `${file}.jpg`), type: "jpeg", quality: 66 });
    result[file] = await page.evaluate(() => [...document.querySelectorAll(".chronicle-faction-pressure p, .chronicle-faction-pressure li")].map(node => node.textContent?.trim() ?? ""));
    await close();
  });
}
for (const [file, name, tab, selector] of [["l1-rights-chased", "rumour-chased", "rights", ".ledger-rights"], ["l2-rights-chapter-end", "chapter4-end", "rights", ".ledger-rights"],
  ["l3-reorg-ledger", "chapter4-end", "stock", ".ledger-wage-ledger"]] as const) {
  await step(file, async () => {
    const { page, close } = await scene(name, 600_000);
    for (const dismiss of [".chronicle-page .chronicle-keep", ".story-modal-later", ".season-ledger-resume"]) if (await page.locator(dismiss).count() > 0) { await page.locator(dismiss).first().click(); await page.waitForTimeout(400); }
    await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(700);
    await page.locator(`[data-ledger-tab='${tab}']`).first().click(); await page.waitForTimeout(700);
    await page.evaluate(query => { const nodes = document.querySelectorAll(query); nodes[nodes.length - 1]?.scrollIntoView({ block: "end" }); }, selector); await page.waitForTimeout(300);
    await page.locator(".ledger-drawer").first().screenshot({ path: join(out!, `${file}.jpg`), type: "jpeg", quality: 70 });
    result[file] = await page.evaluate(query => [...document.querySelectorAll(`${query} li, ${query} p, ${query} tr, ${query} h4`)].map(node => node.textContent?.trim() ?? "").slice(0, 40), selector);
    await close();
  });
}

await browser.close();
await pause(10);
result.errors = errors;
writeFileSync(join(out!, "captures.json"), JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify({ steps: Object.keys(result).length, errors: errors.length }));
process.exitCode = errors.length === 0 ? 0 : 1;
