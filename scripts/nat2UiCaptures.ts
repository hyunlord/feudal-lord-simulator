// NAT-2 UI captures (docs/verification/nat2/ui, JPEG): QA-006 the ledger drawer on Astra's 1380 save
// (fixtures/perf-gate/ch4-1380.save.json.gz) at her 1600 × 1100, at 1280 × 800 and on the tablet (1180 × 820, touch);
// QA-009 the guild's quarrel and the parish's nave (scripts/nat2UiStates.ts), whose answers carry no forecast yet; the
// QA info overlay (the settings' developer switch, key `) on the same 1380 save with a carter selected. `--tag` prefixes
// the files (before | after). Beside the shots <tag>-captures.json: the ledger's scroll widths, the cards' forecast lines,
// the overlay's lines.
//   PLAYWRIGHT_MODULE=... npx tsx scripts/nat2UiCaptures.ts <out-dir> --url <game> --states <dir of nat2UiStates.ts> --tag after
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { pickTile } from "../src/render/picking";
import { walkerVisualAnchor } from "../src/render/walkerAnchor";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

type Locator = { first: () => Locator; click: (options?: object) => Promise<void>; count: () => Promise<number>; waitFor: (options?: object) => Promise<void>;
  screenshot: (options: object) => Promise<unknown> };
type Page = { waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<unknown>; evaluate: <T, A = void>(f: (arg: A) => T, arg?: A) => Promise<T>;
  locator: (selector: string) => Locator; keyboard: { press: (key: string) => Promise<void> }; mouse: { click: (x: number, y: number) => Promise<void> };
  on: (event: string, handler: (error: unknown) => void) => void };
type Proof = { tileClientPoint: (tile: object) => { clientX: number; clientY: number }; state: () => { walkers: { id: string; kind: string; position: { tx: number; ty: number } }[] } };
const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const url = flag("url")!; const statesDir = flag("states")!; const tag = flag("tag") ?? "after";
mkdirSync(out!, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const town1380 = JSON.parse(gunzipSync(readFileSync("fixtures/perf-gate/ch4-1380.save.json.gz")).toString("utf8"));
const houseTile = (state: { buildings: { kind: string; tx: number; ty: number }[] }) => {
  const house = state.buildings.find(building => building.kind === "house") ?? state.buildings[0]!; return [house.tx, house.ty];
};
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const result: Record<string, unknown> = {};
const errors: string[] = [];
const shot = (page: Page, file: string) => page.screenshot({ path: join(out!, `${tag}-${file}`), type: "jpeg", quality: 62 });
async function step(name: string, run: () => Promise<void>) {
  try { await run(); } catch (error) { errors.push(`${name}: ${String(error).slice(0, 300)}`); }
}
async function scene(state: { buildings: { kind: string; tx: number; ty: number }[] }, width: number, height: number, extra: { touch?: boolean; query?: string } = {}) {
  const inner = (state as { state?: typeof state }).state ?? state;
  const { context, page } = await openScene(browser, { state, tile: houseTile(inner), baseUrl: url, width, height, zoom: 1, run: false,
    initScript: TUTORIAL_OFF, query: extra.query ?? "&story-delay=600000", hasTouch: extra.touch ?? false, isMobile: extra.touch ?? false });
  (page as Page).on("pageerror", error => errors.push(`${width}x${height}: ${String(error).slice(0, 200)}`));
  return { page: page as Page, close: () => context.close() };
}

// QA-006: the ledger's stock tab; every scroll box's widths (a wider content than its box hides columns behind a scroll).
for (const [name, width, height, touch] of [["ledger-1600x1100", 1600, 1100, false], ["ledger-1280x800", 1280, 800, false], ["ledger-tablet-1180x820", 1180, 820, true]] as const) {
  await step(name, async () => {
    const { page, close } = await scene(town1380, width, height, { touch });
    await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(900);
    await shot(page, `${name}.jpg`);
    result[name] = await page.evaluate(() => {
      const drawer = document.querySelector(".ledger-drawer")!; const box = drawer.getBoundingClientRect();
      return { drawer: { width: Math.round(box.width), scrollWidth: drawer.scrollWidth, clientWidth: drawer.clientWidth },
        scrolls: [...drawer.querySelectorAll(".ledger-matrix-scroll")].map(scroll => ({ scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth })),
        columns: drawer.querySelectorAll(".ledger-matrix thead th").length };
    });
    // At Astra's size: the first row pressed (its stores lit on the map and listed under it), the drawer alone.
    if (width === 1600 && await page.locator(".ledger-row").count() > 0) {
      await page.locator(".ledger-row").first().click(); await page.waitForTimeout(600);
      await page.locator(".ledger-drawer").first().screenshot({ path: join(out!, `${tag}-${name}-row-pressed.jpg`), type: "jpeg", quality: 70 });
      result[`${name}-row-pressed`] = await page.evaluate(() => [...document.querySelectorAll(".ledger-store")].map(store => store.textContent ?? ""));
    }
    await close();
  });
}

// QA-009: the interlude's petition cards, opened as a player opens them (the chip, then [결정하기]).
for (const name of ["guild-dispute", "church-rebuilding"]) {
  await step(name, async () => {
    const state = JSON.parse(readFileSync(join(statesDir, `${name}.save.json`), "utf8"));
    const { page, close } = await scene(state, 1600, 1100, { query: "&story-delay=5000" });
    if (!await page.locator(".petition-card").waitFor({ timeout: 8_000 }).then(() => true).catch(() => false)) {
      await page.locator(".event-chip").first().click({ timeout: 20_000 }).catch(() => undefined);
      await page.locator(".event-card-decide").first().click({ timeout: 10_000 }).catch(() => undefined);
      await page.locator(".petition-card").waitFor({ timeout: 30_000 });
    }
    await page.waitForTimeout(800);
    await shot(page, `decision-${name}.jpg`);
    result[name] = await page.evaluate(() => ({ def: document.querySelector(".petition-card")?.getAttribute("data-def") ?? null,
      options: [...document.querySelectorAll(".petition-option")].map(option => option.textContent?.replace(/\s+/g, " ").trim() ?? ""),
      predictedLines: [...document.querySelectorAll(".petition-predicted")].map(line => line.textContent ?? "") }));
    await close();
  });
}

// The QA info overlay: the key on, a carter selected (paused, so the carter stays under the click).
await step("qa-overlay", async () => {
  const { page, close } = await scene(town1380, 1600, 1100);
  await page.keyboard.press("Backquote"); await page.waitForTimeout(600);
  if (await page.locator(".qa-overlay").count() === 0) { result["qa-overlay"] = "no overlay in this build"; await close(); return; }
  const walkers = await page.evaluate(() => (window as unknown as { __FEUDAL_PHASE10_PROOF__: Proof }).__FEUDAL_PHASE10_PROOF__.state().walkers
    .filter(walker => walker.kind === "carter").map(walker => ({ id: walker.id, position: walker.position })));
  // The carter nearest the screen's centre (the camera looks at the first house).
  const [cx, cy] = houseTile(town1380.state);
  const nearest = [...walkers].sort((a, b) => Math.hypot(a.position.tx - cx!, a.position.ty - cy!) - Math.hypot(b.position.tx - cx!, b.position.ty - cy!))[0];
  if (nearest !== undefined) {
    const anchor = walkerVisualAnchor(nearest.position);
    const tile = pickTile({ x: anchor.sx, y: anchor.sy }) ?? { tx: Math.floor(nearest.position.tx), ty: Math.floor(nearest.position.ty) };
    const point = await page.evaluate(at => (window as unknown as { __FEUDAL_PHASE10_PROOF__: Proof }).__FEUDAL_PHASE10_PROOF__.tileClientPoint(at), tile);
    await page.mouse.click(point.clientX, point.clientY);
  }
  await page.waitForTimeout(900);
  await shot(page, "qa-overlay.jpg");
  result["qa-overlay"] = { walker: nearest?.id ?? null, lines: await page.evaluate(() => [...document.querySelectorAll(".qa-overlay-line")].map(line => line.textContent ?? "")) };
  await close();
});

await browser.close();
writeFileSync(join(out!, `${tag}-captures.json`), JSON.stringify({ tag, url, result, errors }, null, 1) + "\n");
console.log(JSON.stringify({ tag, errors }, null, 1));
