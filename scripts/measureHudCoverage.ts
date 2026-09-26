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
//   PLAYWRIGHT_MODULE=... npx tsx scripts/measureHudCoverage.ts <out.json> --url <url> [--shots <dir>]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inflateSync } from "node:zlib";

// @ts-expect-error plain JS helper
import { loadChromium, openScene } from "./renderCommitProbe.mjs";

const [out] = process.argv.slice(2);
const flags = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((pairs, value, index, all) => value.startsWith("--") ? [...pairs, [value.slice(2), all[index + 1]!]] : pairs, []));
const url = flags.url ?? "http://127.0.0.1:4281/";
const THRESHOLD = 24;
const TOOL = ".build-tool:visible:not([aria-disabled='true']):not([disabled])";
/** Per-state budgets in percent of the view: [PC, tablet] (UX3R section 9). */
export const BUDGETS = { normal: [6, 8], build: [15, 20], placement: [6, 9], zone: [8, 12], selection: [18, 24], ledger: [25, 30] } as const;
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
function covered(shown: Buffer, hidden: Buffer, again: Buffer, boxes: readonly Box[]): { fraction: number; mask: Uint8Array; width: number; height: number } {
  const a = decode(shown), b = decode(hidden), c = decode(again);
  const inside = new Uint8Array(a.width * a.height);
  for (const box of boxes) {
    for (let y = Math.max(0, Math.floor(box.y)); y < Math.min(a.height, Math.ceil(box.y + box.h)); y += 1) inside.fill(1, y * a.width + Math.max(0, Math.floor(box.x)), y * a.width + Math.min(a.width, Math.ceil(box.x + box.w)));
  }
  const mask = new Uint8Array(a.width * a.height); let count = 0;
  for (let i = 0; i < a.width * a.height; i += 1) {
    if (inside[i] === 0) continue;
    let differs = false, stable = true;
    for (let k = 0; k < 3; k += 1) {
      const va = a.data[i * a.channels + k]!;
      if (Math.abs(va - b.data[i * b.channels + k]!) > THRESHOLD) differs = true;
      if (Math.abs(va - c.data[i * c.channels + k]!) > THRESHOLD) stable = false;
    }
    if (differs && stable) { mask[i] = 1; count += 1; }
  }
  return { fraction: count / (a.width * a.height), mask, width: a.width, height: a.height };
}

async function measure(page: Page, name: StateName, shots: string | undefined, label: string, cursor: { x: number; y: number }) {
  await page.mouse.move(cursor.x, cursor.y); await page.waitForTimeout(400);
  const shown = await page.screenshot({ type: "png" });
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
  await page.waitForTimeout(150);
  const hidden = await page.screenshot({ type: "png" });
  await style.evaluate(element => element.remove()); await page.waitForTimeout(250);
  const again = await page.screenshot({ type: "png" });
  const result = covered(shown, hidden, again, boxes);
  if (shots !== undefined) { mkdirSync(shots, { recursive: true }); writeFileSync(join(shots, `${label}-${name}.png`), shown); writeFileSync(join(shots, `${label}-${name}-mask.pgm`), Buffer.concat([Buffer.from(`P5 ${result.width} ${result.height} 1\n`), Buffer.from(result.mask)])); }
  return { state: name, percent: Math.round(result.fraction * 1000) / 10 };
}

const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
type Row = { resolution: string; state: StateName; view?: string; percent: number; budget: number; pass: boolean };
const rows: Row[] = [];
type Proof = { __FEUDAL_PHASE10_PROOF__: { tileClientPoint: (t: object) => { clientX: number; clientY: number } } };
for (const resolution of RESOLUTIONS) {
  const { context, page } = await openScene(browser, { state: null, tile: [45, 41], baseUrl: url, width: resolution.width, height: resolution.height, dpr: 1, zoom: 1, run: true, hasTouch: resolution.touch }) as { context: { close: () => Promise<void> }; page: Page };
  // The steward's new line is a transient (one line, 8 s, UX3R 7): the normal state is measured once it has folded.
  await page.waitForTimeout(2_500);
  await page.waitForFunction(() => document.querySelector(".steward-bubble") === null, null, { timeout: 12_000 }).catch(() => undefined);
  const point = async (tx: number, ty: number) => { const p = await page.evaluate(t => (window as unknown as Proof).__FEUDAL_PHASE10_PROOF__.tileClientPoint(t), { tx, ty }); return { x: p.clientX, y: p.clientY }; };
  // The cursor rests on open grass (a screen edge would pan the running game; a building would raise its hover card).
  const rest = await point(38, 46);
  const push = async (name: StateName, cursor?: { x: number; y: number }, view?: string) => {
    const measured = await measure(page, name, flags.shots, view === undefined ? resolution.name : `${resolution.name}-${view}`, cursor ?? rest);
    const budget = BUDGETS[name][resolution.touch ? 1 : 0];
    rows.push({ resolution: resolution.name, ...measured, ...(view === undefined ? {} : { view }), budget, pass: measured.percent <= budget });
  };
  await push("normal");
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
await browser.close();
const pass = rows.every(row => row.pass);
writeFileSync(out!, JSON.stringify({ url, threshold: THRESHOLD, budgets: BUDGETS, pass, rows }, null, 1) + "\n");
for (const row of rows) console.log(`${row.resolution.padEnd(16)} ${`${row.state}${row.view === undefined ? "" : `:${row.view}`}`.padEnd(16)} ${String(row.percent).padStart(5)} % / ${row.budget} % ${row.pass ? "ok" : "OVER"}`);
if (!pass) process.exitCode = 1;
