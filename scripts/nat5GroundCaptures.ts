// NAT-5 ground evidence: the QA round 17 cameras (docs/qa/round17/repro/*.json, window 1600 × 1100) on map 1 of every
// land, the vision checker's two fen views (fen-summer-z1.0 / fen-winter-z1.4, 1600 × 1000, report/light scenes.json)
// and two close views of the riverside's rock (N5-D1). Each is a new game (map 1; one rock view map 5) advanced in Node
// to the QA's tick (no player commands: the ground is what is judged), loaded paused through 이어하기 with the start
// camera set at load (as scripts/nat4WorldCaptures.ts). One JPEG per camera, <id>-<label>.jpg, into <out dir>, and one
// JSON line of what the page read.
//   PLAYWRIGHT_MODULE=... tsx scripts/nat5GroundCaptures.ts <url> <out dir> <label> [camera id ...]
import { refuseHeavyOnMac } from "./remote/localGuard.mjs";
refuseHeavyOnMac("브라우저 캡처(scripts/nat5GroundCaptures.ts)", { remote: "scripts/remote/run.sh render-NAT5-ground-<sha7> -- bash scripts/nat5GroundCaptures.sh …", entry: import.meta.url });
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { closeModals, loadChromium, readSave, TUTORIAL_OFF, type PageWindow } from "./perf/scenePage";
import { encodeSave, saveMetaFor } from "../src/save/saveCodec";
import { advanceTick } from "../src/engine/tick";
import { DEFAULT_SCENARIO_ID } from "../src/content/scenario/coreScenarios";
import { newGameState } from "../src/state/newGame";
import type { GameState } from "../src/engine/engine.types";

const [url, out, label] = [process.argv[2]!, process.argv[3]!, process.argv[4]!];
mkdirSync(out, { recursive: true });
const saves = join(".remote", "nat5-ground-saves"); mkdirSync(saves, { recursive: true });

/** zoom, and the world point (the QA readout's "화면 중심 월드") at the canvas centre. */
type Camera = { readonly id: string; readonly land: string; readonly tick: number; readonly zoom: number; readonly x: number; readonly y: number; readonly height?: number; readonly seed?: number };
const CAMERAS: readonly Camera[] = [
  { id: "river-summer", land: "core:open_field", tick: 1003, zoom: 1.063, x: 128, y: 1448 },
  { id: "river-winter", land: "core:open_field", tick: 3002, zoom: 1.063, x: 128, y: 1448 },
  { id: "coast-summer", land: "core:coastal_port", tick: 1004, zoom: 0.565, x: 128, y: 1195 },
  { id: "coast-winter", land: "core:coastal_port", tick: 3002, zoom: 0.565, x: 128, y: 1195 },
  { id: "chalk-summer", land: "core:chalk_downs", tick: 1004, zoom: 1.332, x: 673, y: 1302 },
  { id: "chalk-winter", land: "core:chalk_downs", tick: 3002, zoom: 1.332, x: 673, y: 1302 },
  { id: "forest-summer", land: "core:forest_edge", tick: 1006, zoom: 1.001, x: 190, y: 1303 },
  { id: "forest-winter", land: "core:forest_edge", tick: 3004, zoom: 1.001, x: 190, y: 1303 },
  { id: "fen-summer", land: "core:fen_drainage", tick: 1004, zoom: 1.101, x: 495, y: 1253 },
  { id: "fen-winter", land: "core:fen_drainage", tick: 3002, zoom: 1.101, x: 495, y: 1253 },
  { id: "fen-summer-vision", land: "core:fen_drainage", tick: 1054, zoom: 1.0, x: 0, y: 1024, height: 1000 },
  { id: "fen-winter-vision", land: "core:fen_drainage", tick: 3070, zoom: 1.4, x: 0, y: 1024, height: 1000 },
  // N5-D1: the riverside's rock up close — map 1's big outcrop (ringed by forest: map 1 has no rock beside the meadow)
  // centred on tile (25, 28), and map 5's rock in the meadow, centred on tile (40, 48).
  { id: "river-rock-forest", land: "core:open_field", tick: 1003, zoom: 1.3, x: (25 - 28) * 32, y: (25 + 28) * 16 },
  { id: "river-rock-grass", land: "core:open_field", tick: 1003, zoom: 1.5, x: (40 - 48) * 32, y: (40 + 48) * 16, seed: 5 },
];
const wanted = new Set(process.argv.slice(5));
const cameras = CAMERAS.filter(camera => wanted.size === 0 || wanted.has(camera.id));

/** A map of the land (map 1 unless the camera names one) advanced in Node to `tick`, as a save file (made once; before and after share it). */
function saveAt(land: string, tick: number, seed: number): string {
  const path = join(saves, `${land.split(":").pop()}-map${seed}-${tick}.save.json`);
  if (existsSync(path)) return path;
  let state = newGameState({ scenarioId: DEFAULT_SCENARIO_ID, archetypeId: land, seed }) as GameState | null;
  if (state === null) throw new Error(`no new game on ${land}`);
  while (state.tick < tick) state = advanceTick(state);
  const at = "2026-10-03T00:00:00.000Z";
  writeFileSync(path, encodeSave({ state, createdAt: at, savedAt: at }).bytes);
  return path;
}

// Over the chapter goal panel: off the world (no hover outline) and out of the edge-scroll band.
const PARK = { x: 80, y: 105 };
const chromium = await loadChromium();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const rows: unknown[] = [];

for (const camera of cameras) {
  const save = saveAt(camera.land, camera.tick, camera.seed ?? 1);
  const viewport = { width: 1600, height: camera.height ?? 1100 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(TUTORIAL_OFF);
  const page = await context.newPage();
  await page.route("**/src/render/canvasRuntime.ts*", async (route: any) => {
    const response = await route.fetch(); const text = await response.text(); const anchor = "const house = startingHouse(state.buildings);";
    if (!text.includes(anchor)) throw new Error("camera anchor changed");
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
  if (await page.locator(".welcome-dismiss-layer").count()) await page.locator(".welcome-dismiss-layer").click();
  if (await page.locator(".pause-menu").count()) await page.keyboard.press("Escape");
  await closeModals(page);
  await page.mouse.move(PARK.x, PARK.y);
  // Time for the sprites, the land art and every visible ground chunk (the DGX rasters in software).
  await page.waitForTimeout(6_000);
  const proof = (expression: string) => page.evaluate(`window.__FEUDAL_PHASE10_PROOF__.${expression}`);
  await page.screenshot({ path: join(out, `${camera.id}-${label}.jpg`), type: "jpeg", quality: 82 });
  rows.push({ id: camera.id, tick: await proof("state().tick"), seed: await proof("state().seed"), zoom: (await proof("diagnosis()") as { camera: { zoom: number } }).camera.zoom });
  await context.close();
}

console.log(JSON.stringify({ url, label, rows }));
await browser.close();
