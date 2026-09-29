// UI-9b gate captures (JPEG, 1280 × 800), this build (--url) beside the trunk before it (--base) where the change is a
// picture:
//  a1/a2 the rights tab's house arms and the faction tab's nine crests at chapter 4's end (seed 2), before → after,
//        with every shield's recipe read in node (none may read as a king's: a golden lily on blue, a golden lion on red);
//  p1    the commons' faction page after the chased rumour: the revolt pressure a cell inside the page (page and cell
//        boxes measured in the DOM), and its cell scrolled to the end;
//  c1    the chased collector close up (paused, zoom 1.8), before (the royal messenger) → after (Wave 17 collector);
//  o3/o4/o5 chapters 3, 4 and 5's opening screens (UI-6's chapter 2 end, UI-9's chapter 3 and chapter 4 ends), and o6 the
//        chronicle's chapter starts (milestones only) with their Wave 31 paintings;
//  f1    the pastoral farm on its 2 × 1 plot (CLOTH-UI's state after the shearing), before → after.
//   PLAYWRIGHT_MODULE=... npx tsx scripts/ui9bCaptures.ts <out> --url <this> --base <trunk> --states <UI-9 states> --states6 <UI-6> --cloth <CLOTH-UI>
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { lordHouse } from "../src/engine/lordshipState";
import { currentYear } from "../src/engine/persons";
import { factionEmblem } from "../src/ui/chronicle/chronicleScreenModel";
import type { EmblemSpec } from "../src/ui/heraldry/EmblemImage";
import { armsKey, looksRoyal } from "../src/ui/heraldry/heraldry";
import { lordHouseArms } from "../src/ui/persons/personModels";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Locator = { first: () => Locator; click: (options?: object) => Promise<void>; count: () => Promise<number>; waitFor: (options?: object) => Promise<void>;
  screenshot: (options: object) => Promise<unknown> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>; evaluate: <T, A = void>(f: ((arg: A) => T) | string, arg?: A) => Promise<T>;
  locator: (selector: string) => Locator; on: (event: string, handler: (error: unknown) => void) => void };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const base = flag("base")!;
const dirs = { ui9: flag("states")!, ui6: flag("states6")!, cloth: flag("cloth")! };
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const load = (dir: string, name: string) => JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8")) as GameState;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const result: Record<string, unknown> = {};
const errors: string[] = [];
const builds = [["before", base], ["after", url]] as const;

const keepOf = (state: GameState) => state.buildings.find(building => building.kind === "keep") ?? state.buildings.find(building => building.kind === "church")!;
async function scene(state: GameState, at: readonly number[], options: { baseUrl?: string; zoom?: number; delay?: number; label: string }) {
  const { context, page } = await openScene(browser, { state, tile: at, baseUrl: options.baseUrl ?? url, width: 1280, height: 800, zoom: options.zoom ?? 1.1, run: false,
    initScript: TUTORIAL_OFF, query: `&story-delay=${options.delay ?? 600_000}` });
  (page as Page).on("pageerror", error => errors.push(`${options.label}: ${String(error).slice(0, 200)}`));
  return { page: page as Page, close: () => context.close() };
}
async function step(name: string, run: () => Promise<void>) {
  try { await run(); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); }
}
async function dismiss(page: Page) {
  for (const selector of [".chronicle-page .chronicle-keep", ".story-modal-later", ".season-ledger-resume"]) {
    if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(400); }
  }
}
async function openLedger(page: Page, tab: string) {
  await dismiss(page);
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(700);
  await page.locator(tab).first().click(); await page.waitForTimeout(1_200);
}
async function openFactions(page: Page) {
  await openLedger(page, ".ledger-tab--chronicle");
  await page.evaluate(() => { for (const tab of document.querySelectorAll<HTMLElement>(".chronicle-tab")) if (tab.textContent?.trim() === "세력") tab.click(); });
  await page.waitForTimeout(900);
}

// a: the arms. Node reads every shield the screens draw from this state: the lord's house and the nine factions.
const end4 = load(dirs.ui9, "chapter4-end");
const emblemArms = (emblem: EmblemSpec) => emblem.kind === "arms" ? { key: armsKey(emblem.recipe), royal: looksRoyal(emblem.recipe) } : { kind: emblem.kind };
result.arms = {
  house: { name: lordHouse(end4).name, ...emblemArms(lordHouseArms(end4)) },
  factions: (end4.factions?.factions ?? []).map(faction => ({ id: faction.id, ...emblemArms(factionEmblem(faction, currentYear(end4))) })),
};
for (const [when, build] of builds) {
  await step(`a1-rights-arms-${when}`, async () => {
    const keep = keepOf(end4);
    const { page, close } = await scene(end4, [keep.tx, keep.ty], { baseUrl: build, label: `a1-${when}` });
    await openLedger(page, "[data-ledger-tab='rights']");
    await page.locator(".ledger-drawer").first().screenshot({ path: join(out!, `a1-rights-arms-${when}.jpg`), type: "jpeg", quality: 70 });
    await close();
  });
  await step(`a2-faction-crests-${when}`, async () => {
    const keep = keepOf(end4);
    const { page, close } = await scene(end4, [keep.tx, keep.ty], { baseUrl: build, label: `a2-${when}` });
    await openFactions(page);
    await page.screenshot({ path: join(out!, `a2-faction-crests-${when}.jpg`), type: "jpeg", quality: 66 });
    await close();
  });
}

// p1: the commons' page, chased: the pressure cell inside the page's box.
await step("p1-commons-pressure", async () => {
  const state = load(dirs.ui9, "rumour-chased");
  const keep = keepOf(state);
  const { page, close } = await scene(state, [keep.tx, keep.ty], { label: "p1" });
  await openFactions(page);
  await page.locator(".chronicle-factions-row[data-faction='commons']").first().click(); await page.waitForTimeout(900);
  await page.screenshot({ path: join(out!, "p1-commons-pressure.jpg"), type: "jpeg", quality: 70 });
  // A string, so tsx adds no helper names to the browser's code.
  result.p1 = await page.evaluate(`(() => {
    const rect = selector => { const r = document.querySelector(selector)?.getBoundingClientRect(); return r === undefined ? null : [r.left, r.top, r.right, r.bottom].map(Math.round); };
    const pageBox = rect(".chronicle-faction"); const cell = rect(".chronicle-faction-pressure");
    const body = document.querySelector(".chronicle-faction-pressure-body");
    return { page: pageBox, cell, timeline: rect(".chronicle-faction-box[aria-label='그들의 연표']"),
      inside: pageBox !== null && cell !== null && cell[0] >= pageBox[0] && cell[1] >= pageBox[1] && cell[2] <= pageBox[2] && cell[3] <= pageBox[3],
      scrolls: body === null ? null : body.scrollHeight > body.clientHeight,
      minFont: Math.min(...[...document.querySelectorAll(".chronicle-faction-pressure *")].map(node => parseFloat(getComputedStyle(node).fontSize))),
      lines: [...document.querySelectorAll(".chronicle-faction-pressure p, .chronicle-faction-pressure li")].map(node => node.textContent?.trim() ?? "") };
  })()`);
  await page.evaluate(() => { const body = document.querySelector<HTMLElement>(".chronicle-faction-pressure-body"); if (body !== null) body.scrollTop = body.scrollHeight; });
  await page.waitForTimeout(300);
  await page.locator(".chronicle-faction").first().screenshot({ path: join(out!, "p1-commons-pressure-scrolled.jpg"), type: "jpeg", quality: 72 });
  await close();
});

// c1: the chase, on its path between the market and the keep.
for (const [when, build] of builds) {
  await step(`c1-collector-${when}`, async () => {
    const state = load(dirs.ui9, "rumour-chased");
    const market = state.buildings.find(building => building.kind === "market") ?? keepOf(state); const keep = keepOf(state);
    const { page, close } = await scene(state, [Math.round((market.tx + keep.tx) / 2) + 1, Math.round((market.ty + keep.ty) / 2) + 1], { baseUrl: build, zoom: 1.8, label: `c1-${when}` });
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: join(out!, `c1-collector-${when}.jpg`), type: "jpeg", quality: 70 });
    await page.waitForTimeout(3_000);
    await page.screenshot({ path: join(out!, `c1-collector-${when}-3s.jpg`), type: "jpeg", quality: 70 });
    await close();
  });
}

// o3–o5: each chapter's page, its "to chapter N", then chapter N's opening screen.
for (const [file, dir, name, chapter] of [["o3-chapter3-opening", dirs.ui6, "chapter2-end", 3], ["o4-chapter4-opening", dirs.ui9, "chapter3-end", 4],
  ["o5-chapter5-opening", dirs.ui9, "chapter4-end", 5]] as const) {
  await step(file, async () => {
    const state = load(dir, name);
    const keep = keepOf(state);
    // In a paused game the chapter's page does not always open (on the trunk too: about one load in four locally, noted
    // in the report); a load without it is closed and the scene opened again, up to three times.
    let opened: Awaited<ReturnType<typeof scene>> | null = null;
    for (let attempt = 1; attempt <= 3 && opened === null; attempt += 1) {
      const candidate = await scene(state, [keep.tx, keep.ty], { delay: 0, label: file });
      try { await candidate.page.locator(".chronicle-page").waitFor({ timeout: 40_000 }); opened = candidate; result[`${file}-attempts`] = attempt; }
      catch { await candidate.close(); }
    }
    if (opened === null) throw new Error(`${file}: the chapter page did not open in three loads`);
    const { page, close } = opened;
    await page.locator(".chronicle-page .chronicle-next").first().click(); await page.waitForTimeout(1_500);
    await page.screenshot({ path: join(out!, `${file}.jpg`), type: "jpeg", quality: 66 });
    result[file] = await page.evaluate(intro => {
      const screen = document.querySelector<HTMLElement>(".chapter-preview");
      return screen === null ? null : { chapter: screen.dataset.chapter, title: screen.getAttribute("aria-label"), art: screen.style.backgroundImage.includes(intro),
        line: screen.querySelector(".chapter-loading-line")?.textContent ?? "", goals: [...screen.querySelectorAll(".chapter-preview-goals li")].map(item => item.textContent ?? ""),
        start: screen.querySelector(".chapter-preview-continue")?.textContent ?? "" };
    }, `chapter${chapter}_intro`);
    await close();
  });
}

// o6: the chronicle's chapter starts (milestones only), each with its opening painting.
await step("o6-chronicle-chapter-starts", async () => {
  const keep = keepOf(end4);
  const { page, close } = await scene(end4, [keep.tx, keep.ty], { label: "o6" });
  await openLedger(page, ".ledger-tab--chronicle");
  for (const kind of ["decision", "event", "era", "person", "ledger", "faction"]) {
    const toggle = page.locator(`.chronicle-kinds .chronicle-kind[data-kind='${kind}'][aria-pressed='true']`);
    if (await toggle.count() > 0) { await toggle.first().click(); await page.waitForTimeout(500); }
  }
  result.o6 = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".chronicle-card")].map(card => ({
    text: (card.textContent ?? "").trim().slice(0, 60),
    art: ["chapter3_intro", "chapter4_intro", "chapter5_intro"].find(id => (card.querySelector(".chronicle-card-art")?.outerHTML ?? "").includes(id)) ?? null,
  })).filter(card => card.art !== null));
  await page.evaluate(() => { document.querySelector<HTMLElement>(".chronicle-card .chronicle-card-art[style*='chapter5_intro']")?.closest(".chronicle-card")?.scrollIntoView({ block: "center" }); });
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(out!, "o6-chronicle-chapter-starts.jpg"), type: "jpeg", quality: 66 });
  await close();
});

// f1: the pastoral farm on its plot, close up.
for (const [when, build] of builds) {
  await step(`f1-pastoral-${when}`, async () => {
    const state = load(dirs.cloth, "c2-fleece");
    const farm = state.buildings.find(building => building.kind === "pastoral_farm")!;
    const { page, close } = await scene(state, [farm.tx + 1, farm.ty + 1], { baseUrl: build, zoom: 2, label: `f1-${when}` });
    await page.waitForTimeout(1_200);
    await page.screenshot({ path: join(out!, `f1-pastoral-${when}.jpg`), type: "jpeg", quality: 70 });
    result[`f1-${when}`] = { farm: [farm.tx, farm.ty], tick: state.tick };
    await close();
  });
}

await browser.close();
result.errors = errors;
writeFileSync(join(out!, "captures.json"), JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify({ steps: Object.keys(result).length, errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
