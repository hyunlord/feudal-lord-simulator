// DEC-CARD A1/A2/A4/A5 captures on the DGX (Astra's lord-mode play, 2026-10-06), 1280 × 800 DPR 1, paused, on the
// played-on states of scripts/deccardAstraStates.ts:
//  a2-pill            the status pill in lord mode: date, population, food, coin and 내 도시로
//  a2-far             a lord's game opened with the camera far from the town (a scripted scene keeps its camera)
//  a2-to-town         the same after 내 도시로: the town's seat (the manor's middle tile) at the view's middle
//  a2-load-restore    a lord's game loaded with a camera kept for it (`&lord-camera=1`: the scripted scene lets it run):
//                     the kept tile at the view's middle, not the scene's far camera
//  a5-treasury        the coin cell pressed: the stock tab's treasury by estate (two estates)
//  a1-inspector       the stuck-goods chip pressed: the pile's building in the inspector, its 조치 in lord mode's words
//  a1-advice          a beat whose sandbox advice asks to build, its card's [조언] in lord mode's words
//  a4-since           a registry card that sets the dues (or the policy, a subsidy), with "지난번 같은 일 이후"
// Each view's facts go to captures.json (lines shown, the camera's distance from the target, the smallest text); a
// missing fact or a build-direct word in a lord line fails the run. No text under 12 px.
//   scripts/remote/run.sh render-DECCARD-astra-<sha7> --light -- bash scripts/deccardAstraCaptures.sh
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/deccardAstraCaptures.ts)", { remote: "scripts/remote/run.sh render-DECCARD-astra-<sha7> --light -- bash scripts/deccardAstraCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { townSeatTile } from "../src/ui/lord/camera/townSeat";
import { cameraKey } from "../src/ui/lord/camera/useLordCamera";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Box = { x: number; y: number; width: number; height: number };
type Locator = { first: () => Locator; count: () => Promise<number>; click: () => Promise<void>; boundingBox: () => Promise<Box | null>;
  waitFor: (options: object) => Promise<void>; screenshot: (options: object) => Promise<Buffer>; textContent: () => Promise<string | null> };
type Page = { locator: (selector: string) => Locator; waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<Buffer>;
  evaluate: <T, A = undefined>(f: (arg: A) => T | Promise<T>, arg?: A) => Promise<T> };
type Opened = { context: { close: () => Promise<void> }; page: Page };

const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url"); const statesDir = flag("states");
if (out === undefined || url === undefined || statesDir === undefined) throw new Error("usage: deccardAstraCaptures.ts <out> --url <url> --states <dir>");
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const load = (name: string): GameState | null => { try { return JSON.parse(readFileSync(join(statesDir, `${name}.json`), "utf8")) as GameState; } catch { return null; } };
const QUALITY = 40;
const BUILD = /(지으세요|지어 |지으면|이어 주세요|놓으세요|늘리세요|칠하세요|칠하십시오|두십시오|갖추|갖춰)/;

const chromium = await loadChromium() as unknown as { launch: (options: object) => Promise<{ close: () => Promise<void> }> };
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows: Record<string, unknown>[] = [];
const failures: string[] = [];
const expect = (name: string, ok: boolean, what: string) => { if (!ok) failures.push(`${name}: ${what}`); };

async function open(state: GameState, tile: readonly [number, number], options: { query?: string; init?: string } = {}): Promise<Opened> {
  return await openScene(browser, { state, tile, baseUrl: url, width: 1280, height: 800, zoom: 1.1, run: false, loadTimeout: 120_000,
    initScript: TUTORIAL_OFF + (options.init ?? ""), query: options.query ?? "&story-delay=600000" }) as unknown as Opened;
}
/** The smallest text size on screen inside a root (its text nodes' elements). */
const smallest = (page: Page, selector: string) => page.evaluate(root => Math.min(...[...document.querySelectorAll(`${root} *`)]
  .filter(element => [...element.childNodes].some(node => node.nodeType === 3 && (node.textContent ?? "").trim() !== ""))
  .map(element => parseFloat(getComputedStyle(element).fontSize))), selector);
const lines = (page: Page, selector: string) => page.evaluate(root => [...document.querySelectorAll(root)].map(element => (element.textContent ?? "").trim()), selector);
/** How far the tile's middle stands from the view's middle, in CSS px (the proof port's own projection). */
const offCentre = (page: Page, tile: { tx: number; ty: number }) => page.evaluate(target => {
  const proof = (window as unknown as { __FEUDAL_PHASE10_PROOF__: { tileClientPoint: (tile: { tx: number; ty: number }) => { x: number; y: number } } }).__FEUDAL_PHASE10_PROOF__;
  const point = proof.tileClientPoint(target);
  const canvas = document.querySelector("canvas")!.getBoundingClientRect();
  return Math.round(Math.hypot(point.x - (canvas.left + canvas.width / 2), point.y - (canvas.top + canvas.height / 2)));
}, tile);
async function shoot(page: Page, name: string, selector: string | null): Promise<number> {
  const path = join(out!, `${name}.jpg`);
  if (selector === null) await page.screenshot({ path, type: "jpeg", quality: QUALITY });
  else await page.locator(selector).first().screenshot({ path, type: "jpeg", quality: QUALITY });
  return statSync(path).size;
}
async function view(name: string, state: GameState | null, run: (state: GameState) => Promise<Record<string, unknown>>): Promise<void> {
  if (state === null) { failures.push(`${name}: no state`); return; }
  try { rows.push({ name, tick: state.tick, ...await run(state) }); } catch (error) { failures.push(`${name}: ${String(error)}`); }
}

const estates = load("estates-two");
const far = [3, 3] as const;

// A2: the pill, a far camera, 내 도시로, and a kept camera restored on a load.
await view("a2-pill", estates, async state => {
  const { context, page } = await open(state, [townSeatTile(state)!.tx, townSeatTile(state)!.ty]);
  await page.locator(".status-pill-town").waitFor({ state: "visible", timeout: 30_000 });
  const facts = { cells: await lines(page, ".status-pill > .status-pill-cell"), smallest: await smallest(page, ".status-pill"), bytes: await shoot(page, "a2-pill", ".status-pill") };
  expect("a2-pill", (facts.cells as string[]).some(text => text.includes("내 도시로")), "no 내 도시로 cell");
  await context.close(); return facts;
});
await view("a2-to-town", estates, async state => {
  const seat = townSeatTile(state)!;
  const { context, page } = await open(state, far);
  const before = await offCentre(page, seat);
  const farBytes = await shoot(page, "a2-far", null);
  await page.locator(".status-pill-town").click(); await page.waitForTimeout(600);
  const after = await offCentre(page, seat);
  const bytes = await shoot(page, "a2-to-town", null);
  expect("a2-to-town", before > 300 && after < 40, `seat ${before}px off before, ${after}px after`);
  await context.close(); return { seat, before, after, farBytes, bytes };
});
await view("a2-load-restore", estates, async state => {
  const seat = townSeatTile(state)!;
  const kept = { tx: seat.tx + 4, ty: seat.ty - 3 };
  const init = `try { localStorage.setItem(${JSON.stringify(cameraKey(state))}, "${kept.tx},${kept.ty}"); } catch (error) { void error; }`;
  const { context, page } = await open(state, far, { query: "&story-delay=600000&lord-camera=1", init });
  await page.waitForTimeout(800);
  const off = await offCentre(page, kept);
  const bytes = await shoot(page, "a2-load-restore", null);
  expect("a2-load-restore", off < 40, `the kept tile ${off}px off the middle`);
  await context.close(); return { kept, off, bytes };
});

// A5: the coin cell → the stock tab's treasury by estate.
await view("a5-treasury", estates, async state => {
  const { context, page } = await open(state, [townSeatTile(state)!.tx, townSeatTile(state)!.ty]);
  await page.locator(".status-pill > .status-pill-cell:nth-of-type(4)").click();
  await page.locator(".treasury-estates").waitFor({ state: "visible", timeout: 30_000 });
  const facts = { estates: await lines(page, ".treasury-estates-head"), groups: await lines(page, ".treasury-estates-list > li > ul > li"),
    smallest: await smallest(page, ".treasury-estates"), bytes: await shoot(page, "a5-treasury", ".slot-panel.ledger-drawer") };
  expect("a5-treasury", (facts.estates as string[]).length >= 2, "fewer than two estates");
  await context.close(); return facts;
});

// A1: the inspector's 조치 and an event card's [조언] in lord mode's words.
await view("a1-inspector", load("stuck-pile"), async state => {
  const { context, page } = await open(state, [townSeatTile(state)!.tx, townSeatTile(state)!.ty]);
  await page.locator(".stuck-goods-chip").first().click();
  await page.locator(".slot-panel.inspector-slot").waitFor({ state: "visible", timeout: 30_000 });
  await page.waitForTimeout(400);
  const actions = await lines(page, ".slot-panel.inspector-slot li, .slot-panel.inspector-slot .inspector-action");
  const text = (await page.locator(".slot-panel.inspector-slot").first().textContent()) ?? "";
  expect("a1-inspector", !BUILD.test(text), `a build-direct line: ${text}`);
  const facts = { actions, text, smallest: await smallest(page, ".slot-panel.inspector-slot"), bytes: await shoot(page, "a1-inspector", ".slot-panel.inspector-slot") };
  await context.close(); return facts;
});
await view("a1-advice", load("advice-beat"), async state => {
  const { context, page } = await open(state, [townSeatTile(state)!.tx, townSeatTile(state)!.ty], { query: "&story-delay=600" });
  const chip = page.locator(".event-chip[data-story='fire'], .event-chip[data-story='fire_warning'], .event-chip[data-story='fire_aftermath'], .event-chip[data-story='wet_summer'], .event-chip[data-story='bad_harvest'], .event-chip[data-story='famine_omen'], .event-chip[data-story='palisade']").first();
  await chip.waitFor({ state: "visible", timeout: 60_000 });
  await chip.click();
  await page.locator(".event-card button:has-text('조언')").first().click();
  await page.locator(".event-card-advice").waitFor({ state: "visible", timeout: 10_000 });
  const advice = (await page.locator(".event-card-advice").first().textContent()) ?? "";
  expect("a1-advice", !BUILD.test(advice), `a build-direct advice: ${advice}`);
  const facts = { advice, smallest: await smallest(page, ".event-card"), bytes: await shoot(page, "a1-advice", ".event-cards") };
  await context.close(); return facts;
});

// A4: the recurring card's "지난번 같은 일 이후" (the card opens by itself after the story's delay).
await view("a4-since", load("since-dues") ?? load("since-any"), async state => {
  const { context, page } = await open(state, [townSeatTile(state)!.tx, townSeatTile(state)!.ty], { query: "&story-delay=1500" });
  for (let waited = 0; waited < 60_000; waited += 500) {
    if (await page.locator(".lord-card[data-registry-offer] .since-last").count() > 0) break;
    const other = page.locator(".story-modal:not([data-registry-offer]) .story-modal-later");
    if (await other.count() > 0) await other.first().click();
    const chip = page.locator(".event-chip[data-story='registry_event']");
    if (waited > 6_000 && await chip.count() > 0 && await page.locator(".lord-card[data-registry-offer]").count() === 0) {
      await chip.first().click(); const decide = page.locator(".event-card .event-card-decide"); if (await decide.count() > 0) await decide.first().click();
    }
    await page.waitForTimeout(500);
  }
  const since = await lines(page, ".since-last li");
  expect("a4-since", since.length >= 3, "no since-last lines");
  const facts = { since, smallest: await smallest(page, ".lord-card"), bytes: await shoot(page, "a4-since", ".lord-card") };
  await context.close(); return facts;
});

await browser.close();
for (const row of rows) if (typeof row.smallest === "number" && row.smallest < 12) failures.push(`${String(row.name)}: text ${row.smallest}px`);
const total = rows.reduce((sum, row) => sum + Object.entries(row).filter(([key]) => key.endsWith("ytes")).reduce((part, [, value]) => part + Number(value), 0), 0);
writeFileSync(join(out, "captures.json"), JSON.stringify({ rows, failures, totalBytes: total }, null, 1) + "\n");
console.log(JSON.stringify({ views: rows.length, failures, totalBytes: total }));
if (failures.length > 0) process.exitCode = 1;
