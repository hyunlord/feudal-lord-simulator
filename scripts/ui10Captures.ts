// UI-10 gate captures (states from scripts/ui10States.ts, seed 2's bot through chapter 5 to the last market day of 1450;
// the six endings' saves from scripts/ui10EndingSaves.ts; JPEG, re-encoded smaller in the browser, total ≤ 2 MB):
//  ① chapter 5 in order, world before UI — for each step (the mayor's demand, the Crown's envoy, the succession, the
//    town's seal, the charter, the family's leaving, the legacy sealed, the last market day) and each interlude event
//    (the Staple, the guild's quarrel or the market's fire, the parish's nave, the deposition) a small world shot before
//    the story's pop-up (the story waits STORY_DELAY_MS) and the pop-up after; the season strip's chapter 5 forecast;
//  ② the four decision cards (the heir's with its candidates) and the interlude's two petition cards;
//  ③ the faction tab after 1399 (the new king), the ledger's stock tab at the campaign's end and its "보관 N곳" fold,
//    the storehouse inspector with malt and the granary's without it (--extra's store-malt), the empty manor close up
//    (paused, zoom 1.6; the market in a town without a keep), the keep's inspector and the rights tab's seat line;
//  ④ the campaign's end: chapter 5's page, the legacy verdict and ending (one screen), the chronicle book (title,
//    chapter 5's page, the family tree, the factions, the legacy page) and its text export; the ending a few ticks on;
//  ⑤ with --endings: each of the six endings' saves (ui10-ending-<id>.save.json), its ending screen;
//  ⑥ with --extra (scripts/ui10ExtraStates.ts): the heir's card with three candidates, the market's fire (a town
//    without a guild).
// Beside the shots captures.json (what each shows, the shots' total size). The selectors are in SEL (UI-10's screens
// land in parallel; adjust them there).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/ui10Captures.ts <out-dir> --url <game> --states <dir> [--endings <dir>] [--extra <dir>] [--only <prefix,…>]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/ui10Captures.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/ui10Captures.ts …", entry: import.meta.url });
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LEGACY_ENDING_IDS, LEGACY_STEP_IDS } from "../src/content/legacyConfig";
import type { GameState } from "../src/engine/engine.types";
import { legacyInterludes, legacyStage } from "../src/engine/legacy";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

/** The screens' selectors (src/ui/legacy/*, StoryModals, SeasonStrip, LedgerStockTable, InspectorView, HudShell). */
const SEL = {
  petitionCard: ".petition-card",
  // The heir's card (StoryModals HeirCandidate): each candidate.
  heirCandidate: ".petition-card .petition-heir",
  eventChip: ".event-chip",
  // The event card's button that opens the petition's card.
  decideButton: "결정하기",
  // The event card's close (the event read).
  closeButton: "닫기",
  laterButton: ".petition-card .story-modal-later",
  storyModal: ".story-modal",
  modal: ".petition-card, .chronicle-page, .chapter-preview, .famine-card, .story-modal, .event-card",
  dismiss: [".chronicle-page .chronicle-keep", ".story-modal-later", ".season-ledger-resume"],
  calendar: "[data-testid='hud-calendar']",
  seasonStripLegacy: ".season-strip-list li[data-mark^='legacy_']",
  ledgerDock: "[data-dock='ledger']",
  ledgerDrawer: ".ledger-drawer",
  ledgerTab: (tab: string) => `[data-ledger-tab='${tab}']`,
  // The stock tab's chapter ledgers (the wages', the reorganisation's); the category panel (LedgerPanel) if mounted.
  chapterLedger: ".ledger-wage-ledger",
  coinPanel: ".ledger-panel",
  heldToggle: ".ledger-held-toggle",
  heldStores: "[data-resource-stores] li",
  rightsSeat: ".ledger-rights-seat",
  chronicleTab: ".ledger-tab--chronicle",
  chronicleSubTab: ".chronicle-tab",
  factionRow: ".chronicle-factions-row",
  historyEnding: ".chronicle-ending",
  inspector: ".left-inspector",
  storeInspector: ".store-inspector",
  chroniclePage: ".chronicle-page",
  chronicleNext: ".chronicle-page .chronicle-next",
  // The legacy verdict and the ending are one screen (LegacyEndingScreen).
  endingScreen: ".legacy-ending",
  openBook: ".legacy-ending .legacy-open-book",
  endingExport: ".legacy-ending .legacy-export",
  chronicleBook: ".legacy-book",
  bookNext: ".legacy-book .legacy-book-next",
  bookExport: ".legacy-book .legacy-export",
  exportStatus: ".legacy-export-status",
} as const;
/** The book's pages shown (`data-page` of `.legacy-book`). */
const BOOK_PAGES = ["title", "chapter-5", "family", "factions", "legacy"] as const;

type Locator = { first: () => Locator; last: () => Locator; click: (options?: object) => Promise<void>; count: () => Promise<number>; waitFor: (options?: object) => Promise<void>;
  screenshot: (options: object) => Promise<Buffer>; evaluate: <T>(f: (node: Element) => T) => Promise<T> };
type Download = { suggestedFilename: () => string };
type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<Buffer>; evaluate: <T, A = void>(f: (arg: A) => T, arg?: A) => Promise<T>;
  locator: (selector: string) => Locator; getByRole: (role: string, options: object) => Locator; keyboard: { press: (key: string) => Promise<void> }; mouse: { click: (x: number, y: number) => Promise<void> };
  on: (event: string, handler: (error: unknown) => void) => void; waitForEvent: (event: "download", options: object) => Promise<Download>; close: () => Promise<void> };
type Proof = { tileClientPoint: (tile: object) => { clientX: number; clientY: number } };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!; const endingsDir = flag("endings"); const extraDir = flag("extra");
mkdirSync(out!, { recursive: true });
const STORY_DELAY_MS = 5_000;
const HELD = 600_000;
const BUDGET_BYTES = 2_000_000;
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const readJson = (path: string) => JSON.parse(readFileSync(path, "utf8")) as GameState | { schemaVersion: number; state: GameState };
const bare = (input: ReturnType<typeof readJson>): GameState => "schemaVersion" in input && "state" in input ? input.state : input as GameState;
// A state by name: seed 2's (--states), else --extra's; `extra:<name>` only --extra's.
const pathOf = (name: string) => (name.startsWith("extra:") ? [extraDir] : [statesDir, extraDir]).filter(dir => dir !== undefined)
  .map(dir => join(dir!, `${name.replace(/^extra:/, "")}.json`)).find(path => existsSync(path));
const has = (name: string) => pathOf(name) !== undefined;
const load = (name: string) => bare(readJson(pathOf(name)!));
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const result: Record<string, unknown> = {};
const errors: string[] = [];
const shots: string[] = [];

// The shots are re-encoded in a blank page (a canvas, scaled, JPEG): full frames at 0.7, world shots at 0.4, a box at
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
const shoot = async (page: Page, file: string, scale = 0.7) => save(file, await page.screenshot({ type: "png" }), scale, 0.56);
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
/** Clicks a building's footprint (a few points, as clothCaptures) until `selector` opens. */
async function inspect(page: Page, building: { tx: number; ty: number }, selector: string) {
  for (const [dx, dy, lift] of [[0.5, 0.5, 8], [0.5, 0.5, 28], [1, 1, 8], [1, 1, 36], [0.3, 0.3, 8]] as const) {
    const at = await page.evaluate(tile => (window as unknown as { __FEUDAL_PHASE10_PROOF__: Proof }).__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), { tx: building.tx + dx, ty: building.ty + dy });
    await page.mouse.click(at.clientX, at.clientY - lift); await page.waitForTimeout(700);
    if (await page.locator(selector).count() > 0) return;
    await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  }
}
async function step(name: string, run: () => Promise<void>) {
  if (process.argv.includes("--only") && !flag("only")!.split(",").some(prefix => name.startsWith(prefix))) return;
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
    await shoot(page, `${prefix}-1-world.jpg`, 0.4);
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
const CARDS = ["royal_tax", "heir_choice", "borough_autonomy", "legacy_choice", "guild_dispute", "church_rebuilding", "extra:heir_choice"];
for (const [index, name] of CARDS.entries()) {
  if (!has(name)) { result[name] = { absent: true }; continue; }
  await step(name, async () => {
    // As a player opens it (as scripts/ui10CardsCaptures.ts): the story's short wait, else the chip and [결정하기].
    const { page, close } = await named(name, 600);
    await page.waitForTimeout(2_000);
    // The waiting chips in turn: a card that offers [결정하기] opens the petition; another event's card is closed
    // (read), which lets the next chip in (the rail shows a few at a time).
    const wanted = `${SEL.petitionCard}[data-def='${name.replace("extra:", "")}']`;
    for (let chip = 0; chip < 8 && await page.locator(wanted).count() === 0 && await page.locator(SEL.eventChip).count() > 0; chip += 1) {
      // Another petition's card: later (it stays open), and on to the next chip.
      if (await page.locator(SEL.petitionCard).count() > 0) { await page.locator(SEL.laterButton).first().click({ timeout: 5_000 }); await page.waitForTimeout(500); }
      await page.locator(SEL.eventChip).first().click({ timeout: 5_000 }); await page.waitForTimeout(600);
      const decide = page.getByRole("button", { name: SEL.decideButton }).first();
      if (await decide.count() > 0) { await decide.click({ timeout: 5_000 }); await page.waitForTimeout(600); continue; }
      const read = page.getByRole("button", { name: SEL.closeButton, exact: true }).first();
      if (await read.count() > 0) { await read.click({ timeout: 5_000 }); await page.waitForTimeout(500); }
    }
    await page.locator(wanted).waitFor({ timeout: 15_000 }).catch(async (error: unknown) => {
      await shoot(page, `x-${name.replace("extra:", "extra-")}-timeout.jpg`, 0.5);
      throw new Error(`${String(error).slice(0, 120)} · chips ${JSON.stringify(await texts(page, SEL.eventChip))} · modal ${JSON.stringify(await screen(page))}`);
    });
    await page.waitForTimeout(700);
    await shootBox(page, SEL.petitionCard, `d${index + 1}-${name.replace("extra:", "")}${name.startsWith("extra:") ? "-three" : ""}.jpg`);
    const state = load(name);
    result[name] = { ui: await screen(page), candidates: name.endsWith("heir_choice") ? await texts(page, SEL.heirCandidate) : undefined,
      engineCandidates: name.endsWith("heir_choice") ? state.legacy?.candidates.length ?? 0 : undefined };
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
// The ledger drawer's stock tab at the campaign's end (the chapters' money sections). Chapter 5's categories
// (royal_subsidy, succession_relief, legacy_endowment, charter_fee) are drawn only by LedgerPanel, which no screen mounts.
await step("l1-ledger-chapter5", async () => {
  const { page, close } = await named("chapter5-end", HELD);
  await page.waitForTimeout(1_000); await dismiss(page);
  await page.locator(SEL.ledgerDock).first().click(); await page.waitForTimeout(700);
  await page.locator(SEL.ledgerTab("stock")).first().click(); await page.waitForTimeout(700);
  await page.evaluate(query => { const nodes = document.querySelectorAll(query); nodes[nodes.length - 1]?.scrollIntoView({ block: "end" }); }, SEL.chapterLedger);
  await page.waitForTimeout(300);
  await shootBox(page, SEL.ledgerDrawer, "l1-ledger-chapter5.jpg");
  result["l1-ledger-chapter5"] = { sections: await texts(page, `${SEL.chapterLedger} h3, ${SEL.chapterLedger} h4`), coinPanels: await page.locator(SEL.coinPanel).count() };
  await close();
});
// The stock table's "보관 N곳" unfolded (malt's if any store holds it, else the first row's), the map unlit.
await step("l2-ledger-fold-malt", async () => {
  const { page, close } = await named("chapter5-end", HELD);
  await page.waitForTimeout(1_000); await dismiss(page);
  await page.locator(SEL.ledgerDock).first().click(); await page.waitForTimeout(700);
  await page.locator(SEL.ledgerTab("stock")).first().click(); await page.waitForTimeout(700);
  const opened = await page.evaluate(query => {
    const toggles = [...document.querySelectorAll<HTMLElement>(query)];
    const toggle = toggles.find(node => node.getAttribute("aria-label")?.includes("엿기름")) ?? toggles[0];
    toggle?.scrollIntoView({ block: "center" }); toggle?.click(); return toggle?.getAttribute("aria-label") ?? null;
  }, SEL.heldToggle);
  await page.waitForTimeout(600);
  await shootBox(page, SEL.ledgerDrawer, "l2-ledger-fold-malt.jpg");
  result["l2-ledger-fold-malt"] = { toggle: opened, stores: await texts(page, SEL.heldStores) };
  await close();
});
const STORES = [["b1-storehouse-malt", "storehouse", (held: number) => held > 0], ["b2-granary-no-malt", "granary", (held: number) => held === 0]] as const;
for (const [file, kind, wanted] of STORES) {
  await step(file, async () => {
    const source = has("extra:store-malt") ? "extra:store-malt" : "chapter5-end";
    const state = load(source);
    const store = state.buildings.filter(building => building.kind === kind).find(building => wanted(building.inventory.malt ?? 0))
      ?? state.buildings.find(building => building.kind === kind)!;
    // The store left of the frame's middle (the inspector opens on the right).
    const { page, close } = await scene(state, file, HELD, { tile: [store.tx + 5, store.ty - 3], zoom: 1.2 });
    await dismiss(page);
    await inspect(page, store, SEL.storeInspector);
    // The whole frame (the inspector's body scrolls inside its panel, so an element shot cuts it), its stock rows
    // scrolled to malt's.
    await page.evaluate(query => { const rows = [...document.querySelectorAll(`${query} tr, ${query} li`)].filter(node => node.textContent?.includes("엿기름"));
      rows[rows.length - 1]?.scrollIntoView({ block: "center" }); }, SEL.storeInspector);
    await page.waitForTimeout(300);
    await shoot(page, `${file}.jpg`);
    result[file] = { state: source, store: store.id, malt: store.inventory.malt ?? 0, lines: await texts(page, `${SEL.storeInspector} li, ${SEL.storeInspector} p`) };
    await close();
  });
}
await step("w1-empty-manor", async () => {
  const state = load("empty-manor");
  // A town without a keep has no manor to show: the market, where the petitioners now gather (storyWorldProps).
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings.find(building => building.kind === "market");
  const { page, close } = await scene(state, "empty-manor", HELD, { zoom: 1.6, ...(keep === undefined ? {} : { tile: [keep.tx + 1, keep.ty + 1] }) });
  await page.waitForTimeout(1_000); await dismiss(page);
  await shoot(page, "w1-empty-manor.jpg");
  result["w1-empty-manor"] = { tick: state.tick, family: state.legacy?.family ?? null, at: keep === undefined ? focus(state) : [keep.tx, keep.ty], kind: keep?.kind ?? null };
  await close();
});
await step("w2-keep-inspector", async () => {
  const state = load("empty-manor");
  const keep = state.buildings.find(building => building.kind === "keep");
  if (keep === undefined) { result["w2-keep-inspector"] = { keep: null }; return; }
  const { page, close } = await scene(state, "keep-inspector", HELD, { tile: [keep.tx + 1, keep.ty + 1], zoom: 1.2 });
  await dismiss(page);
  await inspect(page, keep, SEL.inspector);
  await shootBox(page, SEL.inspector, "w2-keep-inspector.jpg");
  result["w2-keep-inspector"] = await texts(page, `${SEL.inspector} p, ${SEL.inspector} li`);
  await close();
});
await step("w3-rights-seat", async () => {
  const { page, close } = await named("empty-manor", HELD);
  await page.waitForTimeout(1_000); await dismiss(page);
  await page.locator(SEL.ledgerDock).first().click(); await page.waitForTimeout(700);
  await page.locator(SEL.ledgerTab("rights")).first().click(); await page.waitForTimeout(700);
  await shootBox(page, SEL.ledgerDrawer, "w3-rights-seat.jpg");
  result["w3-rights-seat"] = await texts(page, SEL.rightsSeat);
  await close();
});

// ④ the campaign's end: chapter 5's page → the legacy verdict and ending → the chronicle book and its export.
/** The book turned to `key` (its next button, at most one turn per page). */
async function turnTo(page: Page, key: string) {
  for (let turn = 0; turn < 12; turn += 1) {
    if (await page.locator(SEL.chronicleBook).first().evaluate(node => node.getAttribute("data-page")) === key) return true;
    if (await page.locator(`${SEL.bookNext}:not([disabled])`).count() === 0) return false;
    await page.locator(SEL.bookNext).first().click(); await page.waitForTimeout(500);
  }
  return false;
}
async function exported(page: Page, button: string) {
  const download = page.waitForEvent("download", { timeout: 10_000 }).then(file => file.suggestedFilename()).catch(() => null);
  await page.locator(button).first().click();
  const file = await download; await page.waitForTimeout(400);
  return { file, status: (await texts(page, SEL.exportStatus)).filter(line => line !== "") };
}
await step("c-campaign-end", async () => {
  const { page, close } = await named("chapter5-end", STORY_DELAY_MS);
  await page.locator(SEL.chroniclePage).waitFor({ timeout: 90_000 }); await page.waitForTimeout(800);
  await shoot(page, "c1-chapter5-page.jpg");
  const flow: Record<string, unknown> = { page: await texts(page, `${SEL.chroniclePage} h2, ${SEL.chroniclePage} p`) };
  await page.locator(SEL.chronicleNext).first().click(); await page.locator(SEL.endingScreen).waitFor({ timeout: 30_000 }); await page.waitForTimeout(800);
  await shoot(page, "c2-legacy-verdict.jpg");
  flow.ending = await page.locator(SEL.endingScreen).first().evaluate(node => ({ id: node.getAttribute("data-ending"), final: node.getAttribute("data-final"),
    text: node.textContent?.trim().slice(0, 400) ?? "" }));
  // The verdict's lower half (the axes, the chosen legacy, the buttons), scrolled to as the player scrolls.
  await page.evaluate(query => { document.querySelector(`${query} .legacy-actions`)?.scrollIntoView({ block: "end" }); }, SEL.endingScreen); await page.waitForTimeout(400);
  await shoot(page, "c3-legacy-ending.jpg");
  flow.endingExport = await exported(page, SEL.endingExport);
  await page.locator(SEL.openBook).first().click(); await page.locator(SEL.chronicleBook).waitFor({ timeout: 30_000 }); await page.waitForTimeout(800);
  for (const [index, key] of BOOK_PAGES.entries()) {
    const reached = await turnTo(page, key);
    await shoot(page, `c${index + 4}-book-${key}.jpg`);
    flow[`book-${key}`] = { reached, lines: await texts(page, `${SEL.chronicleBook} h2, ${SEL.chronicleBook} h3, ${SEL.chronicleBook} li`) };
  }
  await shootBox(page, SEL.bookExport, "c9-book-export.jpg");
  flow.bookExport = await exported(page, SEL.bookExport);
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
    const file = files.find(entry => entry.includes(id) && entry.endsWith(".json"));
    if (file === undefined) { errors.push(`ending ${id}: no save in ${endingsDir}`); continue; }
    await step(`x-${id}`, async () => {
      const state = bare(readJson(join(endingsDir, file)));
      const { page, close } = await scene(state, id, STORY_DELAY_MS);
      await page.waitForTimeout(STORY_DELAY_MS + 1_200);
      // The save opens chapter 5's page: on to the verdict. Else the chronicle's [결말 보기] (the ending written).
      if (await page.locator(SEL.chroniclePage).count() > 0 && await page.locator(SEL.chronicleNext).count() > 0) { await page.locator(SEL.chronicleNext).first().click(); await page.waitForTimeout(900); }
      if (await page.locator(SEL.endingScreen).count() === 0) {
        await dismiss(page);
        await page.locator(SEL.ledgerDock).first().click(); await page.waitForTimeout(600);
        await page.locator(SEL.chronicleTab).first().click(); await page.waitForTimeout(1_200);
        await page.locator(SEL.historyEnding).first().click(); await page.waitForTimeout(900);
      }
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
