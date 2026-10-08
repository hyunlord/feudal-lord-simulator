// INSTALL-18 (Wave 14 leftovers) captures (JPEG): the chronicle's faction tab in Wave 14's faction panel with the kind
// icons (24 px on the rows) — the campaign at 1280 x 800 and 1024 x 768 (chapter 4, all nine) and lord mode (the met
// factions only) — the faction pages of the four kinds that have an icon (32 px), a long name on a row and a page (text
// lengthened in the page, a display check only), and the tab with the panel's file missing (the current look stays).
// Each scene records the rows' heights, the icons' files, the panel's border image and where the heading sits in it.
//   PLAYWRIGHT_MODULE=... npx tsx scripts/in18W14Captures.ts <out-dir> --url <game> --campaign <state.json> --lord <state.json>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/in18W14Captures.ts)", { remote: "scripts/remote/run.sh render-IN18-in18w14-<what>-<sha7> --light -- bash scripts/in18W14Captures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>; evaluate: <T, A = undefined>(f: (arg: A) => T, arg?: A) => Promise<T>;
  locator: (selector: string) => { first: () => { click: (options?: object) => Promise<void>; waitFor: (options?: object) => Promise<void> }; count: () => Promise<number>; waitFor: (options?: object) => Promise<void> } };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const result: Record<string, unknown> = {};
const errors: string[] = [];
const MISSING_PANEL = [{ pattern: "**/src/render/art/catalog.json*", from: "assets/wave14/ui-frames/frame_faction_panel-v1.png", to: "assets/wave14/ui-frames/frame_faction_panel-missing.png" }];

async function scene(file: string, width: number, height: number, rewrite: typeof MISSING_PANEL = []) {
  const state = JSON.parse(readFileSync(file, "utf8")) as GameState;
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings.find(building => building.kind === "house")!;
  const { context, page } = await openScene(browser, { state, tile: [keep.tx, keep.ty], baseUrl: url, width, height, zoom: 1.1, run: false,
    initScript: TUTORIAL_OFF, query: "&story-delay=600000", rewrite });
  return { page: page as Page, close: () => context.close() };
}
async function step(name: string, run: () => Promise<void>) {
  try { await run(); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); }
}
const openFactions = async (page: Page) => {
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(500);
  await page.locator(".ledger-tab--chronicle").first().click(); await page.waitForTimeout(1_000);
  await page.evaluate(() => { for (const tab of document.querySelectorAll<HTMLElement>(".chronicle-tab")) if (tab.textContent?.trim() === "세력") tab.click(); });
  await page.locator(".chronicle-factions-row").first().waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_200);
};
/** The tab as drawn: each row's height and icon, the panel's art and the heading's place in it (art px from the top). */
const measureTab = (page: Page) => page.evaluate(() => {
  const panel = document.querySelector<HTMLElement>(".chronicle-factions-panel");
  const heading = document.querySelector<HTMLElement>(".chronicle-factions-heading");
  const box = panel?.getBoundingClientRect(); const text = heading?.getBoundingClientRect();
  return {
    panel: panel === null || box === undefined ? null : { art: panel.classList.contains("chronicle-factions-panel--art"), width: box.width, height: box.height,
      borderImage: getComputedStyle(panel).borderImageSource.replace(/^.*\/assets\//, "assets/"), borderWidth: getComputedStyle(panel).borderWidth,
      heading: text === undefined ? null : { top: text.top - box.top, bottom: text.bottom - box.top, text: heading?.textContent, fontSize: getComputedStyle(heading!).fontSize } },
    rows: [...document.querySelectorAll<HTMLElement>(".chronicle-factions-row")].map(row => {
      const icon = row.querySelector<HTMLElement>(".chronicle-factions-kind-icon");
      return { faction: row.dataset.faction, height: row.getBoundingClientRect().height, icon: icon === null ? null
        : { kind: icon.dataset.kind, size: icon.getBoundingClientRect().width, file: getComputedStyle(icon).backgroundImage.replace(/^.*\/assets\//, "assets/").replace(/"\)$/, "") } };
    }),
  };
});
const measurePage = (page: Page) => page.evaluate(() => {
  const icon = document.querySelector<HTMLElement>(".chronicle-faction-kind-icon");
  const name = document.querySelector<HTMLElement>(".chronicle-faction-name"); const h3 = name?.querySelector("h3");
  return { faction: document.querySelector<HTMLElement>(".chronicle-faction")?.dataset.faction, name: h3?.textContent,
    icon: icon === null ? null : { kind: icon.dataset.kind, size: icon.getBoundingClientRect().width, file: getComputedStyle(icon).backgroundImage.replace(/^.*\/assets\//, "assets/").replace(/"\)$/, "") },
    nameSlot: name === null || name === undefined ? null : { clientHeight: name.clientHeight, scrollHeight: name.scrollHeight, clientWidth: name.clientWidth, scrollWidth: name.scrollWidth } };
});

const campaign = flag("campaign")!; const lord = flag("lord")!;
for (const [width, height] of [[1280, 800], [1024, 768]] as const) {
  await step(`campaign-tab-${width}`, async () => {
    const { page, close } = await scene(campaign, width, height);
    await openFactions(page);
    await page.screenshot({ path: join(out!, `w1-campaign-tab-${width}.jpg`), type: "jpeg", quality: 62 });
    result[`campaign-tab-${width}`] = await measureTab(page);
    if (width === 1280) {
      for (const faction of ["crown", "bishop", "merchant_house_1", "town"]) {
        await page.locator(`.chronicle-factions-row[data-faction='${faction}']`).first().click(); await page.waitForTimeout(1_000);
        await page.screenshot({ path: join(out!, `w2-page-${faction}.jpg`), type: "jpeg", quality: 62, clip: { x: 340, y: 50, width: 600, height: 260 } });
        result[`page-${faction}`] = await measurePage(page);
        await page.evaluate(() => { for (const button of document.querySelectorAll<HTMLElement>("button")) if (button.textContent?.includes("세력 목록으로")) { button.click(); return; } });
        await page.waitForTimeout(800);
      }
      // Long text (a display check: the names lengthened in the page, not in the game).
      await page.evaluate(() => {
        const row = document.querySelector<HTMLElement>(".chronicle-factions-row[data-faction='merchant_house_1'] .chronicle-factions-name strong");
        if (row?.lastChild) row.lastChild.textContent = `${row.lastChild.textContent ?? ""} 상인 가문의 아주 길게 늘인 이름 시험`;
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(out!, "w3-long-row.jpg"), type: "jpeg", quality: 62, clip: { x: 0, y: 40, width: 1280, height: 420 } });
      result["long-row"] = await measureTab(page);
      await page.locator(".chronicle-factions-row[data-faction='town']").first().click(); await page.waitForTimeout(1_000);
      await page.evaluate(() => { const h3 = document.querySelector<HTMLElement>(".chronicle-faction-name h3"); if (h3?.lastChild) h3.lastChild.textContent = `${h3.lastChild.textContent ?? ""} 자치 도시의 아주 길게 늘인 이름`; });
      await page.waitForTimeout(300);
      await page.screenshot({ path: join(out!, "w3-long-page.jpg"), type: "jpeg", quality: 62, clip: { x: 340, y: 50, width: 600, height: 260 } });
      result["long-page"] = await measurePage(page);
    }
    await close();
  });
}
await step("lord-tab", async () => {
  const { page, close } = await scene(lord, 1280, 800);
  await openFactions(page);
  await page.screenshot({ path: join(out!, "w4-lord-tab.jpg"), type: "jpeg", quality: 62 });
  result["lord-tab"] = await measureTab(page);
  await close();
});
await step("campaign-tab-panel-missing", async () => {
  const { page, close } = await scene(campaign, 1280, 800, MISSING_PANEL);
  await openFactions(page);
  await page.screenshot({ path: join(out!, "w5-panel-missing.jpg"), type: "jpeg", quality: 62, clip: { x: 0, y: 0, width: 1280, height: 420 } });
  result["panel-missing"] = await measureTab(page);
  await close();
});

await browser.close();
writeFileSync(join(out!, "captures.json"), JSON.stringify({ ...result, errors }, null, 1) + "\n");
console.log(JSON.stringify({ steps: Object.keys(result).length, errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
