/**
 * PLAGUE-b captures (local or DGX; UI-8's chapter 3 states, scripts/ui8States.ts):
 *   b1 the plague-emptied houses up close (paused, no hover): each shows the empty-house boards that fit its painting
 *      (buildingOverlays.ts vacantHouseBoards) — the bot town's L4 houses boarded_l4, no door marks;
 *   b2 the chronicle at chapter 3's end: chapter 3's start card with its Wave 31 opening painting (chapter3_intro);
 *   b3 chapter 2's end (UI-6's state): its page, then chapter 3's opening screen over the same painting, with its goals.
 *   npx tsx scripts/plagueBCaptures.ts <out> --url <app url> --states <dir> --states6 <UI-6 states dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { plagueVacantPlots } from "../src/engine/plague";
import { housePressureStatus } from "../src/population/housePressure";
import { vacantHouseBoards } from "../src/render/buildingOverlays";
import { buildBuildingVisualState } from "../src/render/buildingVisualState";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Locator = { first: () => Locator; click: (options?: object) => Promise<void>; count: () => Promise<number>; waitFor: (options?: object) => Promise<void> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>; evaluate: <T, A = void>(f: (arg: A) => T, arg?: A) => Promise<T>;
  locator: (selector: string) => Locator; on: (event: string, handler: (error: unknown) => void) => void };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!; const states6 = flag("states6")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const load = (name: string, dir = statesDir) => JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8")) as GameState;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const result: Record<string, unknown> = {};
const errors: string[] = [];
// The same frame without the empty-house boards, so the boards are the difference: all boards off (no house abandoned),
// and only the base paintings' Wave 7 boards off (a house that still differs there wears a Wave 26 variant's own).
const OVERLAYS = "**/src/render/buildingOverlays.ts*";
const NO_BOARDS = [{ pattern: OVERLAYS, from: `const boarded = house !== undefined && housePressureStatus(house) === "abandoned";`, to: "const boarded = false;" }];
const NO_BASE_BOARDS = [{ pattern: OVERLAYS, from: `else if (boards === "boarded")`, to: `else if (boards === "none")` }];
async function scene(state: GameState, tile: readonly number[], zoom: number, rewrite: readonly object[] = [], storyDelay = 600_000): Promise<{ page: Page; close: () => Promise<void> }> {
  const { context, page } = await openScene(browser, { state, tile, baseUrl: url, width: 1280, height: 800, zoom, run: false, initScript: TUTORIAL_OFF, query: `&story-delay=${storyDelay}`, rewrite });
  (page as Page).on("pageerror", error => errors.push(String(error).slice(0, 200)));
  return { page: page as Page, close: () => context.close() };
}
async function step(name: string, run: () => Promise<void>) {
  try { await run(); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); }
}

// b1: every plague-emptied house of the wages state (the empty streets after the first pestilence), one close-up each.
await step("b1-vacant-houses", async () => {
  const state = load("wages");
  const houses = state.buildings.filter(building => plagueVacantPlots(state).includes(building.id));
  const facts = [];
  for (const [index, building] of houses.entries()) {
    const house = state.houses.find(candidate => candidate.buildingId === building.id)!;
    const level = buildBuildingVisualState(building, state.houses).houseLevel;
    const boarded = housePressureStatus(house) === "abandoned";
    // (Node has no pictures loaded, so the variant is the browser's: see plagueBMarkBoards.py.)
    facts.push({ id: building.id, tile: [building.tx, building.ty], level, abandoned: boarded, baseBoards: boarded ? vacantHouseBoards(level, false, true) : null });
    for (const [suffix, rewrite] of [["", []], ["-noboards", NO_BOARDS], ["-nobase", NO_BASE_BOARDS]] as const) {
      const { page, close } = await scene(state, [building.tx + 0.5, building.ty + 0.5], 2.2, rewrite);
      await page.waitForTimeout(1_200);
      await page.screenshot({ path: join(out!, `b1-vacant-house-${index + 1}${suffix}.png`), clip: { x: 400, y: 120, width: 480, height: 400 } });
      await close();
    }
  }
  result["b1"] = facts;
});

// b2: chapter 3's start in the chronicle (the chapter page kept for later, the ledger's chronicle tab).
await step("b2-chronicle-chapter3-start", async () => {
  const state = load("chapter3-end");
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings.find(building => building.kind === "church")!;
  const { page, close } = await scene(state, [keep.tx, keep.ty], 1.1);
  await page.waitForTimeout(800);
  for (const selector of [".chronicle-page .chronicle-keep", ".story-modal-later", ".season-ledger-resume"]) {
    if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(400); }
  }
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(500);
  await page.locator(".ledger-tab--chronicle").first().click(); await page.waitForTimeout(1_500);
  // Milestones only (every other kind toggled off), so the chapters' starts and ends stand in a short list.
  for (const kind of ["decision", "event", "era", "person", "ledger", "faction"]) {
    const toggle = page.locator(`.chronicle-kinds .chronicle-kind[data-kind='${kind}'][aria-pressed='true']`);
    if (await toggle.count() > 0) { await toggle.first().click(); await page.waitForTimeout(500); }
  }
  const card = await page.evaluate(() => {
    const cards = [...document.querySelectorAll<HTMLElement>(".chronicle-card")];
    const found = cards.find(card => (card.querySelector(".chronicle-card-art") as HTMLElement | null)?.outerHTML.includes("chapter3_intro") === true
      && (card.textContent ?? "").includes("3장"));
    found?.scrollIntoView({ block: "center" });
    return found === undefined ? null : { line: found.querySelector(".chronicle-card-line")?.textContent ?? found.textContent?.slice(0, 120) ?? "" };
  });
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(out!, "b2-chronicle-chapter3-start.jpg"), type: "jpeg", quality: 70 });
  result["b2"] = card;
  await close();
});

// b3: chapter 2's end, its page's "to chapter 3", then chapter 3's opening screen.
await step("b3-chapter3-opening", async () => {
  const state = load("chapter2-end", states6);
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings.find(building => building.kind === "church")!;
  const { page, close } = await scene(state, [keep.tx, keep.ty], 1.1, [], 0);
  // The chapter page opens after the save's first frames (a minute on the DGX's software rendering).
  await page.locator(".chronicle-page").waitFor({ timeout: 90_000 });
  await page.locator(".chronicle-page .chronicle-next").first().click(); await page.waitForTimeout(1_500);
  await page.screenshot({ path: join(out!, "b3-chapter3-opening.jpg"), type: "jpeg", quality: 70 });
  result["b3"] = await page.evaluate(() => {
    const screen = document.querySelector<HTMLElement>(".chapter-preview");
    return screen === null ? null : { chapter: screen.dataset.chapter, title: screen.getAttribute("aria-label"), art: screen.style.backgroundImage.includes("chapter3_intro"),
      goals: [...screen.querySelectorAll(".chapter-preview-goals li")].map(item => item.textContent ?? ""), start: screen.querySelector(".chapter-preview-continue")?.textContent ?? "" };
  });
  await close();
});

await browser.close();
writeFileSync(join(out!, "plague-b-captures.json"), JSON.stringify({ ...result, errors }, null, 2));
console.log(JSON.stringify({ ...result, errors }, null, 2));
process.exit(errors.length === 0 ? 0 : 1);
