// NAT-5 install evidence (Wave 41 reworks, scripts/installWave41Rework.py): each replaced picture where the game draws
// it, before and after, at zoom 1.0. The world pictures are found by where they land on screen, not by guessing: an init
// script follows every drawImage of a target picture (by its URL) through the offscreen canvases it goes into (sprite
// mips, ground chunks) to the visible canvas, so a hit is the picture's on-screen rect. A scene opens the whole 64 x 64
// map at zoom 1 in one window (4200 x 2300), paused, as a player loads it (canvasRuntime's start camera, as
// scripts/nat4WorldCaptures.ts); per picture the hit nearest the map centre clear of the HUD is cropped. The "after"
// run writes the chosen crops to <out>/hits.json, the "before" run takes the same rects (same save, same camera).
// The UI pictures: the welcome screen (title keyart), the ledger's rights tab (toll right icon), a chronicle decision
// record (the actual-result icon), each found by the CSS background that carries it.
//   PLAYWRIGHT_MODULE=... tsx scripts/nat5InstallCaptures.ts <url> <out dir> <label>
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/nat5InstallCaptures.ts)", { remote: "scripts/remote/run.sh render-NAT5-installs-<sha7> -- bash scripts/nat5InstallCaptures.sh …", entry: import.meta.url });
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { closeModals, loadChromium, readSave, TUTORIAL_OFF, type PageWindow } from "./perf/scenePage";
import { decodeSave, encodeSave, saveMetaFor } from "../src/save/saveCodec";
import { advanceTick } from "../src/engine/tick";
import type { GameState } from "../src/engine/engine.types";

const [url, out, label] = [process.argv[2]!, process.argv[3]!, process.argv[4]!];
const TOWN = "fixtures/perf-gate/ch4-1380.save.json.gz";
mkdirSync(out, { recursive: true });
const saves = join(".remote", "nat5-saves"); mkdirSync(saves, { recursive: true });

/** The world pictures (URL fragments) the reworks replace. */
const TARGETS = ["bridge_abutment_ne_a", "bridge_abutment_nw_a", "bridge_abutment_se_a", "guildhall-active", "haycock_a", "haycock_b",
  "haycock_c", "haycock_d", "haycock_e", "haycock_f", "orchard_apple_c-", "orchard_apple_d-", "orchard_pear_e-", "orchard_plum_f-",
  "hurdle_straight", "hurdle_end_corner", "farmstead_a", "farmstead_b", "farmstead_working", "farmstead_winter", "chicken_flock_a",
  "hungry_queue", "footprints_dotted_ne", "footprints_dotted_nw"];

// Follows target pictures through offscreen canvases to the visible one (see the header). Each canvas keeps the rects
// (its own pixels) that hold a target; a full clearRect forgets them.
const HOOK = `(() => {
  const TARGETS = ${JSON.stringify(TARGETS)};
  const imageTags = new WeakMap(); const tags = new WeakMap(); const hits = [];
  const sourceTags = (image) => {
    if (typeof HTMLImageElement !== "undefined" && image instanceof HTMLImageElement) {
      if (!imageTags.has(image) || imageTags.get(image).src !== image.src) {
        const target = TARGETS.find(t => image.src.includes(t));
        imageTags.set(image, { src: image.src, list: target === undefined ? null : [{ t: target, x0: 0, y0: 0, x1: image.naturalWidth, y1: image.naturalHeight }] });
      }
      return imageTags.get(image).list;
    }
    return tags.get(image) ?? null;
  };
  const patch = (proto) => {
    if (proto === undefined) return;
    const draw = proto.drawImage; const clear = proto.clearRect;
    proto.drawImage = function (image, ...args) {
      const list = sourceTags(image);
      if (list !== null && list.length > 0) {
        const iw = image.naturalWidth ?? image.width; const ih = image.naturalHeight ?? image.height;
        let sx = 0, sy = 0, sw = iw, sh = ih, dx, dy, dw = iw, dh = ih;
        if (args.length === 2) [dx, dy] = args; else if (args.length === 4) [dx, dy, dw, dh] = args; else [sx, sy, sw, sh, dx, dy, dw, dh] = args;
        const m = this.getTransform(); const canvas = this.canvas;
        const mapped = [];
        for (const tag of list) {
          const x0 = Math.max(tag.x0, sx), y0 = Math.max(tag.y0, sy), x1 = Math.min(tag.x1, sx + sw), y1 = Math.min(tag.y1, sy + sh);
          if (x1 <= x0 || y1 <= y0) continue;
          const corners = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => {
            const px = dx + (x - sx) * dw / sw, py = dy + (y - sy) * dh / sh;
            return [m.a * px + m.c * py + m.e, m.b * px + m.d * py + m.f];
          });
          const xs = corners.map(c => c[0]), ys = corners.map(c => c[1]);
          mapped.push({ t: tag.t, x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) });
        }
        if (typeof HTMLCanvasElement !== "undefined" && canvas instanceof HTMLCanvasElement && canvas.isConnected) {
          for (const rect of mapped) { hits.push({ canvas, at: performance.now(), ...rect }); if (hits.length > 20000) hits.shift(); }
        } else if (mapped.length > 0) {
          const own = tags.get(canvas) ?? []; own.push(...mapped); if (own.length > 4000) own.splice(0, own.length - 4000); tags.set(canvas, own);
        }
      }
      return draw.call(this, image, ...args);
    };
    proto.clearRect = function (x, y, w, h) {
      const m = this.getTransform();
      if (m.a === 1 && m.d === 1 && m.b === 0 && m.c === 0 && x + m.e <= 0 && y + m.f <= 0 && x + m.e + w >= this.canvas.width && y + m.f + h >= this.canvas.height) tags.delete(this.canvas);
      return clear.call(this, x, y, w, h);
    };
  };
  patch(globalThis.CanvasRenderingContext2D?.prototype); patch(globalThis.OffscreenCanvasRenderingContext2D?.prototype);
  // Hits drawn in the last ms, in client px (the canvas may be drawn at a device scale).
  globalThis.__nat5Hits = (ms) => {
    const now = performance.now(); const seen = new Set(); const result = [];
    for (const hit of hits) {
      if (now - hit.at > ms) continue;
      const box = hit.canvas.getBoundingClientRect(); const kx = box.width / hit.canvas.width, ky = box.height / hit.canvas.height;
      const rect = { t: hit.t, x: Math.round(box.left + hit.x0 * kx), y: Math.round(box.top + hit.y0 * ky), width: Math.round((hit.x1 - hit.x0) * kx), height: Math.round((hit.y1 - hit.y0) * ky) };
      const key = rect.t + ":" + rect.x + ":" + rect.y; if (seen.has(key)) continue; seen.add(key); result.push(rect);
    }
    return result;
  };
})();`;

/** The start camera: `zoom`, with world point (x, y) at the canvas centre. */
type Camera = { readonly zoom: number; readonly x: number; readonly y: number };
type Hit = { t: string; x: number; y: number; width: number; height: number };
type Clip = { x: number; y: number; width: number; height: number };

/** The 1380 town advanced in Node to `tick` (the vision checker's city scenes: summer 321050, winter 323035). */
const townAt = (tick: number): string => {
  const path = join(saves, `town-${tick}.save.json`);
  if (existsSync(path)) return path;
  let state = decodeSave(readSave(TOWN)).envelope.state as GameState;
  while (state.tick < tick) state = advanceTick(state);
  const at = "2026-10-03T00:00:00.000Z";
  writeFileSync(path, encodeSave({ state, createdAt: at, savedAt: at }).bytes);
  return path;
};

const PARK = { x: 80, y: 105 };
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });

/** A page with the save loaded through 이어하기 and left paused, the camera set at load (null: the welcome screen). */
async function openPaused(save: string | null, camera: Camera, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(TUTORIAL_OFF);
  await context.addInitScript(HOOK);
  const page = await context.newPage();
  await page.route("**/src/render/canvasRuntime.ts*", async (route: any) => {
    const response = await route.fetch(); const text = await response.text(); const anchor = "const house = startingHouse(state.buildings);";
    if (!text.includes(anchor)) throw new Error("camera anchor changed");
    const start = `return { zoom: ${camera.zoom}, panX: canvas.clientWidth / 2 - ${camera.x * camera.zoom}, panY: canvas.clientHeight / 2 - ${camera.y * camera.zoom} };`;
    await route.fulfill({ response, body: text.replace(anchor, start + anchor) });
  });
  await page.goto(`${url}?phase10-proof=1`, { waitUntil: "load" });
  if (save === null) return { page, context, proof: async () => null };
  const bytes = readSave(save); const meta = saveMetaFor("auto-1", bytes);
  if (meta === null) throw new Error(`${save}: not a save file`);
  await page.evaluate(async ({ base64, meta }: { base64: string; meta: unknown }) => {
    const data = Uint8Array.from(atob(base64), char => char.charCodeAt(0));
    const db: IDBDatabase = await new Promise((resolve, reject) => { const request = indexedDB.open("feudal-lord-simulator-saves", 1);
      request.onupgradeneeded = () => { for (const store of ["slots", "meta"]) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store); };
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => { const tx = db.transaction(["slots", "meta"], "readwrite");
      tx.objectStore("slots").put(data.buffer, "auto-1"); tx.objectStore("meta").put(meta, "auto-1");
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  }, { base64: Buffer.from(bytes).toString("base64"), meta });
  await page.reload({ waitUntil: "load" });
  await page.getByRole("button", { name: "이어하기" }).first().click({ timeout: 60_000 });
  await page.waitForFunction(() => (window as unknown as PageWindow).__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 120_000 });
  await page.waitForTimeout(2_000);
  if (await page.locator(".welcome-dismiss-layer").count()) await page.locator(".welcome-dismiss-layer").click();
  if (await page.locator(".pause-menu").count()) await page.keyboard.press("Escape");
  await closeModals(page);
  await page.mouse.move(PARK.x, PARK.y);
  await page.waitForTimeout(6_000);
  const proof = (expression: string) => page.evaluate(`window.__FEUDAL_PHASE10_PROOF__.${expression}`);
  return { page, context, proof };
}

const shot = (page: any, name: string, region?: Clip, quality = 88) =>
  page.screenshot({ path: join(out, `${name}-${label}.jpg`), type: "jpeg", quality, ...(region === undefined ? {} : { clip: region }) });
const hitsFile = join(out, "hits.json");
const chosen: Record<string, Clip & { scene: string; hits: number }> = label === "before" && existsSync(hitsFile) ? JSON.parse(readFileSync(hitsFile, "utf8")) : {};
const report: Record<string, unknown> = { url, label };

// The whole map at zoom 1: x from -2048 to 2048, y from 0 to 2048 (plus building height), centred on (0, 1000).
const MAP_VIEW = { width: 4200, height: 2300 };
for (const [scene, tick] of [["summer", 321050], ["winter", 323035]] as const) {
  const { page, context, proof } = await openPaused(townAt(tick), { zoom: 1, x: 0, y: 1000 }, MAP_VIEW);
  const hits = await page.evaluate("globalThis.__nat5Hits(4000)") as Hit[];
  const counts: Record<string, number> = {};
  for (const hit of hits) counts[hit.t] = (counts[hit.t] ?? 0) + 1;
  report[scene] = { tick: await proof("state().tick"), zoom: (await proof("diagnosis()") as { camera: { zoom: number } }).camera.zoom, counts };
  if (label !== "before") {
    for (const target of TARGETS) {
      if (chosen[target] !== undefined) continue;
      // Clear of the HUD (top bar, side panels, dock) and of the window edge; nearest the map centre.
      const fit = hits.filter(hit => hit.t === target && hit.x > 120 && hit.y > 160 && hit.x + hit.width < MAP_VIEW.width - 480 && hit.y + hit.height < MAP_VIEW.height - 220)
        .sort((a, b) => Math.hypot(a.x - 2100, a.y - 1150) - Math.hypot(b.x - 2100, b.y - 1150));
      const hit = fit[0];
      if (hit === undefined) continue;
      const width = Math.max(200, Math.round(hit.width * 3)); const height = Math.max(150, Math.round(hit.height * 2.6));
      chosen[target] = { scene, hits: counts[target] ?? 0, x: Math.round(hit.x + hit.width / 2 - width / 2), y: Math.round(hit.y + hit.height * 0.55 - height / 2), width, height };
    }
  }
  for (const [target, clip] of Object.entries(chosen)) if (clip.scene === scene) await shot(page, `world-${target.replace(/[-_]$/, "")}`, { x: clip.x, y: clip.y, width: clip.width, height: clip.height });
  if (process.env.NAT5_FULL === "1") await shot(page, `map-${scene}`, undefined, 40);
  await context.close();
}
if (label !== "before") writeFileSync(hitsFile, JSON.stringify(chosen, null, 1));
report.chosen = Object.fromEntries(Object.entries(chosen).map(([target, clip]) => [target, clip.scene]));
report.missing = TARGETS.filter(target => chosen[target] === undefined);

/** The client rect of the first element whose computed background carries `fragment` (null: none on screen). */
const backgroundRect = (page: any, fragment: string) => page.evaluate((needle: string) => {
  for (const node of document.querySelectorAll<HTMLElement>("*")) {
    if (!getComputedStyle(node).backgroundImage.includes(needle)) continue;
    const box = node.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) return { x: box.left, y: box.top, width: box.width, height: box.height };
  }
  return null;
}, fragment) as Promise<Clip | null>;
const around = (box: Clip, width: number, height: number, view: { width: number; height: number }): Clip => ({
  x: Math.max(0, Math.min(view.width - width, Math.round(box.x + box.width / 2 - width / 2))),
  y: Math.max(0, Math.min(view.height - height, Math.round(box.y + box.height / 2 - height / 2))), width, height });
const VIEW = { width: 1600, height: 1100 };

// The title keyart: the welcome screen as the game opens (no save).
{
  const { page, context } = await openPaused(null, { zoom: 1, x: 0, y: 1000 }, { width: 1600, height: 900 });
  await page.waitForTimeout(4_000);
  await shot(page, "ui-title", undefined, 70);
  report.title = await backgroundRect(page, "keyart_title_bg");
  await context.close();
}

// The toll right's icon: the ledger's rights tab (권리), the 1380 town in summer.
{
  const { page, context } = await openPaused(townAt(321050), { zoom: 1, x: 0, y: 1000 }, VIEW);
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(600);
  await page.locator("[data-ledger-tab='rights']").first().click(); await page.waitForTimeout(900);
  const icon = await backgroundRect(page, "icon_right_toll");
  report.toll = icon;
  if (icon !== null) await shot(page, "ui-rights-toll", around(icon, 420, 160, VIEW));
  // The chronicle: decision records until one shows the actual-result icon.
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  await page.locator("[data-dock='ledger']").first().click(); await page.waitForTimeout(600);
  await page.locator(".ledger-tab--chronicle").first().click(); await page.waitForTimeout(1_500);
  let actual: Clip | null = null; let tried = 0;
  for (; tried < 24 && actual === null; tried += 1) {
    const cards = page.locator(".chronicle-card[data-kind='decision'] .chronicle-card-body");
    if (await cards.count() <= tried) break;
    await cards.nth(tried).click(); await page.waitForTimeout(700);
    actual = await backgroundRect(page, "icon_actual");
  }
  report.actual = { icon: actual, tried };
  if (actual !== null) await shot(page, "ui-chronicle-actual", around(actual, 520, 220, VIEW));
  await context.close();
}

console.log(JSON.stringify(report));
await browser.close();
