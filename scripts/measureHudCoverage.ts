// UX-3 gate 1 (UX3R section 9): how much of the game view the UI covers, measured per UI state x three resolutions,
// against each state's budget. A frame is shot as the player sees it, then with every DOM element but the canvas
// hidden (visibility), then again as the player sees it; a pixel is UI where the first and the hidden shots differ by
// more than THRESHOLD, the two player shots agree (so an animated pixel is never counted) and the pixel lies inside a
// visible DOM element's box (so a canvas change outside every element — the pointer's hover leaving an element as it
// hides — is not UI). Containers wider than half the view (the shell, the pause veil) are not boxes. The game runs at 1x
// (a paused game adds the pause veil, which is not HUD). New game, tutorial on; the zone state turns the tutorial
// off first (the zone layer is locked until the first mill with it on).
//  - normal: the default screen;  - build: the build drawer;  - placement: a well picked, the cursor on open ground
//    (ghost, ring, range circle and the chip);  - zone: the zone layer;  - selection: a house's inspector;
//  - ledger: the ledger drawer. Modals stop time and are exempt.
//  - normal:chapter2-wall-works (INSTALL-3b): the v24 palisade-construction town in chapter 2, its walls under
//    construction, the camera on the wall works at zoom 1 — the default screen's budget. The construction tags are drawn
//    on the canvas, so this state's hidden shot also hides them (the proof port's constructionLabels) and their boxes (the
//    port's constructionTagBoxes, the frame of the first shot) join the DOM boxes.
//  - normal:lord / build:lord / placement:lord (LM-R1): the lord's slice at its start (lord mode: the town builds itself),
//    the tutorial off — the default screen without the layer switch, the dock's 명령 opening the command pins in the
//    build drawer's place, and the pins' public work (성채) picked with the cursor on open ground. Same budgets.
// The gate is not one run: HUD-MEDIAN (docs/decisions/README.md) judges each row by the median of three runs
// (scripts/uiaudit1HudThrice.sh, then scripts/hudMedian.ts); this run's own `pass` and exit code are one sample.
//   PLAYWRIGHT_MODULE=... npx tsx scripts/measureHudCoverage.ts <out.json> --url <url> [--shots <dir>] [--only walls]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/measureHudCoverage.ts)", { remote: "scripts/remote/run.sh <세션>-<작업ID> -- node_modules/.bin/tsx scripts/measureHudCoverage.ts …", entry: import.meta.url });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

import { loadChromium, openScene } from "./renderCommitProbe.mjs";
import { CHAPTER_TWO } from "../src/content/chapterConfig";
import { isWallConstructionSite, type WallConstructionSite } from "../src/economy/construction";
import { palisadeConstructionSchedule } from "../src/economy/palisadeConstruction";
import { wallSiteLabelAnchor } from "../src/render/wallSiteLabels";
import { currentConstructionSiteLabel } from "../src/ui/constructionAccessModel";
import { WALL_SITE_LABEL_COPY } from "../src/ui/wallCarryCopy.ko";
import type { GameState } from "../src/engine/engine.types";
import { initialPolitics } from "../src/engine/politics";
import { decodeSave } from "../src/save/saveCodec";
import { LORD_SLICE_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { newGameState } from "../src/state/newGame";

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((pairs, value, index, all) => value.startsWith("--") ? [...pairs, [value.slice(2), all[index + 1]!]] : pairs, []));
const url = flags.url ?? "http://127.0.0.1:4281/";
const THRESHOLD = 24;
/** A chapter 2 town has long left the tutorial (as scripts/install3ChainCaptures.ts opens its scenes). */
const TUTORIAL_OFF = `try { localStorage.setItem('feudal-lord-simulator:tutorial:v1', JSON.stringify({ enabled: false, acks: [], pulsed: [], log: [] })); } catch (error) { void error; }`;
/** The season card / story modal a loaded town opens with is a modal (exempt, its veil dims the canvas): closed. */
async function dismissModals(page: Page): Promise<void> {
  for (const selector of [".story-modal-later", ".chronicle-page .chronicle-keep", ".season-ledger-resume"]) {
    if (await page.locator(selector).count() > 0) { await page.locator(selector).first().click(); await page.waitForTimeout(300); }
  }
}
const TOOL = ".build-tool:visible:not([aria-disabled='true']):not([disabled])";
/** Per-state budgets in percent of the view: [PC, tablet] (UX3R section 9). */
export const BUDGETS = { normal: [6, 8], build: [15, 20], placement: [6, 9], zone: [8, 12], selection: [18, 24], ledger: [25, 30] } as const;
/**
 * UI-AUDIT-1 (user decision UIAUDIT-D1): at 1280 × 800 only, normal, placement, build and zone get +0.5 pt — the area the
 * frame tokens added is the frames' own clearance (safe inset + 8 px gap), not content. 1920 and tablet keep BUDGETS.
 * Revisit build and placement when lord mode shrinks the build drawer to command pins.
 */
export const BUDGETS_1280: Partial<Record<keyof typeof BUDGETS, number>> = { normal: 6.5, placement: 6.5, build: 15.5, zone: 8.5 };
export const budgetFor = (state: keyof typeof BUDGETS, resolution: { readonly name: string; readonly touch?: boolean }): number =>
  resolution.touch ? BUDGETS[state][1] : resolution.name === "1280x800" ? BUDGETS_1280[state] ?? BUDGETS[state][0] : BUDGETS[state][0];
type StateName = keyof typeof BUDGETS;
const RESOLUTIONS = [
  { name: "1280x800", width: 1280, height: 800, touch: false },
  { name: "1920x1080", width: 1920, height: 1080, touch: false },
  { name: "tablet-1180x820", width: 1180, height: 820, touch: true },
] as const;
type Page = { click: (s: string) => Promise<void>; locator: (s: string) => { count: () => Promise<number>; first: () => { click: () => Promise<void> }; nth: (i: number) => { click: () => Promise<void> } };
  keyboard: { press: (key: string) => Promise<void> };
  waitForFunction: (f: () => boolean, arg: null, options: { timeout: number }) => Promise<unknown>;
  evaluate: <T>(f: (...a: never[]) => T | Promise<T>, arg?: unknown) => Promise<T>; screenshot: (o: object) => Promise<Buffer>; waitForTimeout: (ms: number) => Promise<void>;
  mouse: { move: (x: number, y: number) => Promise<void>; click: (x: number, y: number) => Promise<void> }; addStyleTag: (o: object) => Promise<{ evaluate: (f: (e: Element) => void) => Promise<void> }> };

/** PNG (8-bit RGBA or RGB, no interlace) -> pixels. */
function decode(png: Buffer): { width: number; height: number; channels: number; data: Uint8Array } {
  let offset = 8, width = 0, height = 0, channels = 4; const chunks: Buffer[] = [];
  while (offset < png.length) {
    const length = png.readUInt32BE(offset); const type = png.subarray(offset + 4, offset + 8).toString("ascii");
    const body = png.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") { width = body.readUInt32BE(0); height = body.readUInt32BE(4); channels = body[9] === 2 ? 3 : 4; }
    if (type === "IDAT") chunks.push(body);
    offset += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(chunks)); const stride = width * channels; const data = new Uint8Array(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]!; const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? data[y * stride + x - channels]! : 0; const up = y > 0 ? data[(y - 1) * stride + x]! : 0;
      const upLeft = x >= channels && y > 0 ? data[(y - 1) * stride + x - channels]! : 0;
      const p = left + up - upLeft; const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
      const paeth = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      data[y * stride + x] = (line[x]! + [0, left, up, (left + up) >> 1, paeth][filter]!) & 255;
    }
  }
  return { width, height, channels, data };
}

type Box = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
function covered(shown: Buffer, hidden: Buffer, again: Buffer, boxes: readonly Box[], tagBoxes: readonly Box[] = []): { fraction: number; tagFraction: number; mask: Uint8Array; width: number; height: number } {
  const a = decode(shown), b = decode(hidden), c = decode(again);
  const inside = new Uint8Array(a.width * a.height);
  // 1 = inside a DOM box, 2 = inside a canvas tag's box only (INSTALL-3b: counted apart as the tags' share).
  for (const box of tagBoxes) {
    for (let y = Math.max(0, Math.floor(box.y)); y < Math.min(a.height, Math.ceil(box.y + box.h)); y += 1) inside.fill(2, y * a.width + Math.max(0, Math.floor(box.x)), y * a.width + Math.min(a.width, Math.ceil(box.x + box.w)));
  }
  for (const box of boxes) {
    for (let y = Math.max(0, Math.floor(box.y)); y < Math.min(a.height, Math.ceil(box.y + box.h)); y += 1) inside.fill(1, y * a.width + Math.max(0, Math.floor(box.x)), y * a.width + Math.min(a.width, Math.ceil(box.x + box.w)));
  }
  const mask = new Uint8Array(a.width * a.height); let count = 0, tagCount = 0;
  for (let i = 0; i < a.width * a.height; i += 1) {
    if (inside[i] === 0) continue;
    let differs = false, stable = true;
    for (let k = 0; k < 3; k += 1) {
      const va = a.data[i * a.channels + k]!;
      if (Math.abs(va - b.data[i * b.channels + k]!) > THRESHOLD) differs = true;
      if (Math.abs(va - c.data[i * c.channels + k]!) > THRESHOLD) stable = false;
    }
    if (differs && stable) { mask[i] = 1; count += 1; if (inside[i] === 2) tagCount += 1; }
  }
  return { fraction: count / (a.width * a.height), tagFraction: tagCount / (a.width * a.height), mask, width: a.width, height: a.height };
}

async function measure(page: Page, name: StateName, shots: string | undefined, label: string, cursor: { x: number; y: number }, canvasTags = false) {
  type TagPort = { __FEUDAL_PHASE10_PROOF__: { constructionLabels: (s: boolean) => void; constructionTagBoxes: () => readonly Box[] } };
  const tagBoxes = () => page.evaluate(() => (window as unknown as TagPort).__FEUDAL_PHASE10_PROOF__.constructionTagBoxes().map(box => ({ ...box })));
  if (canvasTags) await tagBoxes(); // starts the recording
  await page.mouse.move(cursor.x, cursor.y); await page.waitForTimeout(400);
  const shown = await page.screenshot({ type: "png" });
  // The tags drawn in the frame the shot shows (1 px out for the ink outline).
  const tags = canvasTags ? (await tagBoxes()).map(box => ({ x: box.x - 1, y: box.y - 1, w: box.w + 2, h: box.h + 2 })) : [];
  const boxes = await page.evaluate(() => {
    const view = window.innerWidth * window.innerHeight;
    return [...document.querySelectorAll("body *")].flatMap(element => {
      if (element instanceof HTMLCanvasElement) return [];
      const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
      // checkVisibility also drops the content of a closed <details> (the settings popover keeps a 236 x 539 box).
      if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || style.display === "none" || rect.width * rect.height === 0 || rect.width * rect.height > view / 2) return [];
      return [{ x: rect.x, y: rect.y, w: rect.width, h: rect.height }];
    });
  });
  const style = await page.addStyleTag({ content: "*{visibility:hidden!important;transition:none!important}canvas{visibility:visible!important}" });
  const showTags = (shown: boolean) => page.evaluate(on => (window as unknown as TagPort).__FEUDAL_PHASE10_PROOF__.constructionLabels(on), shown);
  if (canvasTags) await showTags(false);
  await page.waitForTimeout(150);
  const hidden = await page.screenshot({ type: "png" });
  await style.evaluate(element => element.remove());
  if (canvasTags) await showTags(true);
  await page.waitForTimeout(250);
  const again = await page.screenshot({ type: "png" });
  const result = covered(shown, hidden, again, boxes, tags);
  if (shots !== undefined) { mkdirSync(shots, { recursive: true }); writeFileSync(join(shots, `${label}-${name}.png`), shown); writeFileSync(join(shots, `${label}-${name}-mask.pgm`), Buffer.concat([Buffer.from(`P5 ${result.width} ${result.height} 1\n`), Buffer.from(result.mask)])); }
  return { state: name, percent: Math.round(result.fraction * 1000) / 10,
    ...(canvasTags ? { canvasTags: tags.length, tagPercent: Math.round(result.tagFraction * 1000) / 10 } : {}) };
}

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
type Row = { resolution: string; state: StateName; view?: string; percent: number; budget: number; pass: boolean; canvasTags?: number; tagPercent?: number; beforeTags?: { tags: number; percent: number } };
const rows: Row[] = [];
type Proof = { __FEUDAL_PHASE10_PROOF__: { tileClientPoint: (t: object) => { clientX: number; clientY: number } } };
// The chapter 2 town under wall construction (as scripts/install3States.ts sets it) and its works' middle.
const wallTown = (() => {
  const saved = decodeSave(new Uint8Array(readFileSync("fixtures/saves/v24/palisade-construction.save.json"))).envelope.state as GameState;
  const politics = initialPolitics(saved);
  return { ...saved, politics: { ...politics, chapter: { ...politics.chapter, number: CHAPTER_TWO.chapter } } } as GameState;
})();
const wallSites = wallTown.constructionSites.filter(isWallConstructionSite);
const segmentTagBefore = (site: WallConstructionSite) => {
  const schedule = palisadeConstructionSchedule(site, wallTown.constructionSites);
  return schedule.kind === "queued" ? WALL_SITE_LABEL_COPY.queued(schedule.position) : currentConstructionSiteLabel(wallTown, site);
};
// LM-R1: the lord's slice at its start, the camera on its manor house.
const lordTown = newGameState({ scenarioId: LORD_SLICE_SCENARIO_ID })!;
const lordSeat = lordTown.buildings.find(building => building.kind === "manor_house") ?? lordTown.buildings[0]!;
const lordTile = [lordSeat.tx, lordSeat.ty];
const wallMiddle = [wallSites.reduce((sum, site) => sum + site.anchor.tx, 0) / wallSites.length, wallSites.reduce((sum, site) => sum + site.anchor.ty, 0) / wallSites.length];
for (const resolution of RESOLUTIONS) {
  // `--only walls` / `--only lord`: the chapter 2 wall works or the lord-mode states alone.
  if (flags.only !== "walls" && flags.only !== "lord") {
  const { context, page } = await openScene(browser, { state: null, tile: [45, 41], baseUrl: url, width: resolution.width, height: resolution.height, dpr: 1, zoom: 1, run: true, hasTouch: resolution.touch }) as { context: { close: () => Promise<void> }; page: Page };
  // The steward's new line is a transient (one line, 8 s, UX3R 7): the normal state is measured once it has folded.
  await page.waitForTimeout(2_500);
  await page.waitForFunction(() => document.querySelector(".steward-bubble") === null, null, { timeout: 12_000 }).catch(() => undefined);
  const point = async (tx: number, ty: number) => { const p = await page.evaluate(t => (window as unknown as Proof).__FEUDAL_PHASE10_PROOF__.tileClientPoint(t), { tx, ty }); return { x: p.clientX, y: p.clientY }; };
  // The cursor rests on open grass (a screen edge would pan the running game; a building would raise its hover card).
  const rest = await point(38, 46);
  const push = async (name: StateName, cursor?: { x: number; y: number }, view?: string) => {
    const measured = await measure(page, name, flags.shots, view === undefined ? resolution.name : `${resolution.name}-${view}`, cursor ?? rest);
    const budget = budgetFor(name, resolution);
    rows.push({ resolution: resolution.name, ...measured, ...(view === undefined ? {} : { view }), budget, pass: measured.percent <= budget });
  };
  await dismissModals(page);
  await push("normal");
  await dismissModals(page);
  await page.locator("[data-dock='build']").first().click(); await page.waitForTimeout(400); await push("build");
  await page.locator(TOOL).nth(1).click(); await page.waitForTimeout(300); await push("placement", await point(40, 44));
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(400); await push("ledger");
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(300);
  const house = await point(44, 42);
  await page.mouse.click(house.x, house.y - 8); await page.waitForTimeout(500); await push("selection");
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  // UX-3R2: the storage inspector (the granary's card: capacity, items, week, users) is a selection too.
  const granaryTile = await page.evaluate(() => { const s = (window as unknown as { __FEUDAL_PHASE10_PROOF__: { state: () => { buildings: { kind: string; tx: number; ty: number }[] } } }).__FEUDAL_PHASE10_PROOF__.state(); const g = s.buildings.find(b => b.kind === "granary")!; return { tx: g.tx, ty: g.ty }; });
  const granary = await point(granaryTile.tx, granaryTile.ty);
  await page.mouse.click(granary.x, granary.y - 10); await page.waitForTimeout(500); await push("selection", undefined, "store");
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  // The zone layer opens with the tutorial off (pause menu switch), then back to play.
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.locator(".pause-menu .tutorial-switch").first().click(); await page.waitForTimeout(200);
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.locator("[data-layer='zone']").first().click(); await page.waitForTimeout(500); await push("zone");
  // UX-3R2: with a kind armed the zone state also shows the land legend under the chips (the toolbar is always up).
  await page.locator("[data-zone-tool='arable']").first().click(); await page.waitForTimeout(400); await push("zone", undefined, "armed");
  await context.close();
  }
  // LM-R1: lord mode (the lord's slice at its start): its normal screen, the command pins, a public work being placed.
  if (flags.only !== "walls") {
    const lord = await openScene(browser, { state: lordTown, tile: lordTile, baseUrl: url, width: resolution.width, height: resolution.height, dpr: 1, zoom: 1, run: true, hasTouch: resolution.touch,
      query: "&story-delay=600000&weather=none", initScript: TUTORIAL_OFF }) as { context: { close: () => Promise<void> }; page: Page };
    await dismissModals(lord.page);
    await lord.page.waitForTimeout(2_500);
    await dismissModals(lord.page);
    await lord.page.waitForFunction(() => document.querySelector(".steward-bubble") === null, null, { timeout: 12_000 }).catch(() => undefined);
    const lordPoint = async (tx: number, ty: number) => { const p = await lord.page.evaluate(t => (window as unknown as Proof).__FEUDAL_PHASE10_PROOF__.tileClientPoint(t), { tx, ty }); return { x: p.clientX, y: p.clientY }; };
    const lordRest = await lordPoint(lordTile[0]! - 6, lordTile[1]! + 4);
    const lordPush = async (name: StateName, cursor: { x: number; y: number }) => {
      const measured = await measure(lord.page, name, flags.shots, `${resolution.name}-lord`, cursor);
      rows.push({ resolution: resolution.name, ...measured, view: "lord", budget: budgetFor(name, resolution), pass: measured.percent <= budgetFor(name, resolution) });
    };
    await lordPush("normal", lordRest);
    await lord.page.locator("[data-dock='build']").first().click(); await lord.page.waitForTimeout(400); await lordPush("build", lordRest);
    await lord.page.locator(".command-pin[data-command-pin='work:keep']").first().click(); await lord.page.waitForTimeout(300); await lordPush("placement", await lordPoint(lordTile[0]! - 4, lordTile[1]! + 3));
    await lord.context.close();
  }
  if (flags.only === "lord") continue;
  // INSTALL-3b: chapter 2 with its walls under construction (the tags on the canvas count; see the header).
  const walls = await openScene(browser, { state: wallTown, tile: wallMiddle, baseUrl: url, width: resolution.width, height: resolution.height, dpr: 1, zoom: 1, run: true, hasTouch: resolution.touch,
    query: "&story-delay=600000&weather=none", initScript: TUTORIAL_OFF }) as { context: { close: () => Promise<void> }; page: Page };
  // The season card the loaded town opens with is a modal (exempt, and its veil dims the whole canvas): closed first.
  await dismissModals(walls.page);
  await walls.page.waitForTimeout(2_500);
  // UI-AUDIT-1: the season card can open about 1 s after load, after the first check — close it again after the wait.
  await dismissModals(walls.page);
  await walls.page.waitForFunction(() => document.querySelector(".steward-bubble") === null, null, { timeout: 12_000 }).catch(() => undefined);
  const wallView = "chapter2-wall-works";
  // Before INSTALL-3b every segment raised its own tag: those whose anchor is on this screen, and their boxes' summed
  // area (text measured in the page, the drawTag box: text + 8 by 18 px at zoom 1; overlaps counted twice).
  const segmentTags = wallSites.map(site => ({ site, text: segmentTagBefore(site) })).filter(entry => entry.text !== "").filter(entry => {
    const anchor = wallSiteLabelAnchor(entry.site);
    const x = anchor.x + resolution.width / 2 - (wallMiddle[0]! - wallMiddle[1]!) * 32, y = anchor.y + resolution.height / 2 - (wallMiddle[0]! + wallMiddle[1]!) * 16;
    return x >= 0 && x <= resolution.width && y >= 0 && y <= resolution.height;
  });
  const widths = await walls.page.evaluate((texts: readonly string[]) => { const context = document.createElement("canvas").getContext("2d")!; context.font = "12px Georgia, serif"; return texts.map(text => Math.ceil(context.measureText(text).width)); }, segmentTags.map(entry => entry.text));
  const beforeTags = { tags: segmentTags.length, percent: Math.round(widths.reduce((sum: number, width: number) => sum + (width + 8) * 18, 0) * 1000 / (resolution.width * resolution.height)) / 10 };
  const measured = await measure(walls.page, "normal", flags.shots, `${resolution.name}-${wallView}`, { x: 200, y: 40 }, true);
  rows.push({ resolution: resolution.name, ...measured, view: wallView, beforeTags, budget: budgetFor("normal", resolution), pass: measured.percent <= budgetFor("normal", resolution) });
  await walls.context.close();
}
await browser.close();
const pass = rows.every(row => row.pass);
writeFileSync(out!, JSON.stringify({ url, threshold: THRESHOLD, budgets: BUDGETS, budgets1280: BUDGETS_1280, pass, rows }, null, 1) + "\n");
for (const row of rows) console.log(`${row.resolution.padEnd(16)} ${`${row.state}${row.view === undefined ? "" : `:${row.view}`}`.padEnd(16)} ${String(row.percent).padStart(5)} % / ${row.budget} % ${row.pass ? "ok" : "OVER"}`
  + (row.tagPercent === undefined ? "" : ` (canvas tags ${row.canvasTags}: ${row.tagPercent} %; before INSTALL-3b ${row.beforeTags?.tags} segment tags ≈ ${row.beforeTags?.percent} %)`));
if (!pass) process.exitCode = 1;
