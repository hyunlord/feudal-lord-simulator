// INSTALL-23 gate ① captures (JPEG): the Crown's arms from Wave 23 by the year — the wool levy card's roundel and writ
// seal (1337), the faction tab and the Crown's page in 1339 (England) and in 1340 (quartered with France), and the
// chronicle's records of the Crown's favour (1338: England). States from scripts/ui6States.ts.
//   PLAYWRIGHT_MODULE=... npx tsx scripts/install23RoyalCaptures.ts <out-dir> --url <game> --states <ui6States dir>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>; evaluate: <T>(f: () => T) => Promise<T>;
  locator: (selector: string) => { first: () => { click: (options?: object) => Promise<void> }; count: () => Promise<number>; waitFor: (options?: object) => Promise<void> } };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const result: Record<string, unknown> = {};
const errors: string[] = [];
const royalImages = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>("img.emblem-image[data-emblem^='royal.']")]
  .map(image => ({ emblem: image.getAttribute("data-emblem"), src: image.currentSrc.replace(/^.*\/assets\//, "assets/"), width: image.width })));

async function scene(name: string, delay: number): Promise<{ page: Page; close: () => Promise<void> }> {
  const state = JSON.parse(readFileSync(join(statesDir, `${name}.json`), "utf8")) as GameState;
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings.find(building => building.kind === "house")!;
  const { context, page } = await openScene(browser, { state, tile: [keep.tx, keep.ty], baseUrl: url, width: 1280, height: 800, zoom: 1.1, run: false,
    initScript: TUTORIAL_OFF, query: `&story-delay=${delay}` });
  return { page: page as Page, close: () => context.close() };
}
async function step(name: string, run: () => Promise<void>) {
  try { await run(); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); }
}
const openFactions = async (page: Page) => {
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(500);
  await page.locator(".ledger-tab--chronicle").first().click(); await page.waitForTimeout(1_000);
  await page.evaluate(() => { for (const tab of document.querySelectorAll<HTMLElement>(".chronicle-tab")) if (tab.textContent?.trim() === "세력") tab.click(); });
  await page.waitForTimeout(900);
};

await step("card-1337", async () => {
  const { page, close } = await scene("wool_payment", 5_000);
  await page.locator(".petition-card").waitFor({ timeout: 30_000 }); await page.waitForTimeout(900);
  await page.screenshot({ path: join(out!, "r1-card-1337.jpg"), type: "jpeg", quality: 70, clip: { x: 270, y: 80, width: 740, height: 300 } });
  result["card-1337"] = await royalImages(page);
  await close();
});
for (const [name, label] of [["beacon", "1339"], ["chapter2-end", "1340"]] as const) {
  await step(`factions-${label}`, async () => {
    const { page, close } = await scene(name, 600_000);
    await page.waitForTimeout(800);
    await openFactions(page);
    await page.screenshot({ path: join(out!, `r2-faction-tab-${label}.jpg`), type: "jpeg", quality: 65, clip: { x: 0, y: 0, width: 1280, height: 260 } });
    await page.locator(".chronicle-factions-row[data-faction='crown']").first().click(); await page.waitForTimeout(900);
    await page.screenshot({ path: join(out!, `r3-crown-page-${label}.jpg`), type: "jpeg", quality: 65, clip: { x: 350, y: 60, width: 580, height: 300 } });
    result[`factions-${label}`] = await royalImages(page);
    await close();
  });
}
await step("chronicle-1338", async () => {
  // The Crown's page's own records (a record link opens the chronicle filtered to the faction): the favour records
  // of 1337-1338 carry the arms of their year (England).
  const { page, close } = await scene("chapter2-end", 600_000);
  await page.waitForTimeout(800);
  await openFactions(page);
  await page.locator(".chronicle-factions-row[data-faction='crown']").first().click(); await page.waitForTimeout(900);
  await page.evaluate(() => { for (const link of document.querySelectorAll<HTMLElement>(".chronicle-faction-record")) if (link.textContent?.includes("마음이")) { link.click(); return; } });
  await page.waitForTimeout(1_200);
  await page.screenshot({ path: join(out!, "r4-chronicle-crown-records.jpg"), type: "jpeg", quality: 65 });
  result["chronicle-crown-records"] = await royalImages(page);
  await close();
});

await browser.close();
writeFileSync(join(out!, "captures.json"), JSON.stringify({ ...result, errors }, null, 1) + "\n");
console.log(JSON.stringify({ steps: Object.keys(result).length, errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
