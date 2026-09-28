// UI-7 gates on the states of scripts/ui7States.ts (the v24 town left to run):
//   t0 the lord's household on the ledger's rights tab; t1 the lord's family tree (the L3 lineage set): the lord → [전기 보기] → [가계도];
//   t2 the miller's family tree (L8, a head with eleven children: wider than the page, it scrolls) and t3 folded;
//   b1 a baby's face (under two) on its house card and its biography;
//   s1–s5 the person-state ornaments sick, injury, pregnant, pilgrim and bailiff on the house card's person row and the
//   biography's portrait, and the ledger sentence of each in the biography's life (the chronicle's own words).
// JPEG shots (the element or the screen) and captures.json (the checks read from the page).
//   PLAYWRIGHT_MODULE=... npx tsx scripts/ui7Captures.ts <out-dir> --url <game> --states <ui7States dir>
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Locator = { first: () => Locator; count: () => Promise<number>; waitFor: (options?: object) => Promise<void>; click: (options?: object) => Promise<void>;
  screenshot: (options: object) => Promise<unknown>; evaluate: <T>(f: (node: Element) => T) => Promise<T> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; evaluate: <T, A>(f: (arg: A) => T, arg?: A) => Promise<T>; locator: (selector: string) => Locator;
  getByRole: (role: string, options: object) => Locator; screenshot: (options: object) => Promise<unknown>;
  mouse: { click: (x: number, y: number) => Promise<void>; move: (x: number, y: number) => Promise<void> }; keyboard: { press: (key: string) => Promise<void> }; on: (event: string, handler: (error: unknown) => void) => void };
type Proof = { tileClientPoint: (tile: object) => { clientX: number; clientY: number } };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!;
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const moments = JSON.parse(readFileSync(join(statesDir, "moments.json"), "utf8")) as Record<string, { tick: number; person: string; house: [number, number] | null }>;
const load = (name: string) => JSON.parse(readFileSync(join(statesDir, `${name}.json`), "utf8")) as GameState;
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const result: Record<string, unknown> = {};
const errors: string[] = [];
const files: string[] = [];

async function scene(state: GameState, tile: readonly number[]) {
  const { context, page } = await openScene(browser, { state, tile, baseUrl: url, width: 1280, height: 800, zoom: 1.4, run: false, initScript: TUTORIAL_OFF,
    query: "&story-delay=600000&weather=none" }) as { context: { close: () => Promise<void> }; page: Page };
  page.on("pageerror", error => errors.push(String(error).slice(0, 200)));
  for (const selector of [".season-ledger-resume", ".story-modal-later", ".chronicle-page .chronicle-keep"]) if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(300); }
  await page.waitForTimeout(800);
  return { page, close: () => context.close() };
}
async function shot(locator: Locator, file: string) { await locator.first().screenshot({ path: join(out!, file), type: "jpeg", quality: 68 }); files.push(file); }
/** The house's card with `personId`'s row: a click on the house (a few points over its lot: a walker can take the click), the list opened in full. */
async function openHouse(page: Page, house: readonly number[], personId: string) {
  // Tile points and screen lifts (the house's body stands above its tile; a wall site beside it can take a low click).
  for (const [dx, dy, lift] of [[0.5, 0.5, 8], [0.5, 0.5, 28], [0.5, 0.5, 48], [0.3, 0.3, 8], [0.7, 0.6, 20], [1, 1, 8], [1, 1, 36]] as const) {
    const at = await page.evaluate(tile => (window as unknown as { __FEUDAL_PHASE10_PROOF__: Proof }).__FEUDAL_PHASE10_PROOF__.tileClientPoint(tile), { tx: house[0]! + dx, ty: house[1]! + dy });
    await page.mouse.click(at.clientX, at.clientY - lift); await page.waitForTimeout(700);
    if (await page.locator(".person-chip").count() === 0) { await page.keyboard.press("Escape"); await page.waitForTimeout(200); continue; }
    if (await page.locator(`.person-chip[data-person="${personId}"]`).count() === 0 && await page.locator(".person-list-toggle[aria-expanded='false']").count() > 0) {
      await page.locator(".person-list-toggle[aria-expanded='false']").first().click(); await page.waitForTimeout(400);
    }
    if (await page.locator(`.person-chip[data-person="${personId}"]`).count() > 0) return;
    await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  }
  throw new Error(`no house card with ${personId} at ${house.join(",")}`);
}
/** A person's biography from their chip (the house card or the steward's card): the chip, [전기 보기]. */
async function openBiography(page: Page, personId: string) {
  await page.locator(`.person-chip[data-person="${personId}"]`).first().click(); await page.waitForTimeout(600);
  await page.getByRole("button", { name: "전기 보기" }).first().click();
  await page.locator(".chronicle-biography").first().waitFor({ timeout: 10_000 }); await page.waitForTimeout(900);
}
async function openTree(page: Page) {
  await page.getByRole("tab", { name: "가계도" }).first().click(); await page.waitForTimeout(1_200);
  await page.mouse.move(640, 790); await page.waitForTimeout(300);
}
const treeFacts = (page: Page) => page.locator(".family-tree-canvas").first().evaluate(node => ({
  nodes: Number(node.getAttribute("data-nodes")), folded: Number(node.getAttribute("data-folded")),
  outside: node.querySelectorAll('[data-outside="true"]').length, dead: node.querySelectorAll('[data-dead="true"]').length,
  selected: node.querySelector('[aria-selected="true"]')?.getAttribute("data-person") ?? null,
  banner: node.querySelector(".family-tree-banner")?.textContent ?? "", width: (node as HTMLElement).offsetWidth,
  // Every outside spouse's frame: no branch line ends on its top (drops end on members only).
  spouseDrops: [...node.querySelectorAll<HTMLElement>('[data-outside="true"]')].filter(frame => [...node.querySelectorAll<HTMLElement>(".family-tree-line")].some(line =>
    Math.abs(line.offsetLeft + line.offsetWidth / 2 - (frame.offsetLeft + frame.offsetWidth / 2)) < 2 && Math.abs(line.offsetTop + line.offsetHeight - frame.offsetTop) < 2)).length,
  smallText: [...node.querySelectorAll<HTMLElement>(".family-tree-name, .family-tree-years, .family-tree-hidden, .family-tree-generation")].filter(entry => parseFloat(getComputedStyle(entry).fontSize) < 12).length,
}));
async function step(name: string, run: () => Promise<Record<string, unknown> | void>) {
  try { const about = await run(); result[name] = { ...(about ?? {}) }; console.log(name, "ok"); }
  catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); console.log(name, "FAILED", String(error).slice(0, 200)); }
}

await step("t1-lord-tree", async () => {
  const state = load("lord"); const lord = moments.lord!.person;
  const keep = state.buildings.find(building => building.kind === "keep") ?? state.buildings[0]!;
  const { page, close } = await scene(state, [keep.tx, keep.ty]);
  // The ledger drawer's rights tab lists the lord's household: the ruling house's family, then the steward.
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(500);
  await page.locator("[data-ledger-tab='rights']").first().click(); await page.waitForTimeout(600);
  await shot(page.locator(".ledger-rights-household"), "t0-lord-household.jpg");
  await openBiography(page, lord);
  await openTree(page);
  await shot(page.locator(".chronicle-screen"), "t1-lord-tree.jpg");
  const facts = await treeFacts(page);
  await close();
  return { tick: state.tick, lord, ...facts };
});
await step("t2-miller-tree", async () => {
  const state = load("bailiff"); const head = moments.bailiff!.person;
  const { page, close } = await scene(state, moments.bailiff!.house!);
  await openHouse(page, moments.bailiff!.house!, head);
  await openBiography(page, head);
  await openTree(page);
  await shot(page.locator(".chronicle-screen"), "t2-miller-tree.jpg");
  const open = await treeFacts(page);
  await page.locator(".family-tree-toggle[aria-expanded='true']").first().click(); await page.waitForTimeout(600);
  await page.mouse.move(640, 790); await page.waitForTimeout(300);
  await shot(page.locator(".chronicle-screen"), "t3-miller-folded.jpg");
  const folded = await treeFacts(page);
  // A frame opens that person's biography.
  await page.locator(".family-tree-toggle[aria-expanded='false']").first().click(); await page.waitForTimeout(500);
  const child = await page.locator('.family-tree-node[data-outside="true"]').first().evaluate(node => node.getAttribute("data-person"));
  await page.locator('.family-tree-node[data-outside="true"]').first().click(); await page.waitForTimeout(800);
  const opened = await page.locator(".chronicle-biography").first().evaluate(node => node.getAttribute("data-person"));
  await close();
  return { tick: state.tick, head, open, folded, frameOpens: { clicked: child, biography: opened } };
});
await step("b1-baby", async () => {
  const state = load("baby"); const baby = moments.baby!.person;
  const { page, close } = await scene(state, moments.baby!.house!);
  await openHouse(page, moments.baby!.house!, baby);
  await shot(page.locator(`.person-chip[data-person="${baby}"]`), "b1-baby-chip.jpg");
  const chip = await page.locator(`.person-chip[data-person="${baby}"]`).first().evaluate(node => ({ faces: [...node.querySelectorAll<HTMLElement>(".person-portrait-layer, [style*='background-image']")].map(entry => entry.style.backgroundImage).filter(Boolean) }));
  await openBiography(page, baby);
  await shot(page.locator(".chronicle-biography"), "b1-baby-biography.jpg");
  const page2 = await page.locator(".chronicle-biography").first().evaluate(node => ({ portrait: node.getAttribute("data-portrait"), face: (node.querySelector(".chronicle-biography-portrait") as HTMLElement | null)?.style.backgroundImage ?? "" }));
  await close();
  return { tick: state.tick, baby, chip, biography: page2 };
});
for (const [index, kind] of (["sick", "injury", "pregnant", "pilgrim", "bailiff"] as const).entries()) {
  await step(`s${index + 1}-${kind}`, async () => {
    const state = load(kind); const moment = moments[kind]!;
    const { page, close } = await scene(state, moment.house!);
    await openHouse(page, moment.house!, moment.person);
    const chip = page.locator(`.person-chip[data-person="${moment.person}"]`);
    await shot(chip, `s${index + 1}-${kind}-chip.jpg`);
    const ornament = await chip.first().evaluate(node => node.querySelector(".person-state-ornament")?.getAttribute("data-ornament") ?? null);
    await openBiography(page, moment.person);
    await shot(page.locator(".chronicle-biography"), `s${index + 1}-${kind}-biography.jpg`);
    const biography = await page.locator(".chronicle-biography").first().evaluate(node => ({
      ornament: node.querySelector(".chronicle-biography-ornament")?.getAttribute("data-ornament") ?? null,
      life: [...node.querySelectorAll(".chronicle-biography-life li")].map(entry => entry.textContent ?? ""),
    }));
    await close();
    return { tick: state.tick, person: moment.person, chipOrnament: ornament, ...biography, rawTemplate: biography.life.some(line => /person\.[a-z_]+/.test(line)) };
  });
}
await browser.close();
const bytes = files.reduce((total, file) => total + statSync(join(out!, file)).size, 0);
writeFileSync(join(out!, "captures.json"), JSON.stringify({ steps: result, files, jpegBytes: bytes, errors }, null, 1) + "\n");
console.log(JSON.stringify({ steps: Object.keys(result).length, files: files.length, bytes, errors }));
process.exitCode = errors.length === 0 ? 0 : 1;
