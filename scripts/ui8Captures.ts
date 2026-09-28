// UI-8 gate captures (states from scripts/ui8States.ts; JPEG, 1280 × 800):
//  ① the Black Death in order, world before UI — for each step (rumour, arrival, the four decisions,
//    resettlement, chapter 3's end) a world shot before the chip or card (the story waits STORY_DELAY_MS)
//    and a UI shot after; the season strip's plague forecast at the rumour's season;
//  ② the four plague decision cards (the "after" shots);
//  ③ the chapter 3 end screen.
// Beside the shots captures.json (what each shows: modal, chips, the world props drawn).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/ui8Captures.ts <out-dir> --url <game> --states <dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
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

function focus(state: GameState): [number, number] {
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings.find(building => building.kind === "house")!;
  return [keep.tx, keep.ty];
}
async function scene(name: string, delay: number): Promise<{ page: Page; close: () => Promise<void> }> {
  const state = load(name);
  const { context, page } = await openScene(browser, { state, tile: focus(state), baseUrl: url, width: 1280, height: 800, zoom: 1.1, run: false,
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

// ① + ②: the Black Death, each step world first (before the story's delay), then the chip or the card.
// States: plague.rumour, plague.arrived, vacant_priest, wages, land_redistribution, cash_rent,
//         plague.resettlement, chapter3-end.
const PLAGUE = ["plague.rumour", "plague.arrived", "vacant_priest", "wages", "land_redistribution", "cash_rent", "plague.resettlement", "chapter3-end"];
for (const [index, name] of PLAGUE.entries()) {
  await step(name, async () => {
    const { page, close } = await scene(name, STORY_DELAY_MS);
    const prefix = `p${String(index + 1).padStart(2, "0")}-${name.replace(".", "-")}`;
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

// ① the plague's forecast on the season strip (the rumour's season: the arrival, wage demand, ordinance ahead).
await step("season-strip", async () => {
  const { page, close } = await scene("plague.rumour", 600_000);
  await page.waitForTimeout(1_000);
  await page.locator("[data-testid='hud-calendar']").first().click(); await page.waitForTimeout(600);
  await page.screenshot({ path: join(out!, "p00-season-strip.jpg"), type: "jpeg", quality: 68 });
  result["season-strip"] = await page.evaluate(() => [...document.querySelectorAll(".season-strip-list li[data-mark^='plague_']")].map(item => item.textContent?.trim() ?? ""));
  await close();
});

await browser.close();
await pause(10);
result.errors = errors;
writeFileSync(join(out!, "captures.json"), JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify({ steps: Object.keys(result).length, errors: errors.length }));
process.exitCode = errors.length === 0 ? 0 : 1;
