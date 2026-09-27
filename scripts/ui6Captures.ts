// UI-6 gate captures (states from scripts/ui6States.ts; JPEG, 1280 x 800):
//  ① the war in order, world before UI — for each step (messenger, wool levy, commission, subsidy, beacon, raid,
//    refugees, wall or market, chapter 2's end) a shot of the world before the chip or card (the story waits
//    STORY_DELAY_MS) and one after it; the raid also from the tick before it;
//    and the season strip's war forecast at the messenger's season;
//  ② the five decision cards (the "after" shots of the five demands);
//  ③ the chronicle's faction tab and one faction's page;
//  ④ the house change (FAIL-3 naive seed 3): the rights tab at the decline (a right lost) and after the change, and the
//    chronicle's record of it.
// Beside the shots captures.json (what each shows: modal, chips, the world props drawn).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/ui6Captures.ts <out-dir> --url <game> --states <dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { beaconSpot, raidQuaySpot } from "../src/render/warWorldProps";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>; evaluate: <T>(f: () => T) => Promise<T>;
  locator: (selector: string) => { first: () => { click: (options?: object) => Promise<void> }; count: () => Promise<number> }; keyboard: { press: (key: string) => Promise<void> };
  on: (event: string, handler: (error: unknown) => void) => void };
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

function focus(state: GameState, name: string): [number, number] {
  const spot = name === "beacon" ? beaconSpot(state) : name === "raid" || name === "before-raid" ? raidQuaySpot(state) ?? beaconSpot(state) : null;
  if (spot !== null) return [spot.tx, spot.ty];
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings.find(building => building.kind === "house")!;
  return [keep.tx, keep.ty];
}
async function scene(name: string, delay: number): Promise<{ page: Page; close: () => Promise<void> }> {
  const state = load(name);
  const { context, page } = await openScene(browser, { state, tile: focus(state, name), baseUrl: url, width: 1280, height: 800, zoom: 1.1, run: false,
    initScript: TUTORIAL_OFF, query: `&story-delay=${delay}` });
  (page as Page).on("pageerror", error => errors.push(`${name}: ${String(error).slice(0, 200)}`));
  return { page: page as Page, close: () => context.close() };
}
const screen = (page: Page) => page.evaluate(() => ({
  modal: document.querySelector(".petition-card, .chronicle-page, .chapter-preview, .famine-card")?.getAttribute("aria-label") ?? null,
  def: document.querySelector(".petition-card")?.getAttribute("data-def") ?? null,
  chips: [...document.querySelectorAll(".event-chip")].map(chip => chip.textContent?.trim() ?? ""),
  goal: document.querySelector(".goal-chip-rail")?.textContent?.trim().slice(0, 120) ?? null,
}));
async function step(name: string, run: () => Promise<void>) {
  try { await run(); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); }
}

// ① + ②: the war, each step world first (before the story's delay), then the chip or the card.
const WAR = ["messenger", "wool_payment", "levy_response", "war_funding", "beacon", "before-raid", "raid", "refugee_admission", "wall_or_market", "chapter2-end"];
for (const [index, name] of WAR.entries()) {
  await step(name, async () => {
    const { page, close } = await scene(name, STORY_DELAY_MS);
    const prefix = `w${String(index + 1).padStart(2, "0")}-${name}`;
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(out!, `${prefix}-1-world.jpg`), type: "jpeg", quality: 68 });
    const world = await screen(page);
    await page.waitForTimeout(STORY_DELAY_MS + 1_200);
    // A chip that waits (no modal) opens its card, as the player would.
    if ((await screen(page)).modal === null && await page.locator(".event-chip").count() > 0) {
      await page.locator(".event-chip").first().click({ timeout: 5_000 }); await page.waitForTimeout(500);
    }
    await page.screenshot({ path: join(out!, `${prefix}-2-ui.jpg`), type: "jpeg", quality: 68 });
    result[name] = { world, ui: await screen(page) };
    await close();
  });
}

// ① the war's forecast on the season strip (the messenger's season: the Crown's demands, the beacon, the raid ahead).
await step("season-strip", async () => {
  const { page, close } = await scene("messenger", 600_000);
  await page.waitForTimeout(1_000);
  await page.locator("[data-testid='hud-calendar']").first().click(); await page.waitForTimeout(600);
  await page.screenshot({ path: join(out!, "w00-season-strip.jpg"), type: "jpeg", quality: 68 });
  result["season-strip"] = await page.evaluate(() => [...document.querySelectorAll(".season-strip-list li[data-mark^='war_']")].map(item => item.textContent?.trim() ?? ""));
  await close();
});

// ③ the chronicle's faction tab and a faction's page (chapter 2's end: the war's records and the nine factions).
await step("factions", async () => {
  const { page, close } = await scene("chapter2-end", 600_000);
  await page.waitForTimeout(1_000);
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(500);
  await page.locator(".ledger-tab--chronicle").first().click(); await page.waitForTimeout(1_000);
  await page.evaluate(() => { for (const tab of document.querySelectorAll<HTMLElement>(".chronicle-tab")) if (tab.textContent?.trim() === "세력") tab.click(); });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(out!, "f1-faction-tab.jpg"), type: "jpeg", quality: 68 });
  const rows = await page.evaluate(() => [...document.querySelectorAll(".chronicle-factions-row")].map(row => ({ faction: row.getAttribute("data-faction"),
    relation: row.getAttribute("data-relation"), text: row.textContent?.replace(/\s+/g, " ").trim().slice(0, 120) ?? "" })));
  // The Crown's page: the war's demands, the wool levy's instalments, its remembered records.
  await page.locator(".chronicle-factions-row[data-faction='crown']").first().click({ timeout: 5_000 }); await page.waitForTimeout(800);
  await page.screenshot({ path: join(out!, "f2-faction-page.jpg"), type: "jpeg", quality: 68 });
  result.factions = await page.evaluate(() => ({
    page: document.querySelector(".chronicle-faction")?.getAttribute("data-faction") ?? null,
    text: document.querySelector(".chronicle-faction")?.textContent?.replace(/\s+/g, " ").trim().slice(0, 400) ?? null }));
  result.factions = { rows, ...(result.factions as object) };
  await close();
});

// ④ the house change: the rights tab at the decline and after the change, and the chronicle's record.
for (const name of ["decline", "house-change", "chapter2-end"]) {
  await step(`rights:${name}`, async () => {
    const { page, close } = await scene(name, 600_000);
    await page.waitForTimeout(1_000);
    if (await page.locator(".story-modal-later").count() > 0) { await page.locator(".story-modal-later").first().click(); await page.waitForTimeout(300); }
    await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(500);
    await page.locator(".ledger-tab").first().click(); await page.waitForTimeout(200);
    await page.evaluate(() => { for (const tab of document.querySelectorAll<HTMLElement>(".ledger-tab")) if (tab.textContent?.trim() === "권리") tab.click(); });
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(out!, `h-${name}-rights.jpg`), type: "jpeg", quality: 68 });
    result[`rights:${name}`] = await page.evaluate(() => ({ text: document.querySelector(".ledger-rights")?.textContent?.replace(/\s+/g, " ").trim().slice(0, 400) ?? null,
      lost: [...document.querySelectorAll(".ledger-rights-list li[data-lost]")].map(item => item.getAttribute("data-right")) }));
    if (name === "house-change") {
      await page.locator(".ledger-tab--chronicle").first().click(); await page.waitForTimeout(1_200);
      await page.screenshot({ path: join(out!, "h-house-change-chronicle.jpg"), type: "jpeg", quality: 68 });
    }
    await close();
  });
}

await browser.close();
await pause(10);
result.errors = errors;
writeFileSync(join(out!, "captures.json"), JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify({ steps: Object.keys(result).length, errors: errors.length }));
process.exitCode = errors.length === 0 ? 0 : 1;
