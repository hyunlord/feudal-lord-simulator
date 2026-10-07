// LM-R2 (negotiation) captures — the wave35-negotiation spec's 캡처 관문 (docs/ops/install-plan-20261003/SPECS/wave35-negotiation.md)
// on the lord screen's 혼인 item, in the game, paused, the story quiet, 1280 × 800 DPR 1 unless named:
//  1. empty-offer: the lord's slice before any offer (LM-R1 `lord-receipts`): the consent row alone, the offer shut (no terms);
//  2. tier-impossible / tier-close / tier-likely: the same draft edited on screen by the clause buttons — the counterpart's
//     word, then political support, then a debt repaid after the inheritance (+£1 twice): evaluateOffer's three tiers;
//  3. divider-long: every clause the editor offers switched on (the long treaty) — the centre line still 16 px wide
//     (divider-short is the empty offer's);
//  4. counter-rejected: a wardship (the counterpart's red line) sent — answered at once with a counter that drops it (the
//     rejected row) and asks a deferred debt (the changed row); answer-accept: that counter accepted — the contract, stamped;
//  5. counter-changed: the lord2 `offer-countered` state (the counter real play left waiting: one clause added);
//     answer-refuse: that counter refused — the draft again, the answer written above it, the seal broken;
//  6. counter-tablet-dpr2: the counter at 1180 × 820, DPR 2, by touch;
//  7. timeline-will-change / timeline-contested: the marriage's progress on lord2 `will-change` and `contested` (the way to
//     the suit pressed: the ledger screen asked for, with the suit's id);
//  8. art-missing: the treaty frame answered 404 — the kit frame and every line still there.
// Each shot's facts (phase, tier, rows and marks, seal, the divider's box, the art's HTTP answers) go to captures.json; a
// missing fact fails the run.
//   PLAYWRIGHT_MODULE=… npx tsx scripts/lmr2NegotiationCaptures.ts <out> --lord <lord states dir> --lord2 <lord2 states dir> [--port <port>]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/lmr2NegotiationCaptures.ts)", { remote: "scripts/remote/run.sh render-LMR2-negotiation-<sha7> -- node_modules/.bin/tsx scripts/lmr2NegotiationCaptures.ts …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadChromium, openScene } from "./renderCommitProbe.mjs";
import { spawnServer } from "./serverProcess";

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
type Locator = {
  first: () => Locator; click: (options?: object) => Promise<void>; tap: () => Promise<void>; count: () => Promise<number>;
  waitFor: (options?: object) => Promise<void>; boundingBox: () => Promise<Box | null>; scrollIntoViewIfNeeded: () => Promise<void>;
};
type Route = { fulfill: (options: object) => Promise<void> };
type Response = { url: () => string; status: () => number };
type Page = {
  locator: (selector: string) => Locator; waitForTimeout: (ms: number) => Promise<void>; screenshot: (options: object) => Promise<Buffer>;
  evaluate: <T, A>(fn: (arg: A) => T, arg: A) => Promise<T>; route: (pattern: string, handler: (route: Route) => unknown) => Promise<void>;
  on: (event: "response", handler: (response: Response) => void) => void; viewportSize: () => { width: number; height: number } | null;
};
type State = { readonly buildings: readonly { readonly kind: string; readonly tx: number; readonly ty: number }[] };

const [out] = process.argv.slice(2);
const flag = (name: string) => { const index = process.argv.indexOf(`--${name}`); return index > 0 ? process.argv[index + 1] : undefined; };
const lordDir = flag("lord"); const lord2Dir = flag("lord2");
if (out === undefined || lordDir === undefined || lord2Dir === undefined) throw new Error("usage: lmr2NegotiationCaptures.ts <out> --lord <dir> --lord2 <dir>");
const port = Number(flag("port") ?? process.env.FLS_REMOTE_PORT ?? 4391);
mkdirSync(out, { recursive: true });
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
const NAME_SHIM = "globalThis.__name = globalThis.__name || (target => target);";
const load = (dir: string, name: string): State => JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8")) as State;
const pause = (ms: number) => new Promise(done => setTimeout(done, ms));

const vite = spawnServer("node_modules/.bin/vite", ["--config", "scripts/remote/viteNoWatch.config.ts", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { stdio: "ignore" });
const url = `http://127.0.0.1:${port}/`;
for (let tries = 0; tries < 90; tries += 1) {
  try { if ((await fetch(url)).ok) break; } catch { /* not up yet */ }
  await pause(1_000);
}

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows: Record<string, unknown>[] = [];
const failures: string[] = [];
const expect = (name: string, ok: boolean, what: string) => { if (!ok) failures.push(`${name}: ${what}`); };

type Scene = { readonly context: { close: () => Promise<void> }; readonly page: Page; readonly art: [string, number][] };
async function scene(state: State, { width = 1280, height = 800, dpr = 1, touch = false, block = null as string | null } = {}): Promise<Scene> {
  const house = state.buildings.find(building => building.kind === "house") ?? state.buildings[0] ?? { tx: 32, ty: 32 };
  const opened = await openScene(browser, { state, tile: [house.tx, house.ty], baseUrl: url, width, height, dpr, zoom: 1.1, run: false, hasTouch: touch,
    loadTimeout: 120_000, initScript: `${NAME_SHIM}${TUTORIAL_OFF}`, query: "&story-delay=600000" });
  const page = opened.page as Page;
  const art: [string, number][] = [];
  page.on("response", response => { if (response.url().includes("lord-ui/wave35-negotiation")) art.push([response.url().replace(/^.*assets\//, ""), response.status()]); });
  if (block !== null) await page.route(`**/${block}`, route => route.fulfill({ status: 404, body: "" }));
  return { context: opened.context, page, art };
}
const press = async (page: Page, selector: string, touch = false) => {
  const target = page.locator(selector).first();
  if (touch) await target.tap(); else await target.click();
  await pause(250);
};
/** Into the lord screen's 혼인 item (the ledger's lord tab, the way in, the menu item); waits for the parts to settle. */
async function openMarriage(page: Page, touch = false): Promise<void> {
  for (const selector of ["[data-dock='ledger']", "[data-ledger-tab='lord']", "[data-lord-open]", "[data-lord-nav='marriage']"]) await press(page, selector, touch);
  await page.locator(".lord-neg").first().waitFor({ timeout: 15_000 });
  for (let tries = 0; tries < 40 && await page.locator(".lord-neg-treaty[data-art='none']").count() > 0; tries += 1) await pause(250);
  await pause(500);
}
const facts = (page: Page) => page.evaluate(() => {
  const root = document.querySelector(".lord-neg");
  const attr = (selector: string, name: string) => root?.querySelector(selector)?.getAttribute(name) ?? null;
  const box = (selector: string) => { const node = root?.querySelector(selector); if (node === null || node === undefined) return null;
    const rect = node.getBoundingClientRect(); return { width: Math.round(rect.width * 10) / 10, height: Math.round(rect.height * 10) / 10 }; };
  const treaty = root?.querySelector(".lord-neg-treaty");
  return {
    phase: root?.getAttribute("data-neg-phase") ?? null, tier: attr(".lord-neg-acceptance", "data-tier"), refusal: attr(".lord-neg-refusal", "data-refusal"),
    sendShut: root?.querySelector(".lord-neg-send")?.hasAttribute("disabled") ?? null, answer: attr(".lord-neg-answer", "data-answer"),
    rows: [...(root?.querySelectorAll(".lord-neg-treaty .lord-neg-row") ?? [])].map(node => `${node.getAttribute("data-clause")}:${node.getAttribute("data-mark")}`),
    reasons: [...(root?.querySelectorAll(".lord-neg-reason") ?? [])].map(node => `${node.getAttribute("data-reason")}:${node.getAttribute("data-sign")}`),
    seal: attr(".lord-neg-seal", "data-seal"), sealArt: attr(".lord-neg-seal", "data-art"),
    treatyArt: treaty?.getAttribute("data-art") ?? null, treatyFrame: treaty?.getAttribute("data-frame") ?? null,
    treatyBorderImage: treaty === null || treaty === undefined ? null : getComputedStyle(treaty).borderImageSource.replace(/^.*\//, "").replace(/"?\)$/, ""),
    divider: box(".lord-neg-divider"), dividerArt: attr(".lord-neg-divider", "data-art"), scaleArt: attr(".lord-neg-scale", "data-art"),
    stage: attr(".lord-neg-timeline", "data-stage"), due: attr(".lord-neg-due", "data-due"), suit: attr(".lord-neg-open-suit", "data-open-suit"),
    natives: root?.querySelectorAll("input, select, textarea").length ?? null,
    primaries: root?.querySelectorAll(".ui-btn--primary").length ?? null,
  };
}, undefined);
type Facts = Awaited<ReturnType<typeof facts>>;

/** The lord screen, its content scrolled so `focus` is in view. */
async function shot(page: Page, name: string, focus: string | null, quality = 42): Promise<string> {
  if (focus !== null) {
    await page.evaluate(selector => { document.querySelector(selector)?.scrollIntoView({ block: "center" }); }, focus);
    await pause(300);
  }
  const box = await page.locator(".slot-panel.lord-screen").first().boundingBox();
  const viewport = page.viewportSize();
  if (box === null || viewport === null) throw new Error(`${name}: no lord screen`);
  const left = Math.max(0, Math.floor(box.x)); const top = Math.max(0, Math.floor(box.y));
  const clip = { x: left, y: top, width: Math.min(viewport.width, Math.ceil(box.x + box.width)) - left, height: Math.min(viewport.height, Math.ceil(box.y + box.height)) - top };
  const file = `${name}.jpg`;
  writeFileSync(join(out!, file), await page.screenshot({ type: "jpeg", quality, clip }));
  return file;
}
async function record(sceneNow: Scene, name: string, focus: string | null, extra: Record<string, unknown> = {}, quality?: number): Promise<Facts> {
  const seen = await facts(sceneNow.page);
  const file = await shot(sceneNow.page, name, focus, quality);
  rows.push({ name, file, ...extra, ...seen, art: [...sceneNow.art] });
  return seen;
}
const sixteen = (seen: Facts) => seen.divider !== null && seen.divider.width === 16;

const lord = load(lordDir, "lord-receipts");
const countered = load(lord2Dir, "offer-countered");
try {
  // 1–3. The draft: empty, the three tiers by editing, every clause on.
  {
    const now = await scene(lord);
    await openMarriage(now.page);
    const empty = await record(now, "empty-offer", ".lord-neg-treaty", { state: "lord/lord-receipts" });
    expect("empty-offer", empty.phase === "draft" && empty.refusal === "no_terms" && empty.sendShut === true && empty.rows.join() === "consent:same", JSON.stringify(empty));
    expect("empty-offer", empty.treatyArt === "drawn" && empty.sealArt === "drawn" && empty.seal === "empty", `art ${empty.treatyArt} seal ${empty.seal}/${empty.sealArt}`);
    expect("divider-short", sixteen(empty) && empty.dividerArt === "drawn", JSON.stringify(empty.divider));
    expect("empty-offer", empty.natives === 0 && empty.primaries === 1, `natives ${empty.natives}, primaries ${empty.primaries}`);
    await press(now.page, "[data-switch='inheritance_non_infringement']"); await press(now.page, "[data-switch='residence']");
    const impossible = await record(now, "tier-impossible", ".lord-neg-acceptance");
    expect("tier-impossible", impossible.tier === "impossible" && impossible.refusal === null && impossible.sendShut === false && impossible.scaleArt === "drawn", JSON.stringify(impossible));
    await press(now.page, "[data-switch='inheritance_non_infringement']"); await press(now.page, "[data-switch='residence']");
    await press(now.page, "[data-switch='political_support']");
    const close = await record(now, "tier-close", ".lord-neg-acceptance");
    expect("tier-close", close.tier === "close", JSON.stringify(close));
    await press(now.page, "[data-switch='political_support']");
    await press(now.page, "[data-clause='debt_after_inheritance'] [data-step='240']"); await press(now.page, "[data-clause='debt_after_inheritance'] [data-step='240']");
    const likely = await record(now, "tier-likely", ".lord-neg-acceptance");
    expect("tier-likely", likely.tier === "likely" && likely.rows.includes("debt_after_inheritance:same"), JSON.stringify(likely));
    for (const selector of ["[data-clause='cash'] [data-step='12']", "[data-switch='jointure']", "[data-clause='pension'] [data-step='12']",
      "[data-switch='political_support']", "[data-switch='inheritance_non_infringement']", "[data-switch='residence']"]) await press(now.page, selector);
    const long = await record(now, "divider-long", ".lord-neg-sides");
    expect("divider-long", sixteen(long) && long.rows.length >= 8, `${JSON.stringify(long.divider)} rows ${long.rows.length}`);
    await now.context.close();
  }
  // 4. A red line sent: the counter answers at once (rejected and changed rows), then accepted.
  {
    const now = await scene(lord);
    await openMarriage(now.page);
    await press(now.page, "[data-switch='wardship']");
    await press(now.page, ".lord-neg-send"); await pause(600);
    const rejected = await record(now, "counter-rejected", ".lord-neg-treaty");
    expect("counter-rejected", rejected.phase === "countered" && rejected.rows.includes("wardship:rejected") && rejected.rows.some(row => row.endsWith(":changed")), JSON.stringify(rejected));
    expect("counter-rejected", rejected.primaries === 0 && rejected.answer === "countered", `primaries ${rejected.primaries}, answer ${rejected.answer}`);
    await press(now.page, "[data-answer-counter='accept']"); await pause(600);
    const accepted = await record(now, "answer-accept", ".lord-neg-treaty");
    expect("answer-accept", accepted.phase === "contract" && accepted.stage === "contracted" && accepted.seal === "stamped" && accepted.answer === "accepted", JSON.stringify(accepted));
    await now.context.close();
  }
  // 5. The counter real play left waiting, then refused.
  {
    const now = await scene(countered);
    await openMarriage(now.page);
    const changed = await record(now, "counter-changed", ".lord-neg-treaty", { state: "lord2/offer-countered" });
    expect("counter-changed", changed.phase === "countered" && changed.rows.includes("debt_after_inheritance:changed") && !changed.rows.some(row => row.endsWith(":rejected")), JSON.stringify(changed));
    await press(now.page, "[data-answer-counter='refuse']"); await pause(600);
    const refused = await record(now, "answer-refuse", ".lord-neg-head");
    expect("answer-refuse", refused.phase === "draft" && refused.answer === "withdrawn" && refused.seal === "broken", JSON.stringify(refused));
    await now.context.close();
  }
  // 6. Tablet, DPR 2, by touch.
  {
    const now = await scene(countered, { width: 1180, height: 820, dpr: 2, touch: true });
    await openMarriage(now.page, true);
    const tablet = await record(now, "counter-tablet-dpr2", ".lord-neg-answers", { viewport: "1180x820", dpr: 2 }, 28);
    expect("counter-tablet-dpr2", tablet.phase === "countered" && sixteen(tablet), JSON.stringify(tablet));
    await now.context.close();
  }
  // 7. The marriage's progress: the will change due; the contest and the way to its suit.
  for (const name of ["will-change", "contested"]) {
    const now = await scene(load(lord2Dir, name));
    await openMarriage(now.page);
    const seen = await record(now, `timeline-${name}`, ".lord-neg-timeline", { state: `lord2/${name}` });
    expect(`timeline-${name}`, seen.phase === "contract" && seen.due === (name === "will-change" ? "will_change" : "contested") && seen.seal === "stamped", JSON.stringify(seen));
    if (name === "contested") {
      expect("timeline-contested", seen.suit !== null, "the suit link");
      await press(now.page, ".lord-neg-open-suit"); await pause(500);
      const asked = await now.page.evaluate(() => document.querySelector(".lord-screen")?.getAttribute("data-lord-screen") ?? null, undefined);
      rows.push({ name: "open-suit", file: null, suit: seen.suit, shownScreen: asked,
        note: "the ledger screen is lmr2-ledger's; on this branch its gate is the scaffold's 준비 중, so the host shows the first open screen" });
    }
    await now.context.close();
  }
  // 8. The treaty frame missing: the kit frame stands in, every line stays.
  {
    const now = await scene(lord, { block: "lord-ui/wave35-negotiation/treaty_frame.png" });
    await openMarriage(now.page);
    const missing = await record(now, "art-missing", ".lord-neg-treaty");
    expect("art-missing", missing.treatyArt === "none" && missing.treatyFrame === "light" && missing.phase === "draft" && missing.rows.length > 0, JSON.stringify(missing));
    await now.context.close();
  }
} catch (error) {
  failures.push(`run: ${String(error).slice(0, 400)}`);
} finally {
  await browser.close();
  vite.kill("SIGTERM");
}
writeFileSync(join(out, "captures.json"), `${JSON.stringify({ rows, failures }, null, 1)}\n`);
console.log(rows.map(row => row.file).filter(Boolean).join(" "));
if (failures.length > 0) { console.error(failures.join("\n")); process.exitCode = 1; }
