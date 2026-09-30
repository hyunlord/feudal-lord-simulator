// UI-8 gate captures (states from scripts/ui8States.ts; JPEG, 1280 × 800):
//  ① the Black Death in order, world before UI — for each step (rumour, arrival, the four decisions,
//    resettlement, chapter 3's end) a world shot before the chip or card (the story waits STORY_DELAY_MS)
//    and a UI shot after; the season strip's plague forecast at the rumour's season;
//  ② the four plague decision cards (the "after" shots);
//  ③ the chapter 3 end screen;
//  ④ the world close up, paused (zoom 1.4): the first plague deaths at the church (new graves, the funeral procession,
//    the church without a priest — its sign, and how many houses that want it carry a marker: none), the shut houses of
//    the empty streets; the facts read in node from the same state (scripts run tsx);
//  ⑤ the wage ledger in the ledger drawer (chapter 3's end) and the family tree of a child whose parent the plague
//    took (1349), its dead in the deceased frame with the cause.
// Beside the shots captures.json (what each shows: modal, chips, the world props drawn).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/ui8Captures.ts <out-dir> --url <game> --states <dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/ui8Captures.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/ui8Captures.ts …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { curacyVacant, plagueStage, plagueVacantPlots } from "../src/engine/plague";
import { causeMarkersForState } from "../src/render/causeMapOverlay";
import { plagueProps } from "../src/render/plagueWorldProps";
import { worldSigns } from "../src/render/worldSigns";
import { buildingCauseSnapshot } from "../src/ui/houseProgressModel";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Locator = { first: () => Locator; click: (options?: object) => Promise<void>; count: () => Promise<number>; waitFor: (options?: object) => Promise<void>;
  screenshot: (options: object) => Promise<unknown>; evaluate: <T>(f: (node: Element) => T) => Promise<T> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>; evaluate: <T, A = void>(f: (arg: A) => T, arg?: A) => Promise<T>;
  locator: (selector: string) => Locator; getByRole: (role: string, options: object) => Locator; keyboard: { press: (key: string) => Promise<void> };
  mouse: { click: (x: number, y: number) => Promise<void>; move: (x: number, y: number) => Promise<void> }; on: (event: string, handler: (error: unknown) => void) => void };
type Proof = { tileClientPoint: (tile: object) => { clientX: number; clientY: number } };
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

// ④ the world close up (paused, the story held back): what the plague leaves in the town before any card.
const church = (state: GameState) => state.buildings.find(building => building.kind === "church") ?? state.buildings.find(building => building.kind === "chapel")!;
function worldFacts(state: GameState) {
  const houses = new Set(state.buildings.filter(building => building.kind === "house").map(building => building.id));
  const wanting = [...buildingCauseSnapshot(state)].filter(([id, cause]) => houses.has(id) && cause.blocker?.causeId === "operation_paused" && cause.blocker.requirement === "church").map(([id]) => id);
  const marked = new Set(causeMarkersForState(state, 1.4).flatMap(marker => marker.buildingIds));
  return { tick: state.tick, stage: plagueStage(state), dead: state.plague?.first?.dead ?? 0, graves: plagueProps(state).length, curacyVacant: curacyVacant(state),
    churchSign: worldSigns(state).some(sign => sign.kind === "curacy_vacant"), housesWantingChurch: wanting.length, ofThemMarked: wanting.filter(id => marked.has(id)).length,
    vacantPlots: plagueVacantPlots(state).length };
}
for (const [file, name, at] of [["w1-first-deaths-church", "first-deaths", "church"], ["w2-empty-streets", "wages", "vacant"], ["w3-priest-died", "plague.priest_died", "church"]] as const) {
  await step(file, async () => {
    const state = load(name);
    const vacant = state.buildings.find(building => plagueVacantPlots(state).includes(building.id));
    const target = at === "vacant" && vacant !== undefined ? vacant : church(state);
    const { page, close } = await scene(name, 600_000, { tile: [target.tx + 1, target.ty + 1], zoom: 1.4 });
    // No hover: a pointer at the screen's edge pans the camera (edge scroll).
    await page.waitForTimeout(2_500);
    await page.screenshot({ path: join(out!, `${file}.jpg`), type: "jpeg", quality: 68 });
    result[file] = worldFacts(state);
    await close();
  });
}

// ⑤ the wage ledger (the ledger drawer's stock tab at chapter 3's end) and a family tree with the plague's dead.
await step("l1-wage-ledger", async () => {
  const { page, close } = await scene("chapter3-end", 600_000);
  for (const selector of [".chronicle-page .chronicle-keep", ".story-modal-later", ".season-ledger-resume"]) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(400); }
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(700);
  await page.evaluate(() => { document.querySelector(".ledger-wage-ledger")?.scrollIntoView({ block: "end" }); }); await page.waitForTimeout(300);
  await page.locator(".ledger-drawer").first().screenshot({ path: join(out!, "l1-wage-ledger.jpg"), type: "jpeg", quality: 70 });
  result["l1-wage-ledger"] = await page.evaluate(() => [...document.querySelectorAll(".ledger-wage-ledger tr, .ledger-wage-ledger p")].map(row => row.textContent?.trim() ?? ""));
  await close();
});
await step("t1-plague-tree", async () => {
  // A living child (1349) whose parent the plague took: the house card's chip, [전기 보기], [가계도].
  const state = load("plague.abandoned_fields");
  const past = new Map((state.persons?.past ?? []).map(person => [person.id, person]));
  const related = (person: object) => Object.values(person).flatMap(value => typeof value === "string" ? [value] : Array.isArray(value) ? value.filter(item => typeof item === "string") : []);
  const child = (state.persons?.people ?? []).find(person => person.role === "child" && related(person).some(id => past.get(id)?.deathCause === "plague"));
  if (child === undefined) throw new Error("no child with a parent dead of the plague");
  const house = state.buildings.find(building => building.id === child.householdId)!;
  const { page, close } = await scene("plague.abandoned_fields", 600_000, { tile: [house.tx, house.ty], zoom: 1.4 });
  let found = false;
  for (const [dx, dy, lift] of [[0.5, 0.5, 8], [0.5, 0.5, 28], [0.5, 0.5, 48], [0.3, 0.3, 8], [1, 1, 8], [1, 1, 36]] as const) {
    const point = await page.evaluate(tile => (window as unknown as { __FEUDAL_PHASE10_PROOF__: Proof }).__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), { tx: house.tx + dx, ty: house.ty + dy });
    await page.mouse.click(point.clientX, point.clientY - lift); await page.waitForTimeout(700);
    if (await page.locator(`.person-chip[data-person="${child.id}"]`).count() === 0 && await page.locator(".person-list-toggle[aria-expanded='false']").count() > 0) {
      await page.locator(".person-list-toggle[aria-expanded='false']").first().click(); await page.waitForTimeout(400);
    }
    if (await page.locator(`.person-chip[data-person="${child.id}"]`).count() > 0) { found = true; break; }
    await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  }
  if (!found) throw new Error(`no house card with ${child.id}`);
  await page.locator(`.person-chip[data-person="${child.id}"]`).first().click(); await page.waitForTimeout(600);
  await page.getByRole("button", { name: "전기 보기" }).first().click();
  await page.locator(".chronicle-biography").first().waitFor({ timeout: 10_000 }); await page.waitForTimeout(900);
  await page.getByRole("tab", { name: "가계도" }).first().click(); await page.waitForTimeout(1_200);
  await page.mouse.move(640, 790); await page.waitForTimeout(300);
  await page.locator(".chronicle-screen").first().screenshot({ path: join(out!, "t1-plague-tree.jpg"), type: "jpeg", quality: 70 });
  result["t1-plague-tree"] = { child: child.id, ...await page.evaluate(() => ({ deceased: document.querySelectorAll("[data-dead='true'], .family-tree-node--dead").length,
    causes: [...document.querySelectorAll(".family-tree-cause, [data-death-cause]")].map(node => node.textContent?.trim() ?? "").slice(0, 8) })) };
  await close();
});

await browser.close();
await pause(10);
result.errors = errors;
writeFileSync(join(out!, "captures.json"), JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify({ steps: Object.keys(result).length, errors: errors.length }));
process.exitCode = errors.length === 0 ? 0 : 1;
