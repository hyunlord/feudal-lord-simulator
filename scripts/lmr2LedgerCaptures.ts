// LM-R2 (ledger area) captures on the DGX: the lord screen's 약속·소송 in the browser, through the real way in (the dock's
// ledger → its lord tab → 영주 집무 열기 → 약속·소송), paused, 1280 × 800 DPR 1 unless named — the 캡처 관문 of
// SPECS/wave35-promises.md and of the litigation_track row of SPECS/wave35-operations.md:
//  p1-empty           no promise yet (lord2 offer-countered): the empty ledger's lines in the book
//  p2-active          the counterpart's word open (lord2 marriage-contracted)
//  p3-due             a promise of the lord's within a season of its deadline (promise-due, played on)
//  p4-due-today       the same on its deadline's day; then 약속 지키기 pressed: p5-kept-now — that promise alone moved to
//                     kept (the game's own statuses before and after), its button gone (a second press cannot happen)
//  p6-kept-broken     kept and broken promises beside the open ones (lord2 promises)
//  p7-tablet-dpr2     the same at 1180 × 820, DPR 2, by touch (a coarse pointer: the 48 px targets)
//  p8-art-missing     the book's and the kept mark's pictures answered 404: the kit frame and the text labels stand
//  s1-filed           the contested inheritance's suit just filed (lord2 contested); a deed brought by its button:
//                     s2-evidence-given (the claim holds the deed, its weight shown); s1-tablet-dpr2 the track at DPR 2
//  s3-evidence, s4-patronage (a patron sought by its button: s5-patron-chosen), s6-hearing, s7-enforcing (enforced by
//                     its button: s8-enforce-result), s9-closed — the same suit at each stage (played on)
//  n1-neighbour       a neighbour's recovery suit against the lord (lord2 neighbour-suit): shown, no command
//  w1-world           the whole view: the town on the left of the panel
// Each view's facts (rows, states, marks, the spine's width, buttons, text sizes, the art's HTTP answers) go to
// captures.json; a missing fact fails the run. On every view the spine is 24 px wide and no text is under 12 px.
//   scripts/remote/run.sh render-LMR2-ledger-<sha7> -- bash scripts/lmr2LedgerCaptures.sh
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/lmr2LedgerCaptures.ts)", { remote: "scripts/remote/run.sh render-LMR2-ledger-<sha7> -- bash scripts/lmr2LedgerCaptures.sh", entry: import.meta.url });
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GameState } from "../src/engine/engine.types";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Box = { x: number; y: number; width: number; height: number };
type Locator = { first: () => Locator; count: () => Promise<number>; click: () => Promise<void>; tap: () => Promise<void>; boundingBox: () => Promise<Box | null>;
  waitFor: (options: object) => Promise<void>; evaluate: (f: (node: Element) => void) => Promise<void> };
type Response = { url: () => string; status: () => number };
type Route = { fulfill: (options: object) => Promise<void> };
type Page = { locator: (selector: string) => Locator; waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<Buffer>;
  evaluate: <T, A = undefined>(f: (arg: A) => T | Promise<T>, arg?: A) => Promise<T>; route: (pattern: string, handler: (route: Route) => Promise<void>) => Promise<void>;
  on: (event: "response", handler: (response: Response) => void) => void; viewportSize: () => { width: number; height: number } };
type Opened = { context: { close: () => Promise<void> }; page: Page };

const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const lord2 = flag("lord2")!; const ledger2 = flag("ledger2")!;
if (out === undefined || url === undefined || lord2 === undefined || ledger2 === undefined) throw new Error("usage: lmr2LedgerCaptures.ts <out> --url <url> --lord2 <dir> --ledger2 <dir>");
mkdirSync(out, { recursive: true });
const INIT = `globalThis.__name = globalThis.__name || (target => target); try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const load = (dir: string, name: string): GameState | null => { try { return JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8")) as GameState; } catch { return null; } };
const seatTile = (state: GameState): [number, number] => {
  const seat = state.buildings.find(building => building.kind === "manor_house") ?? state.buildings.find(building => building.kind === "house") ?? state.buildings[0]!;
  return [seat.tx, seat.ty];
};

const chromium = await loadChromium() as unknown as { launch: (options: object) => Promise<{ close: () => Promise<void> }> };
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows: Record<string, unknown>[] = [];
const failures: string[] = [];
const expect = (name: string, ok: boolean, what: string) => { if (!ok) failures.push(`${name}: ${what}`); };

type View = { width?: number; height?: number; dpr?: number; touch?: boolean; block?: readonly string[] };
async function open(state: GameState, view: View = {}): Promise<Opened & { art: [string, number][] }> {
  const { width = 1280, height = 800, dpr = 1, touch = false, block = [] } = view;
  const opened = await openScene(browser, { state, tile: seatTile(state), baseUrl: url, width, height, dpr, zoom: 1.1, run: false, hasTouch: touch, isMobile: touch,
    loadTimeout: 120_000, initScript: INIT, query: "&story-delay=600000" }) as unknown as Opened;
  const art: [string, number][] = [];
  opened.page.on("response", response => { if (response.url().includes("assets/lord-ui/")) art.push([response.url().replace(/^.*assets\//, ""), response.status()]); });
  for (const file of block) await opened.page.route(`**/${file}`, route => route.fulfill({ status: 404, body: "" }));
  const press = async (selector: string) => { const target = opened.page.locator(selector).first(); if (touch) await target.tap(); else await target.click(); await opened.page.waitForTimeout(400); };
  await press("[data-dock='ledger']"); await press("[data-ledger-tab='lord']"); await press("[data-lord-open]"); await press("[data-lord-nav='ledger']");
  await opened.page.locator(".lord-ledger").first().waitFor({ timeout: 15_000 });
  // The parts settle (loaded, or failed in the missing-art view) before anything is read.
  await opened.page.evaluate(async () => { for (let i = 0; i < 40 && document.querySelector(".lord-ledger-book[data-book-art='ledger_book']") === null; i += 1) await new Promise(done => setTimeout(done, 100)); });
  await opened.page.waitForTimeout(800);
  return { ...opened, art };
}
/** What the screen shows: promise rows, suits, the spine, buttons, the smallest text, the panel's box. */
const facts = (page: Page) => page.evaluate(() => {
  const root = document.querySelector(".lord-ledger");
  const panel = document.querySelector(".slot-panel.lord-screen")!.getBoundingClientRect();
  const bg = (element: Element | null) => element === null ? null : getComputedStyle(element).backgroundImage.match(/lord-ui\/[^")]+/)?.[0] ?? null;
  const spine = root?.querySelector(".lord-ledger-spine")?.getBoundingClientRect();
  const texts = [...(root?.querySelectorAll("*") ?? [])].filter(el => [...el.childNodes].some(node => node.nodeType === 3 && (node.textContent ?? "").trim() !== ""));
  return {
    book: root?.querySelector(".lord-ledger-book")?.getAttribute("data-book-art") ?? null,
    spine: spine === undefined ? null : { width: Math.round(spine.width * 100) / 100, height: Math.round(spine.height), art: root?.querySelector(".lord-ledger-spine")?.getAttribute("data-spine-art") ?? null },
    promises: [...(root?.querySelectorAll(".lord-ledger-promise") ?? [])].map(li => ({ id: li.getAttribute("data-promise"), state: li.getAttribute("data-state"),
      mark: bg(li.querySelector(".lord-ledger-mark")), label: li.querySelector(".lord-ledger-state")?.textContent ?? null,
      deadline: li.querySelector(".lord-ledger-deadline")?.textContent ?? null, deadlineMark: bg(li.querySelector(".lord-ledger-deadline .lord-ledger-inline-icon")),
      dueToday: li.querySelector(".lord-ledger-deadline")?.getAttribute("data-due-today") ?? null,
      keep: li.querySelector(".lord-ledger-keep") === null ? null : (li.querySelector(".lord-ledger-keep") as HTMLButtonElement).disabled ? "shut" : "open",
      page: li.closest(".lord-ledger-leaf")?.getAttribute("data-leaf") ?? null })),
    suits: [...(root?.querySelectorAll(".lord-ledger-suit") ?? [])].map(li => ({ id: li.getAttribute("data-suit"), stage: li.getAttribute("data-stage"), neighbour: li.getAttribute("data-neighbour"),
      now: li.querySelector(".lord-ledger-step[data-at='now']")?.textContent ?? null, track: li.querySelector(".lord-ledger-track")?.getAttribute("data-frame") ?? null,
      trackArt: getComputedStyle(li.querySelector(".lord-ledger-track")!).borderImageSource.match(/lord-ui\/[^")]+/)?.[0] ?? null,
      hearing: li.querySelector("[data-hearing]")?.textContent ?? null, verdict: li.querySelector("[data-verdict]")?.textContent ?? null,
      evidence: [...li.querySelectorAll("[data-evidence]")].map(row => `${row.getAttribute("data-evidence")}:${row.querySelector("[data-given]")?.textContent ?? ((row.querySelector("button") as HTMLButtonElement | null)?.disabled ? "shut" : "open")}`),
      patrons: [...li.querySelectorAll("[data-seek]")].map(button => button.getAttribute("data-seek")), patron: li.querySelector("[data-patron='chosen']")?.textContent ?? null,
      enforce: li.querySelector(".lord-ledger-enforce") === null ? null : (li.querySelector(".lord-ledger-enforce") as HTMLButtonElement).disabled ? "shut" : "open",
      buttons: li.querySelectorAll("button").length })),
    claims: [...(root?.querySelectorAll(".lord-ledger-claim") ?? [])].map(li => `${li.getAttribute("data-claim")}:${li.querySelector("[data-refusal]")?.textContent ?? "open"}`),
    neighbourButtons: root?.querySelector("[data-section='neighbour-suits']")?.querySelectorAll("button").length ?? null,
    empty: [...(root?.querySelectorAll("[data-empty]") ?? [])].map(node => node.getAttribute("data-empty")),
    smallestText: Math.min(...texts.map(el => parseFloat(getComputedStyle(el).fontSize))),
    smallestButton: Math.min(...[...(root?.querySelectorAll("button") ?? [])].map(button => button.getBoundingClientRect().height)),
    natives: root?.querySelectorAll("input, select, [title]").length ?? null,
    coarse: matchMedia("(pointer: coarse)").matches,
    panel: { left: Math.round(panel.left), right: Math.round(panel.right), top: Math.round(panel.top), bottom: Math.round(panel.bottom), viewport: innerWidth },
  };
});
type Facts = Awaited<ReturnType<typeof facts>>;
const engine = (page: Page) => page.evaluate(() => {
  const state = (window as unknown as { __FEUDAL_PHASE10_PROOF__: { state: () => GameState } }).__FEUDAL_PHASE10_PROOF__.state();
  return { tick: state.tick, promises: Object.fromEntries((state.diplomacy?.promises ?? []).map(entry => [entry.id, entry.status])),
    suits: (state.estates?.suits ?? []).map(suit => ({ id: suit.id, stage: suit.stage, patron: suit.patron ?? null, enforcements: suit.enforcements, enforced: suit.enforced ?? null })),
    evidence: Object.fromEntries((state.estates?.claims ?? []).map(claim => [claim.id, claim.evidence.map(entry => `${entry.kind}:${entry.weight}`)])) };
});
/** The panel's screen (the content column, the part in view after `focus` is scrolled to the top). */
async function shot(page: Page, name: string, focus: string | null, dpr: number, whole = false): Promise<string> {
  if (focus !== null) await page.locator(focus).first().evaluate(node => node.scrollIntoView({ block: "start" }));
  await page.waitForTimeout(300);
  const box = whole ? { x: 0, y: 0, ...page.viewportSize() } : await page.locator(".slot-panel.lord-screen").first().boundingBox();
  const file = `${name}.jpg`;
  await writeFile(file, await page.screenshot({ type: "jpeg", quality: whole ? 35 : dpr === 2 ? 26 : 45,
    clip: { x: Math.max(0, box!.x), y: Math.max(0, box!.y), width: box!.width, height: box!.height } }));
  return file;
}
const writeFile = (file: string, data: Buffer) => writeFileSync(join(out!, file), data);
/** The checks every view must pass: the spine fixed, the 12 px floor, no native control or title, the town in view. */
function common(name: string, seen: Facts) {
  expect(name, seen.spine !== null && seen.spine.width === 24, `spine ${JSON.stringify(seen.spine)}`);
  expect(name, seen.smallestText >= 12, `smallest text ${seen.smallestText}`);
  expect(name, seen.natives === 0, `native controls or title ${seen.natives}`);
  expect(name, seen.panel.left >= 264, `town in view left of the panel: ${seen.panel.left}px`);
  expect(name, !Number.isFinite(seen.smallestButton) || seen.smallestButton >= 44, `button height ${seen.smallestButton}`);
  for (const promise of seen.promises) expect(name, promise.mark === null || promise.mark.endsWith(`promise_${promise.state === "open" ? "active" : promise.state}.png`), `${promise.id} mark ${promise.mark} for ${promise.state}`);
  for (const promise of seen.promises) expect(name, (promise.deadline !== null) === (promise.page === "open"), `${promise.id}: deadline only on open promises`);
}
async function view(name: string, state: GameState | null, focus: string | null, options: View = {}, after?: (opened: Opened, seen: Facts) => Promise<void>) {
  if (state === null) { rows.push({ name, file: null, note: "state not found (scripts/lmr2LedgerStates.ts)" }); failures.push(`${name}: no state`); return; }
  const opened = await open(state, options);
  const seen = await facts(opened.page);
  common(name, seen);
  const file = await shot(opened.page, name, focus, options.dpr ?? 1);
  rows.push({ name, file, viewport: `${options.width ?? 1280}x${options.height ?? 800}`, dpr: options.dpr ?? 1, touch: options.touch ?? false, ...seen, engine: await engine(opened.page), art: opened.art });
  if (after !== undefined) await after(opened, seen);
  await opened.context.close();
}
/** After a press: the screen and the game again, under `name`. */
async function again(opened: Opened, name: string, focus: string | null, dpr = 1): Promise<{ seen: Facts; game: Awaited<ReturnType<typeof engine>> }> {
  await opened.page.waitForTimeout(700);
  const seen = await facts(opened.page);
  common(name, seen);
  const game = await engine(opened.page);
  rows.push({ name, file: await shot(opened.page, name, focus, dpr), ...seen, engine: game });
  return { seen, game };
}

const L = (name: string) => load(lord2, name);
const P = (name: string) => load(ledger2, name);

// Promises.
await view("p1-empty", L("offer-countered"), null, {}, async (_opened, seen) => {
  expect("p1-empty", seen.promises.length === 0 && seen.empty.includes("promises") && seen.book === "ledger_book", JSON.stringify({ empty: seen.empty, book: seen.book })); });
await view("p2-active", L("marriage-contracted"), null, {}, async (_opened, seen) => {
  expect("p2-active", seen.promises.some(row => row.state === "open" && row.keep === null), JSON.stringify(seen.promises)); });
await view("p3-due", P("promise-due"), null, {}, async (_opened, seen) => {
  expect("p3-due", seen.promises.some(row => row.state === "due" && row.mark?.endsWith("promise_due.png") === true && row.deadlineMark !== null), JSON.stringify(seen.promises)); });
await view("p4-due-today", P("promise-due-today"), null, {}, async (opened, seen) => {
  const due = seen.promises.find(row => row.state === "due" && row.dueToday === "true");
  expect("p4-due-today", due !== undefined && due.keep === "open", JSON.stringify(seen.promises));
  if (due === undefined) return;
  const before = await engine(opened.page);
  await opened.page.locator(`[data-keep='${due.id}']`).first().click();
  const { seen: after, game } = await again(opened, "p5-kept-now", ".lord-ledger-leaf[data-leaf='past']");
  const moved = Object.keys(before.promises).filter(id => before.promises[id] !== game.promises[id]);
  expect("p5-kept-now", moved.length === 1 && moved[0] === due.id && game.promises[due.id!] === "kept", `moved ${JSON.stringify(moved)} → ${game.promises[due.id!]}`);
  expect("p5-kept-now", after.promises.find(row => row.id === due.id)?.state === "kept" && after.promises.find(row => row.id === due.id)?.keep === null, "the kept row has no button");
  rows.push({ name: "p5-kept-now:check", before: before.promises, after: game.promises, moved });
});
await view("p6-kept-broken", L("promises"), null, {}, async (_opened, seen) => {
  expect("p6-kept-broken", ["kept", "broken", "open"].every(state => seen.promises.some(row => row.state === state)), JSON.stringify(seen.promises.map(row => row.state))); });
await view("p7-tablet-dpr2", L("promises"), null, { width: 1180, height: 820, dpr: 2, touch: true }, async (_opened, seen) => {
  expect("p7-tablet-dpr2", seen.coarse && seen.smallestButton >= 48, `touch (coarse ${seen.coarse}) button ${seen.smallestButton}`); });
await view("p8-art-missing", L("promises"), null, { block: ["lord-ui/wave35-promises/ledger_book.png", "lord-ui/wave35-promises/promise_kept.png"] }, async (_opened, seen) => {
  expect("p8-art-missing", seen.book === "none" && seen.promises.filter(row => row.state === "kept").every(row => row.mark === null && row.label !== null), JSON.stringify({ book: seen.book, kept: seen.promises.filter(row => row.state === "kept") })); });

// Suits.
await view("s1-filed", L("contested"), ".lord-ledger-suit", {}, async (opened, seen) => {
  const suit = seen.suits.find(row => row.stage === "filed" && row.neighbour === null);
  expect("s1-filed", suit !== undefined && suit.hearing !== null && suit.evidence.some(entry => entry.endsWith(":open")) && suit.trackArt !== null, JSON.stringify(seen.suits));
  if (suit === undefined) return;
  await opened.page.locator(`[data-suit='${suit.id}'] [data-bring='deed']`).first().click();
  const { seen: after, game } = await again(opened, "s2-evidence-given", ".lord-ledger-suit");
  const claim = (await opened.page.evaluate(() => (window as unknown as { __FEUDAL_PHASE10_PROOF__: { state: () => GameState } }).__FEUDAL_PHASE10_PROOF__.state().estates?.suits.find(entry => entry.stage === "filed")?.claimId ?? null));
  expect("s2-evidence-given", claim !== null && (game.evidence[claim] ?? []).some(entry => entry.startsWith("deed:")), JSON.stringify(game.evidence));
  expect("s2-evidence-given", after.suits.find(row => row.id === suit.id)?.evidence.some(entry => entry.startsWith("deed:") && !entry.endsWith(":open")) === true, JSON.stringify(after.suits));
});
await view("s1-tablet-dpr2", L("contested"), ".lord-ledger-suit", { width: 1180, height: 820, dpr: 2, touch: true });
await view("s3-evidence", P("suit-evidence"), ".lord-ledger-suit", {}, async (_opened, seen) => {
  expect("s3-evidence", seen.suits.some(row => row.stage === "evidence"), JSON.stringify(seen.suits)); });
await view("s4-patronage", P("suit-patronage"), ".lord-ledger-suit", {}, async (opened, seen) => {
  const suit = seen.suits.find(row => row.stage === "patronage");
  expect("s4-patronage", suit !== undefined, JSON.stringify(seen.suits));
  if (suit === undefined || suit.patrons.length === 0) { rows.push({ name: "s5-patron-chosen", file: null, note: "no faction the engine would take as patron in this state" }); return; }
  await opened.page.locator(`[data-suit='${suit.id}'] [data-seek='${suit.patrons[0]}']`).first().click();
  const { seen: after, game } = await again(opened, "s5-patron-chosen", ".lord-ledger-suit");
  expect("s5-patron-chosen", game.suits.find(row => row.id === suit.id)?.patron === suit.patrons[0] && after.suits.find(row => row.id === suit.id)?.patron !== null, JSON.stringify(game.suits));
});
await view("s6-hearing", P("suit-hearing"), ".lord-ledger-suit", {}, async (_opened, seen) => {
  expect("s6-hearing", seen.suits.some(row => row.stage === "hearing" && row.hearing !== null), JSON.stringify(seen.suits)); });
const enforcing = P("suit-enforcing");
if (enforcing === null) rows.push({ name: "s7-enforcing", file: null, note: "the path's judgment left no possessor to put out (scripts/lmr2LedgerStates.ts): no enforcing stage in this play" });
else await view("s7-enforcing", enforcing, ".lord-ledger-suit", {}, async (opened, seen) => {
  const suit = seen.suits.find(row => row.stage === "enforcing");
  expect("s7-enforcing", suit !== undefined && suit.verdict !== null, JSON.stringify(seen.suits));
  if (suit === undefined || suit.enforce !== "open") return;
  const before = await engine(opened.page);
  await opened.page.locator(`[data-enforce='${suit.id}']`).first().click();
  const { game } = await again(opened, "s8-enforce-result", ".lord-ledger-suit");
  expect("s8-enforce-result", (game.suits.find(row => row.id === suit.id)?.enforcements ?? 0) === (before.suits.find(row => row.id === suit.id)?.enforcements ?? 0) + 1, JSON.stringify(game.suits));
});
await view("s9-closed", P("suit-closed"), ".lord-ledger-suit", {}, async (_opened, seen) => {
  expect("s9-closed", seen.suits.some(row => row.stage === "closed" && row.verdict !== null), JSON.stringify(seen.suits)); });
await view("n1-neighbour", L("neighbour-suit"), "[data-section='neighbour-suits']", {}, async (_opened, seen) => {
  expect("n1-neighbour", seen.suits.some(row => row.neighbour === "true" && row.buttons === 0) && seen.neighbourButtons === 0, JSON.stringify(seen.suits)); });

// The whole view: the town beside the panel.
{
  const state = L("promises")!;
  const opened = await open(state);
  rows.push({ name: "w1-world", file: await shot(opened.page, "w1-world", null, 1, true), ...(await facts(opened.page)) });
  await opened.context.close();
}

await browser.close();
const bytes = rows.filter(row => typeof row.file === "string").reduce((sum, row) => sum + statSync(join(out, row.file as string)).size, 0);
writeFileSync(join(out, "captures.json"), `${JSON.stringify({ rows, failures, bytes }, null, 1)}\n`);
process.stderr.write(`${rows.length} rows, ${bytes} bytes, ${failures.length} failures\n${failures.join("\n")}\n`);
if (failures.length > 0) process.exitCode = 1;
