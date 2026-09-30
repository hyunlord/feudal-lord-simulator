// NAME-1 gate captures (JPEG, 1280 x 800): every person's name the screens write, read in Korean (FIX-6
// `persons.displayName`), and no Latin letter in any of them —
//  - the chronicle's records at the house change (the naive seed 3 run, 1307: people's records) and a biography;
//  - the faction tab and the Crown's page (chapter 2's end);
//  - two decision cards' people (the Crown's wool levy, the bishop's refugees);
//  - with --states5, the walker card (UI-5's carrying state: a carter's line).
// Beside the shots names.json: each surface's names and any Latin found (coin amounts such as "605d" are not names).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/name1Captures.ts <out-dir> --url <game> --states <ui6States dir> [--states5 <ui5States dir>]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/name1Captures.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/name1Captures.ts …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>; evaluate: <T, A>(f: (arg: A) => T, arg?: A) => Promise<T>;
  locator: (selector: string) => { first: () => { click: (options?: object) => Promise<void> }; count: () => Promise<number>; waitFor: (options?: object) => Promise<void> };
  mouse: { click: (x: number, y: number) => Promise<void> }; on: (event: string, handler: (error: unknown) => void) => void };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!; const states5 = flag("states5");
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const result: Record<string, { names: string[]; latin: string[] }> = {};
const errors: string[] = [];
/** Latin letters in a name (coin amounts "605d" and the like are not names). */
const latinIn = (text: string) => (text.replace(/\d+\s*d\b/g, "").match(/[A-Za-z]+/g) ?? []);

async function scene(dir: string, name: string, tile?: [number, number], zoom = 1.1): Promise<{ page: Page; close: () => Promise<void> }> {
  const state = JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8")) as GameState;
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings.find(building => building.kind === "house")!;
  const { context, page } = await openScene(browser, { state, tile: tile ?? [keep.tx, keep.ty], baseUrl: url, width: 1280, height: 800, zoom, run: false,
    initScript: TUTORIAL_OFF, query: "&story-delay=5000" });
  (page as Page).on("pageerror", error => errors.push(`${name}: ${String(error).slice(0, 200)}`));
  return { page: page as Page, close: () => context.close() };
}
function record(surface: string, names: readonly string[]) {
  const clean = names.map(name => name.replace(/\s+/g, " ").trim()).filter(name => name !== "");
  result[surface] = { names: clean, latin: clean.flatMap(latinIn) };
}
async function step(name: string, run: () => Promise<void>) {
  try { await run(); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); }
}
const openChronicle = async (page: Page) => {
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(500);
  await page.locator(".ledger-tab--chronicle").first().click(); await page.waitForTimeout(1_200);
};

// The chronicle at the house change: its people's records, then the first person's biography.
await step("chronicle", async () => {
  const { page, close } = await scene(statesDir, "house-change");
  await page.waitForTimeout(800);
  if (await page.locator(".story-modal-later").count() > 0) { await page.locator(".story-modal-later").first().click(); await page.waitForTimeout(300); }
  await openChronicle(page);
  await page.screenshot({ path: join(out!, "n1-chronicle.jpg"), type: "jpeg", quality: 60 });
  record("chronicle", await page.evaluate(() => [...document.querySelectorAll(".chronicle-card")].filter(card => card.querySelector(".chronicle-card-action[aria-label]") !== null)
    .map(card => card.querySelector(".chronicle-card-line")?.textContent ?? "")));
  await page.evaluate(() => { for (const button of document.querySelectorAll<HTMLElement>(".chronicle-card-action")) if (button.textContent?.trim() === "인물") { button.click(); return; } });
  await page.locator(".chronicle-biography").waitFor({ timeout: 10_000 }); await page.waitForTimeout(800);
  await page.screenshot({ path: join(out!, "n2-biography.jpg"), type: "jpeg", quality: 60 });
  record("biography", await page.evaluate(() => {
    const page = document.querySelector(".chronicle-biography")!;
    // Its title, heading, household and relations, the life's lines (not the portrait's match line: a picture id, no name).
    return [page.getAttribute("aria-label") ?? "", ...[...page.querySelectorAll("h2, h3, li, p")].filter(node => node.closest(".chronicle-biography-match") === null)
      .map(node => node.textContent ?? "")];
  }));
  await close();
});

// The faction tab and the Crown's page (their leaders, the town's heads, the timeline's kings).
await step("factions", async () => {
  const { page, close } = await scene(statesDir, "chapter2-end");
  await page.waitForTimeout(800);
  await page.locator(".chronicle-page").waitFor({ timeout: 20_000 }).catch(() => undefined);
  await page.evaluate(() => { for (const button of document.querySelectorAll<HTMLElement>("button")) if (button.textContent?.includes("계속")) { button.click(); return; } });
  await page.waitForTimeout(500);
  await openChronicle(page);
  await page.evaluate(() => { for (const tab of document.querySelectorAll<HTMLElement>(".chronicle-tab")) if (tab.textContent?.trim() === "세력") tab.click(); });
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(out!, "n3-faction-tab.jpg"), type: "jpeg", quality: 60 });
  record("faction tab", await page.evaluate(() => [...document.querySelectorAll(".chronicle-factions-leader-text strong, .chronicle-factions-name strong")].map(node => node.textContent ?? "")));
  await page.locator(".chronicle-factions-row[data-faction='crown']").first().click(); await page.waitForTimeout(800);
  await page.screenshot({ path: join(out!, "n4-faction-page.jpg"), type: "jpeg", quality: 60 });
  record("faction page", await page.evaluate(() => [...document.querySelectorAll(".chronicle-faction-name, .chronicle-faction li")].map(node => node.textContent ?? "")));
  await close();
});

// Two decision cards' people: the king (the Crown's writ) and the bishop with the refugees.
for (const name of ["wool_payment", "refugee_admission"]) {
  await step(name, async () => {
    const { page, close } = await scene(statesDir, name);
    await page.locator(".petition-card").waitFor({ timeout: 30_000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(out!, `n5-${name}.jpg`), type: "jpeg", quality: 60 });
    record(`petition ${name}`, await page.evaluate(() => [...document.querySelectorAll(".petition-card .person-chip, .petition-who")].map(node => (node as HTMLElement).innerText)));
    await close();
  });
}

// The walker card (UI-5's carrying state and moment).
if (states5 !== undefined) {
  await step("walker", async () => {
    const moments = JSON.parse(readFileSync(join(states5, "moments.json"), "utf8")) as { carrying: { walkerId: string; tile: { tx: number; ty: number } } };
    const { walkerId, tile } = moments.carrying;
    const { page, close } = await scene(states5, "carrying", [tile.tx, tile.ty], 2);
    const point = await page.evaluate(at => (window as unknown as { __FEUDAL_PHASE10_PROOF__: { tileClientPoint: (t: object) => { clientX: number; clientY: number } } })
      .__FEUDAL_PHASE10_PROOF__.tileClientPoint(at), tile);
    await page.mouse.click(point.clientX, point.clientY);
    await page.locator(`.diagnostic-card [data-walker-headline="${walkerId}"]`).waitFor({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(out!, "n6-walker.jpg"), type: "jpeg", quality: 60 });
    // The card's heading names the walker's person (name · job); the headline is what they do.
    record("walker", await page.evaluate(id => { const line = document.querySelector(`[data-walker-headline="${id}"]`);
      return [line?.closest(".diagnostic-card")?.querySelector("h2")?.textContent ?? "", line?.textContent ?? ""]; }, walkerId));
    await close();
  });
}

await browser.close();
const latin = Object.entries(result).flatMap(([surface, entry]) => entry.latin.map(word => `${surface}: ${word}`));
writeFileSync(join(out!, "names.json"), JSON.stringify({ surfaces: result, latin, errors }, null, 1) + "\n");
console.log(JSON.stringify({ surfaces: Object.fromEntries(Object.entries(result).map(([key, entry]) => [key, entry.names.length])), latin, errors }));
process.exitCode = errors.length === 0 && latin.length === 0 ? 0 : 1;
