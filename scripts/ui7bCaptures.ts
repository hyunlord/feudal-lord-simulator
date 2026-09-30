// UI-7b gates on UI-7's states (scripts/ui7States.ts: the v24 town left to run):
//   p1 a commoner baby's biography — the shield and small circle covered, no parent in the circle, no portrait line;
//   p2 the same with the developer display on (the portrait line back);
//   p3 the lord's biography — the house's arms in the shield, the small circle covered;
//   p4 a commoner's person card (the shield covered) and p5 the lord's (the arms).
// Element JPEGs and captures.json (what each page holds).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/ui7bCaptures.ts <out-dir> --url <game> --states <ui7States dir>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/ui7bCaptures.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/ui7bCaptures.ts …", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Locator = { first: () => Locator; count: () => Promise<number>; waitFor: (options?: object) => Promise<void>; click: () => Promise<void>;
  screenshot: (options: object) => Promise<unknown>; evaluate: <T>(f: (node: Element) => T) => Promise<T> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; evaluate: <T, A>(f: (arg: A) => T, arg?: A) => Promise<T>; locator: (selector: string) => Locator;
  getByRole: (role: string, options: object) => Locator; mouse: { click: (x: number, y: number) => Promise<void> }; keyboard: { press: (key: string) => Promise<void> };
  on: (event: string, handler: (error: unknown) => void) => void };
type Proof = { tileClientPoint: (tile: object) => { clientX: number; clientY: number } };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = "localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] }));";
const DEVELOPER_ON = "localStorage.setItem('feudal.presentation.developerInfo', '1');";
const moments = JSON.parse(readFileSync(join(statesDir, "moments.json"), "utf8")) as Record<string, { person: string; house: [number, number] | null }>;
const load = (name: string) => JSON.parse(readFileSync(join(statesDir, `${name}.json`), "utf8")) as GameState;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const result: Record<string, unknown> = {};
const errors: string[] = [];
const files: string[] = [];

async function scene(state: GameState, tile: readonly number[], developer = false) {
  const { context, page } = await openScene(browser, { state, tile, baseUrl: url, width: 1280, height: 800, zoom: 1.4, run: false,
    initScript: `try { ${TUTORIAL_OFF}${developer ? DEVELOPER_ON : ""} } catch (error) { void error; }`, query: "&story-delay=600000&weather=none" }) as { context: { close: () => Promise<void> }; page: Page };
  page.on("pageerror", error => errors.push(String(error).slice(0, 200)));
  for (const selector of [".season-ledger-resume", ".story-modal-later"]) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(300); }
  await page.waitForTimeout(800);
  return { page, close: () => context.close() };
}
async function shot(locator: Locator, file: string) { await locator.first().screenshot({ path: join(out!, file), type: "jpeg", quality: 70 }); files.push(file); }
async function chipIn(page: Page, house: readonly number[], personId: string) {
  for (const [dx, dy, lift] of [[0.5, 0.5, 8], [0.5, 0.5, 28], [0.5, 0.5, 48], [1, 1, 8], [1, 1, 36]] as const) {
    const at = await page.evaluate(tile => (window as unknown as { __FEUDAL_PHASE10_PROOF__: Proof }).__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), { tx: house[0]! + dx, ty: house[1]! + dy });
    await page.mouse.click(at.clientX, at.clientY - lift); await page.waitForTimeout(700);
    if (await page.locator(`.person-chip[data-person="${personId}"]`).count() === 0 && await page.locator(".person-list-toggle[aria-expanded='false']").count() > 0) {
      await page.locator(".person-list-toggle[aria-expanded='false']").first().click(); await page.waitForTimeout(400);
    }
    if (await page.locator(`.person-chip[data-person="${personId}"]`).count() > 0) return;
    await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  }
  throw new Error(`no chip for ${personId}`);
}
async function lordChip(page: Page) {
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(500);
  await page.locator("[data-ledger-tab='rights']").first().click(); await page.waitForTimeout(600);
}
const pageFacts = (page: Page) => page.locator(".chronicle-biography").first().evaluate(node => ({
  armsCovered: node.querySelector(".chronicle-biography-cover--arms") !== null, markCovered: node.querySelector(".chronicle-biography-cover--mark") !== null,
  arms: node.querySelector(".chronicle-biography-arms") !== null, companion: node.querySelector(".chronicle-biography-companion") !== null,
  match: node.querySelector(".chronicle-biography-match")?.textContent ?? null,
}));
const cardFacts = (page: Page) => page.locator(".person-card").first().evaluate(node => ({
  shieldCovered: node.querySelector(".person-card-emblem-cover") !== null, emblem: node.querySelector(".person-card-emblem")?.getAttribute("data-emblem-kind") ?? null,
  match: node.querySelector(".person-card-match")?.textContent ?? null,
}));
async function step(name: string, run: () => Promise<Record<string, unknown>>) {
  try { result[name] = await run(); console.log(name, "ok"); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); console.log(name, "FAILED", String(error).slice(0, 200)); }
}
for (const developer of [false, true]) {
  await step(developer ? "p2-baby-biography-developer" : "p1-baby-biography", async () => {
    const baby = moments.baby!; const { page, close } = await scene(load("baby"), baby.house!, developer);
    await chipIn(page, baby.house!, baby.person);
    await page.locator(`.person-chip[data-person="${baby.person}"]`).first().click(); await page.waitForTimeout(600);
    if (!developer) { await shot(page.locator(".person-card"), "p4-commoner-card.jpg"); result["p4-commoner-card"] = await cardFacts(page); }
    await page.getByRole("button", { name: "전기 보기" }).first().click();
    await page.locator(".chronicle-biography").first().waitFor({ timeout: 10_000 }); await page.waitForTimeout(900);
    await shot(page.locator(".chronicle-biography"), developer ? "p2-baby-biography-developer.jpg" : "p1-baby-biography.jpg");
    const facts = await pageFacts(page);
    await close();
    return { person: baby.person, ...facts };
  });
}
await step("p3-lord-biography", async () => {
  const lord = moments.lord!; const state = load("lord");
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings[0]!;
  const { page, close } = await scene(state, [keep.tx, keep.ty]);
  await lordChip(page);
  await page.locator(`.person-chip[data-person="${lord.person}"]`).first().click(); await page.waitForTimeout(600);
  await shot(page.locator(".person-card"), "p5-lord-card.jpg"); result["p5-lord-card"] = await cardFacts(page);
  await page.getByRole("button", { name: "전기 보기" }).first().click();
  await page.locator(".chronicle-biography").first().waitFor({ timeout: 10_000 }); await page.waitForTimeout(1_200);
  await shot(page.locator(".chronicle-biography"), "p3-lord-biography.jpg");
  const facts = await pageFacts(page);
  await close();
  return { person: lord.person, ...facts };
});
await browser.close();
const bytes = files.reduce((total, file) => total + statSync(join(out!, file)).size, 0);
writeFileSync(join(out!, "captures.json"), JSON.stringify({ steps: result, files, jpegBytes: bytes, errors }, null, 1) + "\n");
console.log(JSON.stringify({ steps: result, errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
