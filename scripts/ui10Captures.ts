// UI-10 gate captures (states from scripts/ui10States.ts, seed 2's bot through chapter 5 to the last market day of 1450;
// the six endings' saves from scripts/ui10EndingSaves.ts; JPEG, re-encoded smaller in the browser, total ≤ 2 MB):
//  ① chapter 5 in order, world before UI — for each step (the mayor's demand, the Crown's envoy, the succession, the
//    town's seal, the charter, the family's leaving, the legacy sealed, the last market day) and each interlude event
//    (the Staple, the guild's quarrel or the market's fire, the parish's nave, the deposition) a small world shot before
//    the story's pop-up (the story waits STORY_DELAY_MS) and the pop-up after; the season strip's chapter 5 forecast;
//  ② the four decision cards (the heir's with its candidates) and the interlude's two petition cards;
//  ③ the faction tab after 1399 (the new king), the ledger's chapter 5 money lines, the storehouse inspector with malt
//    and the granary's without it, the empty manor close up (paused, zoom 1.6);
//  ④ the campaign's end: chapter 5's page, the legacy verdict, the ending screen, the chronicle book (title, a chapter
//    page, the family tree, the factions, the legacy page) and its text export; the ending screen a few ticks on;
//  ⑤ with --endings: each of the six endings' saves, its ending screen.
// Beside the shots captures.json (what each shows, the shots' total size). The selectors are in SEL (UI-10's screens
// land in parallel; adjust them there).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/ui10Captures.ts <out-dir> --url <game> --states <dir> [--endings <dir>]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/ui10Captures.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/ui10Captures.ts …", entry: import.meta.url });
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LEGACY_ENDING_IDS, LEGACY_STEP_IDS } from "../src/content/legacyConfig";
import type { GameState } from "../src/engine/engine.types";
import { legacyInterludes, legacyStage } from "../src/engine/legacy";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

/** The screens' selectors (UI-10 lands beside this script: adjust here). */
const SEL = {
  petitionCard: ".petition-card",
  heirCandidate: ".petition-card .heir-candidate",
  eventChip: ".event-chip",
  storyModal: ".story-modal",
  modal: ".petition-card, .chronicle-page, .chapter-preview, .famine-card, .story-modal, .legacy-verdict, .legacy-ending, .chronicle-book",
  dismiss: [".chronicle-page .chronicle-keep", ".story-modal-later", ".season-ledger-resume"],
  calendar: "[data-testid='hud-calendar']",
  seasonStripLegacy: ".season-strip-list li[data-mark^='legacy']",
  ledgerDock: "[data-dock='ledger']",
  ledgerDrawer: ".ledger-drawer",
  ledgerTab: (tab: string) => `[data-ledger-tab='${tab}']`,
  legacyLedger: ".ledger-legacy-ledger",
  chronicleTab: ".ledger-tab--chronicle",
  chronicleSubTab: ".chronicle-tab",
  factionRow: ".chronicle-factions-row",
  storeInspector: ".store-inspector",
  chroniclePage: ".chronicle-page",
  chronicleNext: ".chronicle-page .chronicle-next",
  legacyVerdict: ".legacy-verdict",
  verdictNext: ".legacy-verdict .legacy-verdict-next",
  endingScreen: ".legacy-ending",
  openBook: ".legacy-ending .legacy-ending-book",
  chronicleBook: ".chronicle-book",
  bookPage: (page: string) => `.chronicle-book [data-book-page='${page}']`,
  bookNav: (page: string) => `.chronicle-book [data-book-tab='${page}']`,
  bookExport: ".chronicle-book .chronicle-book-export",
} as const;
const BOOK_PAGES = ["title", "chapter", "family", "factions", "legacy"] as const;

type Locator = { first: () => Locator; last: () => Locator; click: (options?: object) => Promise<void>; count: () => Promise<number>; waitFor: (options?: object) => Promise<void>;
  screenshot: (options: object) => Promise<Buffer>; evaluate: <T>(f: (node: Element) => T) => Promise<T> };
type Download = { suggestedFilename: () => string };
type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<Buffer>; evaluate: <T, A = void>(f: (arg: A) => T, arg?: A) => Promise<T>;
  locator: (selector: string) => Locator; keyboard: { press: (key: string) => Promise<void> }; mouse: { click: (x: number, y: number) => Promise<void> };
  on: (event: string, handler: (error: unknown) => void) => void; waitForEvent: (event: "download", options: object) => Promise<Download>; close: () => Promise<void> };
type Proof = { tileClientPoint: (tile: object) => { clientX: number; clientY: number } };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!; const endingsDir = flag("endings");
mkdirSync(out!, { recursive: true });
const STORY_DELAY_MS = 5_000;
const HELD = 600_000;
const BUDGET_BYTES = 2_000_000;
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as GameState | { schemaVersion: number; state: GameState };
const bare = (input: ReturnType<typeof readJson>): GameState => "schemaVersion" in input && "state" in input ? input.state : input as GameState;
const has = (name: string) => existsSync(join(statesDir, `${name}.json`));
const load = (name: string) => bare(readJson(join(statesDir, `${name}.json`)));
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const result: Record<string, unknown> = {};
const errors: string[] = [];
const shots: string[] = [];

// The shots are re-encoded in a blank page (a canvas, scaled, JPEG): full frames at 3/4, world shots at 1/2, a box at
// its own size up to 960 px wide.
const encoder = await (await (browser as unknown as { newContext: () => Promise<{ newPage: () => Promise<unknown> }> }).newContext()).newPage() as Page;
async function save(file: string, png: Buffer, scale: number, quality = 0.62) {
  const jpeg = await encoder.evaluate(async ({ data, scale, quality }) => {
    const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
    const canvas = document.createElement("canvas");
    const factor = Math.min(1, scale, 960 / image.naturalWidth);
    canvas.width = Math.round(image.naturalWidth * factor); canvas.height = Math.round(image.naturalHeight * factor);
    canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality).slice("data:image/jpeg;base64,".length);
  }, { data: png.toString("base64"), scale, quality });
  writeFileSync(join(out!, file), Buffer.from(jpeg, "base64"));
  shots.push(file);
}
const shoot = async (page: Page, file: string, scale = 0.75) => save(file, await page.screenshot({ type: "png" }), scale);
const shootBox = async (page: Page, selector: string, file: string) => save(file, await page.locator(selector).first().screenshot({ type: "png" }), 1);

function focus(state: GameState): [number, number] {
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings.find(building => building.kind === "house")!;
  return [keep.tx, keep.ty];
}
async function scene(state: GameState, label: string, delay: number, view: { tile?: readonly number[]; zoom?: number } = {}): Promise<{ page: Page; close: () => Promise<void> }> {
  const { context, page } = await openScene(browser, { state, tile: view.tile ?? focus(state), baseUrl: url, width: 1280, height: 800, zoom: view.zoom ?? 1.1, run: false,
    initScript: TUTORIAL_OFF, query: `&story-delay=${delay}` });
  (page as Page).on("pageerror", error => errors.push(`${label}: ${String(error).slice(0, 200)}`));
  return { page: page as Page, close: () => context.close() };
}
const named = (name: string, delay: number, view: { tile?: readonly number[]; zoom?: number } = {}) => scene(load(name), name, delay, view);
const screen = (page: Page) => page.evaluate(selectors => ({
  modal: document.querySelector(selectors.modal)?.getAttribute("aria-label") ?? null,
  def: document.querySelector(selectors.petitionCard)?.getAttribute("data-def") ?? null,
  chips: [...document.querySelectorAll(selectors.eventChip)].map(chip => chip.textContent?.trim() ?? ""),
  heading: document.querySelector(`${selectors.storyModal} h2, ${selectors.petitionCard} h2`)?.textContent?.trim() ?? null,
}), { modal: SEL.modal, petitionCard: SEL.petitionCard, eventChip: SEL.eventChip, storyModal: SEL.storyModal });
const texts = (page: Page, selector: string) => page.evaluate(query => [...document.querySelectorAll(query)].map(node => node.textContent?.trim() ?? "").slice(0, 40), selector);
async function dismiss(page: Page) {
  for (const selector of SEL.dismiss) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(400); }
}
async function step(name: string, run: () => Promise<void>) {
  if (process.argv.includes("--only") && !name.startsWith(flag("only")!)) return;
  try { await run(); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); }
}

// ① chapter 5 in order: each step's line and each interlude event, world first, then the pop-up (a waiting chip opened).
const MOMENTS = [...LEGACY_STEP_IDS.map(id => `legacy.${id}`), "interlude.staple", "interlude.guild_dispute", "interlude.market_fire", "interlude.church_rebuilding", "interlude.deposition"];
for (const [index, name] of MOMENTS.entries()) {
  if (!has(name)) { result[name] = { absent: true }; continue; }
  await step(name, async () => {
    const { page, close } = await named(name, STORY_DELAY_MS);
    const prefix = `${name.startsWith("legacy.") ? "e" : "i"}${String(index + 1).padStart(2, "0")}-${name.slice(name.indexOf(".") + 1)}`;
    await page.waitForTimeout(600);
    await shoot(page, `${prefix}-1-world.jpg`, 0.5);
    const world = await screen(page);
    await page.waitForTimeout(STORY_DELAY_MS + 1_200);
    if ((await screen(page)).modal === null && await page.locator(SEL.eventChip).count() > 0) {
      await page.locator(SEL.eventChip).first().click({ timeout: 5_000 }); await page.waitForTimeout(500);
    }
    await shoot(page, `${prefix}-2-ui.jpg`);
    const state = load(name);
    result[name] = { world, ui: await screen(page), stage: legacyStage(state), interludes: legacyInterludes(state) };
    await close();
  });
}

// The season strip's chapter 5 forecast (the mayor's demand: the Crown's envoy ahead).
await step("season-strip", async () => {
  const { page, close } = await named(has("legacy.mayor_demand") ? "legacy.mayor_demand" : "chapter5-open", HELD);
  await page.waitForTimeout(1_000); await dismiss(page);
  await page.locator(SEL.calendar).first().click(); await page.waitForTimeout(600);
  await shoot(page, "s01-season-strip.jpg");
  result["season-strip"] = await texts(page, SEL.seasonStripLegacy);
  await close();
});

// ② the decision cards, then the interlude's two petitions (their open states; the card itself at full size).
const CARDS = ["royal_tax", "heir_choice", "borough_autonomy", "legacy_choice", "guild_dispute", "church_rebuilding"];
for (const [index, name] of CARDS.entries()) {
  if (!has(name)) { result[name] = { absent: true }; continue; }
  await step(name, async () => {
    const { page, close } = await named(name, 0);
    await page.locator(SEL.petitionCard).waitFor({ timeout: 60_000 }).catch(async () => { await page.locator(SEL.eventChip).first().click(); });
    await page.locator(SEL.petitionCard).waitFor({ timeout: 30_000 }); await page.waitForTimeout(700);
    await shootBox(page, SEL.petitionCard, `d${index + 1}-${name}.jpg`);
    const state = load(name);
    result[name] = { ui: await screen(page), candidates: name === "heir_choice" ? await texts(page, SEL.heirCandidate) : undefined,
      engineCandidates: name === "heir_choice" ? state.legacy?.candidates.length ?? 0 : undefined };
    await close();
  });
}

// ③ the faction tab after 1399 (the new king at the Crown's row), the ledger's chapter 5 lines, the stores, the empty manor.
await step("f1-factions-new-king", async () => {
  const name = has("legacy.succession") ? "legacy.succession" : "interlude.deposition";
  const { page, close } = await named(name, HELD);
  await page.waitForTimeout(1_000); await dismiss(page);
  await page.locator(SEL.ledgerDock).first().click(); await page.waitForTimeout(600);
  await page.locator(SEL.chronicleTab).first().click(); await page.waitForTimeout(1_200);
  await page.evaluate(query => { for (const tab of document.querySelectorAll<HTMLElement>(query)) if (tab.textContent?.trim() === "세력") tab.click(); }, SEL.chronicleSubTab);
  await page.waitForTimeout(900);
  await shoot(page, "f1-factions-new-king.jpg");
  result["f1-factions-new-king"] = { state: name, rows: await texts(page, SEL.factionRow) };
  await close();
});
await step("l1-legacy-ledger", async () => {
  const { page, close } = await named("chapter5-end", HELD);
  await page.waitForTimeout(1_000); await dismiss(page);
  await page.locator(SEL.ledgerDock).first().click(); await page.waitForTimeout(700);
  await page.locator(SEL.ledgerTab("stock")).first().click(); await page.waitForTimeout(700);
  await page.evaluate(query => { document.querySelector(query)?.scrollIntoView({ block: "end" }); }, SEL.legacyLedger); await page.waitForTimeout(300);
  await shootBox(page, SEL.ledgerDrawer, "l1-legacy-ledger.jpg");
  result["l1-legacy-ledger"] = await texts(page, `${SEL.legacyLedger} tr, ${SEL.legacyLedger} li, ${SEL.legacyLedger} h4`);
  await close();
});
const STORES = [["b1-storehouse-malt", "storehouse", (held: number) => held > 0], ["b2-granary-no-malt", "granary", (held: number) => held === 0]] as const;
for (const [file, kind, wanted] of STORES) {
  await step(file, async () => {
    const state = load("chapter5-end");
    const store = state.buildings.filter(building => building.kind === kind).find(building => wanted(building.inventory.malt ?? 0))
      ?? state.buildings.find(building => building.kind === kind)!;
    const { page, close } = await scene(state, file, HELD, { tile: [store.tx + 1, store.ty + 1], zoom: 1.2 });
    await dismiss(page);
    for (const [dx, dy, lift] of [[0.5, 0.5, 8], [0.5, 0.5, 28], [1, 1, 8], [1, 1, 36], [0.3, 0.3, 8]] as const) {
      const at = await page.evaluate(tile => (window as unknown as { __FEUDAL_PHASE10_PROOF__: Proof }).__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), { tx: store.tx + dx, ty: store.ty + dy });
      await page.mouse.click(at.clientX, at.clientY - lift); await page.waitForTimeout(700);
      if (await page.locator(SEL.storeInspector).count() > 0) break;
      await page.keyboard.press("Escape"); await page.waitForTimeout(200);
    }
    await shootBox(page, SEL.storeInspector, `${file}.jpg`);
    result[file] = { store: store.id, malt: store.inventory.malt ?? 0, lines: await texts(page, `${SEL.storeInspector} li, ${SEL.storeInspector} p`) };
    await close();
  });
}
await step("w1-empty-manor", async () => {
  const state = load("empty-manor");
  const { page, close } = await scene(state, "empty-manor", HELD, { zoom: 1.6 });
  await page.waitForTimeout(1_000); await dismiss(page);
  await shoot(page, "w1-empty-manor.jpg");
  result["w1-empty-manor"] = { tick: state.tick, family: state.legacy?.family ?? null, at: focus(state) };
  await close();
});

// ④ the campaign's end: chapter 5's page → the legacy verdict → the ending → the chronicle book and its export.
await step("c-campaign-end", async () => {
  const { page, close } = await named("chapter5-end", STORY_DELAY_MS);
  await page.locator(SEL.chroniclePage).waitFor({ timeout: 90_000 }); await page.waitForTimeout(800);
  await shoot(page, "c1-chapter5-page.jpg");
  const flow: Record<string, unknown> = { page: await texts(page, `${SEL.chroniclePage} h2, ${SEL.chroniclePage} p`) };
  await page.locator(SEL.chronicleNext).first().click(); await page.locator(SEL.legacyVerdict).waitFor({ timeout: 30_000 }); await page.waitForTimeout(800);
  await shoot(page, "c2-legacy-verdict.jpg");
  flow.verdict = await texts(page, `${SEL.legacyVerdict} h2, ${SEL.legacyVerdict} p, ${SEL.legacyVerdict} li`);
  await page.locator(SEL.verdictNext).first().click(); await page.locator(SEL.endingScreen).waitFor({ timeout: 30_000 }); await page.waitForTimeout(800);
  await shoot(page, "c3-ending.jpg");
  flow.ending = await page.locator(SEL.endingScreen).first().evaluate(node => ({ id: node.getAttribute("data-ending"), text: node.textContent?.trim().slice(0, 300) ?? "" }));
  await page.locator(SEL.openBook).first().click(); await page.locator(SEL.chronicleBook).waitFor({ timeout: 30_000 }); await page.waitForTimeout(800);
  for (const [index, name] of BOOK_PAGES.entries()) {
    if (await page.locator(SEL.bookNav(name)).count() > 0) { await page.locator(SEL.bookNav(name)).first().click(); await page.waitForTimeout(700); }
    await shoot(page, `c${index + 4}-book-${name}.jpg`);
    flow[`book-${name}`] = await texts(page, `${SEL.bookPage(name)} h2, ${SEL.bookPage(name)} h3, ${SEL.bookPage(name)} li`);
  }
  await shootBox(page, SEL.bookExport, "c9-book-export.jpg");
  const download = page.waitForEvent("download", { timeout: 10_000 }).then(file => file.suggestedFilename()).catch(() => null);
  await page.locator(SEL.bookExport).first().click();
  flow.exported = await download;
  result["c-campaign-end"] = flow;
  await close();
});
await step("c0-campaign-victory", async () => {
  const state = load("campaign-victory");
  const { page, close } = await scene(state, "campaign-victory", STORY_DELAY_MS);
  await page.waitForTimeout(STORY_DELAY_MS + 1_500);
  await shoot(page, "c0-campaign-victory.jpg");
  result["c0-campaign-victory"] = { outcome: state.settlement?.outcome ?? null, ui: await screen(page) };
  await close();
});

// ⑤ the six endings (scenario L9's saves): each save's ending screen.
if (endingsDir !== undefined) {
  const files = readdirSync(endingsDir);
  for (const [index, id] of LEGACY_ENDING_IDS.entries()) {
    const file = files.find(entry => entry.startsWith(id) && entry.endsWith(".json"));
    if (file === undefined) { errors.push(`ending ${id}: no save in ${endingsDir}`); continue; }
    await step(`x-${id}`, async () => {
      const state = bare(readJson(join(endingsDir, file)));
      const { page, close } = await scene(state, id, STORY_DELAY_MS);
      await page.waitForTimeout(STORY_DELAY_MS + 1_200);
      // The save may stand before the verdict: go on through the page and the verdict to the ending.
      for (const next of [SEL.chronicleNext, SEL.verdictNext]) if (await page.locator(SEL.endingScreen).count() === 0 && await page.locator(next).count() > 0) { await page.locator(next).first().click(); await page.waitForTimeout(900); }
      await page.locator(SEL.endingScreen).waitFor({ timeout: 30_000 }); await page.waitForTimeout(700);
      await shoot(page, `x${index + 1}-${id}.jpg`);
      result[`x-${id}`] = { save: file, engine: state.legacy?.ending?.id ?? null,
        shown: await page.locator(SEL.endingScreen).first().evaluate(node => node.getAttribute("data-ending")) };
      await close();
    });
  }
}

await browser.close();
const bytes = shots.reduce((sum, file) => sum + statSync(join(out!, file)).size, 0);
result.shots = { count: shots.length, bytes, budget: BUDGET_BYTES };
if (bytes > BUDGET_BYTES) errors.push(`shots ${bytes} bytes over the ${BUDGET_BYTES} budget`);
result.errors = errors;
writeFileSync(join(out!, "captures.json"), JSON.stringify(result, null, 1) + "\n");
console.log(JSON.stringify({ steps: Object.keys(result).length, shots: shots.length, bytes, errors: errors.length }));
process.exitCode = errors.length === 0 ? 0 : 1;
