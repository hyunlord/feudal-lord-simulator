// NAT-4 world evidence (walls, walkers, trees, people's size), paused scenes loaded as a player loads them, the camera
// set exactly at load (canvasRuntime's start camera, as scripts/nat2ForestCaptures.ts). Each section writes small JPEGs
// named <section>-<what>-<label>.jpg into <out dir> and one JSON line of what it read from the page.
//  - qa005: Astra's wall14 Roger scene (QA camera zoom 2, (544, −2277)) at ticks 320041–320047, the fixture advanced in
//    Node to each tick (the simulation is deterministic: her 320165 readout matches), the NW corner (39, 41), Roger
//    unselected and selected (a click on his tile).
//  - qa003: the same town at t320000, the QA-003 camera, the gate (47, 42) and its arms at zoom 2.
//  - zoom: the art audit's population-176 frame (1440 × 960, centre (128, 1413.5)) at zoom 0.5, 1.0 and 1.4.
//  - trees: the 1380 town's densest forest (NAT-2's forest camera) at zoom 2.
//   PLAYWRIGHT_MODULE=... tsx scripts/nat4WorldCaptures.ts <url> <out dir> <label> [section ...]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/nat4WorldCaptures.ts)", { remote: "scripts/remote/run.sh render-NAT4-world-<sha7> -- node_modules/.bin/tsx scripts/nat4WorldCaptures.ts …", entry: import.meta.url });
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { closeModals, loadChromium, readSave, TUTORIAL_OFF, type PageWindow } from "./perf/scenePage";
import { decodeSave, encodeSave, saveMetaFor } from "../src/save/saveCodec";
import { advanceTick } from "../src/engine/tick";
import type { GameState } from "../src/engine/engine.types";

const [url, out, label] = [process.argv[2]!, process.argv[3]!, process.argv[4]!];
const sections = new Set(process.argv.slice(5).length > 0 ? process.argv.slice(5) : ["qa005", "qa003", "zoom", "trees"]);
const TOWN = "fixtures/perf-gate/ch4-1380.save.json.gz";
const POP176 = "fixtures/saves/v41/population-176.save.json";
const ROGER = "carter:construction-site-000048:319813";
mkdirSync(out, { recursive: true });
const saves = join(".remote", "nat4-saves"); mkdirSync(saves, { recursive: true });

/** The start camera: `zoom`, with world point (x, y) (world px, the QA readout's "화면 중심 월드") at the canvas centre. */
type Camera = { readonly zoom: number; readonly x: number; readonly y: number };
/** The camera centred on tile-centre point (tx, ty). */
const cameraOn = (tx: number, ty: number, zoom: number): Camera => ({ zoom, x: (tx - ty) * 32, y: (tx + ty) * 16 });

/** The 1380 town advanced in Node to `tick`, as a save file (null: the fixture as it is). */
const townAt = (tick: number | null): string => {
  if (tick === null) return TOWN;
  let state = decodeSave(readSave(TOWN)).envelope.state as GameState;
  while (state.tick < tick) state = advanceTick(state);
  const at = "2026-10-02T00:00:00.000Z";
  const path = join(saves, `town-${tick}.save.json`);
  writeFileSync(path, encodeSave({ state, createdAt: at, savedAt: at }).bytes);
  return path;
};

// Where the pointer rests: over the chapter goal panel (top left), off the world (no hover outline) and out of the
// edge-scroll band (a pointer at the window's edge scrolls the camera).
const PARK = { x: 80, y: 105 };
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });

/** A page with the save loaded through 이어하기 and left paused (the store pauses on load), the camera set at load. */
async function openPaused(save: string, camera: Camera, viewport: { width: number; height: number }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(TUTORIAL_OFF);
  const page = await context.newPage();
  await page.route("**/src/render/canvasRuntime.ts*", async (route: any) => {
    const response = await route.fetch(); const text = await response.text(); const anchor = "const house = startingHouse(state.buildings);";
    if (!text.includes(anchor)) throw new Error("camera anchor changed");
    // Relative to the canvas as it is then (the start camera is computed again when the canvas takes its size).
    const start = `return { zoom: ${camera.zoom}, panX: canvas.clientWidth / 2 - ${camera.x * camera.zoom}, panY: canvas.clientHeight / 2 - ${camera.y * camera.zoom} };`;
    await route.fulfill({ response, body: text.replace(anchor, start + anchor) });
  });
  await page.goto(`${url}?phase10-proof=1`, { waitUntil: "load" });
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
  await page.waitForFunction(() => (window as unknown as PageWindow).__FEUDAL_PHASE10_PROOF__ !== undefined, null, { timeout: 90_000 });
  await page.waitForTimeout(2_000);
  if (await page.locator(".welcome-dismiss-layer").count()) await page.locator(".welcome-dismiss-layer").click({ position: { x: 20, y: 20 } });
  if (await page.locator(".pause-menu").count()) await page.keyboard.press("Escape");
  await closeModals(page);
  // The pointer at rest (PARK), then time for the sprites and ground chunks.
  await page.mouse.move(PARK.x, PARK.y);
  await page.waitForTimeout(3_000);
  const proof = (expression: string) => page.evaluate(`window.__FEUDAL_PHASE10_PROOF__.${expression}`);
  return { page, context, proof };
}

const clip = (at: { clientX: number; clientY: number }, size: { width: number; height: number }, view: { width: number; height: number }) => ({
  x: Math.max(0, Math.min(view.width - size.width, Math.round(at.clientX - size.width / 2))),
  y: Math.max(0, Math.min(view.height - size.height, Math.round(at.clientY - size.height * 0.6))), ...size });
const shot = (page: any, name: string, region?: object, quality = 80) =>
  page.screenshot({ path: join(out, `${name}-${label}.jpg`), type: "jpeg", quality, ...(region === undefined ? {} : { clip: region }) });
const VIEW = { width: 1600, height: 1100 };
// Astra's wall14 camera: zoom 2, pan (544, −2277), world centre (128, 1414).
const QA_CAMERA: Camera = { zoom: 2, x: 128, y: 1414 };
const report: Record<string, unknown> = { url, label };

if (sections.has("qa005")) {
  const rows: unknown[] = [];
  for (const tick of (process.env.NAT4_TICKS ?? "320041,320043,320044,320045,320046,320047").split(",").map(Number)) {
    const { page, context, proof } = await openPaused(townAt(tick), QA_CAMERA, VIEW);
    const roger = await proof(`state().walkers.find(w => w.id === ${JSON.stringify(ROGER)})`) as { position: { tx: number; ty: number } } | undefined;
    const corner = await proof("tileClientPoint({ tx: 38.5, ty: 40.5 })") as { clientX: number; clientY: number };
    const region = clip(corner, { width: 360, height: 300 }, VIEW);
    if (process.env.NAT4_FULL === "1") await shot(page, `qa005-t${tick}-full`, undefined, 50);
    await shot(page, `qa005-t${tick}`, region);
    let selected = false;
    if (roger !== undefined) {
      // Selection picks the walker whose foot (walkerVisualAnchor) falls on the clicked tile.
      const foot = { tx: Math.round(roger.position.tx + 0.18), ty: Math.round(roger.position.ty + 0.18) };
      const at = await proof(`tileClientPoint(${JSON.stringify(foot)})`) as { clientX: number; clientY: number };
      await page.mouse.click(at.clientX, at.clientY); await page.mouse.move(PARK.x, PARK.y); await page.waitForTimeout(800);
      selected = await page.getByText("로저", { exact: false }).count() > 0;
      await shot(page, `qa005-t${tick}-selected`, region);
    }
    const camera = (await proof("diagnosis()") as { camera: { zoom: number } }).camera;
    rows.push({ tick: await proof("state().tick"), roger: roger?.position ?? null, selected, corner, zoom: camera.zoom });
    await context.close();
  }
  report.qa005 = rows;
}

if (sections.has("qa003")) {
  const { page, context, proof } = await openPaused(townAt(null), QA_CAMERA, VIEW);
  const at = await proof("tileClientPoint({ tx: 45.5, ty: 41.5 })") as { clientX: number; clientY: number };
  await shot(page, "qa003-gate-z2", clip(at, { width: 520, height: 340 }, VIEW));
  const near = await proof("tileClientPoint({ tx: 44.5, ty: 41.5 })") as { clientX: number; clientY: number };
  await shot(page, "qa003-seg000-z2", clip(near, { width: 300, height: 220 }, VIEW), 88);
  report.qa003 = { tick: await proof("state().tick") };
  await context.close();
}

if (sections.has("zoom")) {
  const view = { width: 1440, height: 960 };
  const rows: unknown[] = [];
  for (const zoom of [0.5, 1.0, 1.4]) {
    const { page, context, proof } = await openPaused(POP176, { zoom, x: 128, y: 1413.5 }, view);
    await shot(page, `zoom-${zoom.toFixed(1)}`, undefined, 62);
    rows.push({ zoom: (await proof("diagnosis()") as { camera: { zoom: number } }).camera.zoom, tick: await proof("state().tick") });
    await context.close();
  }
  report.zoom = rows;
}

if (sections.has("trees")) {
  const { page, context } = await openPaused(townAt(null), cameraOn(47, 11, 2), VIEW);
  await shot(page, "trees-forest-z2", { x: 500, y: 300, width: 600, height: 460 });
  await context.close();
}

console.log(JSON.stringify(report));
await browser.close();
