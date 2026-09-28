// INSTALL-23 ④ ⑤ captures (JPEG; element shots to keep the set small):
//  c01 the twelve person-state ornaments on portraits (the kit gallery `/dev/ui-kit`: 96 and 48 px, derivable or awaiting
//      engine data);
//  c02 the pad glyphs and one hint line in both forms (the gallery);
//  c03 a house card whose head and spouse wear child_born (a ui6 state's town, a child born this season), c04 the
//      parent's person card;
//  c05 a dead person's biography (greyscale face, candle), opened from a chronicle record of a death;
//  c06 / c07 the pause badge with the keyboard's Space, then the pad's glyphs (the live HUD's key hint). The build menu's
//      help line and the armed tool's status line switch too (tests/padGlyphs.test.ts), but the current HUD draws
//      neither (its build drawer is controlled; the goals drawer disarms the tool): c02 shows the help line both ways.
// The device is reported through the proof port (`reportInputDevice`, proof mode only), as the gamepad translator
// reports it. Beside the shots captures.json (what each shows).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/install23UiCaptures.ts <out-dir> --url <game> --states <ui6States dir>
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { personsOf } from "../src/engine/persons";
import { personStatesReader } from "../src/ui/persons/personStates";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Locator = { first: () => Locator; count: () => Promise<number>; waitFor: (options?: object) => Promise<void>; click: (options?: object) => Promise<void>;
  screenshot: (options: object) => Promise<unknown>; evaluate: <T>(f: (node: Element) => T) => Promise<T> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>; evaluate: <T, A>(f: (arg: A) => T, arg?: A) => Promise<T>;
  locator: (selector: string) => Locator; goto: (url: string) => Promise<unknown>; mouse: { click: (x: number, y: number) => Promise<void> };
  keyboard: { press: (key: string) => Promise<void> }; on: (event: string, handler: (error: unknown) => void) => void; close: () => Promise<void> };
type Context = { newPage: () => Promise<Page>; close: () => Promise<void> };
type Proof = { tileClientPoint: (tile: object) => { clientX: number; clientY: number }; reportInputDevice: (device: string) => void; inputDevice: () => string };

const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true }) as { newContext: (options: object) => Promise<Context>; close: () => Promise<void> };
const result: Record<string, unknown> = {};
const errors: string[] = [];
const QUALITY = 72;
const load = (name: string) => JSON.parse(readFileSync(join(statesDir, `${name}.json`), "utf8")) as GameState;
async function step(name: string, run: () => Promise<void>) {
  try { await run(); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); console.log(`${name}: FAILED ${String(error).slice(0, 200)}`); }
}
async function scene(state: GameState, tile: [number, number], zoom = 1.6): Promise<{ page: Page; close: () => Promise<void> }> {
  const { context, page } = await openScene(browser, { state, tile, baseUrl: url, width: 1280, height: 800, zoom, run: false, initScript: TUTORIAL_OFF,
    query: "&story-delay=600000" }) as { context: Context; page: Page };
  page.on("pageerror", error => errors.push(`${String(error).slice(0, 200)}`));
  return { page, close: () => context.close() };
}
const device = (page: Page, name: string) => page.evaluate(value => (window as unknown as { __FEUDAL_PHASE10_PROOF__: Proof }).__FEUDAL_PHASE10_PROOF__.reportInputDevice(value), name);
const shot = (locator: Locator, file: string) => locator.first().screenshot({ path: join(out!, file), type: "jpeg", quality: QUALITY });

// c01, c02: the gallery.
await step("gallery", async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await page.goto(new URL("dev/ui-kit", url).href);
  await page.locator('[data-section="person-states"]').waitFor({ timeout: 60_000 }); await page.waitForTimeout(1_200);
  await shot(page.locator('[data-section="person-states"]'), "c01-person-state-sheet.jpg");
  await shot(page.locator('[data-section="pad-glyphs"]'), "c02-pad-glyphs.jpg");
  result.gallery = await page.evaluate(() => ({
    states: [...document.querySelectorAll('[data-section="person-states"] li')].map(item => ({ state: item.getAttribute("data-person-state"), derived: item.getAttribute("data-derived"),
      ornaments: item.querySelectorAll(".person-state-ornament").length, dead: item.querySelector(".person-portrait--dead") !== null })),
    glyphs: [...document.querySelectorAll('[data-section="pad-glyphs"] .ui-kit-gallery-pads [role="img"]')].map(node => node.getAttribute("aria-label")),
  }), undefined);
  await context.close();
});

// c03, c04: a parent's chip and card with child_born.
await step("child_born", async () => {
  // A town where a head's ornament is child_born (the top state: no mourning or hunger over it).
  const names = ["messenger", "wall_or_market", "chapter2-end", "house-change", "war_funding", "wool_payment", "beacon"];
  const name = names.find(candidate => { const state = load(candidate); const read = personStatesReader(state);
    return state.persons!.people.some(person => person.role === "head" && read(person)[0] === "child_born"); })!;
  const state = load(name); const read = personStatesReader(state);
  const head = state.persons!.people.find(person => person.role === "head" && read(person)[0] === "child_born")!;
  const house = state.buildings.find(building => building.id === head.householdId)!;
  const { page, close } = await scene(state, [house.tx, house.ty], 2);
  if (await page.locator(".story-modal-later").count() > 0) { await page.locator(".story-modal-later").first().click(); await page.waitForTimeout(300); }
  const point = await page.evaluate(at => (window as unknown as { __FEUDAL_PHASE10_PROOF__: Proof }).__FEUDAL_PHASE10_PROOF__.tileClientPoint(at), { tx: house.tx, ty: house.ty });
  await page.mouse.click(point.clientX, point.clientY); await page.waitForTimeout(700);
  const chip = page.locator(`.person-chip[data-person="${head.id}"]`);
  await chip.first().waitFor({ timeout: 10_000 });
  const card = page.locator(".diagnostic-card, .left-inspector").first();
  await shot(card, "c03-parent-chips.jpg");
  const chips = await page.evaluate(() => [...document.querySelectorAll(".person-chip")].map(node => ({ person: node.getAttribute("data-person"), label: node.getAttribute("aria-label"),
    ornament: node.querySelector(".person-state-ornament")?.getAttribute("data-ornament") ?? null, state: node.querySelector(".person-chip-state")?.textContent ?? null })), undefined);
  await chip.first().click(); await page.waitForTimeout(700);
  await page.locator(".person-card").waitFor({ timeout: 10_000 });
  await shot(page.locator(".person-card"), "c04-parent-card.jpg");
  const personCard = await page.locator(".person-card").evaluate(node => ({ ornament: node.querySelector(".person-state-ornament")?.getAttribute("data-ornament") ?? null,
    line: node.querySelector(".person-card-state")?.textContent ?? null }));
  result.childBorn = { state: name, head: head.id, household: head.householdId, members: personsOf(state, head.householdId).map(person => ({ id: person.id, role: person.role, states: read(person) })),
    chips, card: personCard };
  await close();
});

// c05: a dead person's biography, from a chronicle record of a death.
await step("dead", async () => {
  const state = load("house-change");
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings[0]!;
  const { page, close } = await scene(state, [keep.tx, keep.ty], 1.1);
  if (await page.locator(".story-modal-later").count() > 0) { await page.locator(".story-modal-later").first().click(); await page.waitForTimeout(300); }
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(500);
  await page.locator(".ledger-tab--chronicle").first().click(); await page.waitForTimeout(1_200);
  const opened = await page.evaluate(() => {
    for (const card of document.querySelectorAll(".chronicle-card")) {
      // An adult's death (a child's portrait is the under-8 silhouette, already grey).
      const age = Number(/(\d+)살에/.exec(card.textContent ?? "")?.[1] ?? "0");
      if (age < 20) continue;
      const person = [...card.querySelectorAll<HTMLElement>(".chronicle-card-action")].find(button => button.textContent?.trim() === "인물");
      if (person !== undefined) { person.click(); return true; }
    }
    return false;
  }, undefined);
  if (!opened) throw new Error("no chronicle record of a death with a person link");
  await page.locator(".chronicle-biography").waitFor({ timeout: 10_000 }); await page.waitForTimeout(900);
  await shot(page.locator(".chronicle-biography"), "c05-dead-biography.jpg");
  result.dead = await page.locator(".chronicle-biography").evaluate(node => ({ person: node.getAttribute("data-person"),
    greyscale: node.querySelector(".chronicle-biography-portrait")?.classList.contains("portrait-greyscale") ?? false,
    filter: getComputedStyle(node.querySelector(".chronicle-biography-portrait")!).filter,
    ornament: node.querySelector(".chronicle-biography-ornament")?.getAttribute("data-ornament") ?? null,
    label: node.querySelector(".chronicle-biography-portrait")?.getAttribute("aria-label") ?? null }));
  await close();
});

// c06, c07: the pause badge with the keyboard, then with a gamepad.
await step("hints", async () => {
  const state = load("house-change");
  const house = state.buildings.find(building => building.kind === "house")!;
  const { page, close } = await scene(state, [house.tx, house.ty], 1.4);
  if (await page.locator(".story-modal-later").count() > 0) { await page.locator(".story-modal-later").first().click(); await page.waitForTimeout(300); }
  const read = () => page.evaluate(() => ({
    device: (window as unknown as { __FEUDAL_PHASE10_PROOF__: Proof }).__FEUDAL_PHASE10_PROOF__.inputDevice(),
    pause: document.querySelector(".pause-veil-label")?.textContent?.trim() ?? null,
    pauseGlyphs: [...document.querySelectorAll(".pause-veil-label [role='img']")].map(node => node.getAttribute("aria-label")),
    instruction: document.querySelector(".build-menu-instruction")?.textContent?.trim() ?? null,
    instructionGlyphs: [...document.querySelectorAll(".build-menu-instruction [role='img']")].map(node => node.getAttribute("aria-label")),
    status: document.querySelector(".settlement-status")?.textContent?.trim() ?? null,
    statusGlyphs: [...document.querySelectorAll(".settlement-status [role='img']")].map(node => node.getAttribute("aria-label")),
  }), undefined);
  await page.waitForTimeout(500);
  // The badge with the map around it (80 px each side).
  const box = await page.evaluate(() => { const rect = document.querySelector(".pause-veil-label")!.getBoundingClientRect();
    return { x: Math.max(0, rect.left - 80), y: Math.max(0, rect.top - 80), width: rect.width + 160, height: rect.height + 160 }; }, undefined);
  const around = (file: string) => page.screenshot({ path: join(out!, file), type: "jpeg", quality: QUALITY, clip: box });
  await device(page, "mouse"); await page.waitForTimeout(300);
  await around("c06-pause-keyboard.jpg");
  const pauseKeyboard = await read();
  await device(page, "gamepad"); await page.waitForTimeout(300);
  await around("c07-pause-gamepad.jpg");
  const pauseGamepad = await read();
  result.hints = { pauseKeyboard, pauseGamepad };
  await close();
});

await browser.close();
const files = ["c01-person-state-sheet.jpg", "c02-pad-glyphs.jpg", "c03-parent-chips.jpg", "c04-parent-card.jpg", "c05-dead-biography.jpg", "c06-pause-keyboard.jpg", "c07-pause-gamepad.jpg"];
const sizes = Object.fromEntries(files.map(file => { try { return [file, statSync(join(out!, file)).size]; } catch { return [file, null]; } }));
writeFileSync(join(out!, "captures.json"), `${JSON.stringify({ url, statesDir: "ui6States (scripts/ui6States.ts)", ...result, sizes,
  totalBytes: Object.values(sizes).reduce<number>((sum, size) => sum + (size ?? 0), 0), errors }, null, 2)}\n`);
console.log(JSON.stringify({ sizes, errors }, null, 2));
